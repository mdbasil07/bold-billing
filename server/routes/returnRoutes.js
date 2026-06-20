const express = require("express");
const router = express.Router();

const Return = require("../models/Return");

const getReturnPayload = (body) => {
  const cashPaid = Number(body.cashPaid || 0);
  const gpayReceived = Number(body.gpayReceived || 0);
  const cardReceived = Number(body.cardReceived || 0);

  if ([cashPaid, gpayReceived, cardReceived].some((value) => Number.isNaN(value))) {
    return { error: "Return amounts must be valid numbers" };
  }

  if (cashPaid < 0) {
    return { error: "Cash paid cannot be negative" };
  }

  if (gpayReceived < 0) {
    return { error: "GPay received cannot be negative" };
  }

  if (cardReceived < 0) {
    return { error: "Card received cannot be negative" };
  }

  return {
    productName: body.productName || "",
    reason: body.reason || "",
    cashPaid,
    gpayReceived,
    cardReceived,
    netRefund: cashPaid - gpayReceived - cardReceived,
    notes: body.notes || ""
  };
};

const getDateFilter = (startDate, endDate) => {
  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000`);
    }

    if (endDate) {
      filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999`);
    }
  }

  return filter;
};

router.post("/", async (req, res) => {
  try {
    const payload = getReturnPayload(req.body);

    if (payload.error) {
      return res.status(400).json({ message: payload.error });
    }

    const returnEntry = await Return.create(payload);

    res.status(201).json(returnEntry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const returns = await Return.find(
      getDateFilter(req.query.startDate, req.query.endDate)
    ).sort({ createdAt: -1 });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const returnEntry = await Return.findByIdAndDelete(req.params.id);

    if (!returnEntry) {
      return res.status(404).json({ message: "Return not found" });
    }

    res.json({ message: "Return deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
