const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema({
  productName: {
    type: String,
    default: "",
    trim: true
  },

  reason: {
    type: String,
    default: "",
    trim: true
  },

  cashPaid: {
    type: Number,
    required: true,
    min: 0
  },

  gpayReceived: {
    type: Number,
    required: true,
    min: 0
  },

  cardReceived: {
    type: Number,
    required: true,
    min: 0
  },

  netRefund: {
    type: Number,
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

module.exports = mongoose.model("Return", returnSchema);
