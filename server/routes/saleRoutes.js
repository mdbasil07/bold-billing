const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Sale = require("../models/Sale");
const { isStandardSize } = require("../utils/stockImport");

const getProductName = (product) =>
  product.brand && product.articleNumber
    ? `${product.brand}-${product.articleNumber}`
    : product.name;

const getProductQuantity = (product) =>
  product.quantity ?? product.sizes.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const reduceProductQuantity = (product, quantity) => {
  const currentQuantity = getProductQuantity(product);

  if (currentQuantity < quantity) {
    return false;
  }

  product.quantity = currentQuantity - quantity;
  return true;
};

const restoreProductQuantity = (product, quantity) => {
  product.quantity = getProductQuantity(product) + quantity;
};

const buildSalesFilter = (query) => {
  const filter = {};

  if (query.date) {
    filter.createdAt = {
      $gte: new Date(`${query.date}T00:00:00.000`),
      $lte: new Date(`${query.date}T23:59:59.999`)
    };
  }

  if (query.startDate || query.endDate) {
    filter.createdAt = {};

    if (query.startDate) {
      filter.createdAt.$gte = new Date(`${query.startDate}T00:00:00.000`);
    }

    if (query.endDate) {
      filter.createdAt.$lte = new Date(`${query.endDate}T23:59:59.999`);
    }
  }

  if (query.productId) {
    filter.productId = query.productId;
  }

  return filter;
};

const getSaleDateRange = (date) => ({
  $gte: new Date(`${date}T00:00:00.000`),
  $lte: new Date(`${date}T23:59:59.999`)
});

const toLocalDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getNextDisplayOrder = async (saleCreatedAt, count = 1) => {
  const saleDate = saleCreatedAt
    ? toLocalDateInputValue(saleCreatedAt)
    : toLocalDateInputValue();
  const lastSale = await Sale.findOne({
    createdAt: getSaleDateRange(saleDate)
  }).sort({ displayOrder: -1, createdAt: -1 });
  const startOrder = Number(lastSale?.displayOrder || 0) + 1;

  return Array.from({ length: count }, (_, index) => startOrder + index);
};

const getPaymentDetails = (sale, totalAmount) => {
  const cash = Number(sale.paymentBreakdown?.cash ?? sale.cashAmount ?? 0);
  const gpay = Number(sale.paymentBreakdown?.gpay ?? sale.gpayAmount ?? 0);
  const card = Number(sale.paymentBreakdown?.card ?? sale.cardAmount ?? 0);
  const hasBreakdown = cash > 0 || gpay > 0 || card > 0;

  if (!hasBreakdown && sale.paymentMethod) {
    return {
      paymentBreakdown: {
        cash: sale.paymentMethod === "Cash" ? totalAmount : 0,
        gpay: sale.paymentMethod === "GPay" ? totalAmount : 0,
        card: sale.paymentMethod === "Card" ? totalAmount : 0
      },
      paymentMethod: sale.paymentMethod
    };
  }

  const paidTotal = cash + gpay + card;

  if ([cash, gpay, card].some((amount) => Number.isNaN(amount) || amount < 0)) {
    return { error: "Payment amounts cannot be negative" };
  }

  if (paidTotal !== totalAmount) {
    return {
      error:
        `Payment is ${paidTotal} but sale total is ${totalAmount}. ` +
        `Cash ${cash} + GPay ${gpay} + Card ${card} must equal Selling Price x Qty.`
    };
  }

  const usedMethods = [
    cash > 0 ? "Cash" : null,
    gpay > 0 ? "GPay" : null,
    card > 0 ? "Card" : null
  ].filter(Boolean);

  return {
    paymentBreakdown: { cash, gpay, card },
    paymentMethod: usedMethods.length > 2 ? "Mixed" : usedMethods.join(" + ")
  };
};

