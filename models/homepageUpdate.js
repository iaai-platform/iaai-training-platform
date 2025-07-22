// models/homepageUpdate.js
const mongoose = require("mongoose");

const HomepageUpdateSchema = new mongoose.Schema({
  // Latest News Section
  latestNewsTitle: { type: String, required: true },
  latestNewsDes: { type: String, required: true },
  latestNewsDetails: { type: String, required: true }, // Fixed field name
  latestNewsImage: { type: String, default: "" }, // Cloudinary URL
  latestNewsImagePublicId: { type: String, default: "" }, // Cloudinary public ID for deletion

  // Latest 1 Section
  latest1Title: { type: String, default: "" }, // Made optional
  latest1Detail: { type: String, default: "" }, // Made optional
  latest1Image: { type: String, default: "" }, // Cloudinary URL
  latest1ImagePublicId: { type: String, default: "" }, // Cloudinary public ID

  // Latest 2 Section
  latest2Title: { type: String, default: "" }, // Made optional
  latest2Detail: { type: String, default: "" }, // Made optional
  latest2Image: { type: String, default: "" }, // Cloudinary URL
  latest2ImagePublicId: { type: String, default: "" }, // Cloudinary public ID

  // Latest 3 Section
  latest3Title: { type: String, default: "" }, // Made optional
  latest3Detail: { type: String, default: "" }, // Made optional
  latest3Image: { type: String, default: "" }, // Cloudinary URL
  latest3ImagePublicId: { type: String, default: "" }, // Cloudinary public ID

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
HomepageUpdateSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("HomepageUpdate", HomepageUpdateSchema);
