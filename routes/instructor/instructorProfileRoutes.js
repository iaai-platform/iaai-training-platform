const express = require("express");
const router = express.Router();
const instructorProfileController = require("../../controllers/instructor/instructorProfileController");

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error_message", "Please log in to access this page.");
  res.redirect("/login");
};

// Middleware to ensure user is an instructor
const ensureInstructorRole = (req, res, next) => {
  if (req.user && req.user.role === "instructor") {
    return next();
  }
  req.flash(
    "error_message",
    "You are not authorized to view this page. Only instructors can access this profile."
  );
  res.redirect("/dashboard");
};

// GET instructor's own profile page
router.get(
  "/instructor/me",
  ensureAuthenticated,
  ensureInstructorRole,
  instructorProfileController.getInstructorProfile
);

// GET page to edit instructor's own profile
router.get(
  "/instructor/me/edit",
  ensureAuthenticated,
  ensureInstructorRole,
  instructorProfileController.getEditInstructorProfile
);

// POST request to update instructor's own profile
router.post(
  "/instructor/me/edit",
  ensureAuthenticated,
  ensureInstructorRole,
  instructorProfileController.postEditInstructorProfile
);

// NEW: GET instructor's assigned teaching courses page
router.get(
  "/instructor/me/courses",
  ensureAuthenticated,
  ensureInstructorRole,
  instructorProfileController.getMyTeachingCourses
); // New route here

module.exports = router;
