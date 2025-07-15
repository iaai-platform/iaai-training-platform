// routes/admin/inPersonCoursesRoutes.js - CORRECTED ORDER FOR POOL ROUTES
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const adminInPersonCoursesController = require("../../controllers/admin/inPersonCoursesController");
const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const CoursePoolItem = require("../../models/CoursePoolItem"); // <<< NEW: Pool Model

//const isAdmin = require('../../middlewares/isAdmin');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
};

// Create upload directories - EXACTLY AS MODEL EXPECTS
const uploadDirs = [
  "public/uploads/courses/images",
  "public/uploads/courses/documents",
  "public/uploads/courses/videos",
];

uploadDirs.forEach((dir) => ensureDirectoryExists(dir));

// Configure multer - EXACT MATCH WITH FRONTEND VALIDATION
const createMulterConfig = (uploadPath, allowedTypes, maxSize) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  });

  const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${allowedTypes.join(", ")} files are allowed`), false);
    }
  };

  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: maxSize },
  });
};

// Upload configurations - EXACT MATCH WITH FRONTEND CONFIG
const uploadConfigs = {
  documents: createMulterConfig(
    "public/uploads/courses/documents",
    [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    50 * 1024 * 1024
  ), // 50MB - MATCHES FRONTEND

  images: createMulterConfig(
    "public/uploads/courses/images",
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    5 * 1024 * 1024
  ), // 5MB - MATCHES FRONTEND

  videos: createMulterConfig(
    "public/uploads/courses/videos",
    ["video/mp4", "video/webm", "video/ogg"],
    100 * 1024 * 1024
  ), // 100MB - MATCHES FRONTEND

  mainImage: createMulterConfig(
    "public/uploads/courses/images",
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    5 * 1024 * 1024
  ), // 5MB - MATCHES FRONTEND
};

// Apply admin authentication middleware to all routes
//router.use(isAdmin);

/**
 * @route   GET /admin-courses/inperson
 * @desc    Render the admin in-person courses management page
 * @access  Admin
 */
router.get("/", adminInPersonCoursesController.renderAdminPage);

// ========================================
// NEW: COURSE POOL ROUTES - MUST BE BEFORE /api/:id
// ========================================

/**
 * @route   GET /admin-courses/inperson/api/pool
 * @desc    Get all course pool items
 * @access  Admin
 */
router.get("/api/pool", adminInPersonCoursesController.getPoolItems);

/**
 * @route   GET /admin-courses/inperson/api/pool/:id
 * @desc    Get a specific course pool item by ID
 * @access  Admin
 */
router.get("/api/pool/:id", adminInPersonCoursesController.getPoolItemById);

/**
 * @route   DELETE /admin-courses/inperson/api/pool/:id
 * @desc    Delete a course pool item
 * @access  Admin
 */
router.delete("/api/pool/:id", adminInPersonCoursesController.deletePoolItem);

// ========================================
// EXISTING SPECIFIC API ROUTES (General GET/POST/PUT/DELETE /api/:id should be last)
// ========================================

/**
 * @route   GET /admin-courses/inperson/api/certification-bodies
 * @desc    Get all active certification bodies
 * @access  Admin
 */
router.get(
  "/api/certification-bodies",
  adminInPersonCoursesController.getCertificationBodies
);

/**
 * @route   GET /admin-courses/inperson/api/instructors
 * @desc    Get all instructors for dropdown
 * @access  Admin
 */
router.get(
  "/api/instructors",
  adminInPersonCoursesController.getAllInstructors
);

/**
 * @route   POST /admin-courses/inperson/api/generate-course-code
 * @desc    Generate course code from title
 * @access  Admin
 */
router.post(
  "/api/generate-course-code",
  adminInPersonCoursesController.generateCourseCode
);

/**
 * @route   GET /admin-courses/inperson/api/check-course-code
 * @desc    Check if course code is available
 * @access  Admin
 */
router.get(
  "/api/check-course-code",
  adminInPersonCoursesController.checkCourseCode
);

/**
 * @route   GET /admin-courses/inperson/api/export
 * @desc    Export courses data to Excel
 * @access  Admin
 */
router.get("/api/export", adminInPersonCoursesController.exportData);

/**
 * @route   GET /admin-courses/inperson/api/notifications/status
 * @desc    Get notification system status
 * @access  Admin
 */
router.get(
  "/api/notifications/status",
  adminInPersonCoursesController.getNotificationStatus
);

/**
 * @route   GET /admin-courses/inperson/api
 * @desc    Get all in-person courses with filtering and pagination
 * @access  Admin
 */
router.get("/api", adminInPersonCoursesController.getAllCourses);

// ========================================
// FILE UPLOAD ROUTES
// ========================================

/**
 * @route   POST /admin-courses/inperson/api/upload/documents
 * @desc    Upload course documents (PDF, DOC, PPT, etc.)
 * @access  Admin
 */
router.post(
  "/api/upload/documents",
  uploadConfigs.documents.array("files", 10),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }
      const files = req.files.map(
        (file) => `/uploads/courses/documents/${file.filename}`
      );
      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        files: files,
      });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading documents",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /admin-courses/inperson/api/upload/images
 * @desc    Upload gallery images
 * @access  Admin
 */
router.post(
  "/api/upload/images",
  uploadConfigs.images.array("files", 20),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }
      const files = req.files.map(
        (file) => `/uploads/courses/images/${file.filename}`
      );
      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        files: files,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading images",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /admin-courses/inperson/api/upload/videos
 * @desc    Upload course videos
 * @access  Admin
 */
router.post(
  "/api/upload/videos",
  uploadConfigs.videos.array("files", 5),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }
      const files = req.files.map(
        (file) => `/uploads/courses/videos/${file.filename}`
      );
      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        files: files,
      });
    } catch (error) {
      console.error("Error uploading videos:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading videos",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /admin-courses/inperson/api/upload/main-image
 * @desc    Upload main course image
 * @access  Admin
 */
router.post(
  "/api/upload/main-image",
  uploadConfigs.mainImage.array("files", 1),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded" });
      }
      const fileUrl = `/uploads/courses/images/${req.files[0].filename}`;
      res.json({
        success: true,
        message: "Main image uploaded successfully",
        files: [fileUrl],
      });
    } catch (error) {
      console.error("Error uploading main image:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading main image",
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /admin-courses/inperson/api/save-uploaded-files
 * @desc    Save uploaded file references for a course
 * @access  Admin
 */
router.post("/api/save-uploaded-files", async (req, res) => {
  try {
    const { courseId, fileType, fileUrls } = req.body;
    console.log("💾 Saving uploaded files:", { courseId, fileType, fileUrls });

    if (courseId) {
      const course = await InPersonAestheticTraining.findById(courseId);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      }

      if (!course.media) course.media = {};

      switch (fileType) {
        case "mainImage":
          course.media.mainImage = {
            url: fileUrls[0],
            alt: req.body.alt || "",
          };
          break;
        case "documents":
          if (!course.media.documents) course.media.documents = [];
          course.media.documents.push(...fileUrls);
          break;
        case "images":
          if (!course.media.images) course.media.images = [];
          course.media.images.push(...fileUrls);
          break;
        case "videos":
          if (!course.media.videos) course.media.videos = [];
          course.media.videos.push(...fileUrls);
          break;
      }

      await course.save();
      res.json({
        success: true,
        message: "Files saved successfully",
        media: course.media,
      });
    } else {
      res.json({
        success: true,
        message: "Files ready for course creation",
        savedFiles: { [fileType]: fileUrls },
      });
    }
  } catch (error) {
    console.error("Error saving uploaded files:", error);
    res.status(500).json({
      success: false,
      message: "Error saving uploaded files",
      error: error.message,
    });
  }
});

// ========================================
// MAIN COURSE CRUD ROUTES (These should typically come AFTER more specific routes)
// ========================================

/**
 * @route   POST /admin-courses/inperson/api
 * @desc    Create a new in-person course
 * @access  Admin
 */
router.post(
  "/api",
  uploadConfigs.mainImage.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "documents", maxCount: 10 },
    { name: "images", maxCount: 20 },
    { name: "videos", maxCount: 5 },
  ]),
  adminInPersonCoursesController.createCourse
);

/**
 * @route   PUT /admin-courses/inperson/api/:id
 * @desc    Update an existing in-person course
 * @access  Admin
 */
router.put(
  "/api/:id",
  uploadConfigs.mainImage.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "documents", maxCount: 10 },
    { name: "images", maxCount: 20 },
    { name: "videos", maxCount: 5 },
  ]),
  adminInPersonCoursesController.updateCourse
);

/**
 * @route   DELETE /admin-courses/inperson/api/:id
 * @desc    Delete an in-person course
 * @access  Admin
 */
router.delete("/api/:id", adminInPersonCoursesController.deleteCourse);

/**
 * @route   POST /admin-courses/inperson/api/:id/clone
 * @desc    Clone an existing course
 * @access  Admin
 */
router.post("/api/:id/clone", adminInPersonCoursesController.cloneCourse);

/**
 * @route   POST /admin-courses/inperson/api/:id/delete-file
 * @desc    Delete a file from course
 * @access  Admin
 */
router.post("/api/:id/delete-file", adminInPersonCoursesController.deleteFile);

/**
 * @route   POST /admin-courses/inperson/api/:id/cancel
 * @desc    Cancel a course and notify registered students
 * @access  Admin
 */
router.post("/api/:id/cancel", adminInPersonCoursesController.cancelCourse);

/**
 * @route   POST /admin-courses/inperson/api/:id/postpone
 * @desc    Postpone a course and notify registered students
 * @access  Admin
 */
router.post("/api/:id/postpone", adminInPersonCoursesController.postponeCourse);

/**
 * @route   POST /admin-courses/inperson/api/:id/send-immediate-notification
 * @desc    Send immediate course notification (bypass 2-hour delay)
 * @access  Admin
 */
router.post(
  "/api/:id/send-immediate-notification",
  adminInPersonCoursesController.sendImmediateNotification
);

/**
 * @route   POST /admin-courses/inperson/api/:id/send-test-notification
 * @desc    Send test notification to specific email
 * @access  Admin
 */
router.post(
  "/api/:id/send-test-notification",
  adminInPersonCoursesController.sendTestNotification
);

/**
 * @route   DELETE /admin-courses/inperson/api/:id/cancel-notification
 * @desc    Cancel scheduled notification for a course
 * @access  Admin
 */
router.delete(
  "/api/:id/cancel-notification",
  adminInPersonCoursesController.cancelScheduledNotification
);

// CRITICAL: This MUST be the LAST GET route that takes an ID parameter
/**
 * @route   GET /admin-courses/inperson/api/:id
 * @desc    Get a specific in-person course by ID
 * @access  Admin
 */
router.get("/api/:id", adminInPersonCoursesController.getCourseById);

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

router.use((error, req, res, next) => {
  console.error("🚨 Route error:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message:
            "File size too large. Please reduce file size and try again.",
          error: "FILE_TOO_LARGE",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded. Please reduce number of files.",
          error: "TOO_MANY_FILES",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field. Please check your form.",
          error: "UNEXPECTED_FILE",
        });
      default:
        return res.status(400).json({
          success: false,
          message: "File upload error: " + error.message,
          error: "MULTER_ERROR",
        });
    }
  }

  if (error.message && error.message.includes("files are allowed")) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: "INVALID_FILE_TYPE",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: "SERVER_ERROR",
  });
});

module.exports = router;
