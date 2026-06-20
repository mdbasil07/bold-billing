const STANDARD_SIZES = [6, 7, 8, 9, 10, 11, 12];

const normalizeText = (value) => String(value || "").trim().toUpperCase();

const normalizeArticle = (value) => String(value || "").trim().toUpperCase();

const getProductDisplayName = (product) =>
  `${normalizeText(product.brand)}-${normalizeArticle(product.articleNumber)}`;

const isStandardSize = (size) => STANDARD_SIZES.includes(Number(size));

const sizesArrayToObject = (sizes = []) => {
  const sizeMap = STANDARD_SIZES.reduce((acc, size) => {
    acc[size] = 0;
    return acc;
  }, {});

  sizes.forEach((item) => {
    const size = Number(item.size);
    const quantity = Number(item.quantity);

    if (isStandardSize(size) && Number.isInteger(quantity) && quantity >= 0) {
      sizeMap[size] = quantity;
    }
  });

  return sizeMap;
};

const sizesObjectToArray = (sizes = {}) =>
  STANDARD_SIZES.map((size) => ({
    size,
    quantity: Number(sizes[size] ?? sizes[String(size)] ?? 0)
  }));

const normalizeSizesArray = (sizes = []) => {
  if (!Array.isArray(sizes) || !sizes.length) {
    return { error: "Add stock for sizes 6 to 12" };
  }

  const groupedSizes = STANDARD_SIZES.reduce((acc, size) => {
    acc[size] = 0;
    return acc;
  }, {});

  for (const item of sizes) {
    const size = Number(item.size);
    const quantity = Number(item.quantity);

    if (!isStandardSize(size)) {
      return { error: "Only shoe sizes 6, 7, 8, 9, 10, 11 and 12 are allowed" };
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return { error: "Stock quantities must be whole numbers and cannot be negative" };
    }

    groupedSizes[size] = quantity;
  }

  return { sizes: sizesObjectToArray(groupedSizes) };
};

const normalizeImportRow = (row) => {
  const brand = normalizeText(row.brand);
  const articleNumber = normalizeArticle(row.articleNumber);
  const color = normalizeText(row.color);
  const sizes = row.sizes || {};
  const quantity =
    row.quantity ?? Object.values(sizes).reduce((sum, value) => sum + Number(value || 0), 0);
  const normalizedQuantity = Number(quantity);

  if (!brand) {
    return { error: "Brand is required" };
  }

  if (!articleNumber) {
    return { error: "Article is required" };
  }

  if (!color) {
    return { error: "Color is required" };
  }

  if (
    Number.isNaN(normalizedQuantity) ||
    normalizedQuantity < 0 ||
    !Number.isInteger(normalizedQuantity)
  ) {
    return { error: "Quantity must be a whole number and cannot be negative" };
  }

  return {
    row: {
      brand,
      articleNumber,
      color,
      quantity: normalizedQuantity,
      sizes
    }
  };
};

const normalizeOcrText = (text) =>
  String(text || "")
    .toUpperCase()
    .replace(/\u00a6/g, "|")
    .replace(/[\\:;,]+/g, "/")
    .replace(/[^\S\r\n]*[|/][^\S\r\n]*/g, "/")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\/+/g, "/")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .join("\n");

const splitCompactStockToken = (token) =>
  String(token || "")
    .replace(/\D/g, "")
    .split("")
    .map(Number);

const buildStockValues = (stockTokens) => {
  let values = stockTokens
    .map((token) => String(token || "").replace(/\D/g, ""))
    .filter(Boolean);

  if (values.length < STANDARD_SIZES.length) {
    values = values.flatMap((value) =>
      value.length > 1 ? splitCompactStockToken(value) : [Number(value)]
    );
  } else {
    values = values.map(Number);
  }

  return values.slice(0, STANDARD_SIZES.length);
};

