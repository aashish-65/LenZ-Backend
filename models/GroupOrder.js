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
    pickup_rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    }, // Rider assigned to the order
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: new mongoose.Types.ObjectId("6759ea9d2f38c65245f21cc8"),
    },
    pickup_rider_details: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },
    delivery_rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    }, // Rider assigned to the order
    delivery_rider_details: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },
    common_pickup_key: { type: String, default: null },
    shop_pickup_key: { type: String, default: null },
    delAmount: { type: Number, default: 0 },
    pickupAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupOrder", groupOrderSchema);
