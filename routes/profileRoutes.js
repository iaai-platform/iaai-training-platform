// routes/profileRoutes.js - Enhanced with Address/Billing Routes
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

// ✅ 3️⃣ NEW: Update Address & Billing Information
router.post(
  "/update-address-billing",
  isAuthenticated,
  profileController.updateAddressBilling
);

// ✅ 4️⃣ Update Detailed Professional Information
router.post(
  "/update-detailed-info",
  isAuthenticated,
  profileController.updateDetailedInfo
);

// ✅ 5️⃣ Update User Password
router.post(
  "/update-password",
  isAuthenticated,
  profileController.updatePassword
);

// ✅ 6️⃣ Upload Documents to Cloudinary (Profile Picture & ID Document)
router.post(
  "/upload-document",
  isAuthenticated,
  profileController.uploadDocument
);

// ✅ 7️⃣ Delete Documents from Cloudinary
router.delete(
  "/delete-document",
  isAuthenticated,
  profileController.deleteDocument
);

// ✅ 8️⃣ Get Profile Data (API endpoint)
router.get(
  "/api/profile-data",
  isAuthenticated,
  profileController.getProfileData
);

module.exports = router;
