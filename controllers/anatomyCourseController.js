// controllers/anatomyCourseController.js
const User = require("../models/user");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const bcrypt = require("bcryptjs");
const emailService = require("../utils/emailService");

// FREE ANATOMY COURSE ID - This should match your database
const FREE_ANATOMY_COURSE_ID = "6884c082935e6577ad62ed93";

/**
 * Display the free anatomy course registration page
 */
exports.showRegistrationPage = async (req, res) => {
  try {
    console.log("📚 Loading free anatomy course registration page...");

    // Fetch the Free Anatomy Unlocked Course from database
    const course = await OnlineLiveTraining.findById(FREE_ANATOMY_COURSE_ID);

    if (!course) {
      console.warn("⚠️ Free Anatomy Course not found in database");
      // Create a fallback course object with basic information
      const fallbackCourse = {
        _id: FREE_ANATOMY_COURSE_ID,
        basic: {
          title: "Free Anatomy Unlocked Course",
          description:
            "A free, aesthetic-focused anatomy course designed for beginner injectors, nurses, dentists, and medical students entering the field of medical aesthetics.",
          courseCode: "IAAI-ANAT001",
        },
        schedule: {
          startDate: new Date("2025-09-10"),
          duration: "1 hour",
        },
        instructors: {
          primary: {
            name: "Noura Lebbar",
          },
        },
        platform: {
          name: "Zoom",
        },
        content: {
          objectives: [
            "Master facial anatomy related to aesthetic injections",
            "Identify facial danger zones to avoid complications",
            "Understand the five anatomical layers of the face",
            "Learn safe injection depths and surface anatomy markers",
            "Improve injection technique and safety protocols",
            "Build confidence and prepare for advanced aesthetic courses",
          ],
        },
        enrollment: {
          price: 0,
          currency: "EUR",
        },
      };

      return res.render("free-anatomy-course-registration", {
        user: req.user || null,
        course: fallbackCourse,
        title: "Free Anatomy Unlocked Course - IAAI Training Institute",
      });
    }

    console.log(
      "✅ Free Anatomy Course loaded:",
      course.basic?.title || course.title
    );

    res.render("free-anatomy-course-registration", {
      user: req.user || null,
      course: course,
      title: `${course.basic?.title || course.title} - IAAI Training Institute`,
    });
  } catch (error) {
    console.error("❌ Error loading anatomy course registration page:", error);

    // Create emergency fallback
    const emergencyFallback = {
      _id: FREE_ANATOMY_COURSE_ID,
      basic: {
        title: "Free Anatomy Unlocked Course",
        description:
          "Learn essential facial anatomy for safe aesthetic injections",
        courseCode: "IAAI-ANAT001",
      },
      schedule: {
        startDate: new Date(),
        duration: "1 hour",
      },
      instructors: {
        primary: {
          name: "Expert Instructor",
        },
      },
    };

    res.render("free-anatomy-course-registration", {
      user: req.user || null,
      course: emergencyFallback,
      title: "Free Anatomy Unlocked Course - IAAI Training Institute",
      error: "Some course details may not be fully loaded",
    });
  }
};

/**
 * Handle registration form submission
 */
