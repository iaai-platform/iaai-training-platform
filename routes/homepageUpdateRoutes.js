//routes/homepageUpdateRoutes.js - Updated with Auto-Populate Route
const express = require("express");
const router = express.Router();
const homepageUpdateController = require("../controllers/homepageUpdateController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const {
  uploadImages,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");

console.log("🌐 Loading homepage routes with auto-populate feature...");

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

// ✅ NEW: Auto-Populate Route
router.post(
  "/auto-populate-homepage",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.autoPopulateHomepage
);

// ✅ Update/Create Homepage Content
router.post(
  "/update-homepage",
  isAuthenticated,
  isAdmin,
  uploadImages,
  handleMulterError,
  homepageUpdateController.updateHomepageContent
);

// ✅ Delete Homepage Content
router.delete(
  "/delete-homepage/:id",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.deleteHomepageContent
);

console.log("✅ Homepage routes loaded with auto-populate feature");

module.exports = router;
