const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const Return = require("../models/Return");

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  };
};

const getProductName = (product) =>
  product.brand && product.articleNumber
    ? `${product.brand}-${product.articleNumber}`
    : product.name;

const getProductQuantity = (product) =>
  product.quantity ?? product.sizes.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const getBrandName = (product) => {
  const rawBrand = (product.brand || product.name || "Unknown").trim() || "Unknown";
  const articleNumber = String(product.articleNumber || "").trim();

  if (articleNumber) {
    const suffix = `-${articleNumber}`.toLowerCase();

    if (rawBrand.toLowerCase().endsWith(suffix)) {
      return rawBrand.slice(0, -suffix.length).trim() || rawBrand;
    }
  }

  if (rawBrand.includes("-")) {
    return rawBrand.split("-")[0].trim() || rawBrand;
  }

  return rawBrand;
};

router.get("/", async (req, res) => {
  try {
    const sales = await Sale.find();
    const expenses = await Expense.find();
    const returns = await Return.find();
    const products = await Product.find();
    const { start, end } = getTodayRange();

    const todaySalesRows = sales.filter(
      (sale) => sale.createdAt >= start && sale.createdAt <= end
    );
    const todayExpenseRows = expenses.filter(
      (expense) => expense.date >= start && expense.date <= end
    );
    const todayReturnRows = returns.filter(
      (returnEntry) => returnEntry.createdAt >= start && returnEntry.createdAt <= end
    );

    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalReturns = returns.reduce(
      (sum, returnEntry) => sum + returnEntry.netRefund,
      0
    );
    const todaySales = todaySalesRows.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const todayProfit = todaySalesRows.reduce((sum, sale) => sum + sale.profit, 0);
    const todayExpenses = todayExpenseRows.reduce((sum, expense) => sum + expense.amount, 0);
    const todayReturns = todayReturnRows.reduce(
      (sum, returnEntry) => sum + returnEntry.netRefund,
      0
    );
    const todayPairsSold = todaySalesRows.reduce((sum, sale) => sum + sale.quantity, 0);

    const totalProducts = products.length;

    const totalStockValue = products.reduce((sum, product) => {
      const totalQuantity = getProductQuantity(product);

      return sum + product.purchasePrice * totalQuantity;
    }, 0);

    const brandStockMap = products.reduce((acc, product) => {
      const brand = getBrandName(product);
      const brandKey = brand.toLowerCase();
      const totalQuantity = getProductQuantity(product);
      const stockValue = product.purchasePrice * totalQuantity;

      if (!acc[brandKey]) {
        acc[brandKey] = {
          brand,
          pairsRemaining: 0,
          stockValue: 0,
          products: 0
        };
      }

      acc[brandKey].pairsRemaining += totalQuantity;
      acc[brandKey].stockValue += stockValue;
      acc[brandKey].products += 1;

      return acc;
    }, {});

    const brandStockSummary = Object.values(brandStockMap)
      .sort((a, b) => b.stockValue - a.stockValue);

    const lowStockProducts = products
      .filter((product) => getProductQuantity(product) <= 1)
      .map((product) => ({
        _id: String(product._id),
        productId: product._id,
        name: getProductName(product),
        color: product.color,
        quantity: getProductQuantity(product)
      }));

    res.json({
      totalSales,
      totalProfit,
      totalExpenses,
      totalReturns,
      netProfit: totalProfit - totalExpenses - totalReturns,
      netProfitAfterReturns: totalProfit - totalExpenses - totalReturns,
      totalStockValue,
      stockValue: totalStockValue,
      totalProducts,
      todaySales,
      todayProfit,
      todayExpenses,
      todayReturns,
      todayNetProfit: todayProfit - todayExpenses - todayReturns,
      todayNetProfitAfterReturns: todayProfit - todayExpenses - todayReturns,
      todayPairsSold,
      brandStockSummary,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