const parseDelimitedLine = (line) => {
  const segments = line.split("/").map((part) => part.trim()).filter(Boolean);

  if (segments.length < 4) {
    return { error: "Not enough separated fields" };
  }

  const [brand, articleNumber, ...remainingSegments] = segments;
  const colorParts = [];
  let purchasePrice = "";
  let stockStartIndex = -1;

  for (let index = 0; index < remainingSegments.length; index += 1) {
    const segment = remainingSegments[index];
    const combinedMatch = segment.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);

    if (combinedMatch) {
      colorParts.push(combinedMatch[1]);
      purchasePrice = combinedMatch[2];
      stockStartIndex = index + 1;
      break;
    }

    if (/^\d+(?:\.\d+)?$/.test(segment)) {
      purchasePrice = segment;
      stockStartIndex = index + 1;
      break;
    }

    colorParts.push(segment);
  }

  if (!purchasePrice) {
    return { error: "Purchase price not found" };
  }

  const stockValues = buildStockValues(remainingSegments.slice(stockStartIndex));

  if (stockValues.length < STANDARD_SIZES.length) {
    return { error: "Could not find stock quantities for sizes 6 to 12" };
  }

  return {
    row: {
      brand,
      articleNumber,
      color: colorParts.join(" "),
      purchasePrice: Number(purchasePrice),
      sizes: STANDARD_SIZES.reduce((acc, size, index) => {
        acc[size] = stockValues[index];
        return acc;
      }, {})
    }
  };
};

const parseFallbackLine = (line) => {
  const tokens = line
    .replace(/\//g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const articleIndex = tokens.findIndex(
    (token, index) =>
      index > 0 &&
      /^[A-Z0-9-]*\d[A-Z0-9-]*$/.test(token) &&
      token.length >= 3
  );

  if (articleIndex < 1) {
    return { error: "Article number not found" };
  }

  const priceIndex = tokens.findIndex(
    (token, index) => index > articleIndex && /^\d+(?:\.\d+)?$/.test(token)
  );

  if (priceIndex <= articleIndex + 1) {
    return { error: "Color or purchase price not found" };
  }

  const stockValues = buildStockValues(tokens.slice(priceIndex + 1));

  if (stockValues.length < STANDARD_SIZES.length) {
    return { error: "Could not find stock quantities for sizes 6 to 12" };
  }

  return {
    row: {
      brand: tokens.slice(0, articleIndex).join(" "),
      articleNumber: tokens[articleIndex],
      color: tokens.slice(articleIndex + 1, priceIndex).join(" "),
      purchasePrice: Number(tokens[priceIndex]),
      sizes: STANDARD_SIZES.reduce((acc, size, index) => {
        acc[size] = stockValues[index];
        return acc;
      }, {})
    }
  };
};

const parseStockTextDetailed = (text) => {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = [];
  const parserErrors = [];

  for (const line of lines) {
    const headerLine = line.replace(/\//g, " ");

    if (
      headerLine.includes("BRAND") &&
      headerLine.includes("ARTICLE") &&
      headerLine.includes("COLOR")
    ) {
      continue;
    }

    const parsed = line.includes("/") ? parseDelimitedLine(line) : parseFallbackLine(line);
    const fallbackParsed = parsed.error ? parseFallbackLine(line) : parsed;

    if (fallbackParsed.error) {
      parserErrors.push({
        line,
        reason: fallbackParsed.error
      });
      continue;
    }

    const { row, error } = normalizeImportRow(fallbackParsed.row);

    if (error) {
      parserErrors.push({
        line,
        reason: error
      });
      rows.push({ ...fallbackParsed.row, error });
      continue;
    }

    rows.push({
      ...row,
      purchasePrice: fallbackParsed.row.purchasePrice
    });
  }

  if (!rows.length && !parserErrors.length) {
    parserErrors.push({
      line: "",
      reason: "No product rows found in OCR text"
    });
  }

  return {
    normalizedText,
    rows,
    parserErrors
  };
};

const parseStockText = (text) => parseStockTextDetailed(text).rows;

const parseCsvRecords = (text) => {
  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < String(text || "").length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      record.push(field.trim());
      if (record.some(Boolean)) {
        records.push(record);
      }
      record = [];
      field = "";
      continue;
    }

    field += char;
  }

  record.push(field.trim());
  if (record.some(Boolean)) {
    records.push(record);
  }

  return records;
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getCsvValue = (row, headerMap, candidates, fallbackIndex) => {
  const headerKey = candidates.find((candidate) =>
    Object.prototype.hasOwnProperty.call(headerMap, candidate)
  );

  if (headerKey) {
    return row[headerMap[headerKey]] || "";
  }

  return row[fallbackIndex] || "";
};

