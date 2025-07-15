//watchExamController.js - COMPLETE FINAL VERSION with ALL requirements
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const crypto = require("crypto");

// ========================================
// MAIN VIDEO PLAYER PAGE
// ========================================

/**
 * Get Watch Exam Page - Complete video player with progress tracking and exam functionality
 * ALL USER DATA IS STORED IN USER MODEL: mySelfPacedCourses array
 */
exports.getWatchExamPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, videoId } = req.params;
    const { video: requestedVideoId, exam: examMode, review } = req.query;

    console.log(
      `📌 Loading watch page - User: ${userId}, Course: ${courseId}, Video: ${
        videoId || requestedVideoId || "Default"
      }`
    );

    // ✅ Find user with populated course data
    const user = await User.findById(userId)
      .populate({
        path: "mySelfPacedCourses.courseId",
        model: "SelfPacedOnlineTraining",
        select: "basic content videos instructor media certification",
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).render("error", {
        message: "User not found",
        user: req.user,
      });
    }

    // ✅ Find the course enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses?.find(
      (c) => c.courseId && c.courseId._id.toString() === courseId
    );

    if (
      !enrollment ||
      !["paid", "registered"].includes(enrollment.enrollmentData.status)
    ) {
      console.error("❌ Course not found or not accessible");
      return res.status(403).render("error", {
        message: "Course not accessible or you are not enrolled in this course",
        user: req.user,
      });
    }

    const course = enrollment.courseId; // Already populated

    if (!course) {
      console.error("❌ Course details not found");
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    // ✅ Use videos from populated course
    const videos = (course.videos || []).sort(
      (a, b) => a.sequence - b.sequence
    );
    if (!videos.length) {
      console.error("❌ No videos found for course");
      return res.status(404).render("error", {
        message: "No videos available for this course",
        user: req.user,
      });
    }

    // ✅ Determine current video
    const targetVideoId = videoId || requestedVideoId;
    let currentVideo = targetVideoId
      ? videos.find((v) => v._id.toString() === targetVideoId)
      : videos[0];

    if (!currentVideo) {
      console.error("❌ Requested video not found, using first video");
      currentVideo = videos[0];
    }

    console.log(
      `✅ Current Video: ${currentVideo.title} (ID: ${currentVideo._id})`
    );

    // ✅ Get user progress data from USER MODEL (stored in mySelfPacedCourses)
    const videoProgressMap = new Map(
      (enrollment.videoProgress || []).map((vp) => [vp.videoId.toString(), vp])
    );

    const examProgressMap = new Map(
      (enrollment.examProgress || []).map((ep) => [ep.videoId.toString(), ep])
    );

    const videoNotesMap = new Map(
      (enrollment.videoNotes || []).map((vn) => [vn.videoId.toString(), vn])
    );

    // ✅ Course progress from USER MODEL
    const userProgress = enrollment.courseProgress || {
      completedVideos: [],
      completedExams: [],
      overallPercentage: 0,
      status: "not-started",
      totalWatchTime: 0,
      averageExamScore: 0,
      lastAccessedAt: new Date(),
    };

    const completedVideos = userProgress.completedVideos.map((id) =>
      id.toString()
    );
    const completedExams = userProgress.completedExams.map((id) =>
      id.toString()
    );

    // ✅ Enhanced video data with user progress
    const videosWithProgress = videos.map((video) => {
      const videoIdStr = video._id.toString();
      const videoProgress = videoProgressMap.get(videoIdStr);
      const examProgress = examProgressMap.get(videoIdStr);
      const isCompleted = completedVideos.includes(videoIdStr);
      const hasExam = video.exam && video.exam.length > 0;
      const examCompleted = examProgress?.isPassed || false;
      const currentTime = videoProgress?.watchProgress?.currentTime || 0;
      const watchedPercentage =
        videoProgress?.watchProgress?.percentageWatched || 0;

      return {
        ...video,
        userProgress: {
          currentTime: currentTime,
          isCompleted: isCompleted,
          hasExam: hasExam,
          examCompleted: examCompleted,
          examScore: examProgress?.bestScore || null,
          progressPercentage: isCompleted ? 100 : watchedPercentage,
          canWatch: true,
          watchedPercentage: watchedPercentage,
        },
      };
    });

    // ✅ ENHANCED: Comprehensive course completion status
    const allVideosCompleted = videos.every((v) =>
      completedVideos.includes(v._id.toString())
    );
    const videosWithExams = videos.filter((v) => v.exam && v.exam.length > 0);
    const allExamsCompleted =
      videosWithExams.length === 0 ||
      videosWithExams.every((v) => completedExams.includes(v._id.toString()));

    const courseCompleted = allVideosCompleted && allExamsCompleted;

    // ✅ Navigation logic
    const currentIndex = videos.findIndex(
      (v) => v._id.toString() === currentVideo._id.toString()
    );
    let prevVideo = currentIndex > 0 ? videos[currentIndex - 1] : null;
    let nextVideo =
      currentIndex < videos.length - 1 ? videos[currentIndex + 1] : null;

    // ✅ Current video data from USER MODEL
    const currentVideoProgress = videoProgressMap.get(
      currentVideo._id.toString()
    );
    const currentVideoExamProgress = examProgressMap.get(
      currentVideo._id.toString()
    );
    const currentVideoNotes = videoNotesMap.get(currentVideo._id.toString());

    // ✅ Current video exam data
    const currentVideoExam =
      currentVideo.exam && currentVideo.exam.length > 0
        ? currentVideo.exam
        : null;

    // ✅ Get existing exam responses for current video from USER MODEL
    let existingExamResponse = null;
    if (
      currentVideoExamProgress &&
      currentVideoExamProgress.attempts.length > 0
    ) {
      const lastAttempt =
        currentVideoExamProgress.attempts[
          currentVideoExamProgress.attempts.length - 1
        ];

      // Convert answers array back to the format expected by the form
      const answersObj = {};
      if (lastAttempt.answers && Array.isArray(lastAttempt.answers)) {
        lastAttempt.answers.forEach((answer) => {
          if (answer.questionId && answer.userAnswer !== undefined) {
            answersObj[`answer_${answer.questionId}`] = answer.userAnswer;
          }
        });
      }

      existingExamResponse = {
        answers: answersObj,
        score: lastAttempt.score,
        passed: lastAttempt.passed,
        attemptDate: lastAttempt.attemptDate,
      };
    }

    // ✅ Course statistics
    const courseStats = {
      totalVideos: videos.length,
      completedVideos: completedVideos.length,
      totalExams: videosWithExams.length,
      completedExams: completedExams.length,
      progressPercentage: Math.round(
        (completedVideos.length / videos.length) * 100
      ),
      courseCompleted,
      estimatedTimeRemaining:
        Math.max(0, videos.length - completedVideos.length) * 15,
    };

    console.log(`📊 Course Stats:`, courseStats);

    // ✅ Render the enhanced watch page
    res.render("watch-exam", {
      // Course data
      course: {
        _id: course._id,
        courseId: course._id,
        title: course.basic?.title,
        description: course.basic?.description,
        instructor: course.instructor?.name,
        courseCode: course.basic?.courseCode,
      },

      // Video data
      videos: videosWithProgress,
      currentVideo: {
        ...currentVideo,
        userProgress: videosWithProgress.find(
          (v) => v._id.toString() === currentVideo._id.toString()
        )?.userProgress,
      },

      // Exam data
      exam: currentVideoExam,
      examMode: examMode === "true",
      examCompleted: currentVideoExamProgress?.isPassed || false,
      existingExamResponse,

      // Navigation
      prevVideo,
      nextVideo,

      // User progress (ALL FROM USER MODEL)
      completedVideos,
      completedExams,
      currentVideoNotes: currentVideoNotes?.notes || "",

      // Course status
      courseCompleted,
      courseStats,

      // User data
      user: req.user,
      title: `${course.basic?.title} - ${currentVideo.title}`,
    });
  } catch (err) {
    console.error("❌ Error in getWatchExamPage:", err);
    res.status(500).render("error", {
      message: "Error loading course content",
      error: process.env.NODE_ENV === "development" ? err : null,
      user: req.user,
    });
  }
};

