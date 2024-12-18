const express = require("express");
const router = express.Router();

// Import your database model (adjust based on your DB setup)
const Order = require("../models/Order");
const User = require("../models/User");

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
    res.status(200).json({ data: orders, confirmation: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve orders", confirmation: false ,error });
  }
});


module.exports = router;
