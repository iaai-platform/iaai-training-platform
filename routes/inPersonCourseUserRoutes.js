// routes/inPersonCourseUserRoutes.js - CORRECTED VERSION

const express = require("express");
const router = express.Router();

// Import the controllers - FIXED IMPORTS
const {
  getInPersonAestheticTraining,
  getCourseDetails,
  getCourseArchive,
} = require("../controllers/inPersonTrainingUserController");

// ✅ CORRECTED: Import library functions from libraryController
const {
  getInPersonLibrary,
  confirmAttendance,
  getInPersonAssessment,
  submitInPersonAssessment,
} = require("../controllers/libraryController");

// ROUTE LOGGING (for debugging)
router.use((req, res, next) => {
  if (req.path.startsWith("/in-person")) {
    console.log(
      `📍 In-Person Training Route accessed: ${req.method} ${req.path}`
    );
  }
  next();
});

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Route to display all In-Person Aesthetic Training courses
// GET /in-person-aesthetic-training
router.get("/in-person-aesthetic-training", getInPersonAestheticTraining);

// Route for specific in-person course details page
// GET /in-person/courses/:courseId
router.get("/in-person/courses/:courseId", getCourseDetails);

// NEW: Route for archived/historical course information
// GET /in-person/courses/:courseId/archive
router.get("/in-person/courses/:courseId/archive", getCourseArchive);

// ============================================
// LIBRARY ROUTES (Require authentication)
// ============================================

// GET /library/in-person - In-person courses library
router.get("/library/in-person", getInPersonLibrary);

// POST /library/confirm-attendance/:courseId - Confirm attendance
router.post("/library/confirm-attendance/:courseId", confirmAttendance);

// GET /library/in-person/assessment/:courseId - Get assessment page
router.get("/library/in-person/assessment/:courseId", getInPersonAssessment);

// POST /library/in-person/assessment/:courseId - Submit assessment
router.post(
  "/library/in-person/assessment/:courseId",
  submitInPersonAssessment
);

// Optional: API endpoint for debugging course data
router.get("/api/in-person/debug", async (req, res) => {
  try {
    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const now = new Date();

    const allCourses = await InPersonAestheticTraining.find()
      .select("basic schedule")
      .lean();

    const debugData = allCourses.map((course) => {
      const startDate = course.schedule?.startDate
        ? new Date(course.schedule.startDate)
        : null;
      const endDate = course.schedule?.endDate
        ? new Date(course.schedule.endDate)
        : null;

      let isExpired = false;
      if (endDate && now > endDate) {
        isExpired = true;
      } else if (
        !endDate &&
        startDate &&
        now > new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      ) {
        isExpired = true;
      }

      return {
        id: course._id,
        title: course.basic?.title,
        code: course.basic?.courseCode,
        status: course.basic?.status,
        startDate: startDate,
        endDate: endDate,
        isExpired: isExpired,
        now: now,
      };
    });

    res.json({
      success: true,
      currentTime: now,
      totalCourses: debugData.length,
      upcomingCourses: debugData.filter((c) => !c.isExpired).length,
      expiredCourses: debugData.filter((c) => c.isExpired).length,
      courses: debugData,
    });
  } catch (error) {
    console.error("❌ Error in debug endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch debug data",
      error: error.message,
    });
  }
});

module.exports = router;
