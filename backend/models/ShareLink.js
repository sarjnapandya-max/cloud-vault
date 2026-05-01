const mongoose = require("mongoose");

const shareLinkSchema = new mongoose.Schema(
  
  {
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,  // ✅ ADD THIS
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("ShareLink", shareLinkSchema);
