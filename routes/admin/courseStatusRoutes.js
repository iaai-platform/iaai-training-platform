// routes/admin/courseStatusRoutes.js
const express = require("express");
const router = express.Router();
const courseStatusController = require("../../controllers/admin/courseStatusController");

// Middleware to ensure user is authenticated and is admin
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error_message", "Please log in to access this page.");
  res.redirect("/login");
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  req.flash("error_message", "Access denied. Admin privileges required.");
  res.redirect("/dashboard");
};

/**
 * Course Status Monitoring Routes
 * Protected admin-only routes for monitoring course registrations
 */

// Main course status page
router.get(
  "/",
  ensureAuthenticated,
  isAdmin,
  courseStatusController.renderCourseStatusPage
);

// API: Get course details and registered users
router.get(
  "/api/course/:courseType/:courseId",
  ensureAuthenticated,
  isAdmin,
  courseStatusController.getCourseDetails
);

// API: Export course data
router.get(
  "/api/export",
  ensureAuthenticated,
  isAdmin,
  courseStatusController.exportCourseData
);

module.exports = router;
