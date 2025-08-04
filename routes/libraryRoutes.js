// libraryRoutes.js - Updated with Clean Separation of Controllers

const express = require("express");
const router = express.Router();
const isAuthenticated = require("../middlewares/isAuthenticated");

// Import Controllers
const LibraryController = require("../controllers/libraryController");
const WatchExamController = require("../controllers/watchExamController"); // Self-paced course functions

// ========================================
// MAIN LIBRARY ROUTES
// ========================================

// Main Library Route - Redirects to self-paced by default
router.get("/library", isAuthenticated, async (req, res) => {
  res.redirect("/library/self-paced");
});

// Specific Library Routes (Display pages only)
router.get(
  "/library/self-paced",
  isAuthenticated,
  LibraryController.getSelfPacedLibrary
);
router.get("/library/live", isAuthenticated, LibraryController.getLiveLibrary);
router.get(
  "/library/in-person",
  isAuthenticated,
  LibraryController.getInPersonLibrary
);

// ========================================
// SELF-PACED COURSE ROUTES (WatchExamController)
// ========================================

// Video Player Routes
router.get(
  "/watch-exam/:courseId",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);
router.get(
  "/watch-exam/:courseId/:videoId",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);

// Alternative video player routes (for flexibility)
router.get(
  "/course/:courseId/watch",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);
router.get(
  "/course/:courseId/video/:videoId",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);

// Video Progress & Interaction Routes
router.post(
  "/update-video-progress",
  isAuthenticated,
  WatchExamController.updateVideoProgress
);
router.post(
  "/mark-video-completed",
  isAuthenticated,
  WatchExamController.markVideoCompleted
);

// Video Notes Routes
router.post("/save-notes", isAuthenticated, WatchExamController.saveNotes);
router.get(
  "/get-notes/:courseId/:videoId",
  isAuthenticated,
  WatchExamController.getNotes
);

// Exam Routes
router.post("/submit-exam", isAuthenticated, WatchExamController.submitExam);
router.get(
  "/exam-results/:courseId/:videoId",
  isAuthenticated,
  WatchExamController.getExamResults
);

// ========================================
// LIVE ONLINE COURSE ROUTES (LibraryController)
// ========================================

// Live Course Assessment Routes
router.get(
  "/library/online-live/assessment/:courseId",
  isAuthenticated,
  LibraryController.getOnlineLiveAssessment
);
router.post(
  "/library/online-live/assessment/:courseId",
  isAuthenticated,
  LibraryController.submitOnlineLiveAssessment
);

// Live Course Attendance Confirmation
router.post(
  "/library/confirm-attendance-live/:courseId",
  isAuthenticated,
  (req, res, next) => {
    req.body.courseType = "OnlineLiveTraining";
    next();
  },
  LibraryController.confirmAttendance
);

// Online Live Assessment Results
router.get(
  "/library/online-live/assessment/:courseId/results",
  isAuthenticated,
  LibraryController.getOnlineLiveAssessmentResults
);

// ========================================
// IN-PERSON COURSE ROUTES (LibraryController)
// ========================================

// In-Person Assessment Routes
router.get(
  "/library/in-person/assessment/:courseId",
  isAuthenticated,
  LibraryController.getInPersonAssessment
);
router.post(
  "/library/in-person/assessment/:courseId",
  isAuthenticated,
  LibraryController.submitInPersonAssessment
);

// In-Person Attendance Confirmation
router.post(
  "/library/confirm-attendance-inperson/:courseId",
  isAuthenticated,
  (req, res, next) => {
    req.body.courseType = "InPersonAestheticTraining";
    next();
  },
  LibraryController.confirmAttendance
);

// ========================================
// ASSESSMENT RESULTS ROUTES (FIXED)
// ========================================

// In-Person Assessment Results
router.get(
  "/library/in-person/assessment/:courseId/results",
  isAuthenticated,
  LibraryController.getInPersonAssessmentResults
);

// Online Live Assessment Results (THIS WAS MISSING!)
router.get(
  "/library/online-live/assessment/:courseId/results",
  isAuthenticated,
  LibraryController.getOnlineLiveAssessmentResults
);

// Generic assessment results route (determines course type automatically)
router.get(
  "/library/assessment/:courseId/results",
  isAuthenticated,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.user._id;

      const User = require("../models/user");
      const user = await User.findById(userId).select(
        "myInPersonCourses myLiveCourses"
      );

      if (!user) {
        return res.status(404).render("error", {
          message: "User not found",
          user: req.user,
        });
      }

      // Check if it's an in-person course
      const inPersonEnrollment = user.myInPersonCourses?.find(
        (c) => c.courseId.toString() === courseId
      );

      if (inPersonEnrollment) {
        return res.redirect(
          `/library/in-person/assessment/${courseId}/results`
        );
      }

      // Check if it's a live online course
      const liveEnrollment = user.myLiveCourses?.find(
        (c) => c.courseId.toString() === courseId
      );

      if (liveEnrollment) {
        return res.redirect(
          `/library/online-live/assessment/${courseId}/results`
        );
      }

      // Course not found in any enrollment
      return res.status(404).render("error", {
        message: "Course enrollment not found",
        user: req.user,
      });
    } catch (error) {
      console.error("Error in generic assessment results route:", error);
      res.status(500).render("error", {
        message: "Error loading assessment results",
        user: req.user,
      });
    }
  }
);
// ========================================
// GENERAL ATTENDANCE ROUTES (for backward compatibility)
// ========================================

