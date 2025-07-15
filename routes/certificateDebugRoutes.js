//certificateDebugRoutes
const express = require('express');
const router = express.Router();
const certificateDebugController = require('../controllers/certificateDebugController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Debug: Check user certificates in database
router.get('/debug/my-certificates', isAuthenticated, certificateDebugController.debugUserCertificates);

// Debug: Check course completion status
router.get('/debug/course-completion/:courseId', isAuthenticated, certificateDebugController.debugCourseCompletion);

// Debug: Force generate certificate for testing
router.post('/debug/force-certificate', isAuthenticated, certificateDebugController.forceGenerateCertificate);

// Debug: Test verification code
router.get('/debug/test-verification/:verificationCode', certificateDebugController.testVerification);

// Debug: List all certificates in the entire database (admin only)
router.get('/debug/all-certificates', isAuthenticated, async (req, res) => {
  try {
    // Only allow admins
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const User = require('../models/user');
    
    const usersWithCertificates = await User.find({
      'myCertificates.0': { $exists: true }
    }).select('firstName lastName email myCertificates');

    const allCertificates = [];
    
    usersWithCertificates.forEach(user => {
      user.myCertificates?.forEach(cert => {
        allCertificates.push({
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          userId: user._id,
          certificateId: cert.certificateId,
          courseId: cert.courseId,
          courseTitle: cert.certificateDetails?.title,
          verificationCode: cert.certificateDetails?.verificationCode,
          status: cert.certificateStatus?.status,
          issueDate: cert.certificateDetails?.issueDate,
          shareableUrl: cert.socialSharing?.shareableUrl
        });
      });
    });

    console.log(`🔍 Found ${allCertificates.length} total certificates across ${usersWithCertificates.length} users`);

    res.json({
      success: true,
      totalUsers: usersWithCertificates.length,
      totalCertificates: allCertificates.length,
      certificates: allCertificates
    });

  } catch (error) {
    console.error('❌ Error fetching all certificates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;