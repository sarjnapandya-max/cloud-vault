const express = require("express");
const router = express.Router();
const File = require("../models/File");
const authMiddleware = require("../middleware/authMiddleware");
const s3 = require("../config/s3");
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const {
  generateSummary,
  analyzeSecurity,
  generateTags,
  autoRename,
  checkDuplicate,
} = require("../utils/ai");

// ─────────────────────────────────────────
// POST /api/files/upload
// ─────────────────────────────────────────
router.post("/upload", authMiddleware, async (req, res) => {
  try {
    const { fileName, fileSize, encryptedData, salt, iv, textContent } = req.body;

    // ── DUPLICATE CHECK ──
    const existingFiles = await File.find({ user: req.user.id });
    const dupResult = checkDuplicate({ fileName, fileSize }, existingFiles);
    if (dupResult.isDuplicate) {
      return res.status(409).json({
        isDuplicate: true,
        message: dupResult.message,
        existingFileId: dupResult.existingFileId,
      });
    }

    // ── UPLOAD ENCRYPTED FILE TO S3 ──
    // Unique key prevents name clashes between users
    const s3Key = `${req.user.id}/${Date.now()}_${fileName}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: encryptedData,
      ContentType: "text/plain",
    }));

    console.log("✅ File uploaded to S3:", s3Key);

    // ── AI ANALYSIS ──
    const text = textContent || fileName;

    const summary                           = await generateSummary(text);
    const { securityLevel, securityReason } = analyzeSecurity(text);
    const tags                              = generateTags(text, fileName);
    const suggestedName                     = autoRename(fileName, text);

    // ── SAVE TO MONGODB ──
    const newFile = new File({
      user:          req.user.id,
      fileName,
      fileSize,
      s3Key,
      salt:          salt || "",
      iv:            iv || "",
      summary,
      securityLevel,
      securityReason,
      tags,
    });

    await newFile.save();

    res.json({ file: newFile, suggestedName });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ─────────────────────────────────────────
// GET /api/files
// ─────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const files = await File.find({ user: req.user.id });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// ─────────────────────────────────────────
// GET /api/files/analytics/summary
// ─────────────────────────────────────────
router.get("/analytics/summary", authMiddleware, async (req, res) => {
  try {
    const files = await File.find({ user: req.user.id });
    const totalFiles   = files.length;
    const totalStorage = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    res.json({ totalFiles, totalStorage });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ─────────────────────────────────────────
// GET /api/files/:id/download
// ─────────────────────────────────────────
router.get("/:id/download", authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) return res.status(404).json({ message: "File not found" });

    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key,
    });

    const response      = await s3.send(command);
    const encryptedData = await response.Body.transformToString();

    res.json({
      fileName:      file.fileName,
      encryptedData,
      salt:          file.salt,
      iv:            file.iv,
    });

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────
// DELETE /api/files/:id
// ─────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    await file.deleteOne();
    res.json({ message: "File deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ─────────────────────────────────────────
// GET /api/files/search?q=keyword
// ─────────────────────────────────────────
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase();
    if (!query) return res.status(400).json({ message: "Query required" });

    const files = await File.find({ user: req.user.id });

    const results = files.filter((f) =>
      f.fileName?.toLowerCase().includes(query) ||
      f.summary?.toLowerCase().includes(query) ||
      f.securityReason?.toLowerCase().includes(query) ||
      f.tags?.some((tag) => tag.toLowerCase().includes(query))
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

module.exports = router;
