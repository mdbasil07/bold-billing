const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  brand: {
    type: String,
    trim: true,
    default: ""
  },

  articleNumber: {
    type: String,
    trim: true,
    default: ""
  },

  name: {
    type: String,
    trim: true
  },

  color: {
    type: String,
    required: true
  },

  purchasePrice: {
    type: Number,
    required: true
  },

  quantity: {
    type: Number,
    min: 0
  },

  sizes: [
    {
      size: Number,
      quantity: Number
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model("Product", productSchema);
