// controllers/selfPacedCourseUserController.js - UPDATED VERSION
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const User = require("../models/user");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (add to your config or at top of controller)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
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

// 2. ENHANCED Display specific course details with ALL model fields
// Enhanced getCourseDetails method in selfPacedCourseUserController.js

exports.getCourseDetails = async (req, res) => {
  try {
    console.log("🔍 Fetching course details for:", req.params.courseId);

    // Populate instructor AND certification bodies with better error handling
    let course = await SelfPacedOnlineTraining.findById(req.params.courseId)
      .populate({
        path: "instructor.instructorId",
        select:
          "firstName lastName fullName profileImage title designation bio experience expertise specializations certifications ratings status assignedCourses email phoneNumber",
      })
      .populate("certification.issuingAuthorityId")
      .populate("certification.certificationBodies.bodyId");

    if (!course) {
      return res.status(404).send("Course not found");
    }

    // Enhanced instructor data processing
    if (course.instructor?.instructorId) {
      const instructorData = course.instructor.instructorId;

      if (instructorData) {
        // Calculate additional instructor metrics
        const activeCoursesCount =
          instructorData.assignedCourses?.filter(
            (c) => c.status === "In Progress" || c.status === "Upcoming"
          ).length || 0;

        const completedCoursesCount =
          instructorData.assignedCourses?.filter(
            (c) => c.status === "Completed"
          ).length || 0;

        // Calculate average rating if available
        let averageRating = 0;
        if (instructorData.ratings?.courseRatings?.length > 0) {
          const sum = instructorData.ratings.courseRatings.reduce(
            (acc, rating) => acc + rating.rating,
            0
          );
          averageRating = (
            sum / instructorData.ratings.courseRatings.length
          ).toFixed(1);
        }

        // Add computed fields to instructor data
        course.instructor.instructorData = {
          ...instructorData.toObject(),
          activeCourses: activeCoursesCount,
          completedCourses: completedCoursesCount,
          averageRating: averageRating,
          totalCourses: instructorData.assignedCourses?.length || 0,
          yearsExperience: instructorData.experience
            ? parseInt(instructorData.experience)
            : 0,
        };

        console.log("✅ Enhanced instructor data processed:", {
          name: instructorData.firstName + " " + instructorData.lastName,
          totalCourses: course.instructor.instructorData.totalCourses,
          averageRating: averageRating,
          certifications: instructorData.certifications?.length || 0,
        });
      }
    }

    // Enhanced certification body data handling
    if (course.certification?.certificationBodies) {
      for (
        let i = 0;
        i < course.certification.certificationBodies.length;
        i++
      ) {
        const certBody = course.certification.certificationBodies[i];
        if (certBody.bodyId && typeof certBody.bodyId === "string") {
          const CertificationBody = require("../models/CertificationBody");
          const bodyData = await CertificationBody.findById(certBody.bodyId);
          if (bodyData) {
            certBody.bodyData = bodyData;
          }
        }
      }
    }

    let courseStatusMessage = "This course is available for enrollment";
    let userEnrollment = null;
    let hasAccess = false;

    // Enhanced user enrollment status checking
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

    // Calculate enhanced course metrics
    const totalDuration = course.videos.reduce(
      (total, video) => total + (video.duration || 0),
      0
    );
    const totalQuizQuestions = course.videos.reduce(
      (total, video) => total + (video.exam ? video.exam.length : 0),
      0
    );
    const previewVideos = course.videos.filter((video) => video.isPreview);
    const hasQuizzes = course.videos.some(
      (video) => video.exam && video.exam.length > 0
    );

    // Format published date
    const publishedDate = course.metadata?.publishedDate
      ? new Date(course.metadata.publishedDate).toLocaleDateString()
      : null;

    // Enhanced course difficulty assessment
    let difficultyLevel = course.content?.experienceLevel || "all-levels";
    if (totalDuration > 360) {
      // 6+ hours
      difficultyLevel =
        difficultyLevel === "beginner" ? "intermediate" : difficultyLevel;
    }

    // Enhanced view data
    const viewData = {
      course,
      user: req.user,
      courseStatusMessage,
      userEnrollment,
      hasAccess,
      // Enhanced calculated fields
      courseMetrics: {
        totalDuration,
        totalQuizQuestions,
        previewVideos,
        hasQuizzes,
        publishedDate,
        enrollmentCount: course.access?.totalEnrollments || 0,
        difficultyLevel,
        completionRate:
          totalDuration > 0
            ? Math.round((course.videos.length / totalDuration) * 100)
            : 0,
        averageVideoLength:
          course.videos.length > 0
            ? Math.round(totalDuration / course.videos.length)
            : 0,
      },
      // SEO and sharing data
      seoData: {
        title: course.basic?.title || "Self-Paced Online Training",
        description: course.basic?.description || "",
        image: course.media?.thumbnailUrl || "/images/default-course.jpg",
        url: `${req.protocol}://${req.get(
          "host"
        )}/self-paced-online-training/courses/${course._id}`,
        instructor: course.instructor?.name || "Expert Instructor",
        price: course.access?.price || 0,
        currency: course.access?.currency || "EUR",
      },
    };

    console.log(
      "📈 Enhanced course metrics calculated:",
      viewData.courseMetrics
    );
    console.log(
      "👨‍🏫 Instructor data available:",
      !!course.instructor?.instructorData
    );

    res.render("self-paced-course-details", viewData);
  } catch (err) {
    console.error("❌ Error fetching course details:", err);
    res.status(500).send("Server error");
  }
};

// 3. Get user's enrolled courses (unchanged)
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

// 4. Access course content (enhanced with instructor data)
exports.accessCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.redirect("/login");
    }

    const userDoc = await User.findById(req.user._id);

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

// 5-11. Other methods remain unchanged...
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

    const userDoc = await User.findById(req.user._id);

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

    const userDoc = await User.findById(req.user._id);

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

    const userDoc = await User.findById(req.user._id);

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

    const userDoc = await User.findById(req.user._id);

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
