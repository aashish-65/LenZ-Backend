const express = require('express');
const nodemailer = require('nodemailer');
const OTP = require('../models/Otp'); // Import OTP schema
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Configure nodemailer for email
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Request OTP
router.post('/request-otp', authenticate, async (req, res) => {
  const { email, phone } = req.body;
  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to the database
    await OTP.create({ email, phone, otp });

    // Send OTP via email (or phone using Twilio)
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      });
    }

    res.status(200).json({ message: 'OTP sent successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

router.post('/verify-otp', authenticate, async (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
      }
    try {
      // Find the OTP in the database
      const record = await OTP.findOne({ email, otp });
  
      if (!record) {
        return res.status(402).json({ message: 'Invalid OTP.' });
      }
  
      // If OTP exists, delete it to prevent reuse
      await OTP.deleteOne({ _id: record._id });
  
      res.status(200).json({ message: 'OTP verified successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to verify OTP.' });
    }
  });

module.exports = router;  
