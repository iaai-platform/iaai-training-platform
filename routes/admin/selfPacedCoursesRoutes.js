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
// ENSURE UPLOAD DIRECTORIES EXIST
// ========================================
const videoUploadDir = path.join(__dirname, "../../uploads/selfpaced/videos");
const thumbnailUploadDir = path.join(
  __dirname,
  "../../uploads/selfpaced/thumbnails"
);

if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
  console.log("📁 Created video upload directory:", videoUploadDir);
}

if (!fs.existsSync(thumbnailUploadDir)) {
  fs.mkdirSync(thumbnailUploadDir, { recursive: true });
  console.log("📸 Created thumbnail upload directory:", thumbnailUploadDir);
}

// ========================================
// MULTER CONFIGURATION FOR VIDEOS
// ========================================
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videoUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /mp4|mov|avi|webm|mkv|pdf|doc|docx|csv/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files and documents are allowed"));
    }
  },
});

// ========================================
// MULTER CONFIGURATION FOR THUMBNAILS
// ========================================
const thumbnailStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, thumbnailUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "thumbnail-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const thumbnailUpload = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF)"));
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
// THUMBNAIL MANAGEMENT API
// ========================================

// Upload course thumbnail
router.post(
  "/api/courses/:courseId/thumbnail",
  isAdmin,
  thumbnailUpload.single("thumbnail"),
  async (req, res) => {
    try {
      const { courseId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No thumbnail file uploaded",
        });
      }

      const course = await SelfPacedOnlineTraining.findById(courseId);
      if (!course) {
        // Clean up uploaded file
        await fsPromises.unlink(req.file.path);
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Delete old thumbnail if exists
      if (
        course.media?.thumbnailUrl &&
        course.media.thumbnailUrl.startsWith("/uploads/")
      ) {
        const oldFilePath = path.join(
          __dirname,
          "../..",
          course.media.thumbnailUrl
        );
        try {
          await fsPromises.unlink(oldFilePath);
          console.log("Deleted old thumbnail:", oldFilePath);
        } catch (err) {
          console.error("Error deleting old thumbnail:", err);
        }
      }

      // Update course with new thumbnail URL
      const thumbnailUrl = `/uploads/selfpaced/thumbnails/${req.file.filename}`;

      if (!course.media) {
        course.media = {};
      }
      course.media.thumbnailUrl = thumbnailUrl;

      await course.save();

      console.log(
        `✅ Thumbnail uploaded for course ${course.basic.title}: ${thumbnailUrl}`
      );

      res.json({
        success: true,
        message: "Thumbnail uploaded successfully",
        thumbnailUrl: thumbnailUrl,
        course: course,
      });
    } catch (error) {
      console.error("❌ Error uploading thumbnail:", error);

      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting uploaded file:", err);
        }
      }

      res.status(500).json({
        success: false,
        message: "Error uploading thumbnail",
        error: error.message,
      });
    }
  }
);

// Delete course thumbnail
router.delete("/api/courses/:courseId/thumbnail", isAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Delete thumbnail file if exists
    if (
      course.media?.thumbnailUrl &&
      course.media.thumbnailUrl.startsWith("/uploads/")
    ) {
      const filePath = path.join(__dirname, "../..", course.media.thumbnailUrl);
      try {
        await fsPromises.unlink(filePath);
        console.log("Deleted thumbnail file:", filePath);
      } catch (err) {
        console.error("Error deleting thumbnail file:", err);
      }
    }

    // Remove thumbnail URL from course
    if (course.media) {
      course.media.thumbnailUrl = "";
    }

    await course.save();

    console.log(`✅ Thumbnail deleted for course ${course.basic.title}`);

    res.json({
      success: true,
      message: "Thumbnail deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting thumbnail:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting thumbnail",
      error: error.message,
    });
  }
});

// ========================================
// VIDEO MANAGEMENT API
// ========================================
router.get(
  "/api/videos/:courseId",
  isAdmin,
  adminSelfPacedController.getCourseVideos
);
router.post(
  "/api/videos/:courseId",
  isAdmin,
  videoUpload.single("videoFile"),
  adminSelfPacedController.addVideo
);
router.put(
  "/api/videos/:courseId/:videoId",
  isAdmin,
  videoUpload.single("videoFile"),
  adminSelfPacedController.updateVideo
);
router.delete(
  "/api/videos/:courseId/:videoId",
  isAdmin,
  adminSelfPacedController.deleteVideo
);
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
router.post(
  "/api/import/courses",
  isAdmin,
  videoUpload.single("file"),
  adminSelfPacedController.importCourses
);

// ========================================
// HELPER ROUTES - FIXED: No duplicates
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
