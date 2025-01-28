const mongoose = require("mongoose");

const groupOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who created the group order
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }], // Array of orders in the group
    totalAmount: { type: Number, required: true }, // Total amount of selected orders
    deliveryCharge: { type: Number, default: 100 }, // Delivery charge
    finalAmount: { type: Number, required: true }, // Total amount + delivery charge
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    }, // Payment status
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupOrder", groupOrderSchema);
