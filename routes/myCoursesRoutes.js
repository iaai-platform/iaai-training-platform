//myCoursesRoutes.js

const express = require('express');
const router = express.Router();
const { getMyCourses } = require('../controllers/myCoursesController');  // Import the controller
const isAuthenticated = require('../middlewares/isAuthenticated');  // Authentication middleware

// Route to get the user's registered courses
router.get('/my-courses', isAuthenticated, getMyCourses);

module.exports = router;