const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const axios = require("axios");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const Order = require("../models/Order");
const User = require("../models/User");
const GroupOrder = require("../models/GroupOrder");
const TrackingOtp = require("../models/TrackingOtp");
const Rider = require("../models/Rider");
const RiderOrderHistory = require("../models/RiderOrderHistory");
const Admin = require("../models/Admin");
const admin = require("../firebase");
const dotenv = require("dotenv");
dotenv.config();

const nodemailer = require("nodemailer");
const { verify } = require("crypto");
const { group } = require("console");
const e = require("express");

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

const sendFCMNotification = async (title, body, data) => {
  try {
    const riders = await Rider.find({
      isAvailable: true,
      isWorking: true,
      fcmToken: { $exists: true, $ne: null },
    });

    const tokens = riders.map((rider) => rider.fcmToken);
    if (tokens.length === 0) {
      console.log("No available riders with FCM tokens.");
      return;
    }

    const isOperationCreate = data.operation === "create";

    const payload = isOperationCreate
      ? {
          notification: {
            title: title,
            body: body,
            // priority: "high",
          },
          android: {
            notification: {
              sound: "vivek",
              channelId: "order_notifications",
              // priority: "high",
            },
          },
          data: data,
        }
      : { data: data };

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      ...(isOperationCreate && {
        notification: payload.notification,
        android: payload.android,
      }),
      data: payload.data,
      // priority: "high",
    });
    console.log("FCM Notification Sent locally:", response);
  } catch (error) {
    console.error("Error sending FCM notification locally:", error);
  }
};

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

    const cryptoKey = require("crypto").randomUUID();
    const shopPickupKey = cryptoKey.split("-").pop();

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
      },
    });
    const savedOrderHistory = await newOrderHistory.save();

    // Update the group order with the saved order history id
    savedGroupOrder.shop_pickup._id = savedOrderHistory._id;
    await savedGroupOrder.save();

    // Update Credit Balance
    user.creditBalance = user.creditBalance + savedGroupOrder.leftAmount;
    await user.save();

    const orderDetails = await RiderOrderHistory.findById(
      savedOrderHistory._id
    ).populate({
      path: "group_order_ids",
      select: "_id tracking_status",
    });

    console.log(orderDetails);

    const title = "New Order Available";
    const body = `A new order is ready for pickup from SHOP!`;
    const data = { order_key: orderDetails.order_key, operation: "create" };

    // Send FCM notification to riders
    sendFCMNotification(title, body, data);

    res.status(201).json({
      message: "Group order created successfully",
      confirmation: true,
      data: savedGroupOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create group order",
      confirmation: false,
      error,
    });
  }
});

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

    // Validate if the order is in the correct status
    if (groupOrder.tracking_status !== "Order Placed For Pickup") {
      return res.status(400).json({
        message: "Order is not in 'Order Placed For Pickup' status",
        confirmation: false,
      });
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

    // Check if shop_pickup._id exists
    if (groupOrder.shop_pickup && groupOrder.shop_pickup._id) {
      const riderOrderHistory = await RiderOrderHistory.findById(
        groupOrder.shop_pickup._id._id
      );
      if (riderOrderHistory.rider_id) {
        return res.status(400).json({
          message: "Rider is already assigned to this order",
          confirmation: false,
        });
      }
      await RiderOrderHistory.findByIdAndUpdate(
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

    // Update the group order with rider details and change status
    groupOrder.tracking_status = "Pickup Accepted";
    await groupOrder.save();

    // Generate a 6-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

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

    const orderDetails = await RiderOrderHistory.findById(
      groupOrder.shop_pickup._id._id
    ).populate({
      path: "group_order_ids",
      select: "_id tracking_status",
    });

    const title = "Order Pickup Accepted";
    const body = `Your order is accepted by ${rider.name} for pickup from shop!`;
    const data = { order_key: orderDetails.order_key, operation: "remove" };
    await sendFCMNotification(title, body, data);

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

      if (otp_code === "0000") {
        // Update the group order status
        const groupOrder = await GroupOrder.findById(groupOrderId).populate(
          "admin_id"
        );
        if (!groupOrder) {
          return res
            .status(404)
            .json({ message: "GroupOrder not found", confirmation: false });
        }

        const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
          groupOrder.shop_pickup._id,
          { isPickupVerified: true },
          { new: true } // Return the updated document
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        const adminOtp = Math.floor(1000 + Math.random() * 9000).toString();

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

        groupOrder.tracking_status = "Order Picked Up";
        await groupOrder.save();

        res.status(200).json({
          message: "OTP verified successfully. Admin OTP sent.",
          confirmation: true,
        });
      } else {
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

        const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
          groupOrder.shop_pickup._id,
          { isPickupVerified: true },
          { new: true } // Return the updated document
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        // Delete the OTP after verification
        await TrackingOtp.deleteOne({ _id: otpRecord._id });

        const adminOtp = Math.floor(1000 + Math.random() * 9000).toString();

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

        groupOrder.tracking_status = "Order Picked Up";
        await groupOrder.save();

        res.status(200).json({
          message: "OTP verified successfully. Admin OTP sent.",
          confirmation: true,
          // data: groupOrder,
          // otp: adminOtp,
        });
      }
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

      if (groupOrder.shop_pickup._id.delivery_type !== "pickup") {
        return res
          .status(400)
          .json({ message: "Invalid Delivery Type", confirmation: false });
      }

      if (otp_code === "0000") {
        const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
          groupOrder.shop_pickup._id._id,
          { isDropVerified: true },
          { new: true }
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        // Update the rider's order and earnings
        rider.totalOrders++;
        rider.dailyOrders++;
        await rider.save();

        groupOrder.tracking_status = "Order Received By Admin";
        await groupOrder.save();

        res.status(200).json({
          message: "OTP verified successfully",
          confirmation: true,
          data: groupOrder,
        });
      } else {
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

        const riderOrderHistory = await RiderOrderHistory.findByIdAndUpdate(
          groupOrder.shop_pickup._id._id,
          { isDropVerified: true },
          { new: true }
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        // Update the rider's order and earnings
        rider.totalOrders++;
        rider.dailyOrders++;
        await rider.save();

        groupOrder.tracking_status = "Order Received By Admin";
        await groupOrder.save();

        // Delete the OTP after verification
        await TrackingOtp.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
          message: "OTP verified successfully",
          confirmation: true,
          data: groupOrder,
        });
      }
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
    const groupOrders = await GroupOrder.find({
      _id: { $in: groupOrderIds },
    }).populate("userId");

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

    const cryptoKey = require("crypto").randomUUID();
    const adminPickupKey = cryptoKey.split("-").pop();

    // Group orders by userId
    const groupedOrders = {};
    groupOrders.forEach((order) => {
      const userId = order.userId._id.toString();
      if (!groupedOrders[userId]) {
        groupedOrders[userId] = {
          userId,
          shopName: order.userId.shopName,
          dealerName: order.userId.name,
          phone: order.userId.phone,
          alternatePhone: order.userId.alternatePhone,
          address: order.userId.address,
          orders: [],
        };
      }
      groupedOrders[userId].orders.push(order._id);
    });

    // Convert groupedOrders object to an array
    const groupedOrdersArray = Object.values(groupedOrders);

    const newOrderHistory = new RiderOrderHistory({
      order_key: adminPickupKey,
      paymentAmount: delAmount,
      delivery_type: "delivery",
      group_order_ids: groupOrderIds,
      grouped_orders: groupedOrdersArray,
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

    const orderDetails = await RiderOrderHistory.findById(
      savedOrderHistory._id
    ).populate({
      path: "group_order_ids",
      select: "_id tracking_status",
    });

    const title = "New Order Available";
    const body = `A new order is ready for pickup from ADMIN!`;
    const data = { order_key: orderDetails.order_key, operation: "create" };

    // Send FCM notification to riders
    sendFCMNotification(title, body, data);

    res.status(200).json({
      message: "Admin pickup key assigned successfully",
      confirmation: true,
      data: { admin_pickup_key: adminPickupKey, groupOrderIds },
    });
  } catch (error) {
    console.error(error);
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

    if (riderOrderHistory.rider_id) {
      return res.status(400).json({
        message: "Rider already assigned",
        confirmation: false,
      });
    }

    riderOrderHistory.rider_id = delivery_rider_id;
    await riderOrderHistory.save();

    const groupOrder = await GroupOrder.findById(
      riderOrderHistory.group_order_ids[0]
    );

    if (!groupOrder) {
      return res.status(404).json({
        message: "GroupOrder not found",
        confirmation: false,
      });
    }
    const admin_id = groupOrder.admin_id;

    // Generate a 6-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

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

    const orderDetails = await RiderOrderHistory.findById(
      riderOrderHistory._id
    ).populate({
      path: "group_order_ids",
      select: "_id tracking_status",
    });

    const title = "New Order Available";
    const body = `Rider ${rider.name} assigned for order from ADMIN!`;
    const data = { order_key: orderDetails.order_key, operation: "remove" };

    // Send FCM notification to riders
    sendFCMNotification(title, body, data);

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

router.post(
  "/:order_key/verify-admin-pickup-otp",
  verifyApiKey,
  async (req, res) => {
    try {
      const { order_key } = req.params;
      const { rider_id, otp_code } = req.body;

      // Validate inputs
      if (!order_key || !rider_id || !otp_code) {
        return res
          .status(400)
          .json({ message: "Invalid input", confirmation: false });
      }

      // Validate rider
      const rider = await Rider.findById(rider_id);
      if (!rider) {
        return res
          .status(404)
          .json({ message: "Rider not found", confirmation: false });
      }

      // Validate RiderOrderHistory by order_key
      const riderOrderHistory = await RiderOrderHistory.findOne({
        order_key,
        rider_id,
        delivery_type: "delivery", // Ensure it's for delivery
      });
      if (!riderOrderHistory) {
        return res.status(404).json({
          message:
            "RiderOrderHistory not found for the given order key and rider",
          confirmation: false,
        });
      }

      if (otp_code === "0000") {
        // Fetch all group orders associated with the group_order_ids
        const groupOrders = await GroupOrder.find({
          _id: { $in: riderOrderHistory.group_order_ids },
        }).populate("userId");

        // Generate and send OTPs for each group order
        for (const groupOrder of groupOrders) {
          const userId = groupOrder.userId._id;
          const userEmail = groupOrder.userId.email;

          // Generate a 6-digit OTP
          const otp = Math.floor(1000 + Math.random() * 9000).toString();

          // Save the OTP in the TrackingOtp collection
          await TrackingOtp.create({
            groupOrder_id: groupOrder._id,
            otp_code: otp,
            purpose: "shop_delivery", // OTP purpose is shop_delivery
          });

          // Send the OTP to the user's email
          await transporter.sendMail({
            from: `"LenZ" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: "Your OTP for Order Delivery",
            text: `Your OTP for order delivery with order ID ${groupOrder._id} is ${otp}.`,
          });
        }

        // Update RiderOrderHistory
        riderOrderHistory.isPickupVerified = true;
        await riderOrderHistory.save();

        // Update the status of all group orders in the group_order_ids array
        await GroupOrder.updateMany(
          { _id: { $in: riderOrderHistory.group_order_ids } },
          {
            $set: {
              tracking_status: "Out For Delivery",
            },
          }
        );

        res.status(200).json({
          message:
            "OTP verified successfully. Orders marked as out for delivery. OTPs sent to users.",
          confirmation: true,
        });
      } else {
        // Validate OTP
        const otpRecord = await TrackingOtp.findOne({
          order_key,
          otp_code,
          purpose: "admin_pickup", // Ensure the OTP is for admin pickup
        });
        if (!otpRecord) {
          return res
            .status(400)
            .json({ message: "Invalid OTP", confirmation: false });
        }

        // Fetch all group orders associated with the group_order_ids
        const groupOrders = await GroupOrder.find({
          _id: { $in: riderOrderHistory.group_order_ids },
        }).populate("userId");

        // Generate and send OTPs for each group order
        for (const groupOrder of groupOrders) {
          const userId = groupOrder.userId._id;
          const userEmail = groupOrder.userId.email;

          // Generate a 6-digit OTP
          const otp = Math.floor(1000 + Math.random() * 9000).toString();

          // Save the OTP in the TrackingOtp collection
          await TrackingOtp.create({
            groupOrder_id: groupOrder._id,
            otp_code: otp,
            purpose: "shop_delivery", // OTP purpose is shop_delivery
          });

          // Send the OTP to the user's email
          await transporter.sendMail({
            from: `"LenZ" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: "Your OTP for Order Delivery",
            text: `Your OTP for order delivery with order ID ${groupOrder._id} is ${otp}.`,
          });
        }

        // Update RiderOrderHistory
        riderOrderHistory.isPickupVerified = true;
        await riderOrderHistory.save();

        // Update the status of all group orders in the group_order_ids array
        await GroupOrder.updateMany(
          { _id: { $in: riderOrderHistory.group_order_ids } },
          {
            $set: {
              tracking_status: "Out For Delivery",
            },
          }
        );

        // Delete the OTP after verification
        await TrackingOtp.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
          message:
            "OTP verified successfully. Orders marked as out for delivery. OTPs sent to users.",
          confirmation: true,
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Failed to verify OTP",
        confirmation: false,
        error: error.message,
      });
    }
  }
);

// POST /api/orders/:groupOrderId/verify-delivery-otp
router.post(
  "/:groupOrderId/verify-delivery-otp",
  verifyApiKey,
  async (req, res) => {
    try {
      const { groupOrderId } = req.params;
      const { otp_code, rider_id } = req.body;

      // Update the group order status
      const groupOrder = await GroupOrder.findById(groupOrderId).populate(
        "admin_pickup._id"
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

      if (groupOrder.admin_pickup._id.rider_id.toString() !== rider_id) {
        return res
          .status(400)
          .json({ message: "Invalid Rider", confirmation: false });
      }

      if (groupOrder.admin_pickup._id.delivery_type !== "delivery") {
        return res
          .status(400)
          .json({ message: "Invalid Delivery Type", confirmation: false });
      }

      if (otp_code === "0000") {
        groupOrder.tracking_status = "Order Completed";
        await groupOrder.save();

        const riderOrderHistory = await RiderOrderHistory.findById(
          groupOrder.admin_pickup._id._id
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        const groupOrderIds = riderOrderHistory.group_order_ids;

        // Fetch all group orders associated with the group_order_ids
        const groupOrders = await GroupOrder.find({
          _id: { $in: groupOrderIds },
        });

        // Check if all group orders have tracking_status === "Order Completed"
        const allOrdersCompleted = groupOrders.every(
          (order) => order.tracking_status === "Order Completed"
        );

        if (allOrdersCompleted) {
          // Update isDropVerified in RiderOrderHistory
          riderOrderHistory.isDropVerified = true;
          await riderOrderHistory.save();
        }

        // Update the rider's order and earnings
        rider.totalOrders++;
        rider.dailyOrders++;
        await rider.save();

        res.status(200).json({
          message: "OTP verified successfully",
          confirmation: true,
          data: groupOrder,
        });
      } else {
        // Find the OTP in the database
        const otpRecord = await TrackingOtp.findOne({
          groupOrder_id: groupOrderId,
          otp_code,
          purpose: "shop_delivery",
        });
        if (!otpRecord) {
          return res
            .status(401)
            .json({ message: "Invalid OTP", confirmation: false });
        }

        groupOrder.tracking_status = "Order Completed";
        await groupOrder.save();

        const riderOrderHistory = await RiderOrderHistory.findById(
          groupOrder.admin_pickup._id._id
        );
        if (!riderOrderHistory) {
          return res.status(404).json({
            message: "RiderOrderHistory not found",
            confirmation: false,
          });
        }

        const groupOrderIds = riderOrderHistory.group_order_ids;

        // Fetch all group orders associated with the group_order_ids
        const groupOrders = await GroupOrder.find({
          _id: { $in: groupOrderIds },
        });

        // Check if all group orders have tracking_status === "Order Completed"
        const allOrdersCompleted = groupOrders.every(
          (order) => order.tracking_status === "Order Completed"
        );

        if (allOrdersCompleted) {
          // Update isDropVerified in RiderOrderHistory
          riderOrderHistory.isDropVerified = true;
          await riderOrderHistory.save();
        }

        // Update the rider's order and earnings
        rider.totalOrders++;
        rider.dailyOrders++;
        await rider.save();

        // Delete the OTP after verification
        await otpRecord.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
          message: "OTP verified successfully",
          confirmation: true,
          data: groupOrder,
        });
      }
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Failed to verify OTP", confirmation: false, error });
    }
  }
);

// PATCH /api/orders/:orderKey/complete-transit
router.patch("/:orderKey/complete-transit", verifyApiKey, async (req, res) => {
  try {
    const { orderKey } = req.params;
    const { riderId } = req.body;

    if (!orderKey || !riderId) {
      return res
        .status(400)
        .json({ message: "Missing required fields", confirmation: false });
    }

    // check if riderId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      return res
        .status(400)
        .json({ message: "Invalid riderId", confirmation: false });
    }

    // Validate if the order exists
    const order = await RiderOrderHistory.findOne({ order_key: orderKey });
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found", confirmation: false });
    }

    if (order.isCompleted) {
      return res
        .status(400)
        .json({ message: "Order already completed", confirmation: false });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res
        .status(404)
        .json({ message: "Rider not found", confirmation: false });
    }

    // Check if the rider is authorized to complete the work
    if (order.rider_id.toString() !== riderId) {
      return res
        .status(401)
        .json({ message: "Unauthorized", confirmation: false });
    }

    // Check if drop is verified
    if (!order.isDropVerified) {
      return res
        .status(400)
        .json({ message: "Drop is not completed", confirmation: false });
    }

    // Update the status of isCompleted in RiderOrderHistory
    order.isCompleted = true;
    await order.save();

    // Update the rider's availability
    rider.totalEarnings += order.paymentAmount;
    rider.dailyEarnings += order.paymentAmount;
    rider.isAvailable = true;
    await rider.save();

    res.status(200).json({
      message: "Work completed successfully",
      confirmation: true,
      data: order,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to complete work", confirmation: false, error });
  }
});

router.get("/active-shop-orders/:shopId", verifyApiKey, async (req, res) => {
  try {
    const { shopId } = req.params;
    const isValidShopId = mongoose.Types.ObjectId.isValid(shopId);
    if (!isValidShopId) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    // Get group orders with specified tracking statuses
    const groupOrders = await GroupOrder.find({
      userId: shopId,
      tracking_status: { $in: ["Pickup Accepted", "Out For Delivery"] },
    }).populate("shop_pickup._id admin_pickup._id");

    // Process each group order
    const result = await Promise.all(
      groupOrders.map(async (groupOrder) => {
        const responseObj = {
          id: groupOrder._id.toString(),
          trackingStatus: groupOrder.tracking_status,
          otpCode: null,
          deliveryPersonName: "Not Available",
          deliveryPersonPhone: "Not Available",
        };

        // Determine purpose based on tracking status
        const purpose =
          groupOrder.tracking_status === "Pickup Accepted"
            ? "shop_pickup"
            : "shop_delivery";

        try {
          // Get OTP from external API
          const otpResponse = await axios.post(
            `${process.env.BACKEND_URL}/otp/request-tracking-otp`,
            {
              groupOrder_id: groupOrder._id,
              purpose: purpose,
            },
            {
              headers: {
                "Content-Type": "application/json",
                "lenz-api-key": process.env.AUTHORIZED_API_KEY,
              },
            }
          );

          if (otpResponse.data && otpResponse.data.otp_code) {
            responseObj.otpCode = otpResponse.data.otp_code;
          }
        } catch (error) {
          console.error("Error fetching OTP:", error.message);
        }

        // Get rider details based on tracking status
        const riderHistoryId =
          groupOrder.tracking_status === "Pickup Accepted"
            ? groupOrder.shop_pickup?._id?._id
            : groupOrder.admin_pickup?._id?._id;

        if (riderHistoryId) {
          const riderOrderHistory = await RiderOrderHistory.findById(
            riderHistoryId
          ).populate("rider_id");

          if (riderOrderHistory?.rider_id) {
            responseObj.deliveryPersonName = riderOrderHistory.rider_id.name;
            responseObj.deliveryPersonPhone = riderOrderHistory.rider_id.phone;
          }
        }

        return responseObj;
      })
    );

    res.status(200).json({
      message: "Active shop orders fetched successfully",
      confirmation: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch active shop orders",
      confirmation: false,
      error: error.message,
    });
  }
});

router.get("/active-admin-orders/:adminId", verifyApiKey, async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    // Check if Object Id is valid
    const isValidAdminId = mongoose.Types.ObjectId.isValid(adminId);
    if (!isValidAdminId) {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    const riderOrderHistorys = await RiderOrderHistory.find()
      .populate({
        path: "group_order_ids",
        select: "_id tracking_status admin_id",
      })
      .populate({
        path: "rider_id",
        select: "name phone",
      });

    // if riderOrderHistorys is empty return empty array
    if (riderOrderHistorys.length === 0) {
      return res.status(200).json({
        message: "Active admin orders fetched successfully",
        confirmation: true,
        data: [],
      });
    }

    const filteredData = riderOrderHistorys.filter((item) => {
      return (
        item.group_order_ids[0] &&
        item.group_order_ids[0].admin_id.equals(
          new mongoose.Types.ObjectId(adminId)
        ) &&
        ["Order Picked Up", "Delivery Accepted"].includes(
          item.group_order_ids[0].tracking_status
        ) &&
        item.isCompleted === false
      );
    });

    const result = await Promise.all(
      filteredData.map(async (groupOrder) => {
        const responseObj = {
          id: groupOrder.group_order_ids[0]._id.toString(),
          orderKey: groupOrder.order_key,
          trackingStatus: groupOrder.group_order_ids[0].tracking_status,
          otpCode: null,
          groupOrderIds: [],
          deliveryPersonName: groupOrder.rider_id.name,
          deliveryPersonPhone: groupOrder.rider_id.phone,
        };

        for (let order of groupOrder.group_order_ids) {
          responseObj.groupOrderIds.push(order._id.toString());
        }

        const purpose =
          responseObj.trackingStatus === "Order Picked Up"
            ? "admin_delivery"
            : "admin_pickup";

        try {
          const otpResponse = await axios.post(
            `${process.env.BACKEND_URL}/otp/request-tracking-otp`,
            {
              order_key: responseObj.orderKey,
              groupOrder_id: responseObj.id,
              purpose: purpose,
            },
            {
              headers: {
                "Content-Type": "application/json",
                "lenz-api-key": process.env.AUTHORIZED_API_KEY,
              },
            }
          );

          if (otpResponse.data && otpResponse.data.otp_code) {
            responseObj.otpCode = otpResponse.data.otp_code;
          }
        } catch (error) {
          console.error("Error fetching OTP:", error.message);
        }

        return responseObj;
      })
    );

    res.status(200).json({
      message: "Active admin orders fetched successfully",
      confirmation: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch active admin orders",
      confirmation: false,
      error: error.message,
    });
  }
});

// router.get("/active-admin-orders/:adminId", verifyApiKey, async (req, res) => {
//   try {
//     const { adminId } = req.params;

//     if (!adminId) {
//       return res.status(400).json({ message: "Admin ID is required" });
//     }

//     // Check if Object Id is valid
//     const isValidAdminId = mongoose.Types.ObjectId.isValid(adminId);
//     if (!isValidAdminId) {
//       return res.status(400).json({ message: "Invalid admin ID" });
//     }

//     const groupOrders = await GroupOrder.find({
//       admin_id: adminId,
//       tracking_status: { $in: ["Order Picked Up", "Delivery Accepted"] },
//     }).populate("shop_pickup._id admin_pickup._id");

//     console.log("Group orders:", groupOrders);

//     // Process each group order
//     const result = await Promise.all(
//       groupOrders.map(async (groupOrder) => {
//         const responseObj = {
//           id: groupOrder._id.toString(),
//           orderKey: "Not Available",
//           trackingStatus: groupOrder.tracking_status,
//           otpCode: null,
//           groupOrderIds: [],
//           shopName: "Not Available",
//           deliveryPersonName: "Not Available",
//           deliveryPersonPhone: "Not Available",
//         };

//         // Determine purpose based on tracking status
//         const purpose =
//           groupOrder.tracking_status === "Order Picked Up"
//             ? "admin_delivery"
//             : "admin_pickup";

//         let order_key = "Not Available";
//         if (purpose === "admin_pickup") {
//           order_key = groupOrder.admin_pickup?.key;
//         }

//         console.log("Order key:", order_key);

//         try {
//           // Get OTP from external API
//           const otpResponse = await axios.post(
//             `${process.env.BACKEND_URL}/otp/request-tracking-otp`,
//             {
//               order_key,
//               groupOrder_id: groupOrder._id,
//               purpose: purpose,
//             },
//             {
//               headers: {
//                 "Content-Type": "application/json",
//                 "lenz-api-key": process.env.AUTHORIZED_API_KEY,
//               },
//             }
//           );

//           console.log("OTP Response:", otpResponse.data);

//           if (otpResponse.data && otpResponse.data.otp_code) {
//             responseObj.otpCode = otpResponse.data.otp_code;
//           }
//         } catch (error) {
//           console.error("Error fetching OTP:", error.message);
//         }

//         // Get rider details based on tracking status
//         const riderHistoryId =
//           groupOrder.tracking_status === "Order Picked Up"
//             ? groupOrder.shop_pickup?._id?._id
//             : groupOrder.admin_pickup?._id?._id;

//         if (riderHistoryId) {
//           const riderOrderHistory = await RiderOrderHistory.findById(
//             riderHistoryId
//           ).populate("rider_id");

//           console.log("Rider Order History:", riderOrderHistory);

//           if (riderOrderHistory?.rider_id) {
//             // responseObj.shopName = riderOrderHistory.shop_details.shopName;
//             responseObj.deliveryPersonName = riderOrderHistory.rider_id.name;
//             responseObj.deliveryPersonPhone = riderOrderHistory.rider_id.phone;
//             responseObj.orderKey = riderOrderHistory.order_key;
//             responseObj.groupOrderIds = riderOrderHistory.group_order_ids;
//           }
//         }

//         return responseObj;
//       })
//     );

//     res.status(200).json({
//       message: "Active admin orders fetched successfully",
//       confirmation: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Failed to fetch active admin orders",
//       confirmation: false,
//       error: error.message,
//     });
//   }
// });

module.exports = router;
