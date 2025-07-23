// routes/linkedCourseRoutes.js
/**
 * Routes for linked course management
 * Simple and minimal implementation
 */

const express = require("express");
const router = express.Router();
const linkedCourseController = require("../controllers/linkedCourseController");

// Get list of online courses for selection dropdown
router.get("/online-courses/list", linkedCourseController.getOnlineCoursesList);

// Get linked course information for a specific in-person course
router.get(
  "/in-person-courses/:courseId/linked-courses",
  linkedCourseController.getLinkedCourse
);

// Add or update linked course for an in-person course
router.post(
  "/in-person-courses/:courseId/linked-course",
  linkedCourseController.addLinkedCourse
);

// Remove linked course from an in-person course
router.delete(
  "/in-person-courses/:courseId/linked-course",
  linkedCourseController.removeLinkedCourse
);

module.exports = router;