// ========================================
// VIDEO PROGRESS TRACKING - SAVED IN USER MODEL
// ========================================

/**
 * Update Video Progress - Real-time progress tracking
 * ALL PROGRESS SAVED IN: user.mySelfPacedCourses[].videoProgress[]
 */
exports.updateVideoProgress = async (req, res) => {
  try {
    const { courseId, videoId, currentTime, duration } = req.body;

    console.log(
      `📊 Updating video progress - Course: ${courseId}, Video: ${videoId}, Time: ${currentTime}/${duration}`
    );

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(400)
        .json({ success: false, message: "Course not found" });
    }

    // ✅ Initialize videoProgress in USER MODEL if needed
    if (!enrollment.videoProgress) {
      enrollment.videoProgress = [];
    }

    // ✅ Find or create video progress in USER MODEL
    let videoProgress = enrollment.videoProgress.find(
      (vp) => vp.videoId.toString() === videoId
    );
    if (!videoProgress) {
      videoProgress = {
        videoId: videoId,
        watchProgress: {
          currentTime: 0,
          totalDuration: duration || 0,
          percentageWatched: 0,
          isCompleted: false,
          watchCount: 0,
        },
      };
      enrollment.videoProgress.push(videoProgress);
    }

    // ✅ Update progress with correct structure in USER MODEL
    videoProgress.watchProgress.currentTime = currentTime;
    videoProgress.watchProgress.lastWatchedAt = new Date();

    if (duration > 0) {
      videoProgress.watchProgress.totalDuration = duration;
      videoProgress.watchProgress.percentageWatched = Math.round(
        (currentTime / duration) * 100
      );
    }

    // Auto-complete if watched > 90%
    if (
      videoProgress.watchProgress.percentageWatched >= 90 &&
      !videoProgress.watchProgress.isCompleted
    ) {
      videoProgress.watchProgress.isCompleted = true;
      videoProgress.watchProgress.completedDate = new Date();
      videoProgress.watchProgress.watchCount++;

      // ✅ Initialize courseProgress in USER MODEL if needed
      if (!enrollment.courseProgress) {
        enrollment.courseProgress = {
          completedVideos: [],
          completedExams: [],
          overallPercentage: 0,
          totalWatchTime: 0,
          averageExamScore: 0,
          status: "not-started",
          lastAccessedAt: new Date(),
        };
      }

      // ✅ Add to completed videos in USER MODEL
      if (!enrollment.courseProgress.completedVideos.includes(videoId)) {
        enrollment.courseProgress.completedVideos.push(videoId);

        // Update overall progress
        const course = await SelfPacedOnlineTraining.findById(courseId);
        if (course) {
          const totalVideos = course.videos.length;
          const completedVideos =
            enrollment.courseProgress.completedVideos.length;
          enrollment.courseProgress.overallPercentage = Math.round(
            (completedVideos / totalVideos) * 100
          );

          if (enrollment.courseProgress.overallPercentage > 0) {
            enrollment.courseProgress.status = "in-progress";
          }
        }
      }
    }

    // ✅ Update total watch time in USER MODEL
    enrollment.courseProgress.lastAccessedAt = new Date();

    // ✅ SAVE TO USER MODEL
    user.markModified("mySelfPacedCourses");
    await user.save();

    res.json({ success: true, message: "Progress updated" });
  } catch (err) {
    console.error("❌ Error updating video progress:", err);
    res
      .status(500)
      .json({ success: false, message: "Error updating progress" });
  }
};

