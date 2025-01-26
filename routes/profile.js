const express = require("express");
const router = express.Router();
const User = require("../models/User");
// const OTP = require("../models/Otp");
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

// Change Password Route
router.post("/change-password", authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  console.log(oldPassword, newPassword);
  // Validate inputs
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long." });
  }

  try {
    // Find the user
    const user = await User.findById(req.user.id);
    console.log(user);
    console.log(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify the old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid old password." });
    }

    // Verify the OTP
    // const otpRecord = await OTP.findOne({ email: user.email, otp });
    // if (!otpRecord) {
    //   return res.status(400).json({ error: "Invalid OTP." });
    // }

    // Delete the OTP record after verification
    // await OTP.deleteOne({ _id: otpRecord._id });

    // Update the password
    await user.updatePassword(newPassword);

    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update password." });
  }
});

module.exports = router;
