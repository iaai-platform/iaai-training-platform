// routes/profileRoutes.js - Enhanced with Cloudinary Integration
const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const isAuthenticated = require("../middlewares/isAuthenticated");

// ✅ 1️⃣ Display User Profile
router.get("/profile", isAuthenticated, profileController.getProfilePage);

// ✅ 2️⃣ Update Basic User Information
router.post(
  "/update-profile",
  isAuthenticated,
  profileController.updateProfile
);

// ✅ 3️⃣ Update Detailed Professional Information
router.post(
  "/update-detailed-info",
  isAuthenticated,
  profileController.updateDetailedInfo
);

// ✅ 4️⃣ Update User Password
router.post(
  "/update-password",
  isAuthenticated,
  profileController.updatePassword
);

// ✅ 5️⃣ Upload Documents to Cloudinary (Profile Picture & ID Document)
router.post(
  "/upload-document",
  isAuthenticated,
  profileController.uploadDocument
);

// ✅ 6️⃣ Delete Documents from Cloudinary
router.delete(
  "/delete-document",
  isAuthenticated,
  profileController.deleteDocument
);

// ✅ 7️⃣ Get Profile Data (API endpoint)
router.get(
  "/api/profile-data",
  isAuthenticated,
  profileController.getProfileData
);

module.exports = router;
