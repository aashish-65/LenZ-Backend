const express = require('express');
const nodemailer = require('nodemailer');
const OTP = require('../models/Otp'); // Import OTP schema
const GroupOrder = require('../models/GroupOrder'); // Import GroupOrder schema
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Configure nodemailer for email
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Request OTP for order tracking
router.post('/request-otp', authenticate, async (req, res) => {
  const { groupOrder_id, email, phone, purpose } = req.body;

  if (!groupOrder_id || !purpose) {
    return res.status(400).json({ message: 'GroupOrder ID and purpose are required.' });
  }

  try {
    // Check if the group order exists
    const groupOrder = await GroupOrder.findById(groupOrder_id);
    if (!groupOrder) {
      return res.status(404).json({ message: 'GroupOrder not found.' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to the database
    await OTP.create({ groupOrder_id, email, phone, otp, purpose });

    // Send OTP via email (or phone using Twilio)
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      });
    }

    res.status(200).json({ message: 'OTP sent successfully.', otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

// Verify OTP for order tracking
router.post('/verify-otp', authenticate, async (req, res) => {
  const { groupOrder_id, otp, purpose } = req.body;

  if (!groupOrder_id || !otp || !purpose) {
    return res.status(400).json({ message: 'GroupOrder ID, OTP, and purpose are required.' });
  }

  try {
    // Find the OTP in the database
    const record = await OTP.findOne({ groupOrder_id, otp, purpose });

    if (!record) {
      return res.status(402).json({ message: 'Invalid OTP.' });
    }

    // If OTP exists, delete it to prevent reuse
    await OTP.deleteOne({ _id: record._id });

    // Update the GroupOrder status based on the purpose
    const groupOrder = await GroupOrder.findById(groupOrder_id);
    if (!groupOrder) {
      return res.status(404).json({ message: 'GroupOrder not found.' });
    }

    switch (purpose) {
      case 'pickup':
        groupOrder.tracking_status = 'Order Picked Up';
        break;
      case 'admin_receipt':
        groupOrder.tracking_status = 'Order Received By Admin';
        break;
      case 'delivery':
        groupOrder.tracking_status = 'Order Completed';
        break;
      default:
        return res.status(400).json({ message: 'Invalid purpose.' });
    }

    await groupOrder.save();

    res.status(200).json({ message: 'OTP verified successfully.', tracking_status: groupOrder.tracking_status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to verify OTP.' });
  }
});

module.exports = router;