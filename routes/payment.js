const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");

router.post("/order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = req.body;
    console.log(options);
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Order creation failed");
    }
    console.log(order);
    res.status(200).send(order);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

router.post("/verify", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;

  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  sha.update(razorpay_order_id + "|" + razorpay_payment_id);
  const digest = sha.digest("hex");

  if (digest !== razorpay_signature) {
    return res.status(400).json({ msg: "Payment verification failed" });
  }

  res
    .status(200)
    .json({
      msg: "success",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
});

module.exports = router;
