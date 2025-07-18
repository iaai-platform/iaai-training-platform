// routes/admin/selfPacedCoursesRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;

// Import models
const SelfPacedOnlineTraining = require("../../models/selfPacedOnlineTrainingModel");

// Import controllers
const adminSelfPacedController = require("../../controllers/admin/selfpacedController");

// Import middlewares
const isAdmin = require("../../middlewares/isAdmin");

// ========================================
// MULTER CONFIGURATION FOR CLOUDINARY
// ========================================
// Use memory storage for temporary files before uploading to Cloudinary
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use OS temp directory
    cb(null, "/tmp");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// ========================================
// VIDEO UPLOAD CONFIGURATION
// ========================================
const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /mp4|mov|avi|webm|mkv/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      allowedTypes.test(file.mimetype) || file.mimetype.startsWith("video/");

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (MP4, MOV, AVI, WEBM, MKV)"));
    }
  },
});

// ========================================
// THUMBNAIL UPLOAD CONFIGURATION
// ========================================
const thumbnailUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      allowedTypes.test(file.mimetype) || file.mimetype.startsWith("image/");

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP)"));
    }
  },
});

// ========================================
// GENERAL UPLOAD (for import/export)
// ========================================
const generalUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for general files
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /csv|pdf|doc|docx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only CSV, PDF, DOC, DOCX files are allowed"));
    }
  },
});

// ========================================
// PAGE ROUTES
// ========================================

