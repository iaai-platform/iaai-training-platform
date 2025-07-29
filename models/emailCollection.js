const mongoose = require("mongoose");

const emailCollectionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "webinar-notification",
        "course-updates",
        "newsletter",
        "general-updates",
        "new-course-alerts",
        "instructor-updates",
        "training-center-news",
        "other",
      ],
    },
    source: {
      type: String,
      required: true, // Which page/form collected this email
    },
    additionalInfo: {
      type: String, // Optional additional details
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
    },
    collectedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate email+reason combinations
emailCollectionSchema.index({ email: 1, reason: 1 }, { unique: true });

module.exports = mongoose.model("EmailCollection", emailCollectionSchema);