/**
 * Mark Video as Completed - With enhanced course completion detection and certificate generation
 * ALL DATA SAVED IN: user.mySelfPacedCourses[] in USER MODEL
 */
exports.markVideoCompleted = async (req, res) => {
  try {
    const { courseId, videoId, currentTime } = req.body;
    console.log(
      `✅ Marking video completed - Course: ${courseId}, Video: ${videoId}`
    );

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(400)
        .json({ success: false, message: "Course not found" });
    }

    // ✅ Initialize courseProgress in USER MODEL with correct structure
    if (!enrollment.courseProgress) {
      enrollment.courseProgress = {
        completedVideos: [],
        completedExams: [],
        overallPercentage: 0,
        totalWatchTime: 0,
        averageExamScore: 0,
        lastAccessedAt: new Date(),
        status: "not-started",
      };
    }

    // ✅ Add to completed videos in USER MODEL if not already there
    if (!enrollment.courseProgress.completedVideos.includes(videoId)) {
      enrollment.courseProgress.completedVideos.push(videoId);
      console.log(`✅ Video ${videoId} marked as completed in USER MODEL`);
    }

    // ✅ Update video progress in USER MODEL with correct structure
    if (!enrollment.videoProgress) {
      enrollment.videoProgress = [];
    }

    let videoProgress = enrollment.videoProgress.find(
      (vp) => vp.videoId.toString() === videoId
    );
    if (!videoProgress) {
      videoProgress = {
        videoId: videoId,
        watchProgress: {
          currentTime: 0,
          totalDuration: 0,
          percentageWatched: 0,
          isCompleted: false,
          watchCount: 0,
        },
      };
      enrollment.videoProgress.push(videoProgress);
    }

    // ✅ Update with correct field names in USER MODEL
    videoProgress.watchProgress.currentTime = currentTime || 0;
    videoProgress.watchProgress.isCompleted = true;
    videoProgress.watchProgress.percentageWatched = 100;
    videoProgress.watchProgress.completedDate = new Date();
    videoProgress.watchProgress.lastWatchedAt = new Date();
    videoProgress.watchProgress.watchCount++;

    // ✅ Get original course to check completion requirements
    const fullCourse = await SelfPacedOnlineTraining.findById(courseId);
    if (!fullCourse) {
      return res
        .status(400)
        .json({ success: false, message: "Course details not found" });
    }

    // ✅ ENHANCED: Comprehensive course completion check
    const allVideosCompleted = fullCourse.videos.every((v) =>
      enrollment.courseProgress.completedVideos.includes(v._id.toString())
    );

    const videosWithExams = fullCourse.videos.filter(
      (v) => v.exam && v.exam.length > 0
    );
    const allExamsCompleted =
      videosWithExams.length === 0 ||
      videosWithExams.every((v) =>
        enrollment.courseProgress.completedExams.includes(v._id.toString())
      );

    // Update overall percentage and status in USER MODEL
    enrollment.courseProgress.overallPercentage = Math.round(
      (enrollment.courseProgress.completedVideos.length /
        fullCourse.videos.length) *
        100
    );
    enrollment.courseProgress.lastAccessedAt = new Date();

    let courseCompleted = false;
    let certificateIssued = false;
    let certificateData = null;
    let isLastVideoOrExam = false;

    // ✅ ENHANCED: Course completion with detailed statistics
    if (allVideosCompleted && allExamsCompleted) {
      enrollment.courseProgress.status = "completed";
      enrollment.courseProgress.completionDate = new Date();
      courseCompleted = true;
      isLastVideoOrExam = true; // Flag for special completion handling

      console.log("🎉 COURSE COMPLETED! Generating certificate...");

      // ✅ Calculate final completion stats
      const finalStats = {
        totalVideos: fullCourse.videos.length,
        totalExams: videosWithExams.length,
        totalWatchTime: enrollment.courseProgress.totalWatchTime || 0,
        averageExamScore: enrollment.courseProgress.averageExamScore || 100,
        completionDate: new Date(),
        courseDuration: Math.round(
          (new Date() - enrollment.enrollmentData.registrationDate) /
            (1000 * 60 * 60 * 24)
        ), // days
      };

      // ✅ Certificate generation in USER MODEL
      if (!user.myCertificates) {
        user.myCertificates = [];
      }

      const existingCertificate = user.myCertificates.find(
        (cert) =>
          cert.courseId.toString() === courseId &&
          cert.courseType === "SelfPacedOnlineTraining"
      );

      if (!existingCertificate) {
        console.log("🏆 Generating new certificate in USER MODEL...");

        // Generate certificate using user model structure
        const certificateId = generateCertificateId();
        const verificationCode = generateVerificationCode();

        const newCertificate = {
          certificateId,
          courseId: courseId,
          courseType: "SelfPacedOnlineTraining",
          certificateData: {
            recipientName: `${user.firstName} ${user.lastName}`,
            courseTitle: fullCourse.basic?.title,
            courseCode: fullCourse.basic?.courseCode,
            instructorName:
              fullCourse.instructor?.name || "IAAI Training Institute",
            completionDate: new Date(),
            issueDate: new Date(),
            achievement: {
              attendancePercentage: 100,
              examScore: finalStats.averageExamScore,
              totalHours: Math.max(
                1,
                Math.round(finalStats.totalWatchTime / 60)
              ),
              courseDuration: finalStats.courseDuration,
              grade:
                finalStats.averageExamScore >= 90
                  ? "A"
                  : finalStats.averageExamScore >= 80
                  ? "B"
                  : finalStats.averageExamScore >= 70
                  ? "C"
                  : "Pass",
            },
            verificationCode: verificationCode,
            digitalSignature: generateDigitalSignature({
              certificateId,
              recipientName: `${user.firstName} ${user.lastName}`,
              courseTitle: fullCourse.basic?.title,
              completionDate: new Date(),
              verificationCode,
            }),
            qrCodeUrl: `${
              process.env.BASE_URL || "http://localhost:3000"
            }/certificates/verify/${verificationCode}`,
            pdfUrl: `/certificates/${user._id}/${certificateId}.pdf`,
          },
          downloadCount: 0,
          isPublic: false,
          shareUrl: `${
            process.env.BASE_URL || "http://localhost:3000"
          }/certificates/verify/${verificationCode}`,
        };

        // ✅ Add certificate to USER MODEL
        user.myCertificates.push(newCertificate);
        certificateIssued = true;
        certificateData = {
          certificateId: newCertificate.certificateId,
          verificationCode: newCertificate.certificateData.verificationCode,
          downloadUrl: newCertificate.certificateData.pdfUrl,
          shareableUrl: newCertificate.shareUrl,
        };

        // Update achievement summary in USER MODEL
        updateAchievementSummary(user);

        console.log(
          `✅ Certificate generated: ${certificateId} and saved in USER MODEL`
        );
      } else {
        console.log(
          "✅ Certificate already exists for this course in USER MODEL"
        );
        certificateData = {
          certificateId: existingCertificate.certificateId,
          verificationCode:
            existingCertificate.certificateData.verificationCode,
          downloadUrl: existingCertificate.certificateData.pdfUrl,
          shareableUrl: existingCertificate.shareUrl,
        };
      }
    } else {
      enrollment.courseProgress.status = "in-progress";
    }

    // ✅ SAVE TO USER MODEL with proper modification tracking
    user.markModified("mySelfPacedCourses");
    if (certificateIssued) {
      user.markModified("myCertificates");
      user.markModified("achievementSummary");
    }

    await user.save();
    console.log("💾 User data saved successfully to USER MODEL");

    // ✅ ENHANCED RESPONSE with completion details
    const response = {
      success: true,
      message: certificateIssued
        ? "🎉 Congratulations! Course completed and certificate issued!"
        : "Video progress updated",
      courseCompleted,
      certificateIssued,
      certificate: certificateData,
      isLastVideoOrExam: isLastVideoOrExam, // Flag for special UI handling
      completionStats: courseCompleted
        ? {
            totalVideos: fullCourse.videos.length,
            totalExams: videosWithExams.length,
            completionDate: enrollment.courseProgress.completionDate,
          }
        : null,
    };

    res.json(response);
  } catch (err) {
    console.error("❌ Error marking video completed:", err);
    res
      .status(500)
      .json({ success: false, message: "Error updating progress" });
  }
};

