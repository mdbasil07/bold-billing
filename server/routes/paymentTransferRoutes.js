const express = require("express");
const router = express.Router();

const PaymentTransfer = require("../models/PaymentTransfer");

router.post("/", async (req, res) => {
  try {
    const { direction, amount, date, notes = "" } = req.body;
    const transferAmount = Number(amount);

    if (!["cash-to-gpay", "gpay-to-cash"].includes(direction)) {
      return res.status(400).json({ message: "Select Cash to GPay or GPay to Cash" });
    }

    if (Number.isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: "Transfer amount must be greater than 0" });
    }

    if (!date) {
      return res.status(400).json({ message: "Transfer date is required" });
    }

    const transfer = await PaymentTransfer.create({
      direction,
      amount: transferAmount,
      date: new Date(`${date}T12:00:00.000`),
      notes
    });

    res.status(201).json(transfer);
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

    const transfers = await PaymentTransfer.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const transfer = await PaymentTransfer.findByIdAndDelete(req.params.id);

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    res.json({ message: "Transfer deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
