// routes/selfPacedOnlineTrainingRoutes.js
const express = require("express");
const router = express.Router();
const {
  getSelfPacedOnlineTraining,
  getCourseDetails,
  getMyEnrolledCourses,
  accessCourse,
  updateVideoProgress,
  submitExam,
  updateVideoNotes,
  addBookmark,
  getCourseProgress,
} = require("../controllers/selfPacedCourseUserController");
const isAuthenticated = require("../middlewares/isAuthenticated");

// ========================================
// PUBLIC ROUTES
// ========================================

// Route to display all Self-Paced Online Training courses
router.get("/self-paced-online-training", getSelfPacedOnlineTraining);

// Route for specific course details page (public preview)
router.get("/self-paced-online-training/courses/:courseId", getCourseDetails);

// Route to get user's enrolled courses (for library/dashboard)
router.get("/my-self-paced-courses", isAuthenticated, getMyEnrolledCourses);

// ========================================
// AUTHENTICATED ROUTES - COURSE ACCESS
// ========================================

// Route to access course content (video player)
router.get("/self-paced-course/:courseId/learn", isAuthenticated, accessCourse);

// Route to update video progress
router.post(
  "/self-paced-course/:courseId/video/:videoId/progress",
  isAuthenticated,
  updateVideoProgress
);

// Route to submit exam
router.post(
  "/self-paced-course/:courseId/video/:videoId/exam",
  isAuthenticated,
  submitExam
);

// Route to update video notes
router.post(
  "/self-paced-course/:courseId/video/:videoId/notes",
  isAuthenticated,
  updateVideoNotes
);

// Route to add bookmark
router.post(
  "/self-paced-course/:courseId/video/:videoId/bookmark",
  isAuthenticated,
  addBookmark
);

// Route to get course progress
router.get(
  "/self-paced-course/:courseId/progress",
  isAuthenticated,
  getCourseProgress
);

module.exports = router;
