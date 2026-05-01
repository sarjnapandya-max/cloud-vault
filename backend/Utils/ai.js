const fetch = require("node-fetch");

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = "facebook/bart-large-cnn";

// ─────────────────────────────────────────
// 1. SUMMARIZER (HuggingFace)
// ─────────────────────────────────────────
async function generateSummary(text) {
  if (!text || text.trim().length < 50) {
    return "No summary available.";
  }

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

    // Model still loading → retry once after 5s
    if (result.error && result.error.includes("loading")) {
      await new Promise((res) => setTimeout(res, 5000));
      return generateSummary(text);
    }

    if (result[0]?.summary_text) return result[0].summary_text;

    return "Summary could not be generated.";
  } catch (err) {
    console.error("Summarizer error:", err.message);
    return "Summary unavailable.";
  }
}

// ─────────────────────────────────────────
// 2. SECURITY ANALYZER (Rule-based)
// ─────────────────────────────────────────
function analyzeSecurity(text) {
  if (!text) {
    return { securityLevel: "Safe", securityReason: "No content to analyze." };
  }

  const highPatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    /\bpassword\s*[=:]\s*\S+/i,
    /\bpin\s*[=:]\s*\d{4,6}/i,
    /\bssn\b|\bsocial security\b/i,
    /\bcvv\b/i,
  ];

  const mediumPatterns = [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/,
    /\bphone\b|\bmobile\b|\bcontact\b/i,
    /\baddress\b|\blocation\b/i,
    /\bdate of birth\b|\bdob\b/i,
  ];

  for (const pattern of highPatterns) {
    if (pattern.test(text)) {
      return {
        securityLevel: "High",
        securityReason: "Contains sensitive data like passwords, card numbers, or SSN.",
      };
    }
  }

  for (const pattern of mediumPatterns) {
    if (pattern.test(text)) {
      return {
        securityLevel: "Medium",
        securityReason: "Contains personal info like email, phone, or address.",
      };
    }
  }

  return { securityLevel: "Safe", securityReason: "No sensitive information detected." };
}

// ─────────────────────────────────────────
// 3. SMART TAGS (Rule-based)
// ─────────────────────────────────────────
function generateTags(text, fileName) {
  const tags = [];
  const content = (text + " " + fileName).toLowerCase();

  const tagRules = {
    finance:   ["invoice", "payment", "billing", "bank", "transaction", "salary"],
    security:  ["password", "credentials", "secret", "private", "key"],
    career:    ["resume", "cv", "job", "experience", "internship"],
    education: ["assignment", "notes", "exam", "study", "lecture"],
    legal:     ["contract", "agreement", "terms", "policy", "legal"],
    medical:   ["prescription", "diagnosis", "doctor", "hospital", "report"],
    personal:  ["address", "phone", "email", "contact", "dob"],
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
// 4. AUTO RENAME (Rule-based)
// ─────────────────────────────────────────
function autoRename(fileName, text) {
  const content = (text + " " + fileName).toLowerCase();

  const rules = [
    { keywords: ["invoice", "billing", "payment"], name: "Invoice Document" },
    { keywords: ["resume", "cv"],                  name: "Resume" },
    { keywords: ["bank", "transaction", "account"],name: "Bank Document" },
    { keywords: ["contract", "agreement"],         name: "Contract" },
    { keywords: ["notes", "lecture", "study"],     name: "Study Notes" },
    { keywords: ["prescription", "doctor"],        name: "Medical Record" },
    { keywords: ["assignment", "homework"],        name: "Assignment" },
    { keywords: ["report", "analysis"],            name: "Report" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => content.includes(kw))) {
      return rule.name;
    }
  }

  return fileName;
}

// ─────────────────────────────────────────
// 5. DUPLICATE CHECKER
// ─────────────────────────────────────────
function checkDuplicate(newFile, existingFiles) {
  const duplicate = existingFiles.find(
    (f) => f.fileName === newFile.fileName && f.fileSize === newFile.fileSize
  );

  if (duplicate) {
    return {
      isDuplicate: true,
      message: `"${newFile.fileName}" already exists with the same size.`,
      existingFileId: duplicate._id,
    };
  }

  return { isDuplicate: false };
}

// ─────────────────────────────────────────
// 6. AI FILE RISK SCORE (0-100)
// ─────────────────────────────────────────
function calculateRiskScore(text, fileName) {
  let score = 0;
  const content = (text + " " + fileName).toLowerCase();

  // High risk patterns → +25 each
  const highPatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    /\bpassword\s*[=:]\s*\S+/i,
    /\bpin\s*[=:]\s*\d{4,6}/i,
    /\bssn\b|\bsocial security\b/i,
    /\bcvv\b/i,
  ];

  // Medium risk patterns → +15 each
  const mediumPatterns = [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/,
    /\bphone\b|\bmobile\b/i,
    /\baddress\b|\blocation\b/i,
    /\bdate of birth\b|\bdob\b/i,
  ];

  // Low risk keywords → +5 each
  const lowKeywords = ["bank", "invoice", "salary", "contract", "private", "confidential"];

  for (const pattern of highPatterns) {
    if (pattern.test(text)) score += 25;
  }
  for (const pattern of mediumPatterns) {
    if (pattern.test(text)) score += 15;
  }
  for (const kw of lowKeywords) {
    if (content.includes(kw)) score += 5;
  }

  return Math.min(score, 100); // cap at 100
}