// General attendance confirmation route (determines course type automatically)
router.post(
  "/library/confirm-attendance/:courseId",
  isAuthenticated,
  LibraryController.confirmAttendance
);
router.post(
  "/confirm-attendance/:courseId",
  isAuthenticated,
  LibraryController.confirmAttendance
);

// ========================================
// CERTIFICATE ROUTES (All Course Types)
// ========================================
// ========================================
// CERTIFICATE ROUTES (All Course Types)
// ========================================

// ✅ ADD: Redirect old certificate routes to new system
router.get("/certificate/:courseId", isAuthenticated, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    console.log(
      `🔄 Redirecting old certificate route: /certificate/${courseId}`
    );

    const User = require("../models/user");
    const user = await User.findById(userId).select("myCertificates");

    if (!user) {
      req.flash("error_message", "User not found");
      return res.redirect("/library");
    }

    // Find existing certificate for this course
    const existingCertificate = user.myCertificates?.find(
      (cert) => cert.courseId && cert.courseId.toString() === courseId
    );

    if (existingCertificate) {
      console.log(
        `✅ Redirecting to certificate: ${existingCertificate.certificateId}`
      );
      return res.redirect(
        `/certificates/view/${existingCertificate.certificateId}`
      );
    } else {
      console.log(`⚠️ No certificate found for course ${courseId}`);
      req.flash(
        "info_message",
        "Certificate not found. Please ensure you have completed all course requirements."
      );
      return res.redirect("/library");
    }
  } catch (error) {
    console.error("❌ Error in certificate redirect:", error);
    req.flash("error_message", "Error accessing certificate");
    res.redirect("/library");
  }
});

// ✅ ADD: Redirect certificate download
router.get(
  "/certificate/download/:certificateId",
  isAuthenticated,
  (req, res) => {
    console.log(
      `🔄 Redirecting certificate download: ${req.params.certificateId}`
    );
    res.redirect(`/certificates/download/${req.params.certificateId}`);
  }
);

// ========================================
// API ROUTES (for AJAX requests)
// ========================================

// Course statistics API
router.get("/api/course-stats/:courseId", isAuthenticated, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const User = require("../models/user");
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Find course in any of the enrollment arrays
    let enrollment = user.mySelfPacedCourses?.find(
      (c) => c.courseId.toString() === courseId
    );
    let courseType = "self-paced";

    if (!enrollment) {
      enrollment = user.myLiveCourses?.find(
        (c) => c.courseId.toString() === courseId
      );
      courseType = "live";
    }

    if (!enrollment) {
      enrollment = user.myInPersonCourses?.find(
        (c) => c.courseId.toString() === courseId
      );
      courseType = "in-person";
    }

    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    let stats = {};

    if (courseType === "self-paced") {
      const courseProgress = enrollment.courseProgress || {};
      stats = {
        courseType: "self-paced",
        completedVideos: courseProgress.completedVideos?.length || 0,
        completedExams: courseProgress.completedExams?.length || 0,
        overallPercentage: courseProgress.overallPercentage || 0,
        status: courseProgress.status || "not-started",
        totalWatchTime: courseProgress.totalWatchTime || 0,
        averageExamScore: courseProgress.averageExamScore || 0,
      };
    } else {
      const userProgress = enrollment.userProgress || {};
      stats = {
        courseType: courseType,
        attendancePercentage: userProgress.overallAttendancePercentage || 0,
        courseStatus: userProgress.courseStatus || "not-started",
        completionDate: userProgress.completionDate,
      };
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error getting course stats:", error);
    res
      .status(500)
      .json({ success: false, message: "Error getting course statistics" });
  }
});

// ========================================
// LEGACY ROUTES (for backward compatibility)
// ========================================

// Old route names that might be used in existing code
router.get("/my-library", isAuthenticated, (req, res) =>
  res.redirect("/library")
);
router.get("/training-library", isAuthenticated, (req, res) =>
  res.redirect("/library")
);

// Old video player routes
router.get(
  "/watch/:courseId",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);
router.get(
  "/watch/:courseId/:videoId",
  isAuthenticated,
  WatchExamController.getWatchExamPage
);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler for library routes
router.use("/library/*", (req, res) => {
  res.status(404).render("error", {
    message: "Library page not found",
    user: req.user,
  });
});

module.exports = router;
