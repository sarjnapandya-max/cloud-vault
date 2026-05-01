const express = require("express");
const router = express.Router();
const ShareLink = require("../models/ShareLink");
const File = require("../models/File");
const authMiddleware = require("../middleware/authMiddleware");
const { v4: uuidv4 } = require("uuid");

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../config/s3");
router.use((req, res, next) => {
  console.log("👉 SHARE ROUTE HIT:", req.method, req.url);
  next();
});
// 📂 GET ALL SHARED FILES OF USER
router.get("/my-shares", authMiddleware, async (req, res) => {
  try {
    const shares = await ShareLink.find({ user: req.user.id })
      .populate("file")
      .sort({ createdAt: -1 });

    res.json(shares);
  } catch (err) {
    console.error("FETCH SHARES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
}); 
// 🔓 Get shared file by token
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const share = await ShareLink.findOne({ token }).populate("file");

    if (!share) {
      return res.status(404).json({ error: "Invalid link" });
    }

    if (share.expiresAt < new Date()) {
      return res.status(400).json({ error: "Link expired" });
    }

    const file = share.file;

    // ✅ DEBUG (optional)
    console.log("S3 KEY:", file.s3Key);

    // ✅ FETCH FROM S3
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key
    });

    const response = await s3.send(command);

    const encryptedData = await response.Body.transformToString();

    // ✅ SEND COMPLETE DATA
    res.json({
      file: {
        ...file._doc,
        encryptedData
      }
    });

  } catch (err) {
    console.error("SHARE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔗 CREATE SHARE LINK
router.post("/:fileId", authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { expiryDays } = req.body;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const token = uuidv4();

    const expiryTime = expiryDays
      ? expiryDays * 24 * 60 * 60 * 1000
      : 60 * 60 * 1000;

    const shareLink = new ShareLink({
      file: fileId,
      user: req.user.id,
      token,
      expiresAt: new Date(Date.now() + expiryTime),
    });

    await shareLink.save();

    res.json({
      message: "Share link created",
      token,
      expiresAt: shareLink.expiresAt,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
