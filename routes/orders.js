const express = require("express");
const router = express.Router();

// Import your database model (adjust based on your DB setup)
const Order = require("../models/Order");
const User = require("../models/User");
const GroupOrder = require("../models/GroupOrder");

// Route to store order details
router.post("/place-order", async (req, res) => {
    try {
      const { userId, ...orderDetails } = req.body;
  
      // Validate if the user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" , confirmation: false});
      }
  
      // Create the order with the userId
      const newOrder = new Order({ userId, ...orderDetails });
      const savedOrder = await newOrder.save();
  
      res.status(201).json({ message: "Order placed successfully", confirmation: true ,data: savedOrder });
    } catch (error) {
      res.status(500).json({ message: "Failed to place order", confirmation: false ,error });
    }
  });

  router.get("/get-order/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).populate("userId", "name email phone plan");
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve orders", confirmation: false ,error });
  }
});

// Route to create a group order
router.post("/create-group-order", async (req, res) => {
  try {
    const { userId, orderIds, paymentOption } = req.body;

    // Validate if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", confirmation: false });
    }

    // Fetch the selected orders
    const orders = await Order.find({ _id: { $in: orderIds } });
    if (!orders.length) {
      return res.status(404).json({ message: "No orders found", confirmation: false });
    }

    // Calculate total amount
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const deliveryCharge = 100; // Fixed delivery charge
    const finalAmount = paymentOption === "full" ? totalAmount + deliveryCharge : deliveryCharge;

    // Create the group order
    const newGroupOrder = new GroupOrder({
      userId,
      orders: orderIds,
      totalAmount,
      deliveryCharge,
      finalAmount,
      paymentStatus: paymentOption === "full" ? "completed" : "pending",
    });
    const savedGroupOrder = await newGroupOrder.save();

    // Update the payment status of individual orders
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { $set: { isGroupOrder: true, groupOrderId: savedGroupOrder._id, paymentStatus: savedGroupOrder.paymentStatus } }
    );

    // Notify the admin (you can implement this logic)
    notifyAdmin(savedGroupOrder);

    res.status(201).json({ message: "Group order created successfully", confirmation: true, data: savedGroupOrder });
  } catch (error) {
    res.status(500).json({ message: "Failed to create group order", confirmation: false, error });
  }
});

// Function to notify the admin (you can implement this logic)
const notifyAdmin = (groupOrder) => {
  console.log(`Notification: A new group order has been created with ID ${groupOrder._id}`);
  // You can integrate with a notification service (e.g., email, SMS, or WebSocket)
};

module.exports = router;
