const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const {
  getProductDisplayName,
  normalizeArticle,
  normalizeText
} = require("../utils/stockImport");

const deriveProductIdentity = ({ brand, articleNumber, name }) => {
  const cleanBrand = normalizeText(brand);
  const cleanArticleNumber = normalizeArticle(articleNumber);

  if (cleanBrand || cleanArticleNumber) {
    return {
      brand: cleanBrand || "Unknown",
      articleNumber: cleanArticleNumber || "NA"
    };
  }

  const legacyName = name?.trim() || "";
  const separatorMatch = legacyName.match(/^(.+?)[-\s]+([A-Za-z0-9]+)$/);

  if (separatorMatch) {
    return {
      brand: normalizeText(separatorMatch[1]),
      articleNumber: normalizeArticle(separatorMatch[2])
    };
  }

  return {
    brand: normalizeText(legacyName),
    articleNumber: "NA"
  };
};

const getTotalSizeQuantity = (sizes = []) =>
  Array.isArray(sizes)
    ? sizes.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;

const normalizeProductPayload = ({
  brand,
  articleNumber,
  name,
  color,
  purchasePrice,
  quantity,
  sizes
}) => {
  const price = Number(purchasePrice);
  const stockQuantity = quantity ?? getTotalSizeQuantity(sizes);
  const normalizedQuantity = Number(stockQuantity);
  const identity = deriveProductIdentity({ brand, articleNumber, name });
  const normalizedColor = normalizeText(color);

  if (!identity.brand?.trim()) {
    return { error: "Brand is required" };
  }

  if (!identity.articleNumber?.trim()) {
    return { error: "Article number is required" };
  }

  if (!normalizedColor) {
    return { error: "Color is required" };
  }

  if (Number.isNaN(price) || price < 0) {
    return { error: "Purchase price cannot be negative" };
  }

  if (
    Number.isNaN(normalizedQuantity) ||
    normalizedQuantity < 0 ||
    !Number.isInteger(normalizedQuantity)
  ) {
    return { error: "Quantity must be a whole number and cannot be negative" };
  }

  return {
    product: {
      brand: identity.brand,
      articleNumber: identity.articleNumber,
      name: getProductDisplayName(identity),
      color: normalizedColor,
      purchasePrice: price,
      quantity: normalizedQuantity,
      ...(Array.isArray(sizes) ? { sizes } : {})
    }
  };
};

router.post("/", async (req, res) => {
  try {
    const { product: payload, error } = normalizeProductPayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const product = await Product.create(payload);

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const products = await Product.find();

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.post("/migrate-legacy", async (req, res) => {
  try {
    const products = await Product.find({
      $or: [
        { brand: { $exists: false } },
        { brand: "" },
        { articleNumber: { $exists: false } },
        { articleNumber: "" }
      ]
    });

    for (const product of products) {
      const identity = deriveProductIdentity({
        brand: product.brand,
        articleNumber: product.articleNumber,
        name: product.name
      });

      product.brand = identity.brand;
      product.articleNumber = identity.articleNumber;
      product.name = getProductDisplayName(identity);
      await product.save();
    }

    res.json({
      message: "Legacy products migrated",
      migrated: products.length
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { product: payload, error } = normalizeProductPayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product deleted"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
