// routes/inPersonCourseUserRoutes.js
const express = require('express');
const router = express.Router();
// Import the authentication middleware
// Import the controllers
const {
  getInPersonAestheticTraining,
  getCourseDetails,
} = require('../controllers/inPersonTrainingUserController');

// ROUTE LOGGING (for debugging)
// ============================================
router.use((req, res, next) => {
  // Only log if the route actually matches one of our patterns
  if (req.path.startsWith('/in-person')) {
    console.log(`📍 In-Person Training Route accessed: ${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Route to display all In-Person Aesthetic Training courses
// GET /in-person-aesthetic-training
router.get('/in-person-aesthetic-training', getInPersonAestheticTraining);

// Route for specific in-person course details page
// GET /in-person/courses/:courseId
router.get('/in-person/courses/:courseId', getCourseDetails);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================



module.exports = router;