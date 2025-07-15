// Create this as: controllers/certificateDebugController.js
const User = require('../models/user');
const SelfPacedOnlineTraining = require('../models/selfPacedOnlineTrainingModel');

class CertificateDebugController {
  
  // Debug endpoint to check what's in the database
  async debugUserCertificates(req, res) {
    try {
      const userId = req.user._id;
      console.log(`🔍 DEBUG: Checking certificates for user: ${userId}`);

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log(`📄 User data structure:`, {
        hasMyCertificates: !!user.myCertificates,
        certificateCount: user.myCertificates?.length || 0,
        hasAchievementSummary: !!user.achievementSummary
      });

      if (user.myCertificates && user.myCertificates.length > 0) {
        console.log(`📜 Certificates found:`, user.myCertificates.map(cert => ({
          certificateId: cert.certificateId,
          verificationCode: cert.certificateDetails?.verificationCode,
          courseId: cert.courseId,
          status: cert.certificateStatus?.status,
          issueDate: cert.certificateDetails?.issueDate
        })));
      } else {
        console.log(`❌ No certificates found in database`);
      }

      res.json({
        success: true,
        debug: {
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          hasMyCertificates: !!user.myCertificates,
          certificateCount: user.myCertificates?.length || 0,
          certificates: user.myCertificates || [],
          achievementSummary: user.achievementSummary || null,
          userObjectKeys: Object.keys(user.toObject())
        }
      });

    } catch (error) {
      console.error('❌ Debug error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Debug endpoint to check course completion status
  async debugCourseCompletion(req, res) {
    try {
      const { courseId } = req.params;
      const userId = req.user._id;

      console.log(`🔍 DEBUG: Checking course completion - User: ${userId}, Course: ${courseId}`);

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Find the course in user's self-paced courses
      const userCourse = user.mySelfPacedCourses?.find(c => c.courseId?.toString() === courseId);
      if (!userCourse) {
        return res.status(404).json({ success: false, message: 'Course not found in user enrollments' });
      }

      // Get original course
      const originalCourse = await SelfPacedOnlineTraining.findById(courseId);
      if (!originalCourse) {
        return res.status(404).json({ success: false, message: 'Original course not found' });
      }

      // Analyze completion status
      const userCourseStatus = userCourse.userCourseStatus || {};
      const completedVideos = userCourseStatus.completedVideos || [];
      const completedExams = userCourseStatus.completedExams || [];

      const allVideosCompleted = originalCourse.videos.every(v => 
        completedVideos.map(id => id.toString()).includes(v._id.toString())
      );

      const videosWithExams = originalCourse.videos.filter(v => v.exam && v.exam.length > 0);
      const allExamsCompleted = videosWithExams.length === 0 || 
        videosWithExams.every(v => completedExams.map(id => id.toString()).includes(v._id.toString()));

      const courseCompleted = allVideosCompleted && allExamsCompleted;

      // Check existing certificate
      const existingCertificate = user.myCertificates?.find(cert => 
        cert.courseId?.toString() === courseId && cert.courseType === 'SelfPacedOnlineTraining'
      );

      console.log(`📊 Course completion analysis:`, {
        courseCompleted,
        allVideosCompleted,
        allExamsCompleted,
        completedVideos: completedVideos.length,
        totalVideos: originalCourse.videos.length,
        completedExams: completedExams.length,
        totalExams: videosWithExams.length,
        hasExistingCertificate: !!existingCertificate
      });

      res.json({
        success: true,
        debug: {
          courseId,
          courseName: originalCourse.title,
          userCourseStatus,
          completion: {
            courseCompleted,
            allVideosCompleted,
            allExamsCompleted,
            completedVideos: completedVideos.length,
            totalVideos: originalCourse.videos.length,
            completedExams: completedExams.length,
            totalExams: videosWithExams.length
          },
          existingCertificate: existingCertificate ? {
            certificateId: existingCertificate.certificateId,
            verificationCode: existingCertificate.certificateDetails?.verificationCode,
            status: existingCertificate.certificateStatus?.status,
            issueDate: existingCertificate.certificateDetails?.issueDate
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Debug course completion error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Force generate certificate for testing
  async forceGenerateCertificate(req, res) {
    try {
      const { courseId } = req.body;
      const userId = req.user._id;

      console.log(`🏆 FORCE: Generating certificate - User: ${userId}, Course: ${courseId}`);

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const userCourse = user.mySelfPacedCourses?.find(c => c.courseId?.toString() === courseId);
      if (!userCourse) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }

      const originalCourse = await SelfPacedOnlineTraining.findById(courseId);
      if (!originalCourse) {
        return res.status(404).json({ success: false, message: 'Original course not found' });
      }

      // Check if certificate already exists
      const existingCertificate = user.myCertificates?.find(cert => 
        cert.courseId?.toString() === courseId && cert.courseType === 'SelfPacedOnlineTraining'
      );

      if (existingCertificate) {
        console.log(`⚠️ Certificate already exists: ${existingCertificate.certificateId}`);
        return res.json({
          success: true,
          message: 'Certificate already exists',
          certificate: {
            certificateId: existingCertificate.certificateId,
            verificationCode: existingCertificate.certificateDetails.verificationCode,
            shareableUrl: existingCertificate.socialSharing?.shareableUrl
          }
        });
      }

      // Generate new certificate
      const certificateId = this.generateCertificateId();
      const verificationCode = this.generateVerificationCode();

      console.log(`🆔 Generated IDs - Certificate: ${certificateId}, Verification: ${verificationCode}`);

      const newCertificate = {
        certificateId,
        courseId: courseId,
        courseType: 'SelfPacedOnlineTraining',
        certificateDetails: {
          title: originalCourse.title,
          courseCode: originalCourse.courseCode || 'N/A',
          recipientName: `${user.firstName} ${user.lastName}`,
          instructorName: originalCourse.instructor || 'IAAI Training Institute',
          institutionName: 'IAAI Training Institute',
          completionDate: new Date(),
          issueDate: new Date(),
          verificationCode: verificationCode,
          digitalSignature: this.generateDigitalSignature({
            certificateId,
            recipientName: `${user.firstName} ${user.lastName}`,
            title: originalCourse.title,
            completionDate: new Date(),
            verificationCode
          }),
          courseStats: {
            totalVideos: originalCourse.videos?.length || 0,
            completedVideos: userCourse.userCourseStatus?.completedVideos?.length || 0,
            totalExams: originalCourse.videos?.filter(v => v.exam && v.exam.length > 0).length || 0,
            completedExams: userCourse.userCourseStatus?.completedExams?.length || 0,
            averageScore: 85,
            timeSpent: 3600,
            startDate: userCourse.dateOfRegistration
          }
        },
        certificateStatus: {
          status: 'active',
          downloadCount: 0,
          sharedCount: 0,
          publiclyVisible: false,
          linkedInShared: false
        },
        certificateFiles: {
          pdfUrl: `/certificates/${userId}/${certificateId}.pdf`,
          imageUrl: '',
          digitalBadgeUrl: '',
          qrCodeUrl: ''
        },
        socialSharing: {
          shareableUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/certificates/verify-page/${verificationCode}`
        },
        metadata: {
          ipAddress: req.ip || '',
          userAgent: req.get('User-Agent') || '',
          location: user.country || 'Unknown',
          deviceInfo: 'Web Application'
        }
      };

      // Initialize myCertificates if it doesn't exist
      if (!user.myCertificates) {
        user.myCertificates = [];
        console.log(`📝 Initialized myCertificates array`);
      }

      // Add certificate
      user.myCertificates.push(newCertificate);
      console.log(`📝 Added certificate to user, total certificates: ${user.myCertificates.length}`);

      // Update achievement summary
      this.updateAchievementSummary(user);

      // Save to database with detailed logging
      console.log(`💾 Attempting to save user to database...`);
      
      try {
        const saveResult = await user.save();
        console.log(`✅ User saved successfully!`);
        console.log(`📄 Save result ID: ${saveResult._id}`);
        
        // Verify the save by re-fetching
        const verifyUser = await User.findById(userId).select('myCertificates');
        console.log(`🔍 Verification: User has ${verifyUser.myCertificates?.length || 0} certificates after save`);
        
        if (verifyUser.myCertificates?.length > 0) {
          const savedCert = verifyUser.myCertificates.find(c => c.certificateId === certificateId);
          if (savedCert) {
            console.log(`✅ Certificate verified in database: ${savedCert.certificateId}`);
            console.log(`🔐 Verification code: ${savedCert.certificateDetails.verificationCode}`);
          } else {
            console.log(`❌ Certificate not found in verification check`);
          }
        } else {
          console.log(`❌ No certificates found in verification check`);
        }

      } catch (saveError) {
        console.error(`❌ SAVE ERROR:`, saveError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save certificate to database',
          error: saveError.message
        });
      }

      res.json({
        success: true,
        message: 'Certificate generated and saved successfully!',
        certificate: {
          certificateId: newCertificate.certificateId,
          verificationCode: newCertificate.certificateDetails.verificationCode,
          shareableUrl: newCertificate.socialSharing.shareableUrl,
          downloadUrl: newCertificate.certificateFiles.pdfUrl
        }
      });

    } catch (error) {
      console.error('❌ Force generate certificate error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Test verification
  async testVerification(req, res) {
    try {
      const { verificationCode } = req.params;
      
      console.log(`🔍 Testing verification for code: ${verificationCode}`);

      // Search for the certificate
      const user = await User.findOne({
        'myCertificates.certificateDetails.verificationCode': verificationCode
      }).select('myCertificates firstName lastName');

      if (!user) {
        console.log(`❌ No user found with verification code: ${verificationCode}`);
        
        // Let's also search all users to see what verification codes exist
        const allUsers = await User.find({
          'myCertificates.0': { $exists: true }
        }).select('myCertificates.certificateDetails.verificationCode myCertificates.certificateId firstName lastName');
        
        console.log(`🔍 Found ${allUsers.length} users with certificates`);
        allUsers.forEach(u => {
          u.myCertificates?.forEach(cert => {
            console.log(`📜 User: ${u.firstName} ${u.lastName}, Cert: ${cert.certificateId}, Code: ${cert.certificateDetails?.verificationCode}`);
          });
        });

        return res.status(404).json({ 
          success: false, 
          message: 'Certificate not found',
          debug: {
            searchedCode: verificationCode,
            foundUsers: allUsers.length,
            existingCodes: allUsers.flatMap(u => 
              u.myCertificates?.map(c => c.certificateDetails?.verificationCode) || []
            ).filter(Boolean)
          }
        });
      }

      const certificate = user.myCertificates.find(cert => 
        cert.certificateDetails?.verificationCode === verificationCode
      );

      if (!certificate) {
        console.log(`❌ Certificate not found in user data`);
        return res.status(404).json({ success: false, message: 'Certificate not found in user data' });
      }

      console.log(`✅ Certificate found: ${certificate.certificateId}`);

      res.json({
        success: true,
        message: 'Certificate found!',
        certificate: {
          certificateId: certificate.certificateId,
          recipientName: certificate.certificateDetails.recipientName,
          courseTitle: certificate.certificateDetails.title,
          verificationCode: certificate.certificateDetails.verificationCode,
          issueDate: certificate.certificateDetails.issueDate,
          status: certificate.certificateStatus.status
        }
      });

    } catch (error) {
      console.error('❌ Test verification error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Helper methods
  generateCertificateId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `CERT-${timestamp}-${randomStr}`.toUpperCase();
  }

  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 18).toUpperCase();
  }

  generateDigitalSignature(certificateData) {
    try {
      const crypto = require('crypto');
      const dataString = JSON.stringify({
        certificateId: certificateData.certificateId || '',
        recipientName: certificateData.recipientName || '',
        courseTitle: certificateData.title || '',
        completionDate: certificateData.completionDate || '',
        verificationCode: certificateData.verificationCode || ''
      });
      
      return crypto
        .createHmac('sha256', process.env.CERTIFICATE_SECRET || 'default-secret')
        .update(dataString)
        .digest('hex');
    } catch (error) {
      console.error('Error generating signature:', error);
      return 'signature-placeholder';
    }
  }

  updateAchievementSummary(user) {
    const certificates = user.myCertificates || [];
    const activeCertificates = certificates.filter(c => c.certificateStatus?.status === 'active');
    
    let achievementLevel = 'Beginner';
    if (activeCertificates.length >= 5) achievementLevel = 'Advanced';
    else if (activeCertificates.length >= 3) achievementLevel = 'Intermediate';

    user.achievementSummary = {
      totalCertificates: certificates.length,
      activeCertificates: activeCertificates.length,
      specializations: ['General Aesthetics'],
      totalLearningHours: 0,
      achievementLevel,
      publicProfileUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/profile/${user._id}`,
      digitalWallet: user.achievementSummary?.digitalWallet || {
        enabled: false,
        walletAddress: '',
        nftCertificates: []
      }
    };

    return user.achievementSummary;
  }
}

module.exports = new CertificateDebugController();