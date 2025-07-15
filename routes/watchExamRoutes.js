//watchExamRoutes.js - Enhanced Version
const express = require('express');
const router = express.Router();
const { 
  getWatchExamPage, 
  saveNotes, 
  markVideoCompleted, 
  submitExam,
  updateVideoProgress 
} = require('../controllers/watchExamController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const User = require('../models/user');

// ✅ Main watch-exam page route
router.get('/watch-exam/:courseId/:videoId?', isAuthenticated, getWatchExamPage);

// ✅ Video progress and completion routes
router.post('/mark-video-completed', isAuthenticated, markVideoCompleted);
router.post('/update-video-progress', isAuthenticated, updateVideoProgress);

// ✅ Notes functionality
router.post('/save-notes', isAuthenticated, saveNotes);

// ✅ Exam submission
router.post('/submit-exam', isAuthenticated, submitExam);

// ✅ Get exam results/answers for a specific video
router.get('/get-exam-answers/:courseId/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        console.log(`📊 Fetching exam answers - Course: ${courseId}, Video: ${videoId}`);

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        // Find the course in user's self-paced courses
        const course = user.mySelfPacedCourses.find(c => c.courseId.toString() === courseId);
        if (!course) {
            return res.status(400).json({ success: false, message: "Course not found" });
        }

        // Find the exam response for this video
        const examResponse = course.userCourseStatus?.examResponses?.find(
            r => r.videoId.toString() === videoId
        );

        if (!examResponse) {
            return res.status(404).json({ 
                success: false, 
                message: "No exam results found for this video" 
            });
        }

        // Get the video and its exam questions
        const video = course.videos.find(v => v._id.toString() === videoId);
        if (!video || !video.exam || video.exam.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Video or exam not found" 
            });
        }

        // Format the answers for display
        const formattedAnswers = examResponse.answers.map(userAnswer => {
            const question = video.exam.find(q => q._id.toString() === userAnswer.questionId);
            return {
                questionText: question?.questionText || 'Question not found',
                userAnswer: userAnswer.userAnswer,
                correctAnswer: question?.correctAnswer || 'Unknown',
                isCorrect: userAnswer.userAnswer === question?.correctAnswer,
                options: question?.options || []
            };
        });

        const totalQuestions = video.exam.length;
        const correctAnswers = formattedAnswers.filter(a => a.isCorrect).length;
        const score = Math.round((correctAnswers / totalQuestions) * 100);

        res.json({ 
            success: true, 
            examResults: {
                answers: formattedAnswers,
                totalQuestions,
                correctAnswers,
                incorrectAnswers: totalQuestions - correctAnswers,
                score,
                passed: examResponse.passed || false,
                submittedAt: examResponse.submittedAt
            }
        });

    } catch (err) {
        console.error("❌ Error fetching exam answers:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching exam results" 
        });
    }
});

// ✅ Get course completion status
router.get('/course-status/:courseId', isAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.params;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const course = user.mySelfPacedCourses.find(c => c.courseId.toString() === courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const totalVideos = course.videos?.length || 0;
        const completedVideos = course.userCourseStatus?.completedVideos?.length || 0;
        const videosWithExams = course.videos?.filter(v => v.exam && v.exam.length > 0) || [];
        const completedExams = course.userCourseStatus?.completedExams?.length || 0;

        const isCompleted = course.userCourseStatus?.userCourseTotalstatus === 'Completed';

        res.json({
            success: true,
            courseStatus: {
                totalVideos,
                completedVideos,
                totalExams: videosWithExams.length,
                completedExams,
                progressPercentage: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
                isCompleted
            }
        });

    } catch (err) {
        console.error("❌ Error fetching course status:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching course status" 
        });
    }
});

// ✅ Reset video progress (for retaking)
router.post('/reset-video-progress', isAuthenticated, async (req, res) => {
    try {
        const { courseId, videoId } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const course = user.mySelfPacedCourses.find(c => c.courseId.toString() === courseId);
        if (!course) {
            return res.status(400).json({ success: false, message: "Course not found" });
        }

        // Reset video progress
        if (course.videoProgress) {
            const progressIndex = course.videoProgress.findIndex(p => p.videoId?.toString() === videoId);
            if (progressIndex !== -1) {
                course.videoProgress[progressIndex].currentTime = 0;
            }
        }

        // Remove from completed videos
        if (course.userCourseStatus?.completedVideos) {
            course.userCourseStatus.completedVideos = course.userCourseStatus.completedVideos.filter(
                id => id.toString() !== videoId
            );
        }

        await user.save();

        res.json({ 
            success: true, 
            message: "Video progress reset successfully" 
        });

    } catch (err) {
        console.error("❌ Error resetting video progress:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error resetting progress" 
        });
    }
});