const validateSaleInput = (sale) => {
  const saleSize = Number(sale.size);
  const saleQuantity = Number(sale.quantity || 1);
  const salePrice = Number(sale.sellingPrice);
  const isManual = !sale.productId;

  if (isManual && !sale.productName?.trim()) {
    return "Product name is required";
  }

  if (!isManual && sale.size && !isStandardSize(saleSize)) {
    return "Only shoe sizes 6, 7, 8, 9, 10, 11 and 12 are allowed";
  }

  if (!saleQuantity || saleQuantity < 1 || Number.isNaN(saleQuantity)) {
    return "Quantity must be at least 1";
  }

  if (!salePrice || salePrice < 0 || Number.isNaN(salePrice)) {
    return "Selling price must be greater than 0";
  }

  if (isManual) {
    const purchasePrice = Number(sale.purchasePrice);

    if (!purchasePrice || Number.isNaN(purchasePrice) || purchasePrice < 0) {
      return "Purchase price must be greater than 0";
    }
  }

  const paymentDetails = getPaymentDetails(sale, salePrice * saleQuantity);

  if (paymentDetails.error) {
    return paymentDetails.error;
  }

  return null;
};

const createSaleDoc = (sale, product, saleCreatedAt) => {
  const saleQuantity = Number(sale.quantity || 1);
  const salePrice = Number(sale.sellingPrice);
  const totalAmount = salePrice * saleQuantity;
  const profit = (salePrice - product.purchasePrice) * saleQuantity;
  const paymentDetails = getPaymentDetails(sale, totalAmount);

  return {
    productId: product._id,
    productName: getProductName(product),
    color: product.color,
    ...(sale.size ? { size: Number(sale.size) } : {}),
    quantity: saleQuantity,
    sellingPrice: salePrice,
    paymentMethod: paymentDetails.paymentMethod,
    paymentBreakdown: paymentDetails.paymentBreakdown,
    purchasePrice: product.purchasePrice,
    totalAmount,
    profit,
    ...(saleCreatedAt ? { createdAt: saleCreatedAt } : {})
  };
};

const createManualSaleDoc = (sale, saleCreatedAt) => {
  const saleQuantity = Number(sale.quantity || 1);
  const salePrice = Number(sale.sellingPrice);
  const purchasePrice = Number(sale.purchasePrice);
  const totalAmount = salePrice * saleQuantity;
  const profit = (salePrice - purchasePrice) * saleQuantity;
  const paymentDetails = getPaymentDetails(sale, totalAmount);

  return {
    productName: sale.productName.trim(),
    color: "",
    quantity: saleQuantity,
    sellingPrice: salePrice,
    paymentMethod: paymentDetails.paymentMethod,
    paymentBreakdown: paymentDetails.paymentBreakdown,
    purchasePrice,
    totalAmount,
    profit,
    isManual: true,
    notes: sale.notes?.trim() || "",
    ...(saleCreatedAt ? { createdAt: saleCreatedAt } : {})
  };
};

