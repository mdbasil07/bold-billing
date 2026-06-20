const express = require("express");
const router = express.Router();

const Expense = require("../models/Expense");

const getExpensePaymentDetails = ({ amount, paymentMethod = "cash", paymentBreakdown }) => {
  const expenseAmount = Number(amount);
  const normalizedPaymentMethod = String(paymentMethod).toLowerCase();

  if (!["cash", "gpay", "split"].includes(normalizedPaymentMethod)) {
    return { error: "Expense payment must be Cash, GPay or Split" };
  }

  if (normalizedPaymentMethod === "split") {
    const cash = Number(paymentBreakdown?.cash || 0);
    const gpay = Number(paymentBreakdown?.gpay || 0);

    if ([cash, gpay].some((value) => Number.isNaN(value) || value < 0)) {
      return { error: "Split payment amounts cannot be negative" };
    }

    if (cash + gpay !== expenseAmount) {
      return { error: "Cash + GPay must equal the expense amount" };
    }

    if (cash <= 0 || gpay <= 0) {
      return { error: "Split expenses need both Cash and GPay amounts" };
    }

    return {
      paymentMethod: "split",
      paymentBreakdown: { cash, gpay }
    };
  }

  return {
    paymentMethod: normalizedPaymentMethod,
    paymentBreakdown: {
      cash: normalizedPaymentMethod === "cash" ? expenseAmount : 0,
      gpay: normalizedPaymentMethod === "gpay" ? expenseAmount : 0
    }
  };
};

const getExpensePayload = (reqBody) => {
  const { title, amount, date, notes = "" } = reqBody;
  const expenseAmount = Number(amount);

  if (!title?.trim()) {
    return { error: "Expense title is required" };
  }

  if (Number.isNaN(expenseAmount) || expenseAmount < 0) {
    return { error: "Expense amount cannot be negative" };
  }

  if (!date) {
    return { error: "Expense date is required" };
  }

  const paymentDetails = getExpensePaymentDetails(reqBody);

  if (paymentDetails.error) {
    return { error: paymentDetails.error };
  }

  return {
    title: title.trim(),
    amount: expenseAmount,
    date: new Date(`${date}T12:00:00.000`),
    notes,
    ...paymentDetails
  };
};

router.post("/", async (req, res) => {
  try {
    const payload = getExpensePayload(req.body);

    if (payload.error) {
      return res.status(400).json({ message: payload.error });
    }

    const expense = await Expense.create(payload);

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.startDate || req.query.endDate) {
      filter.date = {};

      if (req.query.startDate) {
        filter.date.$gte = new Date(`${req.query.startDate}T00:00:00.000`);
      }

      if (req.query.endDate) {
        filter.date.$lte = new Date(`${req.query.endDate}T23:59:59.999`);
      }
    }

    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = getExpensePayload(req.body);

    if (payload.error) {
      return res.status(400).json({ message: payload.error });
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, payload, {
      new: true
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ message: "Expense deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
