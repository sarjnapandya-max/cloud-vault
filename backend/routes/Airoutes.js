const express = require("express");
const router = express.Router();
const File = require("../models/File"); // your existing File model
const authMiddleware = require("../middleware/auth"); // your existing JWT middleware
const {
  summarizeFile,
  analyzeSecurityLevel,
  generateTags,
  autoRenameFile,
  isDuplicate,
} = require("../services/aiService");

// ─────────────────────────────────────────
// POST /api/ai/analyze
// Runs all AI features on a file at once
// Call this after file upload
// Body: { fileId, textContent (optional) }
// ─────────────────────────────────────────
router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const { fileId, textContent } = req.body;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ message: "File not found" });

    // Verify owner
    if (file.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const text = textContent || "";

    // Run all AI features
    const summary = await summarizeFile(text);
    const { securityLevel, securityReason } = analyzeSecurityLevel(text);
    const tags = generateTags(text, file.fileName);
    const suggestedName = autoRenameFile(file.fileName, text);

    // Save results to DB
    file.summary = summary;
    file.securityLevel = securityLevel;
    file.securityReason = securityReason;
    file.tags = tags;
    await file.save();

    res.json({
      summary,
      securityLevel,
      securityReason,
      tags,
      suggestedName,
    });
  } catch (err) {
    console.error("AI analyze error:", err.message);
    res.status(500).json({ message: "AI analysis failed" });
  }
});

// ─────────────────────────────────────────
// GET /api/ai/search?q=keyword
// Smart search across all user files
// ─────────────────────────────────────────
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase();
    if (!query) return res.status(400).json({ message: "Query is required" });

    const files = await File.find({ user: req.user.id });

    const results = files.filter((file) => {
      return (
        file.fileName?.toLowerCase().includes(query) ||
        file.summary?.toLowerCase().includes(query) ||
        file.securityReason?.toLowerCase().includes(query) ||
        file.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    res.json({ results });
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ message: "Search failed" });
  }
});

// ─────────────────────────────────────────
// POST /api/ai/check-duplicate
// Check if uploaded file is a duplicate
// Body: { fileName, fileSize }
// ─────────────────────────────────────────
router.post("/check-duplicate", authMiddleware, async (req, res) => {
  try {
    const { fileName, fileSize } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ message: "fileName and fileSize required" });
    }

    // Get all files of this user
    const existingFiles = await File.find({ user: req.user.id });

    const result = isDuplicate({ fileName, fileSize }, existingFiles);

    res.json(result);
  } catch (err) {
    console.error("Duplicate check error:", err.message);
    res.status(500).json({ message: "Duplicate check failed" });
  }
});

module.exports = router;