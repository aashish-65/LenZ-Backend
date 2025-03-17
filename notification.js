// const dotenv = require("dotenv");
// dotenv.config();
// const mongoose = require("mongoose");
const admin = require("./server");
const Rider = require("./models/Rider");

// mongoose
//   .connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.log(err));

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

    const payload = {
      notification: {
        title: title,
        body: body,
      },
      data:  {message: "Hi", fcmToken: riders[0].fcmToken} ,
    };

    const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        ...payload,
      });
    console.log("FCM Notification Sent:", response);
  } catch (error) {
    console.error("Error sending FCM notification:", error);
  }
};

sendFCMNotification("New Order", "From Shop", { message: "Hi" });