const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
// Import your database model (adjust based on your DB setup)
const Order = require("../models/Order");
const User = require("../models/User");
const GroupOrder = require("../models/GroupOrder");
const TrackingOtp = require("../models/TrackingOtp");
const Rider = require("../models/Rider");
const RiderOrderHistory = require("../models/RiderOrderHistory");
const Admin = require("../models/Admin");

const nodemailer = require("nodemailer");
const { verify } = require("crypto");
const { group } = require("console");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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

// Route to store order details
router.post("/place-order", async (req, res) => {
  try {
    const { userId, ...orderDetails } = req.body;

    // Validate if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", confirmation: false });
    }

    // Create the order with the userId
    const newOrder = new Order({ userId, ...orderDetails });
    const savedOrder = await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully",
      confirmation: true,
      data: savedOrder,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to place order", confirmation: false, error });
  }
});

router.get("/get-order/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).populate(
      "userId",
      "name email phone plan"
    );
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve orders",
      confirmation: false,
      error,
    });
  }
});

router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const orders = await Order.findById(orderId);
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve orders",
      confirmation: false,
      error,
    });
  }
});

//delete order
router.delete("/delete-order/:orderId", authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;
    await Order.findByIdAndDelete(orderId);
    res
      .status(200)
      .json({ message: "Order deleted successfully", confirmation: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete order", confirmation: false, error });
  }
});

// Route to create a group order
router.post("/create-group-order", async (req, res) => {
  try {
    const { userId, orderIds, paymentOption } = req.body;

    // Validate if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", confirmation: false });
    }

    // Fetch the selected orders
    const orders = await Order.find({ _id: { $in: orderIds } });
    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found", confirmation: false });
    }

    // Calculate total amount
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const deliveryCharge = user.deliveryCharge;
    const finalAmount = totalAmount + deliveryCharge;
    const paidAmount =
      paymentOption === "full" ? totalAmount + deliveryCharge : deliveryCharge;
    const leftAmount = paymentOption === "full" ? 0 : totalAmount;

    const shopPickupKey = require("crypto").randomUUID();

    // Calculate pickup amount
    pickupAmount = 0.4 * deliveryCharge;

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
      shop_pickup: {
        key: shopPickupKey,
      },
    });
    const savedGroupOrder = await newGroupOrder.save();

    // Update the payment status of individual orders
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          isGroupOrder: true,
          groupOrderId: savedGroupOrder._id,
          paymentStatus: savedGroupOrder.paymentStatus,
        },
      }
    );

    const newOrderHistory = new RiderOrderHistory({
      order_key: savedGroupOrder.shop_pickup.key,
      paymentAmount: pickupAmount,
      delivery_type: "pickup",
      group_order_ids: [savedGroupOrder._id],
      shop_details: {
        shopName: user.shopName,
        dealerName: user.name,
        address: user.address,
        phone: user.phone,
        alternatePhone: user.alternatePhone,
      }
    });
    const savedOrderHistory = await newOrderHistory.save();

    // Update the group order with the saved order history id
    savedGroupOrder.shop_pickup._id = savedOrderHistory._id;
    await savedGroupOrder.save();

    // Update Credit Balance
    user.creditBalance = user.creditBalance + savedGroupOrder.leftAmount;
    await user.save();

    // Notify the admin using Socket.IO
    notifyAdmin(savedGroupOrder, req.app.get("io"));

    res.status(201).json({
      message: "Group order created successfully",
      confirmation: true,
      data: savedGroupOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create group order",
      confirmation: false,
      error,
    });
  }
});

// Function to notify the admin (you can implement this logic)
const notifyAdmin = (groupOrder, io) => {
  console.log(
    `Notification: A new group order has been created with ID ${groupOrder._id}`
  );

  // Emit a real-time event to the admin
  io.to("adminRoom").emit("newGroupOrder", {
    message: "A new group order has been created!",
    groupOrderId: groupOrder._id,
    userId: groupOrder.userId,
    totalAmount: groupOrder.totalAmount,
    paymentStatus: groupOrder.paymentStatus,
  });
};

