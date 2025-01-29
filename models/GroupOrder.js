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
    paidAmount: { type: Number, default: 0, required: true }, // Amount paid
    leftAmount: { type: Number, default: 0, required: true }, // Remaining amount
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "completed"],
      default: "unpaid",
    }, // Payment status

    tracking_status: {
      type: String,
      enum: [
        "Order Placed For Pickup",
        "Pickup Accepted",
        "Order Picked Up",
        "Order Received By Admin",
        "Work Completed",
        "Out For Delivery",
        "Order Completed",
      ],
      default: "Order Placed For Pickup",
    }, // Tracking status
    rider_id: { type: mongoose.Schema.Types.ObjectId, ref: "Rider", default: null }, // Rider assigned to the order
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null }, // Admin handling the order
    rider_details: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    }, // Rider details
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupOrder", groupOrderSchema);

