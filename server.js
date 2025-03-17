const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
// const admin = require("firebase-admin");

const authRoutes = require("./routes/auth");
const testRoutes = require("./routes/test");
const shopRoutes = require("./routes/shops");
const adminRoutes = require("./routes/admin");
const chargeRoutes = require("./routes/charge");
const orderRoutes = require("./routes/orders");
const profileRoutes = require("./routes/profile");
const otpRoutes = require("./routes/otp");
const paymentRoutes = require("./routes/payment");
const riderRoutes = require("./routes/rider");
// const {startPing} = require("./pingServices");

dotenv.config();
const app = express();
// Initialize Firebase Admin SDK
// let serviceAccount;
// try {
//   serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// } catch (error) {
//   console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", error);
// }

// if (serviceAccount) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
//   console.log("Firebase Admin Initialized");
// } else {
//   console.error("Firebase service account is missing!");
// }

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/riders", riderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {console.log(`Server running on port ${PORT}`);
// startPing("https://lenz-backend.onrender.com/api/test/");
});

// module.exports = admin;