router.post("/bulk", async (req, res) => {
  try {
    const { sales = [], saleDate } = req.body;

    if (!Array.isArray(sales) || !sales.length) {
      return res.status(400).json({
        message: "At least one sale row is required"
      });
    }

    const invalidSaleIndex = sales.findIndex((sale) => validateSaleInput(sale));
    const invalidMessage =
      invalidSaleIndex >= 0 ? validateSaleInput(sales[invalidSaleIndex]) : null;

    if (invalidMessage) {
      return res.status(400).json({
        message: `Row ${invalidSaleIndex + 1}: ${invalidMessage}`
      });
    }

    const inventorySales = sales.filter((sale) => sale.productId);
    const manualSales = sales.filter((sale) => !sale.productId);
    const productIds = [...new Set(inventorySales.map((sale) => sale.productId))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(
      products.map((product) => [String(product._id), product])
    );

    const requestedStock = inventorySales.reduce((acc, sale) => {
      const key = String(sale.productId);
      acc[key] = (acc[key] || 0) + Number(sale.quantity || 1);
      return acc;
    }, {});

    for (const [key, requestedQuantity] of Object.entries(requestedStock)) {
      const product = productMap.get(key);

      if (!product || getProductQuantity(product) < requestedQuantity) {
        return res.status(400).json({
          message: "Selling quantity is greater than available stock"
        });
      }
    }

    const saleCreatedAt = saleDate
      ? new Date(`${saleDate}T12:00:00.000`)
      : undefined;

    const saleDocs = inventorySales.map((sale) => {
      const product = productMap.get(sale.productId);

      reduceProductQuantity(product, Number(sale.quantity || 1));

      return createSaleDoc(sale, product, saleCreatedAt);
    }).concat(
      manualSales.map((sale) => createManualSaleDoc(sale, saleCreatedAt))
    );
    const displayOrders = await getNextDisplayOrder(saleCreatedAt, saleDocs.length);
    const orderedSaleDocs = saleDocs.map((sale, index) => ({
      ...sale,
      displayOrder: displayOrders[index]
    }));

    await Promise.all(products.map((product) => product.save()));

    const createdSales = await Sale.insertMany(orderedSaleDocs);

    res.status(201).json(createdSales);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const invalidMessage = validateSaleInput(req.body);

    if (invalidMessage) {
      return res.status(400).json({ message: invalidMessage });
    }

    const { productId, quantity = 1, saleDate } = req.body;

    if (!productId) {
      const saleCreatedAt = saleDate ? new Date(`${saleDate}T12:00:00.000`) : undefined;
      const [displayOrder] = await getNextDisplayOrder(saleCreatedAt);
      const sale = await Sale.create(
        {
          ...createManualSaleDoc(req.body, saleCreatedAt),
          displayOrder
        }
      );

      return res.status(201).json(sale);
    }

    const saleQuantity = Number(quantity);
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    if (!reduceProductQuantity(product, saleQuantity)) {
      return res.status(400).json({
        message: "Selling quantity is greater than available stock"
      });
    }

    await product.save();

    const saleCreatedAt = saleDate ? new Date(`${saleDate}T12:00:00.000`) : undefined;
    const [displayOrder] = await getNextDisplayOrder(saleCreatedAt);
    const sale = await Sale.create({
      ...createSaleDoc(req.body, product, saleCreatedAt),
      displayOrder
    });

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const sales = await Sale.find(buildSalesFilter(req.query))
      .sort({ displayOrder: 1, createdAt: 1 });

    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.patch("/order", async (req, res) => {
  try {
    const { saleIds = [] } = req.body;

    if (!Array.isArray(saleIds) || !saleIds.length) {
      return res.status(400).json({ message: "Sale order is required" });
    }

    await Sale.bulkWrite(
      saleIds.map((saleId, index) => ({
        updateOne: {
          filter: { _id: saleId },
          update: { $set: { displayOrder: index + 1 } }
        }
      }))
    );

    res.json({ message: "Sale order updated" });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Unable to update sale order"
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const invalidMessage = validateSaleInput(req.body);

    if (invalidMessage) {
      return res.status(400).json({ message: invalidMessage });
    }

    const oldProduct = sale.productId ? await Product.findById(sale.productId) : null;
    const isSameProduct = String(sale.productId) === String(req.body.productId);

    if (oldProduct) {
      restoreProductQuantity(oldProduct, sale.quantity);
    }

    if (!req.body.productId) {
      if (oldProduct) {
        await oldProduct.save();
      }

      const updatedSale = await Sale.findByIdAndUpdate(
        req.params.id,
        createManualSaleDoc(req.body),
        { new: true }
      );

      return res.json(updatedSale);
    }

    const newProduct = isSameProduct
      ? oldProduct
      : await Product.findById(req.body.productId);

    if (!newProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const newSaleQuantity = Number(req.body.quantity || 1);

    if (!reduceProductQuantity(newProduct, newSaleQuantity)) {
      return res.status(400).json({
        message: "Selling quantity is greater than available stock"
      });
    }

    if (oldProduct && !isSameProduct) {
      await oldProduct.save();
    }

    await newProduct.save();

    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      createSaleDoc(req.body, newProduct),
      { new: true }
    );

    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const product = sale.productId ? await Product.findById(sale.productId) : null;

    if (product) {
      restoreProductQuantity(product, sale.quantity);
      await product.save();
    }

    await Sale.findByIdAndDelete(req.params.id);

    res.json({ message: "Sale deleted and stock restored" });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
