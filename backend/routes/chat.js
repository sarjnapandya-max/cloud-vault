const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

// ─────────────────────────────────────────
// POST /api/ai/chat
// Body: { content, question }
// content = decrypted file text from frontend
// question = user's question about the file
// ─────────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { content, question } = req.body;

    if (!question) {
      return res.status(400).json({ answer: "Please ask a question." });
    }

    // If file content is empty or binary (non-text file)
    if (!content || content.trim().length < 10) {
      return res.json({
        answer:
          "This file does not contain readable text. I can only answer questions about text-based files.",
      });
    }

    // Trim content to avoid token limit
    const trimmedContent = content.slice(0, 1500);

    // Build prompt
    const prompt = `You are a helpful assistant. Based on the following file content, answer the user's question clearly and concisely.

File Content:
"""
${trimmedContent}
"""

User Question: ${question}

Answer:`;

    // Call HuggingFace text generation model
    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.5,
            return_full_text: false,
          },
        }),
      }
    );

    const result = await response.json();

    console.log("HF CHAT RESULT:", JSON.stringify(result));

    // Model still loading
    if (result.error && result.error.includes("loading")) {
      return res.json({ answer: "AI model is loading, please try again in 10 seconds." });
    }

    // Extract answer
    if (result[0]?.generated_text) {
      const answer = result[0].generated_text.trim();
      return res.json({ answer });
    }

    return res.json({ answer: "Sorry, I could not generate an answer. Please try again." });

  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.status(500).json({ answer: "AI chat failed. Check your HuggingFace API key." });
  }
});

module.exports = router;