// ========================================
// NOTES FUNCTIONALITY - SAVED IN USER MODEL
// ========================================

/**
 * Save Notes - Store user notes for videos
 * ALL NOTES SAVED IN: user.mySelfPacedCourses[].videoNotes[]
 */
exports.saveNotes = async (req, res) => {
  try {
    const { courseId, videoId, notes } = req.body;
    console.log(`💾 Saving notes - Course: ${courseId}, Video: ${videoId}`);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(400)
        .json({ success: false, message: "Course not found" });
    }

    // ✅ Use correct videoNotes structure from USER MODEL
    if (!enrollment.videoNotes) {
      enrollment.videoNotes = [];
    }

    let videoNote = enrollment.videoNotes.find(
      (vn) => vn.videoId.toString() === videoId
    );
    if (!videoNote) {
      videoNote = {
        videoId: videoId,
        notes: notes,
        lastUpdated: new Date(),
      };
      enrollment.videoNotes.push(videoNote);
    } else {
      videoNote.notes = notes;
      videoNote.lastUpdated = new Date();
    }

    // ✅ SAVE TO USER MODEL
    user.markModified("mySelfPacedCourses");
    await user.save();

    console.log(`✅ Notes saved for video ${videoId} in USER MODEL`);
    res.json({ success: true, message: "Notes saved successfully" });
  } catch (err) {
    console.error("❌ Error saving notes:", err);
    res.status(500).json({ success: false, message: "Error saving notes" });
  }
};

