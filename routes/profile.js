const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authenticate = require("../middleware/authenticate");

// @route   GET /api/profile
// @desc    Fetch user profile
// @access  Private
router.get("/", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password"); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put("/", authenticate, async (req, res) => {
  const {
    name,
    phone,
    alternatePhone,
    shopName,
    address,
    plan,
  } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          name,
          phone,
          alternatePhone,
          shopName,
          "address.line1": address?.line1,
          "address.line2": address?.line2,
          "address.landmark": address?.landmark,
          "address.city": address?.city,
          "address.state": address?.state,
          "address.pinCode": address?.pinCode,
          plan,
        },
      },
      { new: true, runValidators: true }
    ).select("-password"); // Exclude password
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
