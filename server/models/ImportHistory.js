const mongoose = require("mongoose");

const importHistorySchema = new mongoose.Schema({
  imageName: {
    type: String,
    default: "Manual confirmation"
  },

  productsCreated: {
    type: Number,
    required: true,
    default: 0
  },

  productsUpdated: {
    type: Number,
    required: true,
    default: 0
  },

  productsSkipped: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("ImportHistory", importHistorySchema);
