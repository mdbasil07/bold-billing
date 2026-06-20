const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
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

  paymentMethod: {
    type: String,
    enum: ["cash", "gpay", "split"],
    default: "cash",
    required: true
  },

  paymentBreakdown: {
    cash: {
      type: Number,
      default: 0,
      min: 0
    },
    gpay: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  notes: {
    type: String,
    default: "",
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Expense", expenseSchema);
