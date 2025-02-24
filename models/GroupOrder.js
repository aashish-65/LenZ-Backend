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
    deliveryCharge: { type: Number, default: 0 }, // Delivery charge
    finalAmount: { type: Number, required: true }, // Total amount + delivery charge
    paidAmount: { type: Number, default: 0, required: true }, // Amount paid
    leftAmount: { type: Number, default: 0, required: true }, // Remaining amount
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "completed"],
      default: "unpaid",
    },
    tracking_status: {
      type: String,
      enum: [
        "Order Placed For Pickup",
        "Pickup Accepted",
        "Order Picked Up",
        "Order Received By Admin",
        "Work Completed",
        "Internal Tracking",
        "Out For Delivery",
        "Order Completed",
      ],
      default: "Order Placed For Pickup",
    }, // Tracking status
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: new mongoose.Types.ObjectId("67b2959793404c300f4c6cb0"),
    },
    admin_pickup: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "RiderOrderHistory", default: null },
      key: { type: String, default: null },
    },
    shop_pickup: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "RiderOrderHistory", default: null },
      key: { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupOrder", groupOrderSchema);