// Admin dashboard page
router.get("/manage", isAdmin, (req, res) => {
  try {
    res.render("admin/admin-manage-course-selfpaced", {
      title: "Self-Paced Course Management",
      user: req.user,
    });
  } catch (error) {
    console.error("❌ Error rendering self-paced management page:", error);
    res.status(500).render("error", {
      message: "Error loading self-paced course management",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

// ========================================
// STATISTICS & DASHBOARD API
// ========================================
router.get("/api/statistics", isAdmin, adminSelfPacedController.getStatistics);

// ========================================
// COURSE MANAGEMENT API
// ========================================
router.get("/api/courses", isAdmin, adminSelfPacedController.getAllCourses);
router.get(
  "/api/courses/:courseId",
  isAdmin,
  adminSelfPacedController.getCourseById
);
router.post("/api/courses", isAdmin, adminSelfPacedController.createCourse);
router.put(
  "/api/courses/:courseId",
  isAdmin,
  adminSelfPacedController.updateCourse
);
router.delete(
  "/api/courses/:courseId",
  isAdmin,
  adminSelfPacedController.deleteCourse
);

// ========================================
// THUMBNAIL MANAGEMENT API - UPDATED FOR CLOUDINARY
// ========================================

// Upload course thumbnail - Now uses controller method
router.post(
  "/api/courses/:courseId/thumbnail",
  isAdmin,
  thumbnailUpload.single("thumbnail"),
  adminSelfPacedController.uploadThumbnail
);

// Delete course thumbnail - Now uses controller method
router.delete(
  "/api/courses/:courseId/thumbnail",
  isAdmin,
  adminSelfPacedController.deleteThumbnail
);

// ========================================
// VIDEO MANAGEMENT API - UPDATED FOR CLOUDINARY
// ========================================
router.get(
  "/api/videos/:courseId",
  isAdmin,
  adminSelfPacedController.getCourseVideos
);

// Add video - Controller now handles Cloudinary upload
router.post(
  "/api/videos/:courseId",
  isAdmin,
  videoUpload.single("videoFile"),
  adminSelfPacedController.addVideo
);

// Update video - Controller now handles Cloudinary upload
router.put(
  "/api/videos/:courseId/:videoId",
  isAdmin,
  videoUpload.single("videoFile"),
  adminSelfPacedController.updateVideo
);

// Delete video - Controller now handles Cloudinary deletion
router.delete(
  "/api/videos/:courseId/:videoId",
  isAdmin,
  adminSelfPacedController.deleteVideo
);

// Reorder videos
router.put(
  "/api/videos/:courseId/reorder",
  isAdmin,
  adminSelfPacedController.reorderVideos
);

// ========================================
// IMPORT/EXPORT API
// ========================================
router.get(
  "/api/export/courses",
  isAdmin,
  adminSelfPacedController.exportCourses
);

// Updated to use general upload instead of video upload
router.post(
  "/api/import/courses",
  isAdmin,
  generalUpload.single("file"),
  adminSelfPacedController.importCourses
);

// ========================================
// HELPER ROUTES
// ========================================
router.get(
  "/api/instructors",
  isAdmin,
  adminSelfPacedController.getInstructors
);

router.get(
  "/api/certification-bodies",
  isAdmin,
  adminSelfPacedController.getCertificationBodies
);

// ========================================
// DEBUG & UTILITY ROUTES
// ========================================

// Debug route to check instructors
router.get("/api/debug/instructors", isAdmin, async (req, res) => {
  try {
    const Instructor = require("../../models/Instructor");
    const totalCount = await Instructor.countDocuments();
    const activeCount = await Instructor.countDocuments({ status: "Active" });
    const allInstructors = await Instructor.find({})
      .select("firstName lastName status email")
      .lean();

    res.json({
      success: true,
      debug: {
        totalInstructors: totalCount,
        activeInstructors: activeCount,
        allInstructors: allInstructors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test route to verify database and model
router.get("/api/test", isAdmin, async (req, res) => {
  try {
    // Test database connection
    const count = await SelfPacedOnlineTraining.countDocuments();

    // Try to create a test course
    const testCourse = new SelfPacedOnlineTraining({
      basic: {
        courseCode: "TEST-" + Date.now(),
        title: "Test Course",
        description: "Test Description",
        category: "aesthetic",
        status: "draft",
      },
      access: {
        price: 0,
        accessDays: 365,
      },
      content: {
        experienceLevel: "all-levels",
      },
      videos: [],
    });

    // Validate without saving
    await testCourse.validate();

    res.json({
      success: true,
      message: "Database and model are working correctly",
      currentCourseCount: count,
      testValidation: "Passed",
    });
  } catch (error) {
    console.error("Test route error:", error);
    res.status(500).json({
      success: false,
      message: "Database or model error",
      error: error.message,
      stack: error.stack,
    });
  }
});

// Migration route to update old course structure (temporary)
router.post("/api/migrate-courses", isAdmin, async (req, res) => {
  try {
    const courses = await SelfPacedOnlineTraining.find({});
    let migrated = 0;

    for (const course of courses) {
      let needsUpdate = false;

      // Check if course uses old structure
      if (!course.basic && course.title) {
        course.basic = {
          courseCode: course.courseCode,
          title: course.title,
          description: course.description,
          aboutThisCourse: course.Aboutthiscourse || course.aboutThisCourse,
          category: course.category || "aesthetic",
          status: course.status || "draft",
          courseType: "self-paced",
        };
        needsUpdate = true;
      }

      if (
        !course.access &&
        (course.price !== undefined || course.seatsAvailable !== undefined)
      ) {
        course.access = {
          price: course.price || 0,
          currency: "USD",
          accessDays: 365,
          totalEnrollments: 0,
        };
        needsUpdate = true;
      }

      if (!course.content && course.prerequisites) {
        course.content = {
          prerequisites: course.prerequisites,
          experienceLevel: "all-levels",
          objectives: [],
          targetAudience: [],
          totalVideos: course.videos?.length || 0,
          totalQuestions: 0,
        };
        needsUpdate = true;
      }

      if (!course.instructor && course.instructorId) {
        course.instructor = {
          instructorId: course.instructorId,
          name: course.instructorName || "Not Assigned",
        };
        needsUpdate = true;
      }

      if (!course.certification) {
        course.certification = {
          enabled: course.certificateProvided !== false,
          requireAllVideos: true,
          minimumScore: 70,
        };
        needsUpdate = true;
      }

      if (needsUpdate) {
        await course.save();
        migrated++;
      }
    }

    res.json({
      success: true,
      message: `Migration complete. Updated ${migrated} courses out of ${courses.length} total.`,
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message,
    });
  }
});

// ========================================
// CLOUDINARY FOLDER SETUP UTILITY (Optional)
// ========================================

// Route to ensure Cloudinary folders exist (optional utility)
router.post("/api/setup-cloudinary-folders", isAdmin, async (req, res) => {
  try {
    const cloudinary = require("cloudinary").v2;

    // This will create the folders on first upload
    // Cloudinary creates folders automatically when you upload to them
    res.json({
      success: true,
      message:
        "Cloudinary folders will be created automatically on first upload",
      folders: [
        "iaai-platform/selfpaced/videos",
        "iaai-platform/selfpaced/thumbnails",
      ],
    });
  } catch (error) {
    console.error("Cloudinary setup error:", error);
    res.status(500).json({
      success: false,
      message: "Error setting up Cloudinary folders",
      error: error.message,
    });
  }
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
router.use((error, req, res, next) => {
  console.error("❌ Self-paced courses route error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "File size too large. Maximum size is 500MB for videos, 5MB for images.",
      });
    }
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : null,
  });
});

module.exports = router;
