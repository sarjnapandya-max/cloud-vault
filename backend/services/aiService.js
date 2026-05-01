const fetch = require("node-fetch");

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = "facebook/bart-large-cnn";

// ─────────────────────────────────────────
// 1. AI FILE SUMMARIZER (HuggingFace API)
// ─────────────────────────────────────────
async function summarizeFile(text) {
  // If file is not text-based, return default
  if (!text || text.trim().length < 50) {
    return "No summary available for this file type.";
  }

  // Trim text to avoid token limits
  const input = text.slice(0, 1000);

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: input }),
      }
    );

    const result = await response.json();

    // Model may still be loading
    if (result.error && result.error.includes("loading")) {
      await new Promise((res) => setTimeout(res, 5000)); // wait 5s
      return summarizeFile(text); // retry once
    }

    if (result[0] && result[0].summary_text) {
      return result[0].summary_text;
    }

    return "Summary could not be generated.";
  } catch (err) {
    console.error("Summarizer error:", err.message);
    return "Summary unavailable.";
  }
}

// ─────────────────────────────────────────
// 2. AI SECURITY ANALYZER (Rule-based)
// ─────────────────────────────────────────
function analyzeSecurityLevel(text) {
  if (!text) {
    return {
      securityLevel: "Safe",
      securityReason: "No content to analyze.",
    };
  }

  const lower = text.toLowerCase();

  const highPatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // credit card
    /\bpassword\s*[=:]\s*\S+/i,                      // password = ...
    /\bpin\s*[=:]\s*\d{4,6}/i,                       // pin = 1234
    /\bssn\b|\bsocial security\b/i,                  // SSN
    /\bcvv\b/i,                                      // CVV
  ];

  const mediumPatterns = [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/, // email
    /\bphone\b|\bmobile\b|\bcontact\b/i,                 // phone info
    /\baddress\b|\blocation\b/i,                         // address
    /\bdate of birth\b|\bdob\b/i,                        // DOB
  ];

  for (const pattern of highPatterns) {
    if (pattern.test(text)) {
      return {
        securityLevel: "High",
        securityReason:
          "File contains sensitive data like passwords, card numbers, or SSN.",
      };
    }
  }

  for (const pattern of mediumPatterns) {
    if (pattern.test(lower)) {
      return {
        securityLevel: "Medium",
        securityReason:
          "File contains personal info like email, phone, or address.",
      };
    }
  }

  return {
    securityLevel: "Safe",
    securityReason: "No sensitive information detected.",
  };
}

// ─────────────────────────────────────────
// 3. SMART TAGS GENERATOR (Rule-based)
// ─────────────────────────────────────────
function generateTags(text, fileName) {
  const tags = [];
  const content = (text + " " + fileName).toLowerCase();

  const tagRules = {
    finance: ["invoice", "payment", "billing", "bank", "transaction", "salary"],
    security: ["password", "credentials", "secret", "private", "key"],
    career: ["resume", "cv", "job", "experience", "internship", "portfolio"],
    education: ["assignment", "notes", "exam", "study", "lecture", "course"],
    legal: ["contract", "agreement", "terms", "policy", "legal", "clause"],
    medical: ["prescription", "diagnosis", "doctor", "hospital", "report"],
    personal: ["address", "phone", "email", "contact", "dob", "profile"],
  };

  for (const [tag, keywords] of Object.entries(tagRules)) {
    if (keywords.some((kw) => content.includes(kw))) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) tags.push("general");

  return tags;
}

// ─────────────────────────────────────────
// 4. AI AUTO RENAME (Rule-based)
// ─────────────────────────────────────────
function autoRenameFile(fileName, text) {
  const content = (text + " " + fileName).toLowerCase();

  const renameRules = [
    { keywords: ["invoice", "billing", "payment"], name: "Invoice Document" },
    { keywords: ["resume", "cv", "portfolio"], name: "Resume" },
    { keywords: ["bank", "transaction", "account"], name: "Bank Document" },
    { keywords: ["contract", "agreement", "terms"], name: "Contract" },
    { keywords: ["notes", "lecture", "study"], name: "Study Notes" },
    { keywords: ["prescription", "doctor", "hospital"], name: "Medical Record" },
    { keywords: ["assignment", "homework", "exam"], name: "Assignment" },
    { keywords: ["report", "analysis", "summary"], name: "Report" },
  ];

  for (const rule of renameRules) {
    if (rule.keywords.some((kw) => content.includes(kw))) {
      return rule.name;
    }
  }

  // Keep original name if no match
  return fileName;
}

// ─────────────────────────────────────────
// 5. SMART SEARCH (keyword match logic)
// Used in route, not here directly
// See: aiRoutes.js → GET /search
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// 6. DUPLICATE FILE DETECTOR
// ─────────────────────────────────────────
function isDuplicate(newFile, existingFiles) {
  // Compare by fileName AND fileSize
  const duplicate = existingFiles.find(
    (file) =>
      file.fileName === newFile.fileName &&
      file.fileSize === newFile.fileSize
  );

  if (duplicate) {
    return {
      isDuplicate: true,
      message: `Duplicate detected: "${newFile.fileName}" already exists with the same size.`,
      existingFileId: duplicate._id,
    };
  }

  return { isDuplicate: false };
}

module.exports = {
  summarizeFile,
  analyzeSecurityLevel,
  generateTags,
  autoRenameFile,
  isDuplicate,
};