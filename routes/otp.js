const express = require("express");
const nodemailer = require("nodemailer");
const OTP = require("../models/Otp"); // Import OTP schema
// const authenticate = require("../middleware/authenticate");
const TrackingOtp = require("../models/TrackingOtp");

const router = express.Router();

const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["lenz-api-key"];
  console.log(req.headers["lenz-api-key"]);
  const authorizedApiKey = process.env.AUTHORIZED_API_KEY;

  if (!apiKey) {
    return res
      .status(401)
      .json({ error: "API key is missing.", confirmation: false });
  }

  if (apiKey === authorizedApiKey) {
    next();
  } else {
    return res
      .status(403)
      .json({ error: "Access denied. Invalid API key.", confirmation: false });
  }
};

// Configure nodemailer for email
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Request OTP
router.post("/request-otp", verifyApiKey, async (req, res) => {
  const { email, phone } = req.body;
  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to the database
    await OTP.create({ email, phone, otp });

    // Send OTP via email (or phone using Twilio)
    if (email) {
      await transporter.sendMail({
        from: `"LenZ" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      });
    }

    res.status(200).json({ message: "OTP sent successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

router.post("/verify-otp", verifyApiKey, async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }
  try {
    // Find the OTP in the database
    const record = await OTP.findOne({ email, otp });
    console.log(email, otp);
    console.log(record);

    if (!record) {
      return res.status(404).json({ message: "Invalid OTP." });
    }

    // If OTP exists, delete it to prevent reuse
    await OTP.deleteOne({ _id: record._id });

    res
      .status(200)
      .json({ message: "OTP verified successfully.", confirmation: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify OTP." });
  }
});

router.post("/request-tracking-otp", verifyApiKey, async (req, res) => {
  try {
    const { groupOrder_id, order_key, purpose } = req.body;

    if ((!groupOrder_id || !order_key) && !purpose) {
      return res
        .status(400)
        .json({ message: "GroupOrder ID and purpose are required." });
    }

    // Check if the purpose is valid
    if (
      purpose !== "shop_pickup" &&
      purpose !== "admin_delivery" &&
      purpose !== "admin_pickup" &&
      purpose !== "shop_delivery"
    ) {
      return res.status(400).json({ message: "Invalid purpose." });
    }

    if (purpose === "admin_pickup") {
      // Check for order key and purpose in otp db and return the otp
      try {
        const existingOtp = await TrackingOtp.findOne({ order_key, purpose });
        if (existingOtp) {
          return res.status(200).json(existingOtp);
        } else {
          return res.status(404).json({ message: "OTP not found." });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error." });
      }
    } else {
      // Check for groupOrder_id and purpose in otp db and return the otp
      try {
        const existingOtp = await TrackingOtp.findOne({ groupOrder_id, purpose });
        if (existingOtp) {
          return res.status(200).json(existingOtp);
        } else {
          return res.status(404).json({ message: "OTP not found." });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error." });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