// ─────────────────────────────────────────
// 7. AI KEYWORD EXTRACTOR
// ─────────────────────────────────────────
function extractKeywords(text) {
  if (!text || text.trim().length < 10) return [];

  // Remove common stop words
  const stopWords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for",
    "of","with","by","from","is","was","are","were","be","been",
    "this","that","it","its","as","not","have","has","had","will",
    "would","could","should","may","can","do","does","did","your",
    "our","their","we","you","they","he","she","i","my","his","her",
    "please","also","only","any","all","each","more","than","just",
    "about","into","after","before","during","between","above","below",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")   // remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Count frequency
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Sort by frequency, return top 6
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

// ─────────────────────────────────────────
// 8. AI FILE EXPIRY SUGGESTER
// ─────────────────────────────────────────
function suggestExpiry(securityLevel) {
  switch (securityLevel) {
    case "High":
      return { days: 0, hours: 1, label: "1 hour", reason: "High risk file — short expiry recommended" };
    case "Medium":
      return { days: 1, hours: 0, label: "1 day", reason: "Contains personal info — 1 day expiry recommended" };
    case "Safe":
    default:
      return { days: 7, hours: 0, label: "7 days", reason: "Safe file — 7 day expiry is fine" };
  }
}

// ─────────────────────────────────────────
// 9. AI STORAGE INSIGHTS
// ─────────────────────────────────────────
function generateStorageInsights(files) {
  if (!files || files.length === 0) {
    return { insights: ["No files uploaded yet."], tagBreakdown: {}, riskBreakdown: {} };
  }

  const total = files.length;

  // Risk breakdown
  const riskBreakdown = { High: 0, Medium: 0, Safe: 0 };
  for (const f of files) {
    const level = f.securityLevel || "Safe";
    riskBreakdown[level] = (riskBreakdown[level] || 0) + 1;
  }

  // Tag breakdown
  const tagBreakdown = {};
  for (const f of files) {
    for (const tag of f.tags || []) {
      tagBreakdown[tag] = (tagBreakdown[tag] || 0) + 1;
    }
  }

  // Top tag
  const topTag = Object.entries(tagBreakdown).sort((a, b) => b[1] - a[1])[0];

  // Build insight messages
  const insights = [];

  if (riskBreakdown.High > 0) {
    insights.push(`⚠️ ${riskBreakdown.High} file${riskBreakdown.High > 1 ? "s" : ""} are HIGH risk — review them.`);
  }
  if (riskBreakdown.Medium > 0) {
    insights.push(`🟡 ${riskBreakdown.Medium} file${riskBreakdown.Medium > 1 ? "s" : ""} contain personal information.`);
  }
  if (riskBreakdown.Safe > 0) {
    insights.push(`✅ ${riskBreakdown.Safe} file${riskBreakdown.Safe > 1 ? "s" : ""} are safe with no sensitive data.`);
  }
  if (topTag) {
    const pct = Math.round((topTag[1] / total) * 100);
    insights.push(`📁 ${pct}% of your files are ${topTag[0]}-related.`);
  }

  const totalSize = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  insights.push(`💾 Total storage used: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  return { insights, tagBreakdown, riskBreakdown };
}

// ─────────────────────────────────────────
// 10. AI SECURITY REPORT
// ─────────────────────────────────────────
function generateSecurityReport(files) {
  if (!files || files.length === 0) {
    return { report: "No files to analyze.", score: 0, grade: "N/A" };
  }

  const total   = files.length;
  const high    = files.filter((f) => f.securityLevel === "High").length;
  const medium  = files.filter((f) => f.securityLevel === "Medium").length;
  const safe    = files.filter((f) => f.securityLevel === "Safe").length;

  // Overall vault score (higher = safer)
  const rawScore  = ((safe * 100) + (medium * 50) + (high * 0)) / total;
  const score     = Math.round(rawScore);

  const grade =
    score >= 80 ? "A" :
    score >= 60 ? "B" :
    score >= 40 ? "C" : "D";

  const highFiles   = files.filter((f) => f.securityLevel === "High").map((f) => f.fileName);
  const mediumFiles = files.filter((f) => f.securityLevel === "Medium").map((f) => f.fileName);

  const recommendations = [];
  if (high > 0)   recommendations.push(`Review and restrict access to ${high} high-risk file(s).`);
  if (medium > 0) recommendations.push(`${medium} file(s) contain personal info — share carefully.`);
  if (safe === total) recommendations.push("All files are safe. No action needed.");

  return {
    score,
    grade,
    total,
    high,
    medium,
    safe,
    highFiles,
    mediumFiles,
    recommendations,
  };
}

// ─────────────────────────────────────────
// 11. AI SMART NOTIFICATIONS
// ─────────────────────────────────────────
function generateNotifications(files, shareLinks) {
  const notifications = [];
  const now = new Date();

  // Check share links expiring within 2 hours
  for (const share of shareLinks || []) {
    const diff    = new Date(share.expiresAt) - now;
    const hours   = diff / (1000 * 60 * 60);
    const expired = diff <= 0;

    if (expired) {
      notifications.push({
        type:    "warning",
        message: `Share link for "${share.file?.fileName}" has expired.`,
      });
    } else if (hours <= 2) {
      notifications.push({
        type:    "alert",
        message: `Share link for "${share.file?.fileName}" expires in ${Math.round(hours * 60)} minutes.`,
      });
    }
  }

  // Check high risk files that have active share links
  for (const share of shareLinks || []) {
    const diff = new Date(share.expiresAt) - now;
    if (diff > 0 && share.file?.securityLevel === "High") {
      notifications.push({
        type:    "danger",
        message: `⚠️ "${share.file?.fileName}" is HIGH risk and is currently shared!`,
      });
    }
  }

  // General insights
  const highRiskFiles = (files || []).filter((f) => f.securityLevel === "High");
  if (highRiskFiles.length > 0) {
    notifications.push({
      type:    "info",
      message: `You have ${highRiskFiles.length} high-risk file(s) in your vault.`,
    });
  }

  return notifications;
}

module.exports = {
  generateSummary,
  analyzeSecurity,
  generateTags,
  autoRename,
  checkDuplicate,
  calculateRiskScore,
  extractKeywords,
  suggestExpiry,
  generateStorageInsights,
  generateSecurityReport,
  generateNotifications,
};