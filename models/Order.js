const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to the User
  customerDetails: Object,
  frameOptions: Object,
  shiftingOrFitting: String,
  purchaseLens: String,
  glassType: String,
  lensDetails: Object,
  materialDetails: Object,
  coatingDetails: Object,
  powerDetails: Object,
  powerType: String,
  powerEntryType: String,
  fittingCharge: Number,
  shiftingCharge: Number,
  totalAmount: Number,
  paymentType: String,
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