/**
 * Get Notes - Retrieve user notes for a video
 * NOTES RETRIEVED FROM: user.mySelfPacedCourses[].videoNotes[]
 */
exports.getNotes = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // ✅ Get notes from USER MODEL videoNotes structure
    const videoNote = enrollment.videoNotes?.find(
      (vn) => vn.videoId.toString() === videoId
    );
    const notes = videoNote?.notes || "";

    res.json({ success: true, notes });
  } catch (error) {
    console.error("Error getting notes:", error);
    res.status(500).json({ success: false, message: "Error retrieving notes" });
  }
};

// ========================================
// EXAM FUNCTIONALITY - SAVED IN USER MODEL
// ========================================

/**
 * Submit Exam - Process exam submission with enhanced feedback
 * ALL EXAM DATA SAVED IN: user.mySelfPacedCourses[].examProgress[]
 */
exports.submitExam = async (req, res) => {
  try {
    const { courseId, videoId, answers } = req.body;
    console.log("📩 Processing exam submission:", {
      courseId,
      videoId,
      answersCount: Object.keys(answers || {}).length,
    });

    if (!courseId || !videoId || !answers) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (courseId, videoId, answers)",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Course not found in your enrollments",
        });
    }

    // Get original course for exam questions
    const originalCourse = await SelfPacedOnlineTraining.findById(
      courseId
    ).lean();
    if (!originalCourse) {
      return res
        .status(400)
        .json({ success: false, message: "Course details not found" });
    }

    const video = originalCourse.videos.find(
      (v) => v._id.toString() === videoId
    );
    if (!video || !video.exam || video.exam.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No exam available for this video" });
    }

    console.log(
      `✅ Processing exam with ${video.exam.length} questions for video: ${video.title}`
    );

    // Grade the exam
    let correctCount = 0;
    let reviewAnswers = [];
    const startTime = Date.now();

    const processedAnswers = video.exam.map((question) => {
      const userAnswer = answers[`answer_${question._id}`];
      const isCorrect =
        userAnswer !== undefined && userAnswer === question.correctAnswer;

      console.log(
        `🔍 Q: ${question.questionText.substring(
          0,
          50
        )}... | User: ${userAnswer} | Correct: ${
          question.correctAnswer
        } | ✓: ${isCorrect}`
      );

      if (isCorrect) {
        correctCount++;
      } else {
        reviewAnswers.push({
          question: question.questionText,
          userAnswer: userAnswer || "No Answer",
          correctAnswer: question.correctAnswer,
          options: question.options,
          explanation: question.explanation || "",
        });
      }

      return {
        questionId: question._id,
        questionText: question.questionText, // Store for review purposes
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
      };
    });

    const score = Math.round((correctCount / video.exam.length) * 100);
    const passingScore = video.assessmentSettings?.passingScore || 60;
    const passed = score >= passingScore;
    const timeSpent = Math.round((Date.now() - startTime) / 1000); // seconds

    console.log(
      `📊 Exam Results: ${correctCount}/${video.exam.length} correct, Score: ${score}%, Passing: ${passingScore}%, Passed: ${passed}`
    );

    // ✅ Update exam progress in USER MODEL with correct structure
    if (!enrollment.examProgress) {
      enrollment.examProgress = [];
    }

    let examProgress = enrollment.examProgress.find(
      (ep) => ep.videoId.toString() === videoId
    );
    if (!examProgress) {
      examProgress = {
        videoId: videoId,
        attempts: [],
        bestScore: 0,
        isPassed: false,
      };
      enrollment.examProgress.push(examProgress);
    }

    // ✅ Add attempt with correct structure to USER MODEL
    const attempt = {
      attemptNumber: examProgress.attempts.length + 1,
      attemptDate: new Date(),
      answers: processedAnswers,
      score: score,
      passed: passed,
      timeSpent: timeSpent,
    };

    examProgress.attempts.push(attempt);

    // Update best score and pass status in USER MODEL
    if (score > examProgress.bestScore) {
      examProgress.bestScore = score;
    }

    if (passed) {
      examProgress.isPassed = true;

      // ✅ Initialize courseProgress in USER MODEL if needed
      if (!enrollment.courseProgress) {
        enrollment.courseProgress = {
          completedVideos: [],
          completedExams: [],
          overallPercentage: 0,
          totalWatchTime: 0,
          averageExamScore: 0,
          status: "not-started",
          lastAccessedAt: new Date(),
        };
      }

      // ✅ Add to completed exams in USER MODEL
      if (!enrollment.courseProgress.completedExams.includes(videoId)) {
        enrollment.courseProgress.completedExams.push(videoId);
        console.log(
          `✅ Added video ${videoId} to completed exams in USER MODEL`
        );
      }

      // ✅ Update average exam score in USER MODEL
      const allPassedExams = enrollment.examProgress.filter(
        (ep) => ep.isPassed
      );
      if (allPassedExams.length > 0) {
        const totalScore = allPassedExams.reduce(
          (sum, ep) => sum + ep.bestScore,
          0
        );
        enrollment.courseProgress.averageExamScore = Math.round(
          totalScore / allPassedExams.length
        );
      }
    }

    // ✅ ENHANCED: Check course completion after exam
    const allVideosCompleted = originalCourse.videos.every((v) =>
      enrollment.courseProgress.completedVideos.includes(v._id.toString())
    );

    const videosWithExams = originalCourse.videos.filter(
      (v) => v.exam && v.exam.length > 0
    );
    const allExamsCompleted =
      videosWithExams.length === 0 ||
      videosWithExams.every((v) =>
        enrollment.courseProgress.completedExams.includes(v._id.toString())
      );

    let courseCompletedByExam = false;
    let isLastVideoOrExam = false;

    if (allVideosCompleted && allExamsCompleted && passed) {
      enrollment.courseProgress.status = "completed";
      enrollment.courseProgress.completionDate = new Date();
      courseCompletedByExam = true;
      isLastVideoOrExam = true; // Flag for special completion handling
      console.log("🎉 COURSE COMPLETED AFTER EXAM SUBMISSION!");
    }

    // ✅ SAVE TO USER MODEL with proper modification tracking
    user.markModified("mySelfPacedCourses");
    await user.save();
    console.log("💾 Exam results saved successfully to USER MODEL");

    // ✅ Enhanced response with completion details
    const response = {
      success: true,
      correctCount,
      incorrectCount: video.exam.length - correctCount,
      totalQuestions: video.exam.length,
      score: score,
      passed,
      passingScore,
      reviewAnswers: reviewAnswers.length > 0 ? reviewAnswers : null,
      courseCompleted: courseCompletedByExam,
      isLastVideoOrExam: isLastVideoOrExam, // Flag for special UI handling
      canRetake: !passed,
      message: passed
        ? `🎉 Congratulations! You passed with ${score}%`
        : `You scored ${score}%. You need ${passingScore}% to pass. ${
            !passed ? "You can retake the exam." : ""
          }`,
    };

    console.log(
      `📤 Sending response: ${passed ? "PASSED" : "FAILED"} - ${score}%`
    );
    res.json(response);
  } catch (err) {
    console.error("❌ Error submitting exam:", err);
    res.status(500).json({
      success: false,
      message: "Error processing exam submission",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * Get Exam Results - Retrieve exam results for a video
 * EXAM DATA RETRIEVED FROM: user.mySelfPacedCourses[].examProgress[]
 */
exports.getExamResults = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // ✅ Get exam progress from USER MODEL
    const examProgress = enrollment.examProgress?.find(
      (ep) => ep.videoId.toString() === videoId
    );

    if (!examProgress || examProgress.attempts.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No exam results found" });
    }

    res.json({
      success: true,
      examProgress: {
        bestScore: examProgress.bestScore,
        isPassed: examProgress.isPassed,
        totalAttempts: examProgress.attempts.length,
        attempts: examProgress.attempts.map((attempt) => ({
          attemptNumber: attempt.attemptNumber,
          attemptDate: attempt.attemptDate,
          score: attempt.score,
          passed: attempt.passed,
          timeSpent: attempt.timeSpent,
          answers: attempt.answers, // Include for detailed review
        })),
      },
    });
  } catch (error) {
    console.error("Error getting exam results:", error);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving exam results" });
  }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Generate Certificate ID
 */
function generateCertificateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `CERT-${timestamp}-${randomStr}`.toUpperCase();
}

/**
 * Generate Verification Code
 */
function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 18).toUpperCase();
}

