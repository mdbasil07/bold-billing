const express = require("express");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

const Product = require("../models/Product");
const ImportHistory = require("../models/ImportHistory");
const {
  getProductDisplayName,
  normalizeImportRow,
  parseStockCsvDetailed,
  parseStockTextDetailed
} = require("../utils/stockImport");

const router = express.Router();

let multer = null;
try {
  multer = require("multer");
} catch {
  multer = null;
}

const upload = multer
  ? multer({
      dest: path.join(os.tmpdir(), "bold-billing-ocr"),
      limits: {
        fileSize: 8 * 1024 * 1024
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "text/csv",
          "application/csv",
          "application/vnd.ms-excel"
        ];
        const isCsvName = path.extname(file.originalname).toLowerCase() === ".csv";

        if (!allowedTypes.includes(file.mimetype) && !isCsvName) {
          cb(new Error("Only jpg, jpeg, png and csv files are supported"));
          return;
        }

        cb(null, true);
      }
    })
  : null;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findExistingProduct = async ({ brand, articleNumber, color }) =>
  Product.findOne({
    brand: new RegExp(`^${escapeRegex(brand)}$`, "i"),
    articleNumber: new RegExp(`^${escapeRegex(articleNumber)}$`, "i"),
    color: new RegExp(`^${escapeRegex(color)}$`, "i")
  });

const scanImage = async (filePath) => {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "Google Vision API key is missing"
    );
    error.statusCode = 503;
    throw error;
  }

  const imageBuffer = await fs.promises.readFile(filePath);
  const base64Image = imageBuffer.toString("base64");

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: "TEXT_DETECTION"
              }
            ]
          }
        ]
      }
    );

    return response.data?.responses?.[0]?.fullTextAnnotation?.text || "";
  } catch (error) {
    const ocrError = new Error("Google Vision OCR failed");
    ocrError.statusCode = error.response?.status || 502;
    throw ocrError;
  }
};

router.post(
  "/image",
  upload
    ? upload.single("image")
    : (req, res) =>
        res.status(503).json({
          message: "File upload dependency is not installed. Run npm install in the server folder."
        }),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Upload a jpg, jpeg, png or csv file" });
    }

    try {
      const isCsv =
        req.file.mimetype === "text/csv" ||
        req.file.mimetype === "application/csv" ||
        req.file.mimetype === "application/vnd.ms-excel" ||
        path.extname(req.file.originalname).toLowerCase() === ".csv";
      const text = isCsv
        ? await fs.promises.readFile(req.file.path, "utf8")
        : await scanImage(req.file.path);
      const parsed = isCsv
        ? parseStockCsvDetailed(text)
        : parseStockTextDetailed(text);

      console.log(isCsv ? "========== CSV RAW TEXT ==========" : "========== OCR RAW TEXT ==========");
      console.log(text);
      console.log("==================================");

      res.json({
        rawText: text,
        normalizedText: parsed.normalizedText,
        parserErrors: parsed.parserErrors,
        rows: parsed.rows,
        imageName: req.file.originalname
      });
    } catch (error) {
      if (error.message === "Google Vision OCR failed") {
        return res.status(error.statusCode || 502).json({
          error: "Google Vision OCR failed"
        });
      }

      res.status(error.statusCode || 500).json({
        message: error.message || "Unable to scan stock image"
      });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  }
);

router.post("/confirm", async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : req.body.rows;
    const imageName = Array.isArray(req.body)
      ? "Manual confirmation"
      : req.body.imageName || "Manual confirmation";

    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ message: "No stock rows supplied for import" });
    }

    const newRows = [];
    const errors = [];
    let productsSkipped = 0;
    const seenRows = new Set();

    for (const [index, row] of rows.entries()) {
      const { row: normalizedRow, error } = normalizeImportRow(row);

      if (error) {
        errors.push({ row: index + 1, message: error });
        continue;
      }

      const rowKey = [
        normalizedRow.brand,
        normalizedRow.articleNumber,
        normalizedRow.color
      ].join("|");

      if (seenRows.has(rowKey)) {
        errors.push({ row: index + 1, message: "Duplicate product row in import" });
        continue;
      }

      seenRows.add(rowKey);

      const existingProduct = await findExistingProduct(normalizedRow);

      if (existingProduct) {
        productsSkipped += 1;
        continue;
      }

      const purchasePrice = Number(row.purchasePrice);
      const quantity = Number(normalizedRow.quantity);

      if (!purchasePrice || Number.isNaN(purchasePrice) || purchasePrice <= 0) {
        errors.push({
          row: index + 1,
          message: "Purchase price is required and must be greater than 0"
        });
        continue;
      }

      newRows.push({
        ...normalizedRow,
        purchasePrice,
        quantity
      });
    }

    if (errors.length) {
      return res.status(400).json({
        message: "Fix invalid rows before confirming import",
        errors
      });
    }

    let productsCreated = 0;

    for (const row of newRows) {
      const payload = {
        brand: row.brand,
        articleNumber: row.articleNumber,
        name: getProductDisplayName(row),
        color: row.color,
        purchasePrice: row.purchasePrice,
        quantity: row.quantity
      };

      await Product.create(payload);
      productsCreated += 1;
    }

    const history = await ImportHistory.create({
      imageName,
      productsCreated,
      productsUpdated: 0,
      productsSkipped
    });

    res.status(201).json({
      message: "Stock import completed",
      productsCreated,
      productsUpdated: 0,
      productsSkipped,
      rowsWithErrors: errors.length,
      errors,
      history
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Unable to confirm stock import"
    });
  }
});

router.get("/history", async (req, res) => {
  try {
    const history = await ImportHistory.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Unable to load import history"
    });
  }
});

module.exports = router;