router.get("/get-all-group-orders", verifyApiKey, async (req, res) => {
  try {
    const groupOrders = await GroupOrder.find().populate("orders");
    res.status(200).json({ data: groupOrders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch group orders", error });
  }
});

router.get("/get-group-orders", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
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
    const groupOrder = await GroupOrder.findById(groupOrderId).populate(
      "orders"
    );
    res.status(200).json({ data: groupOrder });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch group order details", error });
  }
});

// PATCH /api/orders/:groupOrderId/accept-pickup
router.patch("/:groupOrderId/accept-pickup", verifyApiKey, async (req, res) => {
  try {
    const { groupOrderId } = req.params;
    const { pickup_rider_id } = req.body;

    // Validate if the group order exists
    const groupOrder = await GroupOrder.findById(groupOrderId)
      .populate("userId")
      .populate("shop_pickup._id");
    if (!groupOrder) {
      return res
        .status(404)
        .json({ message: "GroupOrder not found", confirmation: false });
    }

    // Validate if the rider exists
    const rider = await Rider.findById(pickup_rider_id);
    if (!rider) {
      return res
        .status(404)
        .json({ message: "Rider not found", confirmation: false });
    }

    // Update the rider's availability to false
    if (rider.isWorking === true && rider.isAvailable === true) {
      rider.isAvailable = false;
      await rider.save();
    } else {
      return res.status(400).json({
        message: "Rider is not available or not working",
        confirmation: false,
      });
    }

    // Update the group order with rider details and change status
    groupOrder.tracking_status = "Pickup Accepted";
    await groupOrder.save();

    // Check if shop_pickup._id exists
    if (groupOrder.shop_pickup && groupOrder.shop_pickup._id) {
      const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
        groupOrder.shop_pickup._id._id,
        { rider_id: pickup_rider_id },
        { new: true } // Return the updated document
      );
      if (!riderOrderHistory) {
        return res.status(404).json({
          message: "RiderOrderHistory not found",
          confirmation: false,
        });
      }
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save the OTP to the database
    await TrackingOtp.create({
      groupOrder_id: groupOrderId,
      otp_code: otp,
      purpose: "shop_pickup",
    });

    // Send the OTP to the user's email
    const userEmail = groupOrder.userId.email;
    await transporter.sendMail({
      from: `"LenZ" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: "Your OTP for Order Pickup",
      text: `Your OTP for order pickup is ${otp}. It will expire in 5 minutes.`,
    });

    res.status(200).json({
      message: "Pickup accepted successfully. OTP sent to your email.",
      confirmation: true,
      data: groupOrder,
      otp: otp,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Failed to accept pickup", confirmation: false, error });
  }
});

// POST /api/orders/:groupOrderId/verify-pickup-otp
router.post(
  "/:groupOrderId/verify-pickup-otp",
  verifyApiKey,
  async (req, res) => {
    try {
      const { groupOrderId } = req.params;
      const { otp_code } = req.body;

      // Find the OTP in the database
      const otpRecord = await TrackingOtp.findOne({
        groupOrder_id: groupOrderId,
        otp_code,
        purpose: "shop_pickup",
      });
      if (!otpRecord) {
        return res
          .status(400)
          .json({ message: "Invalid OTP", confirmation: false });
      }

      // Update the group order status
      const groupOrder = await GroupOrder.findById(groupOrderId).populate(
        "admin_id"
      );
      if (!groupOrder) {
        return res
          .status(404)
          .json({ message: "GroupOrder not found", confirmation: false });
      }

      groupOrder.tracking_status = "Order Picked Up";
      await groupOrder.save();

      // Delete the OTP after verification
      await TrackingOtp.deleteOne({ _id: otpRecord._id });

      const adminOtp = Math.floor(100000 + Math.random() * 900000).toString();

      await TrackingOtp.create({
        groupOrder_id: groupOrderId,
        otp_code: adminOtp,
        purpose: "admin_delivery",
      });

      // Send the OTP to the admin's email
      const adminEmail = groupOrder.admin_id.email;
      await transporter.sendMail({
        from: `"LenZ" <${process.env.EMAIL_USER}>`,
        to: adminEmail,
        subject: "Your OTP for Admin Receipt",
        text: `Your OTP for admin receipt for order id : ${groupOrderId} is ${adminOtp}. It will expire in 5 minutes.`,
      });

      res.status(200).json({
        message: "OTP verified successfully. Admin OTP sent.",
        confirmation: true,
        data: groupOrder,
        otp: adminOtp,
      });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Failed to verify OTP", confirmation: false, error });
    }
  }
);

// POST /api/orders/:groupOrderId/verify-admin-otp
router.post(
  "/:groupOrderId/verify-admin-otp",
  verifyApiKey,
  async (req, res) => {
    try {
      const { groupOrderId } = req.params;
      const { otp_code, rider_id } = req.body;

      // Update the group order status
      const groupOrder = await GroupOrder.findById(groupOrderId).populate(
        "shop_pickup._id"
      );
      if (!groupOrder) {
        return res
          .status(404)
          .json({ message: "GroupOrder not found", confirmation: false });
      }

      const rider = await Rider.findById(rider_id);
      if (!rider) {
        return res
          .status(404)
          .json({ message: "Rider not found", confirmation: false });
      }

      if (groupOrder.shop_pickup._id.rider_id.toString() !== rider_id) {
        return res
          .status(400)
          .json({ message: "Invalid Rider", confirmation: false });
      }

      if(groupOrder.shop_pickup._id.delivery_type !== "pickup"){
        return res
        .status(400).json({ message: "Invalid Delivery Type", confirmation: false });
      }

      // Find the OTP in the database
      const otpRecord = await TrackingOtp.findOne({
        groupOrder_id: groupOrderId,
        otp_code,
        purpose: "admin_delivery",
      });
      if (!otpRecord) {
        return res
          .status(400)
          .json({ message: "Invalid OTP", confirmation: false });
      }

      // Update the rider's availability to false
      rider.isAvailable = true;
      await rider.save();

      const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
        groupOrder.shop_pickup._id._id,
        { isCompleted: true },
        { new: true }
      );
      if (!riderOrderHistory) {
        return res.status(404).json({
          message: "RiderOrderHistory not found",
          confirmation: false,
        });
      }

      groupOrder.tracking_status = "Order Received By Admin";
      await groupOrder.save();

      // Delete the OTP after verification
      await TrackingOtp.deleteOne({ _id: otpRecord._id });

      res.status(200).json({
        message: "OTP verified successfully",
        confirmation: true,
        data: groupOrder,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to verify OTP", confirmation: false, error });
    }
  }
);

// PATCH /api/orders/:groupOrderId/complete-work
router.patch("/:groupOrderId/complete-work", verifyApiKey, async (req, res) => {
  try {
    const { groupOrderId } = req.params;

    // Validate if the group order exists
    const groupOrder = await GroupOrder.findById(groupOrderId);
    if (!groupOrder) {
      return res
        .status(404)
        .json({ message: "GroupOrder not found", confirmation: false });
    }

    // Validate the current tracking status
    if (groupOrder.tracking_status !== "Order Received By Admin") {
      let errorMessage = "Work cannot be completed at this stage.";
      if (groupOrder.tracking_status === "Out For Delivery") {
        errorMessage =
          "Work cannot be completed because the order is already out for delivery.";
      } else if (groupOrder.tracking_status === "Order Completed") {
        errorMessage =
          "Work cannot be completed because the order is already completed.";
      }
      return res
        .status(400)
        .json({ message: errorMessage, confirmation: false });
    }

    // Update the group order status
    groupOrder.tracking_status = "Work Completed";
    await groupOrder.save();

    res.status(200).json({
      message: "Work completed successfully",
      confirmation: true,
      data: groupOrder,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to complete work", confirmation: false, error });
  }
});

// POST /api/orders/call-for-pickup
router.post("/call-for-pickup", verifyApiKey, async (req, res) => {
  try {
    const { groupOrderIds, delAmount } = req.body;

    // Validate if groupOrderIds is provided and is an array
    if (
      !groupOrderIds ||
      !Array.isArray(groupOrderIds) ||
      groupOrderIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Invalid groupOrderIds", confirmation: false });
    }

    // Fetch all group orders with the provided IDs
    const groupOrders = await GroupOrder.find({ _id: { $in: groupOrderIds } });

    // Validate that all group orders exist
    if (groupOrders.length !== groupOrderIds.length) {
      return res
        .status(404)
        .json({ message: "Some group orders not found", confirmation: false });
    }

    const invalidOrders = groupOrders.filter(
      (order) => order.tracking_status !== "Work Completed"
    );
    if (invalidOrders.length > 0) {
      const invalidOrderIds = invalidOrders.map((order) => order._id);
      return res.status(400).json({
        message: "Some group orders are not in 'Work Completed' status",
        confirmation: false,
        invalidOrderIds,
      });
    }

    const adminPickupKey = require("crypto").randomUUID();

    const newOrderHistory = new RiderOrderHistory({
      order_key: adminPickupKey,
      paymentAmount: delAmount,
      delivery_type: "delivery",
      group_order_ids: groupOrderIds,
    });
    const savedOrderHistory = await newOrderHistory.save();

    // Update the group order with the saved order history id
    const updateHistoryId = await GroupOrder.updateMany(
      { _id: { $in: groupOrderIds } },
      {
        $set: {
          admin_pickup: { _id: savedOrderHistory._id, key: adminPickupKey },
        },
      }
    );

    if (updateHistoryId.modifiedCount === 0) {
      return res.status(404).json({
        message: "No group orders found or updated with History ID",
        confirmation: false,
      });
    }

    const updateResult = await GroupOrder.updateMany(
      { _id: { $in: groupOrderIds } },
      {
        $set: {
          tracking_status: "Internal Tracking",
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        message: "No group orders found or updated",
        confirmation: false,
      });
    }

    res.status(200).json({
      message: "Admin pickup key assigned successfully",
      confirmation: true,
      data: { admin_pickup_key: adminPickupKey, groupOrderIds },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to assign common pickup key",
      confirmation: false,
      error,
    });
  }
});

// POST /api/orders/assign-rider
router.post("/assign-rider", verifyApiKey, async (req, res) => {
  try {
    const { admin_pickup_key, delivery_rider_id } = req.body;

    // Validate inputs
    if (!admin_pickup_key || !delivery_rider_id) {
      return res
        .status(400)
        .json({ message: "Invalid input", confirmation: false });
    }

    // Validate rider
    const rider = await Rider.findById(delivery_rider_id);
    if (!rider) {
      return res
        .status(404)
        .json({ message: "Rider not found", confirmation: false });
    }

    // Check if the rider is available and working
    if (!rider.isAvailable || !rider.isWorking) {
      return res.status(400).json({
        message: "Rider is not available or not working",
        confirmation: false,
      });
    }

    // Fetch RiderOrderHistory by admin_pickup_key
    const riderOrderHistory = await RiderOrderHistory.findOne({
      order_key: admin_pickup_key,
      delivery_type: "delivery",
    });
    if (!riderOrderHistory) {
      return res.status(404).json({
        message: "RiderOrderHistory not found for the given key",
        confirmation: false,
      });
    }

    // Fetch all group orders associated with the group_order_ids
    const groupOrders = await GroupOrder.find({
      _id: { $in: riderOrderHistory.group_order_ids },
    }).populate("userId");

    if (!groupOrders.length) {
      return res.status(404).json({
        message: "No group orders found for the given key",
        confirmation: false,
      });
    }

    // Group orders by userId
    const groupedOrders = {};
    groupOrders.forEach((order) => {
      const userId = order.userId._id.toString();
      if (!groupedOrders[userId]) {
        groupedOrders[userId] = {
          userId,
          shopName: order.userId.shopName,
          address: order.userId.address,
          orders: [],
        };
      }
      groupedOrders[userId].orders.push(order._id);
    });

    // Convert groupedOrders object to an array
    const groupedOrdersArray = Object.values(groupedOrders);

    // Update RiderOrderHistory with the delivery_rider_id and grouped_orders
    riderOrderHistory.rider_id = delivery_rider_id;
    riderOrderHistory.grouped_orders = groupedOrdersArray; // Save grouped orders
    await riderOrderHistory.save();

    const groupOrder = await GroupOrder.findById(riderOrderHistory.group_order_ids[0]);

    if (!groupOrder) {
      return res.status(404).json({
        message: "GroupOrder not found",
        confirmation: false,
      });
    }
    const admin_id = groupOrder.admin_id;

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save the OTP in the TrackingOtp collection
    await TrackingOtp.create({
      order_key: admin_pickup_key,
      otp_code: otp,
      purpose: "admin_pickup",
    });

    // Send the OTP to the admin's email
    const admin = await Admin.findById(admin_id);
    if (admin) {
      await transporter.sendMail({
        from: `"LenZ" <${process.env.EMAIL_USER}>`,
        to: admin.email,
        subject: "Your OTP for Order Delivery",
        text: `Your OTP for order delivery with key ${admin_pickup_key} is ${otp}.`,
      });
    }

    // Update GroupOrder documents with the assigned rider and change tracking status
    await GroupOrder.updateMany(
      { _id: { $in: riderOrderHistory.group_order_ids } },
      {
        $set: {
          tracking_status: "Delivery Accepted",
        },
      }
    );

    // Update rider's availability
    rider.isAvailable = false;
    await rider.save();

    // Send response
    res.status(200).json({
      message: "Rider assigned successfully. OTP sent to admin.",
      confirmation: true,
      data: {
        rider: {
          _id: rider._id,
          name: rider.name,
          phone: rider.phone,
        },
        groupedOrders: groupedOrdersArray,
        otp: otp,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to assign rider",
      confirmation: false,
      error: error.message,
    });
  }
});

// POST /api/orders/:groupOrderId/verify-delivery-otp
router.post(
  "/:groupOrderId/verify-delivery-otp",
  verifyApiKey,
  async (req, res) => {
    try {
      const { groupOrderId } = req.params;
      const { otp_code } = req.body;

      // Find the OTP in the database
      const otpRecord = await TrackingOtp.findOne({
        groupOrder_id: groupOrderId,
        otp_code,
        purpose: "delivery",
      });
      if (!otpRecord) {
        return res
          .status(400)
          .json({ message: "Invalid OTP", confirmation: false });
      }

      // Update the group order status
      const groupOrder = await GroupOrder.findById(groupOrderId);
      if (!groupOrder) {
        return res
          .status(404)
          .json({ message: "GroupOrder not found", confirmation: false });
      }

      const rider = await Rider.findById(groupOrder.delivery_rider_id);
      if (!rider) {
        return res
          .status(404)
          .json({ message: "Rider not found", confirmation: false });
      }

      groupOrder.tracking_status = "Order Completed";
      await groupOrder.save();

      // Update the rider's availability to false
      rider.isAvailable = true;
      await rider.save();

      // Delete the OTP after verification
      await OTP.deleteOne({ _id: otpRecord._id });

      // Check if all group orders with the same common_pickup_key are completed
      const commonPickupKey = groupOrder.common_pickup_key;
      const allGroupOrders = await GroupOrder.find({
        common_pickup_key: commonPickupKey,
      });

      const allCompleted = allGroupOrders.every(
        (order) => order.tracking_status === "Order Completed"
      );

      if (allCompleted) {
        // Create the Delivery Order History to the database
        await RiderOrderHistory.create({
          rider_id: groupOrder.delivery_rider_id,
          delivery_type: "delivery",
          order_key: groupOrder.common_pickup_key,
          paymentAmount: groupOrder.delAmount,
        });
      }

      res.status(200).json({
        message: "OTP verified successfully",
        confirmation: true,
        data: groupOrder,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to verify OTP", confirmation: false, error });
    }
  }
);

module.exports = router;