/**
 * Generate Digital Signature
 */
function generateDigitalSignature(certificateData) {
  try {
    const dataString = JSON.stringify({
      certificateId: certificateData.certificateId || "",
      recipientName: certificateData.recipientName || "",
      courseTitle: certificateData.courseTitle || "",
      completionDate: certificateData.completionDate || "",
      verificationCode: certificateData.verificationCode || "",
    });

    return crypto
      .createHmac(
        "sha256",
        process.env.CERTIFICATE_SECRET || "default-secret-key"
      )
      .update(dataString)
      .digest("hex");
  } catch (error) {
    console.error("Error generating signature:", error);
    return "signature-placeholder";
  }
}

/**
 * Update Achievement Summary in USER MODEL
 */
function updateAchievementSummary(user) {
  const certificates = user.myCertificates || [];
  const activeCertificates = certificates.filter(
    (c) => c.certificateData && c.certificateData.recipientName
  );

  const totalLearningHours = certificates.reduce((sum, cert) => {
    const hours = cert.certificateData?.achievement?.totalHours || 0;
    return sum + hours;
  }, 0);

  let achievementLevel = "Beginner";
  if (activeCertificates.length >= 5) achievementLevel = "Advanced";
  else if (activeCertificates.length >= 3) achievementLevel = "Intermediate";

  // ✅ Update achievement summary in USER MODEL
  user.achievementSummary = {
    totalCertificates: certificates.length,
    activeCertificates: activeCertificates.length,
    specializations: ["General Aesthetics"],
    totalLearningHours,
    achievementLevel,
    publicProfileUrl: `${
      process.env.BASE_URL || "http://localhost:3000"
    }/profile/${user._id}`,
    digitalWallet: user.achievementSummary?.digitalWallet || {
      enabled: false,
      walletAddress: "",
      nftCertificates: [],
    },
  };

  console.log("📈 Achievement summary updated in USER MODEL:", {
    totalCertificates: user.achievementSummary.totalCertificates,
    achievementLevel: user.achievementSummary.achievementLevel,
    totalHours: user.achievementSummary.totalLearningHours,
  });

  return user.achievementSummary;
}

