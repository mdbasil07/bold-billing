const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const saleRoutes = require("./routes/saleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const reportRoutes = require("./routes/reportRoutes");
const importStockRoutes = require("./routes/importStockRoutes");
const paymentTransferRoutes = require("./routes/paymentTransferRoutes");
const returnRoutes = require("./routes/returnRoutes");
require("dotenv").config();

const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/import-stock", importStockRoutes);
app.use("/api/payment-transfers", paymentTransferRoutes);
app.use("/api/returns", returnRoutes);

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("MongoDB Connected");
})
.catch((err) => {
  console.log(err);
});

app.get("/", (req, res) => {
  res.send("Bold Billing API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
