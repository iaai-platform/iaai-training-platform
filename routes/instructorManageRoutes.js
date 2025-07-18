// routes/instructorManageRoutes.js
const express = require("express");
const router = express.Router();
const instructorController = require("../controllers/instructorController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================
// FILE UPLOAD CONFIGURATION FOR INSTRUCTOR PHOTOS - CLOUDINARY
// ============================================

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage for instructor photos
const instructorPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/instructors",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "fill", quality: "auto" },
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      return `instructor-${uniqueSuffix}`;
    },
  },
});

// File filter for images (updated for Cloudinary)
const instructorPhotoFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: JPEG, PNG, WebP`), false);
  }
};

// Multer instance for instructor photos with Cloudinary
const uploadInstructorPhoto = multer({
  storage: instructorPhotoStorage,
  fileFilter: instructorPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single("profileImage");

// ============================================
// MIDDLEWARE FOR LOGGING
// ============================================

// Request logging middleware (optional)
const logRequest = (action) => {
  return (req, res, next) => {
    console.log(
      `📝 [${new Date().toISOString()}] ${action} - User: ${
        req.user?.email || "Unknown"
      }`
    );
    next();
  };
};

// ============================================
// INSTRUCTOR MANAGEMENT PAGE ROUTES
// ============================================

// Main instructor management page
router.get(
  "/manage",
  isAuthenticated,
  isAdmin,
  logRequest("View Instructor Management Page"),
  instructorController.manageInstructors
);

// Alternative routes for backward compatibility
router.get(
  "/",
  isAuthenticated,
  isAdmin,
  instructorController.manageInstructors
);

// ============================================
// INSTRUCTOR API ROUTES - BASIC CRUD
// ============================================

// Get all instructors
router.get(
  "/api/all",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructors
);

// Get active instructors for dropdowns
router.get(
  "/api/active",
  isAuthenticated,
  isAdmin,
  instructorController.getActiveInstructors
);

// Search instructors by name or email
router.get(
  "/api/search/:query",
  isAuthenticated,
  isAdmin,
  instructorController.searchInstructors
);

// Get instructor details by ID (with course details)
router.get(
  "/api/:instructorId",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructorById
);

// Create new instructor with photo upload
router.post(
  "/api",
  isAuthenticated,
  isAdmin,
  logRequest("Create New Instructor"),
  (req, res, next) => {
    uploadInstructorPhoto(req, res, (err) => {
      if (err) {
        console.error("📁 Photo upload error:", err);
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              message: "File too large. Maximum size is 5MB.",
            });
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
              success: false,
              message:
                'Unexpected field. Please ensure the field name is "profileImage".',
            });
          }
          return res.status(400).json({
            success: false,
            message: "File upload error: " + err.message,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        });
      }
      next();
    });
  },
  instructorController.createInstructor
);

// Update instructor with photo upload
router.put(
  "/api/:instructorId",
  isAuthenticated,
  isAdmin,
  logRequest("Update Instructor"),
  (req, res, next) => {
    uploadInstructorPhoto(req, res, (err) => {
      if (err) {
        console.error("📁 Photo upload error:", err);
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              message: "File too large. Maximum size is 5MB.",
            });
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
              success: false,
              message:
                'Unexpected field. Please ensure the field name is "profileImage".',
            });
          }
          return res.status(400).json({
            success: false,
            message: "File upload error: " + err.message,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        });
      }
      next();
    });
  },
  instructorController.updateInstructor
);

// Delete instructor (soft delete)
router.delete(
  "/api/:instructorId",
  isAuthenticated,
  isAdmin,
  logRequest("Delete Instructor"),
  instructorController.deleteInstructor
);

// Bulk import instructors
router.post(
  "/api/bulk-import",
  isAuthenticated,
  isAdmin,
  logRequest("Bulk Import Instructors"),
  instructorController.bulkImportInstructors
);

// ============================================
// COURSE MANAGEMENT ROUTES
// ============================================

// Sync courses for a specific instructor
router.post(
  "/api/:instructorId/sync-courses",
  isAuthenticated,
  isAdmin,
  logRequest("Sync Instructor Courses"),
  instructorController.syncInstructorCourses
);

// Sync courses for all instructors
router.post(
  "/api/sync-all-courses",
  isAuthenticated,
  isAdmin,
  logRequest("Sync All Instructors Courses"),
  instructorController.syncAllInstructorsCourses
);

// Get instructor's courses (with optional filters)
router.get(
  "/api/:instructorId/courses",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructorCourses
);

// Manually assign course to instructor
router.post(
  "/api/:instructorId/assign-course",
  isAuthenticated,
  isAdmin,
  logRequest("Assign Course to Instructor"),
  instructorController.assignCourse
);

// Update course status for instructor
router.put(
  "/api/:instructorId/course/:courseId/status",
  isAuthenticated,
  isAdmin,
  logRequest("Update Course Status"),
  instructorController.updateCourseStatus
);

// Remove course assignment
router.delete(
  "/api/:instructorId/course/:courseId",
  isAuthenticated,
  isAdmin,
  logRequest("Remove Course Assignment"),
  instructorController.removeCourseAssignment
);

// ============================================
// AVAILABILITY & SCHEDULING ROUTES
// ============================================

// Check instructor availability for date range
router.get(
  "/api/:instructorId/availability",
  isAuthenticated,
  isAdmin,
  instructorController.checkAvailability
);

// Get instructor schedule (with optional month/year filter)
router.get(
  "/api/:instructorId/schedule",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructorSchedule
);

// ============================================
// RATING & FEEDBACK ROUTES
// ============================================

// Add rating to instructor
router.post(
  "/api/:instructorId/rating",
  isAuthenticated,
  isAdmin,
  logRequest("Add Instructor Rating"),
  instructorController.addRating
);

// Get instructor ratings
router.get(
  "/api/:instructorId/ratings",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructorRatings
);

// ============================================
// STATISTICS & REPORTS ROUTES
// ============================================

// Get instructor statistics
router.get(
  "/api/:instructorId/stats",
  isAuthenticated,
  isAdmin,
  instructorController.getInstructorStats
);

// ============================================
// EXPORT ROUTES
// ============================================

module.exports = router;
