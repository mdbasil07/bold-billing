const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  },

  productName: {
    type: String,
    required: true
  },

  color: {
    type: String,
    default: ""
  },

  size: {
    type: Number
  },

  quantity: {
    type: Number,
    required: true
  },

  sellingPrice: {
    type: Number,
    required: true
  },

  paymentMethod: {
    type: String,
    enum: ["Cash", "GPay", "Card", "Cash + GPay", "Cash + Card", "GPay + Card", "Mixed"],
    required: true
  },

  paymentBreakdown: {
    cash: {
      type: Number,
      default: 0
    },
    gpay: {
      type: Number,
      default: 0
    },
    card: {
      type: Number,
      default: 0
    }
  },

  purchasePrice: {
    type: Number,
    required: true
  },

  totalAmount: {
    type: Number,
    required: true
  },

  profit: {
    type: Number,
    required: true
  },

  isManual: {
    type: Boolean,
    default: false
  },

  notes: {
    type: String,
    default: ""
  },

  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Sale", saleSchema);
