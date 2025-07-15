const express = require('express');
const router = express.Router();
const inCompanyCoursesController = require('../controllers/inCompanyCoursesController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin'); // ✅ Middleware for Admin Access

// ✅ 1️⃣ Route to View In-Company Training Page
router.get('/in-company-courses', inCompanyCoursesController.getInCompanyCoursesPage);

// ✅ 2️⃣ Route to Handle Application Submission
router.post('/apply-in-company', inCompanyCoursesController.submitApplication);

// ✅ 3️⃣ Route for Admin to View Applications
router.get('/admin/in-company-applications', isAuthenticated, isAdmin, inCompanyCoursesController.getAllApplications);

module.exports = router;