// ✅ Retake exam (reset exam progress)
router.post('/retake-exam', isAuthenticated, async (req, res) => {
    try {
        const { courseId, videoId } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const course = user.mySelfPacedCourses.find(c => c.courseId.toString() === courseId);
        if (!course) {
            return res.status(400).json({ success: false, message: "Course not found" });
        }

        // Remove from completed exams
        if (course.userCourseStatus?.completedExams) {
            course.userCourseStatus.completedExams = course.userCourseStatus.completedExams.filter(
                id => id.toString() !== videoId
            );
        }

        // Remove exam response
        if (course.userCourseStatus?.examResponses) {
            course.userCourseStatus.examResponses = course.userCourseStatus.examResponses.filter(
                response => response.videoId?.toString() !== videoId
            );
        }

        // Update course completion status
        const allVideosCompleted = course.videos.every(v => 
            course.userCourseStatus.completedVideos.includes(v._id.toString())
        );
        const videosWithExams = course.videos.filter(v => v.exam && v.exam.length > 0);
        const allExamsCompleted = videosWithExams.length === 0 || 
            videosWithExams.every(v => course.userCourseStatus.completedExams.includes(v._id.toString()));

        if (!(allVideosCompleted && allExamsCompleted)) {
            course.userCourseStatus.userCourseTotalstatus = 'In Progress';
        }

        await user.save();

        res.json({ 
            success: true, 
            message: "Exam reset successfully. You can now retake it." 
        });

    } catch (err) {
        console.error("❌ Error resetting exam:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error resetting exam" 
        });
    }
});


// Add this route to your watchExamRoutes.js for manual certificate testing

// ✅ Manual certificate generation route (for testing)
router.post('/generate-certificate-manual', isAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user._id;
        
        console.log(`🏆 Manual certificate generation requested - User: ${userId}, Course: ${courseId}`);

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the course in user's self-paced courses
        const userCourse = user.mySelfPacedCourses.find(c => c.courseId.toString() === courseId);
        if (!userCourse) {
            return res.status(404).json({ success: false, message: 'Course not found in your enrollments' });
        }

        // Check if certificate already exists
        const existingCertificate = user.myCertificates?.find(cert => 
            cert.courseId.toString() === courseId && cert.courseType === 'SelfPacedOnlineTraining'
        );

        if (existingCertificate) {
            return res.json({ 
                success: true, 
                message: 'Certificate already exists',
                certificate: {
                    certificateId: existingCertificate.certificateId,
                    verificationCode: existingCertificate.certificateDetails.verificationCode,
                    shareableUrl: existingCertificate.socialSharing.shareableUrl
                }
            });
        }

        // Try to use the Certificate Controller
        try {
            const CertificateController = require('../controllers/CertificateController');
            
            // Create fake request/response for certificate controller
            const fakeReq = {
                user: { _id: userId },
                body: { courseId, courseType: 'SelfPacedOnlineTraining' },
                ip: req.ip || '',
                get: (header) => req.get ? req.get(header) : ''
            };

            let certificateResult = null;
            const fakeRes = {
                status: (code) => ({
                    json: (data) => { certificateResult = { status: code, data }; }
                }),
                json: (data) => { certificateResult = { status: 200, data }; }
            };

            await CertificateController.issueCertificate(fakeReq, fakeRes);

            if (certificateResult && certificateResult.status === 200 && certificateResult.data.success) {
                return res.json({
                    success: true,
                    message: 'Certificate generated successfully!',
                    certificate: certificateResult.data.certificate
                });
            } else {
                throw new Error('Certificate controller failed');
            }

        } catch (controllerError) {
            console.error('❌ Certificate controller error:', controllerError.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to generate certificate',
                error: controllerError.message
            });
        }

    } catch (error) {
        console.error('❌ Error in manual certificate generation:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating certificate',
            error: error.message
        });
    }
});

// ✅ Debug route to check certificate data in database
router.get('/debug-certificates/:userId?', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;
        
        // Only allow admins to check other users, or users to check themselves
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const user = await User.findById(userId).select('myCertificates achievementSummary firstName lastName email');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const certificates = user.myCertificates || [];
        
        res.json({
            success: true,
            user: {
                id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
            },
            certificateCount: certificates.length,
            certificates: certificates.map(cert => ({
                certificateId: cert.certificateId,
                courseId: cert.courseId,
                courseType: cert.courseType,
                title: cert.certificateDetails?.title,
                recipientName: cert.certificateDetails?.recipientName,
                verificationCode: cert.certificateDetails?.verificationCode,
                status: cert.certificateStatus?.status,
                issueDate: cert.certificateDetails?.issueDate,
                shareableUrl: cert.socialSharing?.shareableUrl
            })),
            achievementSummary: user.achievementSummary
        });

    } catch (error) {
        console.error('❌ Error in debug certificates:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching certificate data',
            error: error.message
        });
    }
});

module.exports = router;