// ========================================
// ADDITIONAL UTILITY METHODS
// ========================================

/**
 * Manual Certificate Generation (for testing/admin)
 * CERTIFICATE SAVED IN: user.myCertificates[] in USER MODEL
 */
exports.generateCertificateManually = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    console.log(
      `🏆 Manual certificate generation - User: ${userId}, Course: ${courseId}`
    );

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Find enrollment in USER MODEL
    const enrollment = user.mySelfPacedCourses.find(
      (c) => c.courseId.toString() === courseId
    );
    if (!enrollment) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Course not found in your enrollments",
        });
    }

    const fullCourse = await SelfPacedOnlineTraining.findById(courseId);
    if (!fullCourse) {
      return res
        .status(404)
        .json({ success: false, message: "Course details not found" });
    }

    // ✅ Initialize myCertificates in USER MODEL if needed
    if (!user.myCertificates) {
      user.myCertificates = [];
    }

    const existingCertificate = user.myCertificates.find(
      (cert) =>
        cert.courseId.toString() === courseId &&
        cert.courseType === "SelfPacedOnlineTraining"
    );

    if (existingCertificate) {
      return res.json({
        success: true,
        message: "Certificate already exists in USER MODEL",
        certificate: {
          certificateId: existingCertificate.certificateId,
          verificationCode:
            existingCertificate.certificateData.verificationCode,
        },
      });
    }

    // Generate new certificate in USER MODEL
    const certificateId = generateCertificateId();
    const verificationCode = generateVerificationCode();

    const newCertificate = {
      certificateId,
      courseId: courseId,
      courseType: "SelfPacedOnlineTraining",
      certificateData: {
        recipientName: `${user.firstName} ${user.lastName}`,
        courseTitle: fullCourse.basic?.title,
        courseCode: fullCourse.basic?.courseCode,
        instructorName:
          fullCourse.instructor?.name || "IAAI Training Institute",
        completionDate: new Date(),
        issueDate: new Date(),
        verificationCode,
        achievement: {
          attendancePercentage: 100,
          examScore: 100,
          totalHours: Math.max(
            1,
            Math.round((fullCourse.content?.estimatedMinutes || 60) / 60)
          ),
          grade: "A",
        },
      },
      downloadCount: 0,
      isPublic: false,
      shareUrl: `${
        process.env.BASE_URL || "http://localhost:3000"
      }/certificates/verify/${verificationCode}`,
    };

    // ✅ Add certificate to USER MODEL
    user.myCertificates.push(newCertificate);
    updateAchievementSummary(user);

    user.markModified("myCertificates");
    user.markModified("achievementSummary");

    await user.save();

    console.log(
      `✅ Certificate generated manually in USER MODEL. User now has ${user.myCertificates.length} certificates`
    );

    res.json({
      success: true,
      message: "Certificate generated successfully in USER MODEL!",
      certificate: {
        certificateId: newCertificate.certificateId,
        verificationCode: newCertificate.certificateData.verificationCode,
      },
    });
  } catch (error) {
    console.error("❌ Error in manual certificate generation:", error);
    res.status(500).json({
      success: false,
      message: "Error generating certificate",
      error: error.message,
    });
  }
};

