const express = require('express');
const router = express.Router();
const adminFormsController = require('../controllers/adminFormsController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin'); // ✅ Middleware for Admin Access

// ✅ 1️⃣ Route to View Applications (Admin Only)
router.get('/admin-view-forms', isAuthenticated, isAdmin, adminFormsController.getAllApplications);

// ✅ 2️⃣ Route to Delete an Application (Admin Only)
router.post('/admin/delete-application', isAuthenticated, isAdmin, adminFormsController.deleteApplication);

module.exports = router;