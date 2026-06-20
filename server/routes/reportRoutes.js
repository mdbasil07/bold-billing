const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const PaymentTransfer = require("../models/PaymentTransfer");
const Return = require("../models/Return");

const getDateFilter = (startDate, endDate, field) => {
  const filter = {};

  if (startDate || endDate) {
    filter[field] = {};

    if (startDate) {
      filter[field].$gte = new Date(`${startDate}T00:00:00.000`);
    }

    if (endDate) {
      filter[field].$lte = new Date(`${endDate}T23:59:59.999`);
    }
  }

  return filter;
};

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const sales = await Sale.find(getDateFilter(startDate, endDate, "createdAt"))
      .sort({ createdAt: 1 });
    const expenses = await Expense.find(getDateFilter(startDate, endDate, "date"))
      .sort({ date: 1, createdAt: 1 });
    const paymentTransfers = await PaymentTransfer.find(
      getDateFilter(startDate, endDate, "date")
    ).sort({ date: 1, createdAt: 1 });
    const returns = await Return.find(getDateFilter(startDate, endDate, "createdAt"))
      .sort({ createdAt: 1 });

    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalReturns = returns.reduce(
      (sum, returnEntry) => sum + returnEntry.netRefund,
      0
    );
    const pairsSold = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const paymentTotals = sales.reduce(
      (sum, sale) => ({
        cash: sum.cash + Number(sale.paymentBreakdown?.cash || 0),
        gpay: sum.gpay + Number(sale.paymentBreakdown?.gpay || 0),
        card: sum.card + Number(sale.paymentBreakdown?.card || 0)
      }),
      { cash: 0, gpay: 0, card: 0 }
    );
    const expensePaymentTotals = expenses.reduce(
      (sum, expense) => {
        const amount = Number(expense.amount || 0);
        const hasBreakdown =
          expense.paymentBreakdown &&
          (expense.paymentBreakdown.cash > 0 || expense.paymentBreakdown.gpay > 0);
        const cash = hasBreakdown
          ? Number(expense.paymentBreakdown.cash || 0)
          : expense.paymentMethod === "gpay"
            ? 0
            : amount;
        const gpay = hasBreakdown
          ? Number(expense.paymentBreakdown.gpay || 0)
          : expense.paymentMethod === "gpay"
            ? amount
            : 0;

        return {
          cash: sum.cash + cash,
          gpay: sum.gpay + gpay
        };
      },
      { cash: 0, gpay: 0 }
    );
    const transferTotals = paymentTransfers.reduce(
      (sum, transfer) => {
        const amount = Number(transfer.amount || 0);

        if (transfer.direction === "cash-to-gpay") {
          return {
            cash: sum.cash - amount,
            gpay: sum.gpay + amount
          };
        }

        return {
          cash: sum.cash + amount,
          gpay: sum.gpay - amount
        };
      },
      { cash: 0, gpay: 0 }
    );
    const returnPaymentTotals = returns.reduce(
      (sum, returnEntry) => ({
        cash: sum.cash + Number(returnEntry.cashPaid || 0),
        gpay: sum.gpay + Number(returnEntry.gpayReceived || 0),
        card: sum.card + Number(returnEntry.cardReceived || 0)
      }),
      { cash: 0, gpay: 0, card: 0 }
    );

    res.json({
      totalSales,
      totalProfit,
      totalExpenses,
      totalReturns,
      netProfit: totalProfit - totalExpenses - totalReturns,
      balanceAmount: totalSales - totalExpenses - totalReturns,
      pairsSold,
      paymentTotals,
      expensePaymentTotals,
      transferTotals,
      returnPaymentTotals,
      balances: {
        cash:
          paymentTotals.cash +
          transferTotals.cash -
          expensePaymentTotals.cash -
          returnPaymentTotals.cash,
        gpay:
          paymentTotals.gpay +
          transferTotals.gpay -
          expensePaymentTotals.gpay +
          returnPaymentTotals.gpay,
        card: paymentTotals.card + returnPaymentTotals.card
      },
      returns: returns.map((returnEntry) => ({
        date: returnEntry.createdAt,
        productName: returnEntry.productName,
        reason: returnEntry.reason,
        cashPaid: returnEntry.cashPaid,
        gpayReceived: returnEntry.gpayReceived,
        cardReceived: returnEntry.cardReceived,
        netRefund: returnEntry.netRefund,
        notes: returnEntry.notes || ""
      })),
      expenses: expenses.map((expense) => ({
        date: expense.date,
        title: expense.title,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        paymentBreakdown: expense.paymentBreakdown,
        notes: expense.notes || ""
      })),
      paymentTransfers: paymentTransfers.map((transfer) => ({
        date: transfer.date,
        direction: transfer.direction,
        amount: transfer.amount,
        notes: transfer.notes || ""
      })),
      sales: sales.map((sale) => ({
        date: sale.createdAt,
        productName: sale.productName,
        color: sale.color,
        size: sale.size,
        quantity: sale.quantity,
        purchasePrice: sale.purchasePrice,
        sellingPrice: sale.sellingPrice,
        totalAmount: sale.totalAmount,
        profit: sale.profit,
        paymentMethod: sale.paymentMethod,
        paymentBreakdown: sale.paymentBreakdown,
        notes: sale.notes || "",
        isManual: Boolean(sale.isManual)
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
