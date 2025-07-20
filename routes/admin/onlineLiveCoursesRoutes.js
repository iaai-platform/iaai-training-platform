const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const controller = require("../../controllers/admin/onlineLiveController");

// ==========================================
// CLOUDINARY CONFIGURATION
// ==========================================

// Configure cloudinary (make sure these environment variables are set)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// CLOUDINARY STORAGE CONFIGURATIONS
// ==========================================

// Main Images Storage
const mainImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/onlinelive/main-images",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, height: 800, crop: "limit" },
      { quality: "auto" },
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      return `main-image-${timestamp}-${randomStr}`;
    },
  },
});

// Course Documents Storage
const documentsStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/onlinelive/coursedocuments",
    allowed_formats: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
    resource_type: "raw", // Important for non-image files
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const originalName = file.originalname
        .split(".")[0]
        .replace(/[^a-zA-Z0-9]/g, "");
      return `document-${originalName}-${timestamp}-${randomStr}`;
    },
  },
});

// Gallery Images Storage
const galleryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/onlinelive/gallery-images",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 800, height: 600, crop: "limit" },
      { quality: "auto" },
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      return `gallery-${timestamp}-${randomStr}`;
    },
  },
});

// Videos Storage
const videosStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/onlinelive/videos",
    allowed_formats: ["mp4", "webm", "ogg", "mov", "avi"],
    resource_type: "video",
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const originalName = file.originalname
        .split(".")[0]
        .replace(/[^a-zA-Z0-9]/g, "");
      return `video-${originalName}-${timestamp}-${randomStr}`;
    },
  },
});

// ==========================================
// MULTER CONFIGURATIONS
// ==========================================

const mainImageUpload = multer({
  storage: mainImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

const documentsUpload = multer({
  storage: documentsStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

const galleryUpload = multer({
  storage: galleryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 20,
  },
});

const videosUpload = multer({
  storage: videosStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 5,
  },
});

// General upload for form submission (no files)
const upload = multer();

// ==========================================
// VIEW ROUTE
// ==========================================

router.get("/", controller.renderAdminPage);

// ==========================================
// CLOUDINARY FILE UPLOAD API ROUTES
// ==========================================

router.post(
  "/api/upload/main-image",
  mainImageUpload.array("files", 1),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
      }

      const file = req.files[0];
      const fileUrl = file.path; // Cloudinary URL

      console.log("✅ Main image uploaded to Cloudinary:", fileUrl);

      res.json({
        success: true,
        files: [fileUrl],
        cloudinary_id: file.filename,
      });
    } catch (error) {
      console.error("❌ Main image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  }
);

router.post(
  "/api/upload/documents",
  documentsUpload.array("files", 10),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded.",
        });
      }

      const fileUrls = req.files.map((file) => file.path);

      console.log(
        "✅ Documents uploaded to Cloudinary:",
        fileUrls.length,
        "files"
      );

      res.json({
        success: true,
        files: fileUrls,
        cloudinary_ids: req.files.map((file) => file.filename),
      });
    } catch (error) {
      console.error("❌ Documents upload error:", error);
      res.status(500).json({
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  }
);

router.post(
  "/api/upload/images",
  galleryUpload.array("files", 20),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded.",
        });
      }

      const fileUrls = req.files.map((file) => file.path);

      console.log(
        "✅ Gallery images uploaded to Cloudinary:",
        fileUrls.length,
        "files"
      );

      res.json({
        success: true,
        files: fileUrls,
        cloudinary_ids: req.files.map((file) => file.filename),
      });
    } catch (error) {
      console.error("❌ Gallery images upload error:", error);
      res.status(500).json({
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  }
);

router.post(
  "/api/upload/videos",
  videosUpload.array("files", 5),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded.",
        });
      }

      const fileUrls = req.files.map((file) => file.path);

      console.log(
        "✅ Videos uploaded to Cloudinary:",
        fileUrls.length,
        "files"
      );

      res.json({
        success: true,
        files: fileUrls,
        cloudinary_ids: req.files.map((file) => file.filename),
      });
    } catch (error) {
      console.error("❌ Videos upload error:", error);
      res.status(500).json({
        success: false,
        message: "Upload failed: " + error.message,
      });
    }
  }
);

