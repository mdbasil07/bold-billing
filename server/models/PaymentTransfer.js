const mongoose = require("mongoose");

const paymentTransferSchema = new mongoose.Schema({
  direction: {
    type: String,
    enum: ["cash-to-gpay", "gpay-to-cash"],
    required: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0
  },

  date: {
    type: Date,
    required: true
  },

  notes: {
    type: String,
    default: "",
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("PaymentTransfer", paymentTransferSchema);
