const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("../../controllers/admin/onlineLiveController");

// ==========================================
// MULTER CONFIGURATION
// ==========================================

// Configure storage for all online live course file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;

    // Determine the correct subfolder based on the route or fieldname
    if (req.path.includes("/main-image") || file.fieldname === "mainImage") {
      uploadPath = "public/uploads/onlinelivecourses/images";
    } else if (
      req.path.includes("/documents") ||
      file.fieldname === "documents"
    ) {
      uploadPath = "public/uploads/onlinelivecourses/documents";
    } else if (req.path.includes("/images") || file.fieldname === "images") {
      uploadPath = "public/uploads/onlinelivecourses/gallery";
    } else if (req.path.includes("/videos") || file.fieldname === "videos") {
      uploadPath = "public/uploads/onlinelivecourses/videos";
    } else {
      // Default fallback for mixed file types if needed
      if (file.mimetype.startsWith("image/")) {
        uploadPath = "public/uploads/onlinelivecourses/images";
      } else if (file.mimetype.startsWith("video/")) {
        uploadPath = "public/uploads/onlinelivecourses/videos";
      } else {
        uploadPath = "public/uploads/onlinelivecourses/documents";
      }
    }

    // Create the directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") // Sanitize filename
      .substring(0, 50);
    cb(null, `onlinelive-${baseName}-${uniqueSuffix}${ext}`);
  },
});

// Define a consistent file filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "video/mp4",
    "video/webm",
    "video/ogg",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}.`), false);
  }
};

// Create the Multer instance with storage, filter, and limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 50, // Max 50 files per request
  },
});

// ==========================================
// VIEW ROUTE
// ==========================================

router.get("/", controller.renderAdminPage);

// ==========================================
// DEDICATED FILE UPLOAD API ROUTES
// These routes handle the initial, separate file uploads from the frontend.
// ==========================================

router.post("/api/upload/main-image", upload.array("files", 1), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded." });
  }
  const fileUrl = `/uploads/onlinelivecourses/images/${req.files[0].filename}`;
  res.json({ success: true, files: [fileUrl] });
});

router.post("/api/upload/documents", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No files uploaded." });
  }
  const fileUrls = req.files.map(
    (file) => `/uploads/onlinelivecourses/documents/${file.filename}`
  );
  res.json({ success: true, files: fileUrls });
});

router.post("/api/upload/images", upload.array("files", 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No files uploaded." });
  }
  const fileUrls = req.files.map(
    (file) => `/uploads/onlinelivecourses/gallery/${file.filename}`
  );
  res.json({ success: true, files: fileUrls });
});

router.post("/api/upload/videos", upload.array("files", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No files uploaded." });
  }
  const fileUrls = req.files.map(
    (file) => `/uploads/onlinelivecourses/videos/${file.filename}`
  );
  res.json({ success: true, files: fileUrls });
});

// ==========================================
// CORE COURSE DATA API ROUTES
// ✅ This is the critical fix. Using `upload.any()` ensures that the `multipart/form-data`
// from the final form submission is parsed correctly, populating `req.body`.
// ==========================================

const debugMiddleware = (req, res, next) => {
  console.log("🐛 ONLINE LIVE API HIT:", req.method, req.originalUrl);
  console.log("   - Body Keys:", Object.keys(req.body || {}));
  console.log("   - Files Received:", req.files ? req.files.length : "None");
  next();
};

router.post("/api", upload.any(), debugMiddleware, controller.createCourse);

router.put("/api/:id", upload.any(), debugMiddleware, controller.updateCourse);

// ==========================================
// OTHER API ENDPOINTS
// ==========================================

// GET requests do not need body parsers
router.get("/api", controller.getAllCourses);
router.get("/api/instructors", controller.getAllInstructors);
router.get("/api/certification-bodies", controller.getAllCertificationBodies);
router.get("/api/check-course-code", controller.checkCourseCode);
router.get("/api/export", controller.exportData);
router.get("/api/notifications/status", controller.getNotificationStatus);
router.get("/api/:id", controller.getCourseById);

// DELETE request for a course
router.delete("/api/:id", controller.deleteCourse);

// POST requests with JSON payloads
router.post(
  "/api/generate-course-code",
  express.json(),
  controller.generateCourseCode
);
router.post("/api/:id/delete-file", express.json(), controller.deleteFile);
router.post("/api/:id/clone", express.json(), controller.cloneCourse);
router.post("/api/:id/cancel", express.json(), controller.cancelCourse);
router.post("/api/:id/postpone", express.json(), controller.postponeCourse);
router.post(
  "/api/:id/notify-immediate",
  express.json(),
  controller.sendImmediateNotification
);
router.post(
  "/api/:id/notify-test",
  express.json(),
  controller.sendTestNotification
);
router.delete("/api/:id/notify-cancel", controller.cancelScheduledNotification);

// ==========================================
// FINAL ERROR HANDLING MIDDLEWARE
// ==========================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error("Multer Error:", error);
    return res
      .status(400)
      .json({ success: false, message: `File upload error: ${error.message}` });
  }
  if (error) {
    console.error("Route Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "An unexpected error occurred.",
      });
  }
  next();
});

module.exports = router;