// ========================================
// MODULE EXPORTS
// ========================================

module.exports = {
  getWatchExamPage: exports.getWatchExamPage,
  updateVideoProgress: exports.updateVideoProgress,
  markVideoCompleted: exports.markVideoCompleted,
  saveNotes: exports.saveNotes,
  getNotes: exports.getNotes,
  submitExam: exports.submitExam,
  getExamResults: exports.getExamResults,
  generateCertificateManually: exports.generateCertificateManually,
};

// ========================================
// DATA STORAGE SUMMARY
// ========================================

/*
🗄️ ALL USER COURSE DATA IS STORED IN USER MODEL:

user.mySelfPacedCourses[] = [
  {
    courseId: ObjectId,
    enrollmentData: { status, registrationDate, ... },
    
    // ✅ VIDEO PROGRESS DATA
    videoProgress: [
      {
        videoId: ObjectId,
        watchProgress: {
          currentTime: Number,
          totalDuration: Number,
          percentageWatched: Number,
          isCompleted: Boolean,
          completedDate: Date,
          lastWatchedAt: Date,
          watchCount: Number
        }
      }
    ],
    
    // ✅ EXAM PROGRESS DATA
    examProgress: [
      {
        videoId: ObjectId,
        attempts: [
          {
            attemptNumber: Number,
            attemptDate: Date,
            answers: Array,
            score: Number,
            passed: Boolean,
            timeSpent: Number
          }
        ],
        bestScore: Number,
        isPassed: Boolean
      }
    ],
    
    // ✅ OVERALL COURSE PROGRESS
    courseProgress: {
      completedVideos: [ObjectId],
      completedExams: [ObjectId],
      overallPercentage: Number,
      totalWatchTime: Number,
      averageExamScore: Number,
      lastAccessedAt: Date,
      status: String, // "not-started", "in-progress", "completed"
      completionDate: Date
    },
    
    // ✅ USER NOTES
    videoNotes: [
      {
        videoId: ObjectId,
        notes: String,
        lastUpdated: Date
      }
    ]
  }
]

// ✅ CERTIFICATES STORED IN USER MODEL
user.myCertificates[] = [
  {
    certificateId: String,
    courseId: ObjectId,
    courseType: String,
    certificateData: {
      recipientName: String,
      courseTitle: String,
      achievement: { ... },
      verificationCode: String,
      ...
    }
  }
]

// ✅ ACHIEVEMENT SUMMARY IN USER MODEL
user.achievementSummary = {
  totalCertificates: Number,
  activeCertificates: Number,
  totalLearningHours: Number,
  achievementLevel: String,
  ...
}
*/
