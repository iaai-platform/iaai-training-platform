const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    discountPercentage: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    expiryDate: { type: Date },

    // New fields for restrictions
    restrictionType: {
      type: String,
      enum: ["none", "email", "course", "both"],
      default: "none",
    },
    allowedEmails: [{ type: String }], // Array of specific email addresses
    // CHANGED: Store course IDs as simple ObjectIds without refs since we have multiple course models
    allowedCourses: [{ type: mongoose.Schema.Types.ObjectId }], // Array of course IDs from any course model
  },
  { timestamps: true }
);

module.exports = mongoose.model("PromoCode", promoCodeSchema);