// ==========================================
// CORE COURSE DATA API ROUTES
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

router.get("/api", controller.getAllCourses);
router.get("/api/instructors", controller.getAllInstructors);
router.get("/api/certification-bodies", controller.getAllCertificationBodies);
router.get("/api/check-course-code", controller.checkCourseCode);
router.get("/api/export", controller.exportData);
router.get("/api/notifications/status", controller.getNotificationStatus);
router.get("/api/:id", controller.getCourseById);

router.delete("/api/:id", controller.deleteCourse);

router.post(
  "/api/generate-course-code",
  express.json(),
  controller.generateCourseCode
);
router.post(
  "/api/:id/delete-file",
  express.json(),
  controller.deleteCloudinaryFile
); // Updated method
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

//test
//test
// Add this test route to verify the fix works
//test
// Add this test route to verify the fix works
router.get("/api/test/instructor-fix/:id", async (req, res) => {
  try {
    const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel");

    const course = await OnlineLiveTraining.findById(req.params.id)
      .populate(
        "instructors.primary.instructorId",
        "firstName lastName email fullName"
      )
      .populate(
        "instructors.additional.instructorId",
        "firstName lastName email fullName"
      );

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // FIX: Create helper functions directly in the route
    const getStandardizedInstructorNames = (course) => {
      const names = [];

      // Primary instructor
      if (course.instructors?.primary?.name) {
        names.push(course.instructors.primary.name);
      } else if (course.instructors?.primary?.instructorId?.fullName) {
        names.push(course.instructors.primary.instructorId.fullName);
      } else if (course.instructors?.primary?.instructorId?.firstName) {
        const inst = course.instructors.primary.instructorId;
        names.push(`${inst.firstName} ${inst.lastName}`.trim());
      }

      // Additional instructors
      if (course.instructors?.additional?.length > 0) {
        course.instructors.additional.forEach((inst) => {
          if (inst.name) {
            names.push(inst.name);
          } else if (inst.instructorId?.fullName) {
            names.push(inst.instructorId.fullName);
          } else if (inst.instructorId?.firstName) {
            names.push(
              `${inst.instructorId.firstName} ${inst.instructorId.lastName}`.trim()
            );
          }
        });
      }

      return names.length > 0 ? names.join(", ") : "TBD";
    };

    const getStandardizedInstructorEmails = async (course) => {
      const emails = [];
      const Instructor = require("../../models/Instructor");

      // Primary instructor
      if (course.instructors?.primary?.instructorId) {
        let email = null;

        if (course.instructors.primary.instructorId.email) {
          email = course.instructors.primary.instructorId.email;
        } else if (
          typeof course.instructors.primary.instructorId === "string"
        ) {
          try {
            const instructor = await Instructor.findById(
              course.instructors.primary.instructorId
            ).select("email");
            email = instructor?.email;
          } catch (error) {
            console.error("Error fetching primary instructor email:", error);
          }
        }

        if (email) {
          emails.push(email);
        }
      }

      return emails;
    };

    // Test all methods
    const instructorNames = getStandardizedInstructorNames(course);
    const instructorEmails = await getStandardizedInstructorEmails(course);
    const virtualNames = course.instructorNames; // Model's virtual field

    res.json({
      success: true,
      courseTitle: course.basic?.title,
      methods: {
        standardized: instructorNames,
        virtual: virtualNames,
        emails: instructorEmails,
      },
      rawData: {
        primary: course.instructors?.primary,
        additional: course.instructors?.additional,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add monitoring route
router.get("/api/notifications/tracking-status", (req, res) => {
  const notificationController = require("../../controllers/admin/onlinecourseNotificationController");

  res.json({
    success: true,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    trackingMaps: {
      scheduledNotifications:
        notificationController.scheduledNotifications.size,
      courseCreationTimes: notificationController.courseCreationTimes.size,
    },
  });
});
// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error("Multer Error:", error);
    return res.status(400).json({
      success: false,
      message: `File upload error: ${error.message}`,
    });
  }
  if (error) {
    console.error("Route Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred.",
    });
  }
  next();
});

module.exports = router;