exports.registerForCourse = async (req, res) => {
  try {
    console.log("📝 Processing anatomy course registration...");
    console.log("📧 Email:", req.body.email);

    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      profession,
      country,
      role,
    } = req.body;

    // Input validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please fill in all required fields (First Name, Last Name, Email, and Password).",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (user) {
      console.log("👤 Existing user found:", user.email);

      // Check if user is already enrolled in this course
      const existingEnrollment = user.myLiveCourses.find(
        (course) => course.courseId.toString() === FREE_ANATOMY_COURSE_ID
      );

      if (existingEnrollment) {
        return res.status(200).json({
          success: true,
          message:
            "You are already enrolled in the Free Anatomy Unlocked Course! You can access it from your course library.",
          isNewUser: false,
          alreadyEnrolled: true,
        });
      }
    } else {
      console.log("🆕 Creating new user account...");
      isNewUser = true;

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user
      user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phoneNumber: phoneNumber?.trim() || "",
        profession: profession || "",
        country: country?.trim() || "",
        role: role || "user",
        isConfirmed: true, // Auto-confirm for free course registration

        // Set up basic professional info if provided
        professionalInfo: {
          fieldOfStudy: profession || null,
        },

        // Initialize notification settings
        notificationSettings: {
          email: true,
          courseUpdates: true,
          promotions: false,
          reminders: true,
        },

        // Initialize account status
        accountStatus: {
          isActive: true,
          isLocked: false,
          lastLoginAt: new Date(),
          loginAttempts: 0,
        },
      });
    }

    // Fetch the course details
    const course = await OnlineLiveTraining.findById(FREE_ANATOMY_COURSE_ID);

    if (!course) {
      console.error("❌ Free Anatomy Course not found in database");
      return res.status(404).json({
        success: false,
        message: "Course not found. Please contact support.",
      });
    }

    // Add course enrollment to user
    const enrollmentData = {
      courseId: course._id,
      enrollmentData: {
        status: "registered", // Free course - automatically registered
        registrationDate: new Date(),
        paidAmount: 0, // Free course
        courseName:
          course.basic?.title || course.title || "Free Anatomy Unlocked Course",
        courseCode:
          course.basic?.courseCode || course.courseCode || "IAAI-ANAT001",
        courseType: "OnlineLiveTraining",
        originalPrice: 0,
        currency: "EUR",
        isLinkedCourse: false,
        isLinkedCourseFree: false,
      },
      userProgress: {
        attendanceRecords: [],
        overallAttendancePercentage: 0,
        assessmentScore: 0,
        assessmentCompleted: false,
        courseStatus: "not-started",
      },
      certificateId: null,
      userNotes: "",
      notificationsEnabled: true,
    };

    // Add the course to user's enrolled courses
    user.myLiveCourses.push(enrollmentData);

    // Save the user
    await user.save();

    console.log(
      `✅ User ${isNewUser ? "created and " : ""}enrolled successfully`
    );

    // Prepare course information for email
    const courseInfo = {
      title:
        course.basic?.title || course.title || "Free Anatomy Unlocked Course",
      courseCode:
        course.basic?.courseCode || course.courseCode || "IAAI-ANAT001",
      courseType: "OnlineLiveTraining",
      displayType: "Live Online Training",
      startDate: course.schedule?.startDate || new Date(),
      originalPrice: 0,
      finalPrice: 0,
      isLinkedCourseFree: false,
    };

    // Prepare transaction info for email
    const transactionInfo = {
      referenceNumber: `FREE-${Date.now()}`,
      receiptNumber: `FREE-ANAT-${user._id.toString().slice(-6)}`,
      orderNumber: `ORD-FREE-${Date.now()}`,
      finalAmount: 0,
      paymentMethod: "Free Registration",
    };

    // Send registration confirmation email
    try {
      const emailResult = await emailService.sendCourseRegistrationConfirmation(
        user,
        [courseInfo],
        transactionInfo,
        false // Not a promo code
      );

      if (emailResult.success) {
        console.log("✅ Registration confirmation email sent");
      } else {
        console.warn("⚠️ Email sending failed:", emailResult.error);
      }
    } catch (emailError) {
      console.error("❌ Email sending error:", emailError);
      // Don't fail the registration if email fails
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: isNewUser
        ? "Congratulations! Your account has been created and you have been successfully enrolled in the Free Anatomy Unlocked Course."
        : "Great! The Free Anatomy Unlocked Course has been added to your account.",
      isNewUser: isNewUser,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      course: {
        id: course._id,
        title: courseInfo.title,
        code: courseInfo.courseCode,
      },
    });
  } catch (error) {
    console.error("❌ Error during anatomy course registration:", error);

    // Handle specific errors
    if (error.code === 11000) {
      // Duplicate key error (should not happen since we check first)
      return res.status(400).json({
        success: false,
        message:
          "An account with this email already exists. Please try logging in instead.",
      });
    }

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: `Validation error: ${validationErrors.join(", ")}`,
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "An error occurred during registration. Please try again later.",
    });
  }
};
