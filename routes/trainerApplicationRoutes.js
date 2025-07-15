const express = require('express');
const router = express.Router();
const trainerApplicationController = require('../controllers/trainerApplicationController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin'); // ✅ Ensures only admin can view applications

// ✅ 1️⃣ Show Trainer Application Page
router.get('/new-trainers-required', trainerApplicationController.getTrainerApplicationPage);

// ✅ 2️⃣ Handle Form Submission
router.post('/apply-trainer', trainerApplicationController.submitTrainerApplication);

// ✅ 3️⃣ Admin Panel: View Trainer Applications
router.get('/admin-trainer-applications', isAuthenticated, isAdmin, trainerApplicationController.getAllTrainerApplications);

module.exports = router;