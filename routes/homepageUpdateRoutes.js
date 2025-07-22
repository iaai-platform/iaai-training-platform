//routes/homepageUpdateRoutes.js - Using your existing uploadMiddleware
const express = require("express");
const router = express.Router();
const homepageUpdateController = require("../controllers/homepageUpdateController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const {
  uploadImages,
  handleMulterError,
} = require("../middlewares/uploadMiddleware"); // Your existing middleware

console.log("🌐 Loading homepage routes with existing middleware...");

// ✅ PUBLIC ROUTES
router.get("/", homepageUpdateController.getHomepageContent);
router.get("/all-courses", homepageUpdateController.getAllCoursesPage);
router.get(
  "/training-programs",
  homepageUpdateController.getTrainingProgramsPage
);

// ✅ ADMIN ROUTES
router.get(
  "/admin-homepage",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.getHomepageRecords
);

router.get(
  "/get-homepage-content/:id",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.getHomepageById
);

// ✅ Using YOUR existing uploadImages middleware
router.post(
  "/update-homepage",
  isAuthenticated,
  isAdmin,
  uploadImages, // Your existing middleware handles the exact fields we need!
  handleMulterError, // Your existing error handling
  homepageUpdateController.updateHomepageContent
);

router.delete(
  "/delete-homepage/:id",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.deleteHomepageContent
);

console.log("✅ Homepage routes loaded with existing middleware");

module.exports = router;
