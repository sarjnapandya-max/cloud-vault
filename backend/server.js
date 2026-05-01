// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();

// console.log("🚀 THIS SERVER FILE IS RUNNING");

// // 🔥 Import Routes
// const authRoutes = require("./routes/auth");
// const fileRoutes = require("./routes/files");
// const shareRoutes = require("./routes/share");
// const authMiddleware = require("./middleware/authMiddleware");


// // ✅ CREATE APP FIRST
// const app = express();

// // 🔥 Middleware
// app.use(cors());
// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));

// // 🔥 Connect MongoDB
// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("✅ MongoDB Connected"))
//   .catch((err) => console.log("❌ MongoDB Error:", err));

// // 🔥 Register Routes (AFTER app is created)
// app.use("/api/auth", authRoutes);
// app.use("/api/files", fileRoutes);
// app.use("/api/share", shareRoutes);


// // 🔐 Protected Route
// app.get("/api/protected", authMiddleware, (req, res) => {
//   res.json({
//     message: "You accessed protected route!",
//     userId: req.user.id,
//   });
// });

// // 🏠 Root Route
// app.get("/", (req, res) => {
//   res.send("Secure Vault Backend Running");
// });

// // 🔥 Start Server
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

console.log("🚀 Server starting...");

const authRoutes     = require("./routes/auth");
const fileRoutes     = require("./routes/files");
const shareRoutes    = require("./routes/share");
const chatRoutes     = require("./routes/chat");
const authMiddleware = require("./middleware/authMiddleware");
const insightsRoutes = require("./routes/insights");


const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/insights", insightsRoutes);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

app.use("/api/auth",  authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/ai",    chatRoutes);   // ✅ handles /api/ai/chat

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "Protected route works!", userId: req.user.id });
});

app.get("/", (req, res) => res.send("SecureVault Backend Running ✅"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));