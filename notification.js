const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const admin = require("./firebase");
const Rider = require("./models/Rider");

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const sendFCMNotification = async (title, body, data) => {
  try {
    console.log("Title:", title);
    console.log("Body:", body);
    console.log("Data:", data);

    const riders = await Rider.find({
      isAvailable: true,
      isWorking: true,
      fcmToken: { $exists: true, $ne: null },
    });

    console.log("Riders fetched:", riders);

    const tokens = riders.map((rider) => rider.fcmToken);
    console.log("Available riders with FCM tokens:", tokens);

    if (tokens.length === 0) {
      console.log("No available riders with FCM tokens.");
      return;
    }
    const isOperationCreate = true;

    const payload = isOperationCreate
      ? {
          notification: {
            title: title,
            body: body,
          },
          android: {
            notification: {
              sound: "vivek",
              channelId: "order_notifications",
            },
          },
          data: data,
        }
      : { data: data };

      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        ...(isOperationCreate && { notification: payload.notification, android: payload.android }),
        data: payload.data,
      });

    console.log("FCM Notification Sent:", response);
  } catch (error) {
    console.error("Error sending FCM notification:", error);
    if (error.errorInfo) {
      console.error("Error Info:", error.errorInfo);
    }
  }
};

sendFCMNotification("New Order", "From Shop", { message: "Hi" });
