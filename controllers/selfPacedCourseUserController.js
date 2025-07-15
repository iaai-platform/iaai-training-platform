// controllers/selfPacedCourseUserController.js
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const User = require("../models/user");
const mongoose = require("mongoose");

// 1. Display Self-Paced Online Training Courses
exports.getSelfPacedOnlineTraining = async (req, res) => {
  try {
    console.log("📚 Fetching self-paced courses...");
    const courses = await SelfPacedOnlineTraining.find({
      "basic.status": "published",
    });
    const user = req.user || null;

    console.log(`📊 Found ${courses.length} published self-paced courses`);
    console.log(
      "👤 User:",
      user ? `${user.firstName} (${user.email})` : "Not logged in"
    );

    res.render("self-paced-online-training", {
      courses: courses,
      user: user,
    });
  } catch (err) {
    console.error("❌ Error fetching self-paced courses:", err);
    res.status(500).send("Server error");
  }
};

// 2. Display specific course details
// In your selfPacedCourseUserController.js - Update the getCourseDetails function

// REPLACE your getCourseDetails function with this:

exports.getCourseDetails = async (req, res) => {
  try {
    console.log("🔍 Fetching course details for:", req.params.courseId);

    // Try to populate instructor data
    let course = await SelfPacedOnlineTraining.findById(
      req.params.courseId
    ).populate("instructor.instructorId");

    console.log("📊 Course found:", course ? "Yes" : "No");
    console.log("👨‍🏫 Instructor data:", course?.instructor);

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // If instructor population failed, try manual lookup
    if (
      course.instructor?.instructorId &&
      typeof course.instructor.instructorId === "string"
    ) {
      console.log(
        "🔄 Manually fetching instructor:",
        course.instructor.instructorId
      );

      const Instructor = require("../models/Instructor");
      const instructorData = await Instructor.findById(
        course.instructor.instructorId
      );

      if (instructorData) {
        course.instructor.instructorData = instructorData;
        console.log(
          "✅ Instructor data fetched:",
          instructorData.firstName,
          instructorData.lastName
        );
        console.log("📸 Profile image:", instructorData.profileImage);
      }
    }

    let courseStatusMessage = "This course is available for enrollment";
    let userEnrollment = null;
    let hasAccess = false;

    // Check user enrollment status if logged in
    if (req.user) {
      const userDoc = await User.findById(req.user._id);
      userEnrollment = userDoc.getCourseEnrollment(
        req.params.courseId,
        "SelfPacedOnlineTraining"
      );
      hasAccess = userDoc.hasAccessToCourse(
        req.params.courseId,
        "SelfPacedOnlineTraining"
      );

      if (userEnrollment) {
        const status = userEnrollment.enrollmentData.status;
        switch (status) {
          case "wishlist":
            courseStatusMessage = "💝 This course is in your wishlist";
            break;
          case "cart":
            courseStatusMessage =
              "🛒 This course is in your cart - complete payment to access";
            break;
          case "paid":
          case "registered":
            if (hasAccess) {
              courseStatusMessage =
                "✅ You have access to this course - start learning!";
            } else {
              courseStatusMessage = "⏰ Your access to this course has expired";
            }
            break;
        }
      }
    }

    res.render("self-paced-course-details", {
      course,
      user: req.user,
      courseStatusMessage,
      userEnrollment,
      hasAccess,
    });
  } catch (err) {
    console.error("❌ Error fetching course details:", err);
    res.status(500).send("Server error");
  }
};

// 5. Get user's enrolled courses
exports.getMyEnrolledCourses = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(req.user._id).populate(
      "mySelfPacedCourses.courseId",
      "basic content instructor videos access"
    );

    const enrolledCourses = user.mySelfPacedCourses.filter((enrollment) => {
      const isValidStatus = ["paid", "registered"].includes(
        enrollment.enrollmentData.status
      );
      if (!isValidStatus) return false;

      // Check if not expired
      const isNotExpired =
        !enrollment.enrollmentData.expiryDate ||
        enrollment.enrollmentData.expiryDate > new Date();

      return isNotExpired;
    });

    res.json({
      success: true,
      courses: enrolledCourses,
    });
  } catch (err) {
    console.error("❌ Error fetching enrolled courses:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching enrolled courses",
    });
  }
};

// 6. Access course content
exports.accessCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.redirect("/login");
    }

    // Get fresh user data with methods
    const userDoc = await User.findById(req.user._id);

    // Check if user has access
    if (!userDoc.hasAccessToCourse(courseId, "SelfPacedOnlineTraining")) {
      return res.status(403).render("error", {
        message: "You do not have access to this course",
        error: { status: 403 },
      });
    }

    const course = await SelfPacedOnlineTraining.findById(
      req.params.courseId
    ).populate(
      "instructor.instructorId",
      "firstName lastName fullName profileImage title"
    );

    // If population doesn't work, add this fallback after getting the course:
    if (
      course.instructor?.instructorId &&
      typeof course.instructor.instructorId === "string"
    ) {
      const Instructor = require("../models/Instructor");
      const instructorData = await Instructor.findById(
        course.instructor.instructorId
      ).select("firstName lastName fullName profileImage title");

      if (instructorData) {
        course.instructor.instructorData = instructorData;
      }
    }

    if (!course) {
      return res.status(404).render("error", {
        message: "Course not found",
        error: { status: 404 },
      });
    }

    const userEnrollment = userDoc.getCourseEnrollment(
      courseId,
      "SelfPacedOnlineTraining"
    );

    res.render("self-paced-course-player", {
      course,
      user: req.user,
      enrollment: userEnrollment,
    });
  } catch (err) {
    console.error("❌ Error accessing course:", err);
    res.status(500).render("error", {
      message: "Server error",
      error: { status: 500 },
    });
  }
};

