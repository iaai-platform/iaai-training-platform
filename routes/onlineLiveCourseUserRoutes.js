// routes/onlineLiveCourseUserRoutes.js
const express = require('express');
const router = express.Router();
const onlineLiveTrainingController = require('../controllers/onlineLiveCourseUserController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Public routes
router.get('/online-live-training', onlineLiveTrainingController.getOnlineLiveTraining);
router.get('/online-live-training/courses/:courseId', onlineLiveTrainingController.getCourseDetails);

// Protected routes - REMOVED separate endpoints, will use shared ones from server.js

// Live session features
router.post('/online-live-training/join/:courseId', isAuthenticated, onlineLiveTrainingController.joinLiveSession);
router.get('/online-live-training/materials/:courseId', isAuthenticated, onlineLiveTrainingController.getCourseMaterials);
router.get('/online-live-training/assessment/:courseId', isAuthenticated, onlineLiveTrainingController.getCourseAssessment);
router.post('/online-live-training/assessment/:courseId', isAuthenticated, onlineLiveTrainingController.submitAssessment);

module.exports = router;