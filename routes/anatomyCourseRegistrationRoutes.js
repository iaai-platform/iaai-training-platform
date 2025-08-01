// routes/anatomyCourseRegistrationRoutes.js
const express = require("express");
const router = express.Router();
const anatomyCourseController = require("../controllers/anatomyCourseController");

// Route to display the free anatomy course registration page
router.get(
  "/free-anatomy-course-registration",
  anatomyCourseController.showRegistrationPage
);

// Route to handle the registration form submission
router.post(
  "/register-anatomy-course",
  anatomyCourseController.registerForCourse
);

module.exports = router;
