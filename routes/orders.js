const express = require("express");
const router = express.Router();
const authenticate = require('../middleware/authenticate');
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
    const finalAmount = totalAmount + deliveryCharge;
    const paidAmount = paymentOption === "full" ? totalAmount + deliveryCharge : deliveryCharge;
    const leftAmount = paymentOption === "full" ? 0 : totalAmount;

    // Create the group order
    const newGroupOrder = new GroupOrder({
      userId,
      orders: orderIds,
      totalAmount,
      deliveryCharge,
      finalAmount,
      paidAmount,
      leftAmount,
      paymentStatus: paymentOption === "full" ? "completed" : "pending",
      tracking_status: "Order Placed For Pickup",
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


router.patch("/:groupOrderId/accept-pickup", async (req, res) => {
  try {
    const { groupOrderId } = req.params;
    const { rider_id, rider_name, rider_phone } = req.body;

    // Validate if the group order exists
    const groupOrder = await GroupOrder.findById(groupOrderId);
    if (!groupOrder) {
      return res.status(404).json({ message: "GroupOrder not found", confirmation: false });
    }

    // Update the group order with rider details and change status
    groupOrder.tracking_status = "Pickup Accepted";
    groupOrder.rider_id = rider_id;
    groupOrder.rider_details = { name: rider_name, phone: rider_phone };
    await groupOrder.save();

    res.status(200).json({ message: "Pickup accepted successfully", confirmation: true, data: groupOrder });
  } catch (error) {
    res.status(500).json({ message: "Failed to accept pickup", confirmation: false, error });
  }
});

router.get("/get-group-orders", async (req, res) => {
  try {
    const userId = req.user.id; // Assuming authenticate middleware adds user info to req
    console.log(userId);
    const groupOrders = await GroupOrder.find({ userId }).populate("orders");
    res.status(200).json({ data: groupOrders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch group orders", error });
  }
});

// GET /api/orders/get-group-order/:groupOrderId
router.get("/get-group-order/:groupOrderId", async (req, res) => {
  try {
    const { groupOrderId } = req.params;
    const groupOrder = await GroupOrder.findById(groupOrderId).populate("orders");
    res.status(200).json({ data: groupOrder });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch group order details", error });
  }
});

module.exports = router;
