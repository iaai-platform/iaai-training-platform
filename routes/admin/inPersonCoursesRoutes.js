// routes/admin/inPersonCoursesRoutes.js - CORRECTED ORDER FOR POOL ROUTES
const express = require("express");
const router = express.Router();
const multer = require("multer");

const adminInPersonCoursesController = require("../../controllers/admin/inPersonCoursesController");
const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const CoursePoolItem = require("../../models/CoursePoolItem"); // <<< NEW: Pool Model
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary - ADD THIS AFTER OTHER IMPORTS
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Define allowed file types
    const allowedTypes = {
      "image/jpeg": true,
      "image/jpg": true,
      "image/png": true,
      "image/webp": true,
      "application/pdf": true,
      "application/msword": true,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
      "application/vnd.ms-powerpoint": true,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
      "video/mp4": true,
      "video/webm": true,
      "video/ogg": true,
    };

    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  },
});
const isAdmin = require("../../middlewares/isAdmin");

// Apply admin authentication middleware to all routes
router.use(isAdmin);

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
  upload.array("files", 10),
  async (req, res) => {
    try {
      console.log(
        "📁 Documents upload - Files received:",
        req.files?.length || 0
      );

      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          // ✅ CRITICAL: Extract original filename without extension
          const originalName = file.originalname.replace(/\.[^/.]+$/, "");

          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "iaai-platform/inperson/coursedocuments",
              resource_type: "raw",
              public_id: `${originalName}_${Date.now()}`, // ✅ Use original filename
              use_filename: false, // ✅ We're setting public_id manually
              unique_filename: false, // ✅ We're handling uniqueness
            },
            (error, result) => {
              if (error) {
                console.error("❌ Cloudinary upload error:", error);
                reject(error);
              } else {
                // ✅ CRITICAL FIX: Create URL with proper attachment parameter
                const viewableUrl = `${result.secure_url.replace(
                  "/upload/",
                  "/upload/fl_attachment:" + file.originalname + "/"
                )}`;

                console.log(
                  "✅ Document uploaded with viewable URL:",
                  viewableUrl
                );
                resolve({
                  url: result.secure_url, // Original URL for storage
                  viewUrl: viewableUrl, // URL with proper filename for viewing
                  originalName: file.originalname,
                });
              }
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const uploadResults = await Promise.all(uploadPromises);

      console.log(
        "✅ All documents uploaded successfully:",
        uploadResults.length
      );

      res.json({
        success: true,
        message: `${uploadResults.length} document(s) uploaded successfully`,
        files: uploadResults.map((result) => result.viewUrl), // ✅ Return viewable URLs
        uploadDetails: uploadResults, // ✅ Include full details if needed
      });
    } catch (error) {
      console.error("❌ Error uploading documents:", error);
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
  upload.array("files", 20),
  async (req, res) => {
    try {
      console.log("🖼️ Images upload - Files received:", req.files?.length || 0);

      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "iaai-platform/inperson/gallery-images",
              resource_type: "image", // ✅ CORRECT: Use "image" for images
              format: "webp",
              transformation: [
                { width: 800, height: 600, crop: "fill", quality: "auto" },
              ],
            },
            (error, result) => {
              if (error) {
                console.error("❌ Cloudinary upload error:", error);
                reject(error);
              } else {
                console.log("✅ Image uploaded:", result.secure_url);
                resolve(result.secure_url);
              }
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: `${uploadedUrls.length} gallery image(s) uploaded successfully`,
        files: uploadedUrls,
      });
    } catch (error) {
      console.error("❌ Error uploading images:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading images",
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
  upload.single("file"), // Keep as "file" - frontend will send this
  async (req, res) => {
    try {
      console.log("🖼️ Main image upload - File received:", !!req.file);

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded" });
      }

      // Upload to Cloudinary with specific folder
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "iaai-platform/inperson/main-images",
            resource_type: "image",
            format: "webp",
            transformation: [
              { width: 1200, height: 800, crop: "fill", quality: "auto" },
            ],
          },
          (error, result) => {
            if (error) {
              console.error("❌ Cloudinary upload error:", error);
              reject(error);
            } else {
              console.log("✅ Main image uploaded:", result.secure_url);
              resolve(result);
            }
          }
        );
        uploadStream.end(req.file.buffer);
      });

      res.json({
        success: true,
        message: "Main image uploaded successfully",
        files: [result.secure_url],
      });
    } catch (error) {
      console.error("❌ Error uploading main image:", error);
      res.status(500).json({
        success: false,
        message: "Error uploading main image",
        error: error.message,
      });
    }
  }
);

// ===========================================
// 4. ADD DELETE ROUTE FOR CLOUDINARY FILES
// ===========================================

// Add this route to your inPersonCoursesRoutes.js
router.post("/api/delete-cloudinary-file", async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    res.json({
      success: result.result === "ok",
      message:
        result.result === "ok" ? "File deleted successfully" : "File not found",
    });
  } catch (error) {
    console.error("Error deleting Cloudinary file:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting file",
      error: error.message,
    });
  }
});

/**
 * @route   POST /admin-courses/inperson/api/upload/videos
 * @desc    Upload course videos
 * @access  Admin
 */
router.post(
  "/api/upload/videos",
  upload.array("files", 5), // CHANGED: Use memory storage upload
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "iaai-platform/inperson/course-videos", // ADDED: Video folder
              resource_type: "video",
              format: file.mimetype.includes("mp4") ? "mp4" : undefined,
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: `${uploadedUrls.length} file(s) uploaded successfully`,
        files: uploadedUrls,
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
  upload.fields([
    // CHANGED: Use single upload config
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
  upload.fields([
    // CHANGED: Use single upload config
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
