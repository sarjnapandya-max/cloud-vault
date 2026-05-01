const express        = require("express");
const router         = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const File           = require("../models/File");
const ShareLink      = require("../models/ShareLink");
const {
  calculateRiskScore,
  extractKeywords,
  suggestExpiry,
  generateStorageInsights,
  generateSecurityReport,
  generateNotifications,
} = require("../utils/ai");

// GET /api/insights/report
router.get("/report", authMiddleware, async (req, res) => {
  try {
    const files  = await File.find({ user: req.user.id });
    const result = generateSecurityReport(files);
    res.json(result);
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/insights/storage
router.get("/storage", authMiddleware, async (req, res) => {
  try {
    const files  = await File.find({ user: req.user.id });
    const result = generateStorageInsights(files);
    res.json(result);
  } catch (err) {
    console.error("Storage error:", err);
    res.status(500).json({ message: "Failed to generate insights" });
  }
});

// GET /api/insights/notifications
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const files      = await File.find({ user: req.user.id });
    const shareLinks = await ShareLink.find({ user: req.user.id })
      .populate("file", "fileName securityLevel");
    const result     = generateNotifications(files, shareLinks);
    res.json(result);
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ message: "Failed to generate notifications" });
  }
});

// GET /api/insights/file/:id
router.get("/file/:id", authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const riskScore = calculateRiskScore(file.summary || "", file.fileName);
    const keywords  = extractKeywords(file.summary || "");
    const expiry    = suggestExpiry(file.securityLevel);
    res.json({ riskScore, keywords, expiry });
  } catch (err) {
    console.error("File insights error:", err);
    res.status(500).json({ message: "Failed to analyze file" });
  }
});

module.exports = router;
