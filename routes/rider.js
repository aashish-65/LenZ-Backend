const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Rider = require("../models/Rider");
const nodemailer = require("nodemailer");
const RiderOrderHistory = require("../models/RiderOrderHistory");
require("dotenv").config();

const router = express.Router();

// Configure nodemailer for email
const transporter = nodemailer.createTransport({
  service: "Gmail", // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Middleware to verify API Key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["lenz-api-key"];
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

// User Signup
router.post("/signup", verifyApiKey, async (req, res) => {
  const { name, email, phone, password, vehicleNumber } = req.body;

  try {
    // Check if the user already exists
    const existingRider = await Rider.findOne({ email });

    if (existingRider) {
      return res.status(401).json({ error: "Email already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let riderId;
    let isUnique = false;
    // Generate a unique 10-digit ID
    while (!isUnique) {
      riderId = Math.floor(100000 + Math.random() * 900000);
      const existingRider = await Rider.findOne({ riderId });
      if (!existingRider) {
        isUnique = true;
      }
    }

    const emailTemplate = `
          <div style="font-family: 'Roboto', sans-serif; background-color: #f4f4f7; padding: 20px; margin: 0;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
    
    <!-- Header Section -->
    <tr style="background-color: #007BFF; text-align: center;">
      <td style="padding: 20px;">
        <img src="https://lenz-booking.netlify.app/web-app-manifest-192x192.png" alt="LenZ Logo" style="height: 60px; max-width: 100%; margin-bottom: 10px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">Welcome to LenZ, ${name}!</h1>
        <p style="color: #dce6f1; font-size: 14px; margin-top: 8px;">Your journey to smarter eyewear solutions begins here.</p>
      </td>
    </tr>

    <!-- Body Section -->
    <tr>
      <td style="padding: 20px; color: #333333;">
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Thank you for signing up with <strong>LenZ</strong>. We are thrilled to have you onboard! Below are your account details for quick reference:
        </p>

        <!-- Rider Details -->
        <table style="width: 100%; background-color: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e3e6ea; margin: 20px 0;">
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Rider ID:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${riderId}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Email:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Phone:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${phone}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Vehicle Number:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${vehicleNumber}</td>
          </tr>
        </table>

        <p style="font-size: 16px; line-height: 1.6; margin: 0;">
          You can now log in to your account to manage the orders, payments, and explore our features.
        </p>
      </td>
    </tr>

    <!-- Call to Action -->
    <tr>
      <td style="text-align: center; padding: 20px;">
        <a href="https://lenz-booking.netlify.app/login" 
           style="display: inline-block; padding: 14px 24px; font-size: 16px; color: #ffffff; background-color: #007BFF; border-radius: 8px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 6px rgba(0, 123, 255, 0.4); max-width: 90%; width: auto;">
          Login to Your Account
        </a>
      </td>
    </tr>

    <!-- Footer Section -->
    <tr style="background-color: #f1f3f5;">
      <td style="text-align: center; padding: 20px; color: #777777; font-size: 14px;">
        <p style="margin: 0;">LenZ © ${new Date().getFullYear()} | All Rights Reserved.</p>
        <p style="margin: 10px 0;">
          <a href="https://lenz-booking.netlify.app/terms" style="color: #007BFF; text-decoration: none;">Terms of Service</a> | 
          <a href="https://lenz-booking.netlify.app/privacy" style="color: #007BFF; text-decoration: none;">Privacy Policy</a>
        </p>
      </td>
    </tr>
  </table>
</div>
`;

    const mailOptions = {
      from: `"LenZ" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to LenZ!",
      html: emailTemplate,
    };

    // Create a new user
    const newRider = new Rider({
      riderId,
      name,
      email,
      phone,
      vehicleNumber,
      password: hashedPassword,
    });

    await newRider.save();
    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: "Signup successful", newRider });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during signup" });
  }
});

router.post("/login", verifyApiKey, async (req, res) => {
  const { riderEmail, password } = req.body;

  try {
    // Check if the rider exists
    const email = riderEmail;
    const rider = await Rider.findOne({ email });
    if (!rider) {
      return res
        .status(401)
        .json({ message: "Rider Not Found", confirmation: false });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Invalid Password", confirmation: false });
    }

    res.json({ message: "Login Successful", confirmation: true });
  } catch (error) {
    res.status(500).json({ message: "Server error during login", confirmation: false });
  }
});

router.get("/", verifyApiKey, async (req, res) => {
  try {
    const riders = await Rider.find();
    res.status(200).json(riders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:riderId", verifyApiKey, async (req, res) => {
  const { riderId } = req.params;

  try {
    const rider = await Rider.findOne({ riderId });
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    res.status(200).json(rider);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:riderId/edit-working-status", verifyApiKey, async (req, res) => {
  const { riderId } = req.params;
  const { newStatus } = req.body;

  try {
    if (newStatus != true && newStatus != false) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const rider = await Rider.findOne({ riderId });
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    if (rider.isAvailable === false)
      return res.status(400).json({ error: "Rider is not available" });

    rider.isWorking = newStatus;
    await rider.save();

    res.status(200).json({
      message: "Working Status updated successfully",
      confirmation: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:riderId/edit-phone-number", verifyApiKey, async (req, res) => {
  const { riderId } = req.params;
  const { newPhoneNumber } = req.body;

  try {
    if (!newPhoneNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const rider = await Rider.findOne({ riderId });
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    rider.phone = newPhoneNumber;
    await rider.save();

    res.status(200).json({
      message: "Mobile Number updated successfully",
      confirmation: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// API to get orders by rider_id
router.get("/order-history/:riderId", async (req, res) => {
  try {
    const { riderId } = req.params;

    // Validate riderId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Find orders for the given rider_id
    const orders = await RiderOrderHistory.find({ rider_id: riderId });

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ message: "No orders found for this rider" });
    }

    // Respond with the filtered orders
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching rider orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