const parseStockCsvDetailed = (text) => {
  const records = parseCsvRecords(text);
  const rows = [];
  const parserErrors = [];

  if (!records.length) {
    return {
      normalizedText: "",
      rows,
      parserErrors: [{ line: "", reason: "CSV file is empty" }]
    };
  }

  const firstRecord = records[0];
  const firstHeader = normalizeHeader(firstRecord[0]);
  const hasHeader =
    firstRecord.some((value) =>
      ["brand", "article", "articlenumber", "color", "purchaseprice"].includes(
        normalizeHeader(value)
      )
    ) || firstHeader === "brand";
  const headerMap = hasHeader
    ? firstRecord.reduce((acc, value, index) => {
        acc[normalizeHeader(value)] = index;
        return acc;
      }, {})
    : {};
  const dataRecords = hasHeader ? records.slice(1) : records;

  dataRecords.forEach((record, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const brand = getCsvValue(record, headerMap, ["brand", "name"], 0);
    const articleNumber = getCsvValue(
      record,
      headerMap,
      ["articlenumber", "article", "artno", "style", "stylecode"],
      1
    );
    const color = getCsvValue(record, headerMap, ["color", "colour"], 2);
    const purchasePrice = getCsvValue(
      record,
      headerMap,
      ["purchaseprice", "purchase", "cost", "price"],
      3
    );
    const quantityHeader = ["quantity", "qty", "stock", "totalquantity", "totalstock"].find(
      (candidate) => Object.prototype.hasOwnProperty.call(headerMap, candidate)
    );
    const explicitQuantity = quantityHeader ? record[headerMap[quantityHeader]] || "" : "";
    const sizes = STANDARD_SIZES.reduce((acc, size, sizeIndex) => {
      const headerCandidates = [
        `size${size}`,
        `s${size}`,
        String(size),
        `qty${size}`,
        `quantity${size}`
      ];
      acc[size] = Number(getCsvValue(record, headerMap, headerCandidates, 4 + sizeIndex) || 0);
      return acc;
    }, {});
    const parsedRow = {
      brand,
      articleNumber,
      color,
      purchasePrice: Number(purchasePrice),
      quantity: explicitQuantity === "" ? undefined : Number(explicitQuantity),
      sizes
    };
    const { row, error } = normalizeImportRow(parsedRow);

    if (error) {
      parserErrors.push({
        line: `CSV row ${lineNumber}`,
        reason: error
      });
      rows.push({ ...parsedRow, error });
      return;
    }

    if (
      !Number(parsedRow.purchasePrice) ||
      Number.isNaN(parsedRow.purchasePrice) ||
      parsedRow.purchasePrice <= 0
    ) {
      parserErrors.push({
        line: `CSV row ${lineNumber}`,
        reason: "Purchase price is required and must be greater than 0"
      });
      rows.push({
        ...row,
        purchasePrice: parsedRow.purchasePrice || "",
        error: "Purchase price is required and must be greater than 0"
      });
      return;
    }

    rows.push({
      ...row,
      purchasePrice: parsedRow.purchasePrice
    });
  });

  if (!rows.length && !parserErrors.length) {
    parserErrors.push({
      line: "",
      reason: "No product rows found in CSV"
    });
  }

  return {
    normalizedText: records.map((record) => record.join(" / ")).join("\n"),
    rows,
    parserErrors
  };
};

module.exports = {
  STANDARD_SIZES,
  getProductDisplayName,
  isStandardSize,
  normalizeArticle,
  normalizeImportRow,
  normalizeOcrText,
  normalizeSizesArray,
  normalizeText,
  parseStockCsvDetailed,
  parseStockText,
  parseStockTextDetailed,
  sizesArrayToObject,
  sizesObjectToArray
};