// 7. Update video progress
exports.updateVideoProgress = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { currentTime, duration } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get fresh user data with methods
    const userDoc = await User.findById(req.user._id);

    // Check access
    if (!userDoc.hasAccessToCourse(courseId, "SelfPacedOnlineTraining")) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await userDoc.updateVideoProgress(courseId, videoId, currentTime, duration);

    res.json({
      success: true,
      message: "Progress updated",
    });
  } catch (err) {
    console.error("❌ Error updating video progress:", err);
    res.status(500).json({
      success: false,
      message: "Error updating progress",
    });
  }
};

// 8. Submit exam
exports.submitExam = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { answers } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get fresh user data with methods
    const userDoc = await User.findById(req.user._id);

    // Check access
    if (!userDoc.hasAccessToCourse(courseId, "SelfPacedOnlineTraining")) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const course = await SelfPacedOnlineTraining.findById(courseId);
    const video = course.videos.id(videoId);

    if (!video || !video.exam || video.exam.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    // Calculate score
    let correctAnswers = 0;
    const processedAnswers = answers.map((answer) => {
      const question = video.exam.id(answer.questionId);
      const isCorrect =
        question && question.correctAnswer === answer.userAnswer;
      if (isCorrect) correctAnswers++;

      return {
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        isCorrect,
      };
    });

    const score = Math.round((correctAnswers / video.exam.length) * 100);

    // Record attempt
    await userDoc.recordExamAttempt(courseId, videoId, processedAnswers, score);

    res.json({
      success: true,
      score,
      passed: score >= 70,
      correctAnswers,
      totalQuestions: video.exam.length,
    });
  } catch (err) {
    console.error("❌ Error submitting exam:", err);
    res.status(500).json({
      success: false,
      message: "Error submitting exam",
    });
  }
};

// 9. Update video notes
exports.updateVideoNotes = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { notes } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get fresh user data with methods
    const userDoc = await User.findById(req.user._id);

    // Check access
    if (!userDoc.hasAccessToCourse(courseId, "SelfPacedOnlineTraining")) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const enrollment = userDoc.getCourseEnrollment(
      courseId,
      "SelfPacedOnlineTraining"
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    // Find or create note
    let noteIndex = enrollment.videoNotes.findIndex(
      (note) => note.videoId.toString() === videoId
    );

    if (noteIndex !== -1) {
      enrollment.videoNotes[noteIndex].notes = notes;
      enrollment.videoNotes[noteIndex].lastUpdated = new Date();
    } else {
      enrollment.videoNotes.push({
        videoId: videoId,
        notes: notes,
        lastUpdated: new Date(),
      });
    }

    await userDoc.save();

    res.json({
      success: true,
      message: "Notes saved successfully",
    });
  } catch (err) {
    console.error("❌ Error updating notes:", err);
    res.status(500).json({
      success: false,
      message: "Error saving notes",
    });
  }
};

// 10. Add bookmark
exports.addBookmark = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { timestamp, title } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get fresh user data with methods
    const userDoc = await User.findById(req.user._id);

    // Check access
    if (!userDoc.hasAccessToCourse(courseId, "SelfPacedOnlineTraining")) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const enrollment = userDoc.getCourseEnrollment(
      courseId,
      "SelfPacedOnlineTraining"
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    enrollment.bookmarks.push({
      videoId: videoId,
      timestamp: timestamp,
      title:
        title ||
        `Bookmark at ${Math.floor(timestamp / 60)}:${(timestamp % 60)
          .toString()
          .padStart(2, "0")}`,
      createdAt: new Date(),
    });

    await userDoc.save();

    res.json({
      success: true,
      message: "Bookmark added successfully",
    });
  } catch (err) {
    console.error("❌ Error adding bookmark:", err);
    res.status(500).json({
      success: false,
      message: "Error adding bookmark",
    });
  }
};

// 11. Get course progress
exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userDoc = await User.findById(req.user._id);
    const enrollment = userDoc.getCourseEnrollment(
      courseId,
      "SelfPacedOnlineTraining"
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    res.json({
      success: true,
      progress: enrollment.courseProgress,
      videoProgress: enrollment.videoProgress,
      examProgress: enrollment.examProgress,
    });
  } catch (err) {
    console.error("❌ Error fetching progress:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching progress",
    });
  }
};
