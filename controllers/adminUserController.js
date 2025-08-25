// adminUserController.js - Updated Version with Enhanced Course Data Population
const User = require("../models/user");
const DeletedUser = require("../models/deletedUser");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const crypto = require("crypto");
const Instructor = require("../models/Instructor");
const CoursePool = require("../models/CoursePool");
const sendEmail = require("../utils/sendEmail");
const DeletedCourse = require("../models/deletedCourse");
// ============================================
// EMAIL CONFIGURATION HELPER (ALIGNED WITH USER CONTROLLER)
// ============================================
function createEmailTransporter() {
  return {
    verify: async () => {
      console.log(
        "✅ Using Gmail SMTP - verification handled by sendEmail utility"
      );
      return true;
    },
    sendMail: async (options) => {
      const sendEmail = require("../utils/sendEmail");
      return await sendEmail(options);
    },
  };
}

// Helper function to get course model
const getCourseModel = (courseType) => {
  switch (courseType) {
    case "InPersonAestheticTraining":
      return InPersonAestheticTraining;
    case "OnlineLiveTraining":
      return OnlineLiveTraining;
    case "SelfPacedOnlineTraining":
      return SelfPacedOnlineTraining;
    default:
      return null;
  }
};

// ✅ Enhanced Fetch All Users with Complete Course Data Population
exports.getAllUsers = async (req, res) => {
  try {
    console.log("🔍 Fetching all users for admin panel...");

    // ✅ Fetch all users and populate course references with enhanced data
    const users = await User.find()
      .populate({
        path: "myInPersonCourses.courseId",
        select:
          "basic.title basic.courseCode schedule.startDate schedule.endDate enrollment.price venue.city venue.country certification.enabled",
      })
      .populate({
        path: "myLiveCourses.courseId",
        select:
          "basic.title basic.courseCode schedule.startDate schedule.endDate enrollment.price platform.name certification.enabled",
      })
      .populate({
        path: "mySelfPacedCourses.courseId",
        select:
          "basic.title basic.courseCode content.estimatedMinutes enrollment.price access.accessDays certification.enabled videos",
      })
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Enhanced user processing with complete course data
    const processedUsers = users.map((user) => {
      const allCourses = [];
      const wishlistCourses = [];

      // Enhanced In-Person Courses Processing
      if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
        user.myInPersonCourses.forEach((course) => {
          const courseData = {
            ...course,
            courseType: "In-Person",
            courseTitle: course.courseId
              ? course.courseId.basic?.title
              : course.title,
            courseCode: course.courseId
              ? course.courseId.basic?.courseCode
              : course.courseCode,
            price:
              course.enrollmentData?.paidAmount ||
              course.courseId?.enrollment?.price ||
              0,
            // Enhanced progress tracking
            enrollmentStatus: course.enrollmentData?.status || "unknown",
            registrationDate:
              course.enrollmentData?.registrationDate ||
              course.dateOfRegistration,
            paidAmount: course.enrollmentData?.paidAmount || 0,
            promoCodeUsed:
              course.enrollmentData?.promoCodeUsed || course.promoCode,
            // Progress details
            attendancePercentage:
              course.userProgress?.overallAttendancePercentage || 0,
            courseStatus:
              course.userProgress?.courseStatus ||
              course.status ||
              "not-started",
            completionDate: course.userProgress?.completionDate,
            assessmentScore:
              course.userProgress?.assessmentScore || course.assessmentScore,
            certificateId: course.certificateId,
            // Location info
            location: course.courseId?.venue
              ? `${course.courseId.venue.city}, ${course.courseId.venue.country}`
              : null,
            startDate: course.courseId?.schedule?.startDate,
            endDate: course.courseId?.schedule?.endDate,
          };
          allCourses.push(courseData);

          if (course.wishlistStatus === 1) {
            wishlistCourses.push(courseData);
          }
        });
      }

      // Enhanced Online Live Courses Processing
      if (user.myLiveCourses && user.myLiveCourses.length > 0) {
        user.myLiveCourses.forEach((course) => {
          const courseData = {
            ...course,
            courseType: "Online Live",
            courseTitle: course.courseId
              ? course.courseId.basic?.title
              : course.title,
            courseCode: course.courseId
              ? course.courseId.basic?.courseCode
              : course.courseCode,
            price:
              course.enrollmentData?.paidAmount ||
              course.courseId?.enrollment?.price ||
              0,
            // Enhanced progress tracking
            enrollmentStatus: course.enrollmentData?.status || "unknown",
            registrationDate:
              course.enrollmentData?.registrationDate ||
              course.dateOfRegistration,
            paidAmount: course.enrollmentData?.paidAmount || 0,
            promoCodeUsed:
              course.enrollmentData?.promoCodeUsed || course.promoCode,
            // Progress details
            attendancePercentage:
              course.userProgress?.overallAttendancePercentage || 0,
            courseStatus:
              course.userProgress?.courseStatus ||
              course.status ||
              "not-started",
            completionDate: course.userProgress?.completionDate,
            assessmentScore:
              course.userProgress?.bestAssessmentScore ||
              course.assessmentScore,
            certificateId: course.certificateId,
            // Online-specific details
            sessionsAttended:
              course.userProgress?.sessionsAttended?.length || 0,
            recordingsWatched:
              course.userProgress?.recordingsWatched?.length || 0,
            assessmentAttempts: course.assessmentAttempts?.length || 0,
            platform: course.courseId?.platform?.name || "Online Platform",
            startDate: course.courseId?.schedule?.startDate,
            endDate: course.courseId?.schedule?.endDate,
          };
          allCourses.push(courseData);

          if (course.wishlistStatus === 1) {
            wishlistCourses.push(courseData);
          }
        });
      }

      // Enhanced Self-Paced Courses Processing
      if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
        user.mySelfPacedCourses.forEach((course) => {
          const totalVideos = course.courseId?.videos?.length || 0;
          const completedVideos =
            course.courseProgress?.completedVideos?.length || 0;
          const overallPercentage =
            totalVideos > 0
              ? Math.round((completedVideos / totalVideos) * 100)
              : 0;

          const courseData = {
            ...course,
            courseType: "Self-Paced",
            courseTitle: course.courseId
              ? course.courseId.basic?.title
              : course.title,
            courseCode: course.courseId
              ? course.courseId.basic?.courseCode
              : course.courseCode,
            price:
              course.enrollmentData?.paidAmount ||
              course.courseId?.access?.price ||
              0,
            // Enhanced progress tracking
            enrollmentStatus: course.enrollmentData?.status || "unknown",
            registrationDate:
              course.enrollmentData?.registrationDate ||
              course.dateOfRegistration,
            expiryDate: course.enrollmentData?.expiryDate,
            paidAmount: course.enrollmentData?.paidAmount || 0,
            promoCodeUsed:
              course.enrollmentData?.promoCodeUsed || course.promoCode,
            // Progress details
            overallPercentage: overallPercentage,
            courseStatus:
              course.courseProgress?.status || course.status || "not-started",
            completionDate: course.courseProgress?.completionDate,
            lastAccessedAt: course.courseProgress?.lastAccessedAt,
            totalWatchTime: course.courseProgress?.totalWatchTime || 0,
            averageExamScore: course.courseProgress?.averageExamScore || 0,
            certificateId: course.certificateId,
            // Self-paced specific details
            completedVideos: completedVideos,
            totalVideos: totalVideos,
            completedExams: course.courseProgress?.completedExams?.length || 0,
            videoNotes: course.videoNotes?.length || 0,
            bookmarks: course.bookmarks?.length || 0,
            estimatedMinutes: course.courseId?.content?.estimatedMinutes || 0,
          };
          allCourses.push(courseData);

          if (course.wishlistStatus === 1) {
            wishlistCourses.push(courseData);
          }
        });
      }

      // Calculate comprehensive user statistics
      const userStats = {
        totalSpent: user.paymentTransactions
          ? user.paymentTransactions
              .filter((t) => t.paymentStatus === "completed")
              .reduce((sum, t) => sum + (t.finalAmount || 0), 0)
          : 0,
        totalTransactions: user.paymentTransactions
          ? user.paymentTransactions.filter(
              (t) => t.paymentStatus === "completed"
            ).length
          : 0,
        totalCourses: allCourses.length,
        completedCourses: allCourses.filter(
          (c) =>
            c.courseStatus === "completed" ||
            c.completionDate ||
            c.overallPercentage === 100
        ).length,
        inProgressCourses: allCourses.filter(
          (c) =>
            c.courseStatus === "in-progress" ||
            (c.overallPercentage > 0 && c.overallPercentage < 100)
        ).length,
        certificatesEarned: allCourses.filter((c) => c.certificateId).length,
        averageProgress:
          allCourses.length > 0
            ? Math.round(
                allCourses.reduce(
                  (sum, c) =>
                    sum + (c.overallPercentage || c.attendancePercentage || 0),
                  0
                ) / allCourses.length
              )
            : 0,
      };

      // Enhanced professional information processing
      const professionalInfo = {
        basic: {
          title: user.professionalInfo?.title || "Not specified",
          fieldOfStudy: user.professionalInfo?.fieldOfStudy || "Not specified",
          specialty: user.professionalInfo?.specialty || "Not specified",
          aestheticsExperience:
            user.professionalInfo?.aestheticsExperience || "Not specified",
          yearsOfExperience:
            user.professionalInfo?.yearsOfExperience || "Not specified",
          currentWorkplace:
            user.professionalInfo?.currentWorkplace || "Not specified",
          trainingGoals:
            user.professionalInfo?.trainingGoals || "Not specified",
        },
        license: {
          hasLicense: user.professionalInfo?.licenseInfo?.hasLicense || false,
          licenseNumber:
            user.professionalInfo?.licenseInfo?.licenseNumber || "Not provided",
          licenseState:
            user.professionalInfo?.licenseInfo?.licenseState || "Not provided",
          licenseCountry:
            user.professionalInfo?.licenseInfo?.licenseCountry ||
            "Not provided",
        },
        interests: user.professionalInfo?.areasOfInterest || [],
      };

      return {
        ...user,
        myCourses: allCourses,
        myWishlist: wishlistCourses,
        userStats: userStats,
        professionalInfo: professionalInfo,
        totalSpent: userStats.totalSpent,
        coursesPurchased: userStats.totalCourses,
        lastTransactionDate:
          user.paymentTransactions && user.paymentTransactions.length > 0
            ? Math.max(
                ...user.paymentTransactions.map(
                  (t) => new Date(t.transactionDate)
                )
              )
            : null,
      };
    });

    // ✅ Calculate overall statistics (existing code remains the same)
    const overallStats = {
      totalRevenue: processedUsers.reduce(
        (sum, user) => sum + user.totalSpent,
        0
      ),
      totalTransactions: processedUsers.reduce(
        (sum, user) =>
          sum +
          (user.paymentTransactions ? user.paymentTransactions.length : 0),
        0
      ),
      totalPaidCourses: processedUsers.reduce(
        (sum, user) =>
          sum +
          (user.paymentTransactions
            ? user.paymentTransactions
                .filter((t) => t.finalAmount > 0)
                .reduce(
                  (s, t) =>
                    s + (t.coursesRegistered ? t.coursesRegistered.length : 0),
                  0
                )
            : 0),
        0
      ),
      totalFreeCourses: processedUsers.reduce(
        (sum, user) =>
          sum +
          (user.paymentTransactions
            ? user.paymentTransactions
                .filter((t) => t.finalAmount === 0)
                .reduce(
                  (s, t) =>
                    s + (t.coursesRegistered ? t.coursesRegistered.length : 0),
                  0
                )
            : 0),
        0
      ),
      averageTransactionValue: 0,
    };

    // Calculate average transaction value
    const paidTransactions = processedUsers.reduce(
      (count, user) =>
        count +
        (user.paymentTransactions
          ? user.paymentTransactions.filter((t) => t.finalAmount > 0).length
          : 0),
      0
    );

    overallStats.averageTransactionValue =
      paidTransactions > 0
        ? (overallStats.totalRevenue / paidTransactions).toFixed(2)
        : 0;

    // ✅ Determine which page to render based on the route
    const view = req.path.includes("approval")
      ? "admin-user-approval"
      : "admin-users-manage";

    res.render(view, {
      users: processedUsers,
      overallStats: overallStats,
      user: req.user,
    });
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    req.flash("error", "Error fetching users");
    res.redirect("/dashboard");
  }
};

// ✅ Enhanced Get User Details with Complete Course Data
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const userDetails = await User.findById(userId)
      .populate({
        path: "myInPersonCourses.courseId",
        select:
          "basic title courseCode schedule venue instructors enrollment certification media",
        options: { strictPopulate: false },
      })
      .populate({
        path: "myLiveCourses.courseId",
        select:
          "basic title courseCode schedule platform instructors enrollment certification recording",
        options: { strictPopulate: false },
      })
      .populate({
        path: "mySelfPacedCourses.courseId",
        select:
          "basic title courseCode content access instructor certification videos",
        options: { strictPopulate: false },
      })
      .lean();

    if (!userDetails) {
      req.flash("error", "User not found");
      return res.redirect("/admin-users");
    }

    // Process user data with enhanced course information (same logic as getAllUsers but with more detail)
    const allCourses = [];
    const wishlistCourses = [];

    // Enhanced In-Person Courses Processing with full details
    // Enhanced In-Person Courses Processing with full details
    // Enhanced In-Person Courses Processing with full details
    if (
      userDetails.myInPersonCourses &&
      userDetails.myInPersonCourses.length > 0
    ) {
      userDetails.myInPersonCourses.forEach((course) => {
        const courseData = {
          ...course,
          _id: course._id, // Include enrollment ID
          courseType: "InPersonAestheticTraining", // Use model name
          courseTitle: course.courseId
            ? course.courseId.basic?.title || course.courseId.title
            : course.enrollmentData?.courseName ||
              course.title ||
              "Unknown Course",
          courseCode: course.courseId
            ? course.courseId.basic?.courseCode || course.courseId.courseCode
            : course.enrollmentData?.courseCode || course.courseCode || "N/A",
          price:
            course.enrollmentData?.paidAmount ||
            course.courseId?.enrollment?.price ||
            course.courseId?.basic?.price ||
            0,

          // Enhanced enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate:
            course.enrollmentData?.registrationDate ||
            course.dateOfRegistration,
          paidAmount: course.enrollmentData?.paidAmount || 0,
          promoCodeUsed:
            course.enrollmentData?.promoCodeUsed || course.promoCode,

          // Progress details
          attendancePercentage:
            course.userProgress?.overallAttendancePercentage || 0,
          courseStatus:
            course.userProgress?.courseStatus || course.status || "not-started",
          completionDate: course.userProgress?.completionDate,
          assessmentScore:
            course.userProgress?.assessmentScore ||
            course.assessmentScore ||
            course.bestAssessmentScore ||
            0,
          certificateId: course.certificateId,

          // Location and schedule info
          location: course.courseId?.venue
            ? `${course.courseId.venue.city}, ${course.courseId.venue.country}`
            : course.courseId?.location || null,
          startDate: course.courseId?.schedule?.startDate,
          endDate: course.courseId?.schedule?.endDate,
          instructor:
            course.courseId?.instructors?.primary?.name ||
            course.courseId?.instructor?.name ||
            "TBA",
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }

    // Enhanced Online Live Courses Processing with full details
    if (userDetails.myLiveCourses && userDetails.myLiveCourses.length > 0) {
      userDetails.myLiveCourses.forEach((course) => {
        const courseData = {
          ...course,
          _id: course._id, // Include enrollment ID
          courseType: "OnlineLiveTraining", // Use model name
          courseTitle: course.courseId
            ? course.courseId.basic?.title || course.courseId.title
            : course.enrollmentData?.courseName ||
              course.title ||
              "Unknown Course",
          courseCode: course.courseId
            ? course.courseId.basic?.courseCode || course.courseId.courseCode
            : course.enrollmentData?.courseCode || course.courseCode || "N/A",
          price:
            course.enrollmentData?.paidAmount ||
            course.courseId?.enrollment?.price ||
            course.courseId?.basic?.price ||
            0,

          // Enhanced enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate:
            course.enrollmentData?.registrationDate ||
            course.dateOfRegistration,
          paidAmount: course.enrollmentData?.paidAmount || 0,
          promoCodeUsed:
            course.enrollmentData?.promoCodeUsed || course.promoCode,

          // Progress details
          attendancePercentage:
            course.userProgress?.overallAttendancePercentage || 0,
          courseStatus:
            course.userProgress?.courseStatus || course.status || "not-started",
          completionDate: course.userProgress?.completionDate,
          assessmentScore:
            course.userProgress?.bestAssessmentScore ||
            course.assessmentScore ||
            course.bestAssessmentScore ||
            0,
          certificateId: course.certificateId,

          // Online-specific details
          sessionsAttended: course.userProgress?.sessionsAttended?.length || 0,
          recordingsWatched:
            course.userProgress?.recordingsWatched?.length || 0,
          assessmentAttempts: course.assessmentAttempts?.length || 0,
          platform: course.courseId?.platform?.name || "Online Platform",
          startDate: course.courseId?.schedule?.startDate,
          endDate: course.courseId?.schedule?.endDate,
          instructor:
            course.courseId?.instructors?.primary?.name ||
            course.courseId?.instructor?.name ||
            "TBA",
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }

    // Enhanced Self-Paced Courses Processing with full details
    if (
      userDetails.mySelfPacedCourses &&
      userDetails.mySelfPacedCourses.length > 0
    ) {
      userDetails.mySelfPacedCourses.forEach((course) => {
        const totalVideos = course.courseId?.videos?.length || 0;
        const completedVideos =
          course.courseProgress?.completedVideos?.length || 0;
        const overallPercentage =
          totalVideos > 0
            ? Math.round((completedVideos / totalVideos) * 100)
            : 0;

        const courseData = {
          ...course,
          _id: course._id, // Include enrollment ID
          courseType: "SelfPacedOnlineTraining", // Use model name
          courseTitle: course.courseId
            ? course.courseId.basic?.title || course.courseId.title
            : course.enrollmentData?.courseName ||
              course.title ||
              "Unknown Course",
          courseCode: course.courseId
            ? course.courseId.basic?.courseCode || course.courseId.courseCode
            : course.enrollmentData?.courseCode || course.courseCode || "N/A",
          price:
            course.enrollmentData?.paidAmount ||
            course.courseId?.access?.price ||
            course.courseId?.basic?.price ||
            0,

          // Enhanced enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate:
            course.enrollmentData?.registrationDate ||
            course.dateOfRegistration,
          expiryDate: course.enrollmentData?.expiryDate,
          paidAmount: course.enrollmentData?.paidAmount || 0,
          promoCodeUsed:
            course.enrollmentData?.promoCodeUsed || course.promoCode,

          // Progress details
          overallPercentage: overallPercentage,
          courseStatus:
            course.courseProgress?.status || course.status || "not-started",
          completionDate: course.courseProgress?.completionDate,
          lastAccessedAt: course.courseProgress?.lastAccessedAt,
          totalWatchTime: course.courseProgress?.totalWatchTime || 0,
          averageExamScore: course.courseProgress?.averageExamScore || 0,
          certificateId: course.certificateId,

          // Self-paced specific details
          completedVideos: completedVideos,
          totalVideos: totalVideos,
          completedExams: course.courseProgress?.completedExams?.length || 0,
          videoNotes: course.videoNotes?.length || 0,
          bookmarks: course.bookmarks?.length || 0,
          estimatedMinutes: course.courseId?.content?.estimatedMinutes || 0,
          instructor: course.courseId?.instructor?.name || "TBA",
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }
    // Calculate comprehensive user statistics
    const userStats = {
      totalSpent: userDetails.paymentTransactions
        ? userDetails.paymentTransactions
            .filter((t) => t.paymentStatus === "completed")
            .reduce((sum, t) => sum + (t.finalAmount || 0), 0)
        : 0,
      totalTransactions: userDetails.paymentTransactions
        ? userDetails.paymentTransactions.filter(
            (t) => t.paymentStatus === "completed"
          ).length
        : 0,
      totalCourses: allCourses.length,
      completedCourses: allCourses.filter(
        (c) =>
          c.courseStatus === "completed" ||
          c.completionDate ||
          c.overallPercentage === 100
      ).length,
      inProgressCourses: allCourses.filter(
        (c) =>
          c.courseStatus === "in-progress" ||
          (c.overallPercentage > 0 && c.overallPercentage < 100)
      ).length,
      certificatesEarned: allCourses.filter((c) => c.certificateId).length,
      averageProgress:
        allCourses.length > 0
          ? Math.round(
              allCourses.reduce(
                (sum, c) =>
                  sum + (c.overallPercentage || c.attendancePercentage || 0),
                0
              ) / allCourses.length
            )
          : 0,
    };

    // Process professional information
    const professionalInfo = {
      basic: {
        title: userDetails.professionalInfo?.title || "Not specified",
        fieldOfStudy:
          userDetails.professionalInfo?.fieldOfStudy || "Not specified",
        specialty: userDetails.professionalInfo?.specialty || "Not specified",
        aestheticsExperience:
          userDetails.professionalInfo?.aestheticsExperience || "Not specified",
        yearsOfExperience:
          userDetails.professionalInfo?.yearsOfExperience || "Not specified",
        currentWorkplace:
          userDetails.professionalInfo?.currentWorkplace || "Not specified",
        trainingGoals:
          userDetails.professionalInfo?.trainingGoals || "Not specified",
      },
      license: {
        hasLicense:
          userDetails.professionalInfo?.licenseInfo?.hasLicense || false,
        licenseNumber:
          userDetails.professionalInfo?.licenseInfo?.licenseNumber ||
          "Not provided",
        licenseState:
          userDetails.professionalInfo?.licenseInfo?.licenseState ||
          "Not provided",
        licenseCountry:
          userDetails.professionalInfo?.licenseInfo?.licenseCountry ||
          "Not provided",
      },
      interests: userDetails.professionalInfo?.areasOfInterest || [],
    };

    // Process profile and documentation
    const profileInfo = {
      profilePicture: userDetails.profileData?.profilePicture || null,
      identificationDocument:
        userDetails.profileData?.identificationDocument || null,
      professionalDocuments:
        userDetails.profileData?.professionalDocuments || [],
      completionStatus: userDetails.profileData?.completionStatus || {
        basicInfo: false,
        professionalInfo: false,
        profilePicture: false,
        identificationDocument: false,
        overallPercentage: 0,
      },
    };

    // Process learning preferences and settings
    const userPreferences = {
      library: userDetails.libraryPreferences || {},
      learning: userDetails.learningPreferences || {},
      notifications: userDetails.notificationSettings || {},
    };

    // Process account status and security
    const accountInfo = {
      status: userDetails.accountStatus || {},
      twoFactorAuth: userDetails.twoFactorAuth || { enabled: false },
      loginActivity: userDetails.loginActivity || [],
    };

    res.render("admin-user-details", {
      userDetails: {
        ...userDetails,
        myCourses: allCourses,
        myWishlist: wishlistCourses,
        userStats: userStats,
        professionalInfo: professionalInfo,
        profileInfo: profileInfo,
        userPreferences: userPreferences,
        accountInfo: accountInfo,
      },
      user: req.user,
    });
  } catch (err) {
    console.error("❌ Error fetching user details:", err);
    req.flash("error", "Error fetching user details");
    res.redirect("/admin-users");
  }
};

// ✅ Enhanced Approve User - ALIGNED WITH USER CONTROLLER EMAIL STRATEGY
exports.approveUser = async (req, res) => {
  try {
    const {
      userId,
      sendEmail: shouldSendEmail,
      emailSubject,
      emailContent,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isConfirmed: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`✅ User ${user.email} approved successfully`);

    // ============================================
    // ENHANCED EMAIL NOTIFICATION (ALIGNED WITH USER CONTROLLER)
    // ============================================
    if (shouldSendEmail !== false) {
      try {
        const subject =
          emailSubject || "Welcome to IAAI Training - Account Approved! 🎉";

        const htmlContent = emailContent
          ? `<!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
                .content { padding: 30px 25px; }
                .welcome-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .login-button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; }
                .footer { background: #f8f9fa; color: #666; font-size: 14px; text-align: center; padding: 20px; border-top: 1px solid #eee; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>IAAI Training Institute</h1>
                </div>
                <div class="content">
                  <h2>${subject}</h2>
                  <div style="white-space: pre-wrap;">${emailContent.replace(
                    /\n/g,
                    "<br>"
                  )}</div>
                </div>
              </div>
            </body>
            </html>`
          : `<!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
                .content { padding: 30px 25px; }
                .welcome-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .login-button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; }
                .footer { background: #f8f9fa; color: #666; font-size: 14px; text-align: center; padding: 20px; border-top: 1px solid #eee; }
                .company-info { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
                ul { margin: 15px 0; padding-left: 20px; }
                li { margin: 8px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to IAAI Training!</h1>
                  <p style="margin: 10px 0 0 0;">Your account has been approved</p>
                </div>
                
                <div class="content">
                  <p>Dear ${user.firstName},</p>
                  
                  <div class="welcome-box">
                    <h3 style="margin-top: 0;">Account Successfully Approved</h3>
                    <p>Congratulations! Your account has been reviewed and approved by our team. You now have full access to the IAAI Training Platform.</p>
                  </div>
                  
                  <h3>What's Next?</h3>
                  <ul>
                    <li>Log in to your account using your email and password</li>
                    <li>Browse our comprehensive training programs</li>
                    <li>Enroll in courses that match your interests</li>
                    <li>Track your learning progress</li>
                    ${
                      user.role === "instructor"
                        ? "<li>Access instructor tools and resources</li>"
                        : ""
                    }
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${
                      process.env.BASE_URL || "https://www.iaa-i.com"
                    }/login" class="login-button">
                      Login to Your Account
                    </a>
                  </div>
                  
                  <p>If you have any questions or need assistance, please contact our support team.</p>
                  
                  <p>Best regards,<br>
                  <strong>IAAI Training Institute</strong></p>
                  
                  <div class="company-info">
                    <p><strong>IAAI Training Institute</strong><br>
                    Professional Aesthetic Training<br>
                    Email: ${process.env.ADMIN_EMAIL || "info@iaa-i.com"}<br>
                    Website: ${
                      process.env.BASE_URL || "https://www.iaa-i.com"
                    }</p>
                  </div>
                </div>
                
                <div class="footer">
                  <p>This email was sent to ${
                    user.email
                  } because you created an account with IAAI Training Institute.</p>
                  <p>If you did not create this account, please ignore this email.</p>
                  <p><a href="${
                    process.env.BASE_URL || "https://www.iaa-i.com"
                  }/unsubscribe" style="color: #667eea;">Unsubscribe</a> | 
                     <a href="${
                       process.env.BASE_URL || "https://www.iaa-i.com"
                     }/contact" style="color: #667eea;">Contact Us</a></p>
                </div>
              </div>
            </body>
            </html>`;

        // Create email transporter using same method as userController
        const transporter = createEmailTransporter();

        await transporter.sendMail({
          from: {
            name: "IAAI Training Institute",
            address:
              process.env.ADMIN_EMAIL ||
              process.env.EMAIL_FROM ||
              "info@iaa-i.com",
          },
          to: user.email,
          subject: subject,
          // Add anti-spam headers like in userController
          headers: {
            "List-Unsubscribe": `<${process.env.BASE_URL}/unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-ID": "IAAI-Training-Institute",
            "X-Mailer": "IAAI Training Platform",
          },
          html: htmlContent,
          // Add plain text version to avoid spam filters
          text: `
            Welcome to IAAI Training Institute!
            
            Dear ${user.firstName},
            
            Your account has been approved and is now active.
            
            You can now log in at: ${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/login
            
            What's next:
            - Log in using your email and password
            - Browse our training programs
            - Enroll in courses
            - Track your progress
            ${
              user.role === "instructor"
                ? "- Access instructor tools and resources"
                : ""
            }
            
            If you have questions, contact our support team.
            
            Best regards,
            IAAI Training Institute
            
            Email: ${process.env.ADMIN_EMAIL || "info@iaa-i.com"}
            Website: ${process.env.BASE_URL || "https://www.iaa-i.com"}
          `,
        });

        console.log("📧 User approval email sent successfully to:", user.email);

        return res.json({
          success: true,
          message: "✅ User Approved Successfully! Welcome email sent.",
          emailSent: true,
        });
      } catch (emailError) {
        console.error("❌ Error sending approval email:", emailError);
        return res.json({
          success: true,
          message:
            "✅ User Approved Successfully! (Note: Email notification failed)",
          emailSent: false,
          emailError: emailError.message,
        });
      }
    } else {
      return res.json({
        success: true,
        message: "✅ User Approved Successfully!",
        emailSent: false,
      });
    }
  } catch (err) {
    console.error("❌ Error approving user:", err);
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: err.message,
    });
  }
};
// ✅ NEW: Get Payment Analytics
exports.getPaymentAnalytics = async (req, res) => {
  try {
    const users = await User.find()
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId")
      .lean();

    // Analytics by time period
    const now = new Date();
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastYear = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate()
    );

    // Revenue analytics
    const revenueAnalytics = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      thisYear: 0,
      total: 0,
    };

    // Course type analytics
    const courseTypeAnalytics = {
      "In-Person": {
        revenue: 0,
        count: 0,
        earlyBird: 0,
        promo: 0,
        fullPrice: 0,
      },
      "Online Live": {
        revenue: 0,
        count: 0,
        earlyBird: 0,
        promo: 0,
        fullPrice: 0,
      },
      "Self-Paced": {
        revenue: 0,
        count: 0,
        earlyBird: 0,
        promo: 0,
        fullPrice: 0,
      },
    };

    // Payment method analytics
    const paymentMethodAnalytics = {};

    // Promo code analytics
    const promoCodeAnalytics = {};

    // Early bird analytics
    const earlyBirdAnalytics = {
      totalRevenue: 0,
      totalDiscounts: 0,
      totalUsers: 0,
      courseBreakdown: {},
    };

    // Payment type breakdown
    const paymentTypeBreakdown = {
      earlyBird: { count: 0, revenue: 0 },
      promo: { count: 0, revenue: 0 },
      fullPrice: { count: 0, revenue: 0 },
      combined: { count: 0, revenue: 0 }, // Both early bird and promo
    };

    // Monthly revenue for chart
    const monthlyRevenue = {};
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = month.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      monthlyRevenue[monthKey] = 0;
    }

    // Process all transactions
    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          if (transaction.paymentStatus === "completed") {
            const transactionDate = new Date(transaction.transactionDate);
            const amount = transaction.finalAmount || 0;

            // Time-based revenue
            revenueAnalytics.total += amount;

            if (transactionDate.toDateString() === now.toDateString()) {
              revenueAnalytics.today += amount;
            }
            if (transactionDate >= lastWeek) {
              revenueAnalytics.thisWeek += amount;
            }
            if (transactionDate >= lastMonth) {
              revenueAnalytics.thisMonth += amount;
            }
            if (transactionDate >= lastYear) {
              revenueAnalytics.thisYear += amount;
            }

            // Monthly revenue for chart
            const monthKey = transactionDate.toLocaleString("default", {
              month: "short",
              year: "numeric",
            });
            if (monthlyRevenue.hasOwnProperty(monthKey)) {
              monthlyRevenue[monthKey] += amount;
            }

            // Determine payment type
            const hasEarlyBird =
              transaction.earlyBird ||
              (transaction.metadata && transaction.metadata.earlyBird) ||
              transaction.discountType === "earlyBird";
            const hasPromo =
              transaction.promoCode && transaction.promoCode.code;

            if (hasEarlyBird && hasPromo) {
              paymentTypeBreakdown.combined.count += 1;
              paymentTypeBreakdown.combined.revenue += amount;
            } else if (hasEarlyBird) {
              paymentTypeBreakdown.earlyBird.count += 1;
              paymentTypeBreakdown.earlyBird.revenue += amount;

              // Early bird analytics
              earlyBirdAnalytics.totalRevenue += amount;
              earlyBirdAnalytics.totalDiscounts +=
                transaction.discountAmount || 0;
              earlyBirdAnalytics.totalUsers += 1;
            } else if (hasPromo) {
              paymentTypeBreakdown.promo.count += 1;
              paymentTypeBreakdown.promo.revenue += amount;
            } else {
              paymentTypeBreakdown.fullPrice.count += 1;
              paymentTypeBreakdown.fullPrice.revenue += amount;
            }

            // Course type analytics with payment type breakdown
            if (transaction.coursesRegistered) {
              transaction.coursesRegistered.forEach((course) => {
                if (courseTypeAnalytics[course.courseType]) {
                  courseTypeAnalytics[course.courseType].revenue +=
                    course.paidPrice || 0;
                  courseTypeAnalytics[course.courseType].count += 1;

                  // Track payment type per course type
                  if (hasEarlyBird) {
                    courseTypeAnalytics[course.courseType].earlyBird += 1;

                    // Track early bird by course
                    if (
                      !earlyBirdAnalytics.courseBreakdown[course.courseCode]
                    ) {
                      earlyBirdAnalytics.courseBreakdown[course.courseCode] = {
                        title: course.courseTitle,
                        count: 0,
                        revenue: 0,
                      };
                    }
                    earlyBirdAnalytics.courseBreakdown[
                      course.courseCode
                    ].count += 1;
                    earlyBirdAnalytics.courseBreakdown[
                      course.courseCode
                    ].revenue += course.paidPrice || 0;
                  }
                  if (hasPromo) {
                    courseTypeAnalytics[course.courseType].promo += 1;
                  }
                  if (!hasEarlyBird && !hasPromo) {
                    courseTypeAnalytics[course.courseType].fullPrice += 1;
                  }
                }
              });
            }

            // Payment method analytics
            const method = transaction.paymentMethod || "Unknown";
            if (!paymentMethodAnalytics[method]) {
              paymentMethodAnalytics[method] = { revenue: 0, count: 0 };
            }
            paymentMethodAnalytics[method].revenue += amount;
            paymentMethodAnalytics[method].count += 1;

            // Promo code analytics
            if (transaction.promoCode && transaction.promoCode.code) {
              const code = transaction.promoCode.code;
              if (!promoCodeAnalytics[code]) {
                promoCodeAnalytics[code] = {
                  uses: 0,
                  discountGiven: 0,
                  revenue: 0,
                  discountPercentage:
                    transaction.promoCode.discountPercentage || 0,
                };
              }
              promoCodeAnalytics[code].uses += 1;
              promoCodeAnalytics[code].discountGiven +=
                transaction.discountAmount || 0;
              promoCodeAnalytics[code].revenue += amount;
            }
          }
        });
      }
    });

    // Calculate conversion rates
    const conversionAnalytics = {
      wishlistToPayment: 0,
      registrationToPayment: 0,
      averageDaysToConvert: 0,
      repeatPurchaseRate: 0,
    };

    // Calculate conversion metrics
    const usersWithWishlist = users.filter(
      (u) => u.myWishlist && u.myWishlist.length > 0
    ).length;
    const usersWithPayments = users.filter((u) => u.totalSpent > 0).length;
    const repeatBuyers = users.filter(
      (u) => u.paymentTransactions && u.paymentTransactions.length > 1
    ).length;

    if (usersWithWishlist > 0) {
      conversionAnalytics.wishlistToPayment = (
        (usersWithPayments / usersWithWishlist) *
        100
      ).toFixed(2);
    }
    if (users.length > 0) {
      conversionAnalytics.registrationToPayment = (
        (usersWithPayments / users.length) *
        100
      ).toFixed(2);
    }
    if (usersWithPayments > 0) {
      conversionAnalytics.repeatPurchaseRate = (
        (repeatBuyers / usersWithPayments) *
        100
      ).toFixed(2);
    }

    // Top paying users with more details
    const topPayingUsers = users
      .map((user) => ({
        ...user,
        totalSpent: user.paymentTransactions
          ? user.paymentTransactions
              .filter((t) => t.paymentStatus === "completed")
              .reduce((sum, t) => sum + (t.finalAmount || 0), 0)
          : 0,
        transactionCount: user.paymentTransactions
          ? user.paymentTransactions.filter(
              (t) => t.paymentStatus === "completed"
            ).length
          : 0,
        lastPurchaseDate:
          user.paymentTransactions && user.paymentTransactions.length > 0
            ? Math.max(
                ...user.paymentTransactions.map(
                  (t) => new Date(t.transactionDate)
                )
              )
            : null,
      }))
      .filter((user) => user.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Most popular courses with detailed analytics
    const coursePopularity = {};
    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          if (
            transaction.coursesRegistered &&
            transaction.paymentStatus === "completed"
          ) {
            transaction.coursesRegistered.forEach((course) => {
              const key = `${course.courseCode}-${course.courseTitle}`;
              if (!coursePopularity[key]) {
                coursePopularity[key] = {
                  courseCode: course.courseCode,
                  courseTitle: course.courseTitle,
                  courseType: course.courseType,
                  enrollments: 0,
                  revenue: 0,
                  earlyBirdEnrollments: 0,
                  promoEnrollments: 0,
                  fullPriceEnrollments: 0,
                  averagePrice: 0,
                };
              }
              coursePopularity[key].enrollments += 1;
              coursePopularity[key].revenue += course.paidPrice || 0;

              // Track payment types
              const hasEarlyBird =
                transaction.earlyBird ||
                transaction.discountType === "earlyBird";
              const hasPromo =
                transaction.promoCode && transaction.promoCode.code;

              if (hasEarlyBird) {
                coursePopularity[key].earlyBirdEnrollments += 1;
              }
              if (hasPromo) {
                coursePopularity[key].promoEnrollments += 1;
              }
              if (!hasEarlyBird && !hasPromo) {
                coursePopularity[key].fullPriceEnrollments += 1;
              }
            });
          }
        });
      }
    });

    // Calculate average prices
    Object.values(coursePopularity).forEach((course) => {
      course.averagePrice =
        course.enrollments > 0
          ? (course.revenue / course.enrollments).toFixed(2)
          : 0;
    });

    const popularCourses = Object.values(coursePopularity)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Time-based analytics (hourly, daily patterns)
    const timePatterns = {
      hourlyDistribution: new Array(24).fill(0),
      dayOfWeekDistribution: new Array(7).fill(0),
      peakHours: [],
      peakDays: [],
    };

    // Analyze time patterns
    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          if (transaction.paymentStatus === "completed") {
            const date = new Date(transaction.transactionDate);
            timePatterns.hourlyDistribution[date.getHours()] += 1;
            timePatterns.dayOfWeekDistribution[date.getDay()] += 1;
          }
        });
      }
    });

    // Identify peak times
    const maxHourlyTransactions = Math.max(...timePatterns.hourlyDistribution);
    const maxDailyTransactions = Math.max(
      ...timePatterns.dayOfWeekDistribution
    );

    timePatterns.peakHours = timePatterns.hourlyDistribution
      .map((count, hour) => ({ hour, count }))
      .filter((h) => h.count === maxHourlyTransactions)
      .map((h) => h.hour);

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    timePatterns.peakDays = timePatterns.dayOfWeekDistribution
      .map((count, day) => ({ day: dayNames[day], count }))
      .filter((d) => d.count === maxDailyTransactions)
      .map((d) => d.day);

    res.render("admin-payment-analytics", {
      revenueAnalytics,
      courseTypeAnalytics,
      paymentMethodAnalytics,
      promoCodeAnalytics,
      earlyBirdAnalytics,
      paymentTypeBreakdown,
      monthlyRevenue,
      topPayingUsers,
      popularCourses,
      conversionAnalytics,
      timePatterns,
      user: req.user,
    });
  } catch (err) {
    console.error("❌ Error fetching payment analytics:", err);
    req.flash("error", "Error loading payment analytics");
    res.redirect("/dashboard");
  }
};

// ✅ Export Financial Report
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");

exports.exportFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate, format = "csv" } = req.query;

    // Fetch and filter data
    const users = await User.find().lean();

    // Filter transactions by date range
    const transactions = [];
    let totalRevenue = 0;
    let totalDiscounts = 0;
    let totalTransactions = 0;

    // Analytics data
    const courseTypeAnalytics = {
      "In-Person": { revenue: 0, count: 0 },
      "Online Live": { revenue: 0, count: 0 },
      "Self-Paced": { revenue: 0, count: 0 },
    };

    const paymentMethodAnalytics = {};
    const monthlyRevenue = {};
    const promoCodeUsage = {};

    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          if (transaction.paymentStatus !== "completed") return;

          const transDate = new Date(transaction.transactionDate);
          if (startDate && transDate < new Date(startDate)) return;
          if (endDate && transDate > new Date(endDate)) return;

          totalTransactions++;
          totalRevenue += transaction.finalAmount || 0;
          totalDiscounts += transaction.discountAmount || 0;

          // Add user info to transaction
          transactions.push({
            ...transaction,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userPhone: user.phoneNumber || "N/A",
          });

          // Analytics calculations
          const monthKey = transDate.toLocaleString("default", {
            month: "short",
            year: "numeric",
          });
          monthlyRevenue[monthKey] =
            (monthlyRevenue[monthKey] || 0) + (transaction.finalAmount || 0);

          // Payment method
          const method = transaction.paymentMethod || "Unknown";
          if (!paymentMethodAnalytics[method]) {
            paymentMethodAnalytics[method] = { revenue: 0, count: 0 };
          }
          paymentMethodAnalytics[method].revenue +=
            transaction.finalAmount || 0;
          paymentMethodAnalytics[method].count += 1;

          // Course type analytics
          if (transaction.coursesRegistered) {
            transaction.coursesRegistered.forEach((course) => {
              if (courseTypeAnalytics[course.courseType]) {
                courseTypeAnalytics[course.courseType].revenue +=
                  course.paidPrice || 0;
                courseTypeAnalytics[course.courseType].count += 1;
              }
            });
          }

          // Promo code usage
          if (transaction.promoCode && transaction.promoCode.code) {
            const code = transaction.promoCode.code;
            if (!promoCodeUsage[code]) {
              promoCodeUsage[code] = { uses: 0, discount: 0 };
            }
            promoCodeUsage[code].uses += 1;
            promoCodeUsage[code].discount += transaction.discountAmount || 0;
          }
        });
      }
    });

    // Sort transactions by date (newest first)
    transactions.sort(
      (a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)
    );

    // Generate report based on format
    switch (format) {
      case "csv":
        await generateCSVReport(res, transactions, {
          startDate,
          endDate,
          totalRevenue,
          totalDiscounts,
          totalTransactions,
        });
        break;

      case "excel":
        await generateExcelReport(res, transactions, {
          startDate,
          endDate,
          totalRevenue,
          totalDiscounts,
          totalTransactions,
          courseTypeAnalytics,
          paymentMethodAnalytics,
          monthlyRevenue,
          promoCodeUsage,
        });
        break;

      case "pdf":
        await generatePDFReport(res, transactions, {
          startDate,
          endDate,
          totalRevenue,
          totalDiscounts,
          totalTransactions,
          courseTypeAnalytics,
          paymentMethodAnalytics,
          monthlyRevenue,
          promoCodeUsage,
        });
        break;

      case "json":
      default:
        res.json({
          reportDate: new Date(),
          dateRange: { startDate, endDate },
          summary: {
            totalTransactions,
            totalRevenue,
            totalDiscounts,
            averageTransactionValue:
              totalTransactions > 0
                ? (totalRevenue / totalTransactions).toFixed(2)
                : 0,
          },
          analytics: {
            courseTypeAnalytics,
            paymentMethodAnalytics,
            monthlyRevenue,
            promoCodeUsage,
          },
          transactions: transactions,
        });
    }
  } catch (err) {
    console.error("❌ Error exporting financial report:", err);
    res
      .status(500)
      .json({ error: "Error generating report", message: err.message });
  }
};

// Generate CSV Report
async function generateCSVReport(res, transactions, summary) {
  let csv = "IAAI Financial Report\n";
  csv += `Generated on: ${new Date().toLocaleString()}\n`;
  csv += `Period: ${summary.startDate || "All Time"} to ${
    summary.endDate || "Present"
  }\n\n`;

  csv += "SUMMARY\n";
  csv += `Total Revenue,$${summary.totalRevenue.toFixed(2)}\n`;
  csv += `Total Discounts,$${summary.totalDiscounts.toFixed(2)}\n`;
  csv += `Total Transactions,${summary.totalTransactions}\n`;
  csv += `Average Transaction Value,$${(
    summary.totalRevenue / summary.totalTransactions
  ).toFixed(2)}\n\n`;

  csv += "TRANSACTION DETAILS\n";
  csv +=
    "Date,Time,Receipt Number,User Name,Email,Phone,Payment Method,Courses,Subtotal,Discount,Final Amount,Promo Code\n";

  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);
    const courses = t.coursesRegistered
      ? t.coursesRegistered
          .map((c) => `${c.courseCode}-${c.courseTitle}`)
          .join("; ")
      : "";
    const promoCode = t.promoCode ? t.promoCode.code : "None";

    csv += `"${date.toLocaleDateString()}","${date.toLocaleTimeString()}","${
      t.receiptNumber
    }","${t.userName}","${t.userEmail}","${t.userPhone}","${
      t.paymentMethod
    }","${courses}","$${t.subtotal}","$${t.discountAmount || 0}","$${
      t.finalAmount
    }","${promoCode}"\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="financial-report.csv"'
  );
  res.send(csv);
}

// Generate Excel Report with multiple sheets
async function generateExcelReport(res, transactions, data) {
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = "IAAI Admin System";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: "28a745" } },
  });

  // Add logo/header
  summarySheet.mergeCells("A1:E1");
  summarySheet.getCell("A1").value = "IAAI Financial Report";
  summarySheet.getCell("A1").font = { name: "Arial", size: 20, bold: true };
  summarySheet.getCell("A1").alignment = { horizontal: "center" };

  summarySheet.mergeCells("A2:E2");
  summarySheet.getCell(
    "A2"
  ).value = `Generated on: ${new Date().toLocaleString()}`;
  summarySheet.getCell("A2").alignment = { horizontal: "center" };

  summarySheet.mergeCells("A3:E3");
  summarySheet.getCell("A3").value = `Period: ${
    data.startDate || "All Time"
  } to ${data.endDate || "Present"}`;
  summarySheet.getCell("A3").alignment = { horizontal: "center" };

  // Summary data
  summarySheet.addRow([]);
  summarySheet.addRow(["Summary Metrics", "", "", "", ""]);
  summarySheet.addRow(["Metric", "Value"]);
  summarySheet.addRow(["Total Revenue", data.totalRevenue]);
  summarySheet.addRow(["Total Discounts", data.totalDiscounts]);
  summarySheet.addRow(["Total Transactions", data.totalTransactions]);
  summarySheet.addRow([
    "Average Transaction Value",
    (data.totalRevenue / data.totalTransactions).toFixed(2),
  ]);

  // Format summary
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;
  summarySheet.getCell("B7").numFmt = "$#,##0.00";
  summarySheet.getCell("B8").numFmt = "$#,##0.00";
  summarySheet.getCell("B10").numFmt = "$#,##0.00";

  // Sheet 2: Transactions
  const transSheet = workbook.addWorksheet("Transactions", {
    properties: { tabColor: { argb: "007bff" } },
  });

  // Add headers
  const headers = [
    "Date",
    "Time",
    "Receipt #",
    "User Name",
    "Email",
    "Phone",
    "Payment Method",
    "Course Code",
    "Course Title",
    "Course Type",
    "Subtotal",
    "Discount",
    "Final Amount",
    "Promo Code",
  ];

  transSheet.addRow(headers);

  // Style headers
  transSheet.getRow(1).font = { bold: true };
  transSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E9ECEF" },
  };

  // Add transaction data
  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);

    if (t.coursesRegistered && t.coursesRegistered.length > 0) {
      t.coursesRegistered.forEach((course) => {
        transSheet.addRow([
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          t.receiptNumber,
          t.userName,
          t.userEmail,
          t.userPhone,
          t.paymentMethod,
          course.courseCode,
          course.courseTitle,
          course.courseType,
          t.subtotal,
          t.discountAmount || 0,
          t.finalAmount,
          t.promoCode ? t.promoCode.code : "None",
        ]);
      });
    } else {
      transSheet.addRow([
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        t.receiptNumber,
        t.userName,
        t.userEmail,
        t.userPhone,
        t.paymentMethod,
        "N/A",
        "N/A",
        "N/A",
        t.subtotal,
        t.discountAmount || 0,
        t.finalAmount,
        t.promoCode ? t.promoCode.code : "None",
      ]);
    }
  });

  // Format columns
  transSheet.getColumn(11).numFmt = "$#,##0.00"; // Subtotal
  transSheet.getColumn(12).numFmt = "$#,##0.00"; // Discount
  transSheet.getColumn(13).numFmt = "$#,##0.00"; // Final Amount

  // Auto-fit columns
  transSheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength;
  });

  // Sheet 3: Analytics
  const analyticsSheet = workbook.addWorksheet("Analytics", {
    properties: { tabColor: { argb: "ffc107" } },
  });

  analyticsSheet.addRow(["Course Type Analytics"]);
  analyticsSheet.addRow(["Course Type", "Revenue", "Enrollments"]);
  Object.entries(data.courseTypeAnalytics).forEach(([type, stats]) => {
    analyticsSheet.addRow([type, stats.revenue, stats.count]);
  });

  analyticsSheet.addRow([]);
  analyticsSheet.addRow(["Payment Method Analytics"]);
  analyticsSheet.addRow(["Payment Method", "Revenue", "Transaction Count"]);
  Object.entries(data.paymentMethodAnalytics).forEach(([method, stats]) => {
    analyticsSheet.addRow([method, stats.revenue, stats.count]);
  });

  analyticsSheet.addRow([]);
  analyticsSheet.addRow(["Promo Code Usage"]);
  analyticsSheet.addRow(["Promo Code", "Times Used", "Total Discount Given"]);
  Object.entries(data.promoCodeUsage).forEach(([code, stats]) => {
    analyticsSheet.addRow([code, stats.uses, stats.discount]);
  });

  // Format analytics sheet
  analyticsSheet.getColumn(2).numFmt = "$#,##0.00";
  analyticsSheet.getColumn(3).numFmt = "$#,##0.00";

  // Sheet 4: Monthly Trends
  const trendsSheet = workbook.addWorksheet("Monthly Trends", {
    properties: { tabColor: { argb: "dc3545" } },
  });

  trendsSheet.addRow(["Monthly Revenue Trends"]);
  trendsSheet.addRow(["Month", "Revenue"]);
  Object.entries(data.monthlyRevenue).forEach(([month, revenue]) => {
    trendsSheet.addRow([month, revenue]);
  });

  trendsSheet.getColumn(2).numFmt = "$#,##0.00";

  // Generate and send file
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="financial-report.xlsx"'
  );

  await workbook.xlsx.write(res);
  res.end();
}

// Generate PDF Report
async function generatePDFReport(res, transactions, data) {
  try {
    // Create HTML template for PDF
    const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    border-radius: 10px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                }
                .header p {
                    margin: 5px 0;
                }
                .summary {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                }
                .summary h2 {
                    color: #28a745;
                    margin-bottom: 15px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                .summary-item {
                    padding: 15px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .summary-label {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 5px;
                }
                .summary-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                }
                .section {
                    margin-bottom: 30px;
                }
                .section h2 {
                    color: #333;
                    border-bottom: 2px solid #28a745;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th {
                    background: #28a745;
                    color: white;
                    padding: 12px;
                    text-align: left;
                    font-weight: bold;
                }
                td {
                    padding: 10px;
                    border-bottom: 1px solid #e9ecef;
                }
                tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .footer {
                    text-align: center;
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 2px solid #e9ecef;
                    color: #666;
                    font-size: 12px;
                }
                .page-break {
                    page-break-after: always;
                }
                @media print {
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>IAAI Financial Report</h1>
                <p>Generated on: ${new Date().toLocaleString()}</p>
                <p>Period: ${data.startDate || "All Time"} to ${
      data.endDate || "Present"
    }</p>
            </div>
            
            <div class="summary">
                <h2>Executive Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Revenue</div>
                        <div class="summary-value">$${data.totalRevenue.toFixed(
                          2
                        )}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Transactions</div>
                        <div class="summary-value">${
                          data.totalTransactions
                        }</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Discounts</div>
                        <div class="summary-value">$${data.totalDiscounts.toFixed(
                          2
                        )}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Average Transaction</div>
                        <div class="summary-value">$${(
                          data.totalRevenue / data.totalTransactions
                        ).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Revenue by Course Type</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Course Type</th>
                            <th>Revenue</th>
                            <th>Enrollments</th>
                            <th>Average Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.courseTypeAnalytics)
                          .map(
                            ([type, stats]) => `
                            <tr>
                                <td>${type}</td>
                                <td>$${stats.revenue.toFixed(2)}</td>
                                <td>${stats.count}</td>
                                <td>$${
                                  stats.count > 0
                                    ? (stats.revenue / stats.count).toFixed(2)
                                    : "0.00"
                                }</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>Payment Method Distribution</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Payment Method</th>
                            <th>Revenue</th>
                            <th>Transaction Count</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.paymentMethodAnalytics)
                          .map(
                            ([method, stats]) => `
                            <tr>
                                <td>${method}</td>
                                <td>$${stats.revenue.toFixed(2)}</td>
                                <td>${stats.count}</td>
                                <td>${(
                                  (stats.revenue / data.totalRevenue) *
                                  100
                                ).toFixed(1)}%</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="page-break"></div>
            
            <div class="section">
                <h2>Recent Transactions (Top 10)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Receipt #</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions
                          .slice(0, 10)
                          .map(
                            (t) => `
                            <tr>
                                <td>${new Date(
                                  t.transactionDate
                                ).toLocaleDateString()}</td>
                                <td>${t.receiptNumber}</td>
                                <td>${t.userName}</td>
                                <td>$${t.finalAmount.toFixed(2)}</td>
                                <td>${t.paymentMethod}</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="footer">
                <p>This report is confidential and proprietary to IAAI Training Institute</p>
                <p>© ${new Date().getFullYear()} International Aesthetic Academic Institution. All rights reserved.</p>
            </div>
        </body>
        </html>
        `;

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="financial-report.pdf"'
    );
    res.send(pdf);
  } catch (err) {
    console.error("❌ Error generating PDF:", err);

    // Fallback to HTML if PDF generation fails
    res.status(500).json({
      error: "PDF generation failed",
      message: "Please try CSV or Excel format instead",
      details: err.message,
    });
  }
}

// ✅ Get User Details (for viewing specific user with ALL information)
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const userDetails = await User.findById(userId)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId")
      .lean();

    if (!userDetails) {
      req.flash("error", "User not found");
      return res.redirect("/admin-users");
    }

    // Process user data similar to getAllUsers but with MORE detail
    const allCourses = [];
    const wishlistCourses = [];

    // Process In-Person Courses with detailed enrollment info
    if (
      userDetails.myInPersonCourses &&
      userDetails.myInPersonCourses.length > 0
    ) {
      userDetails.myInPersonCourses.forEach((course) => {
        const courseData = {
          ...course,
          courseType: "In-Person",
          courseTitle: course.courseId ? course.courseId.title : course.title,
          // Add enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate: course.enrollmentData?.registrationDate,
          paidAmount: course.enrollmentData?.paidAmount,
          promoCodeUsed: course.enrollmentData?.promoCodeUsed,
          // Add progress details
          attendancePercentage:
            course.userProgress?.overallAttendancePercentage || 0,
          courseStatus: course.userProgress?.courseStatus || "not-started",
          completionDate: course.userProgress?.completionDate,
          assessmentScore: course.userProgress?.assessmentScore,
          certificateId: course.certificateId,
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }

    // Process Online Live Courses with detailed info
    if (userDetails.myLiveCourses && userDetails.myLiveCourses.length > 0) {
      userDetails.myLiveCourses.forEach((course) => {
        const courseData = {
          ...course,
          courseType: "Online Live",
          courseTitle: course.courseId ? course.courseId.title : course.title,
          // Add enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate: course.enrollmentData?.registrationDate,
          paidAmount: course.enrollmentData?.paidAmount,
          promoCodeUsed: course.enrollmentData?.promoCodeUsed,
          // Add progress details
          attendancePercentage:
            course.userProgress?.overallAttendancePercentage || 0,
          courseStatus: course.userProgress?.courseStatus || "not-started",
          completionDate: course.userProgress?.completionDate,
          assessmentScore:
            course.userProgress?.bestAssessmentScore || course.assessmentScore,
          certificateId: course.certificateId,
          // Add online-specific details
          sessionsAttended: course.userProgress?.sessionsAttended?.length || 0,
          recordingsWatched:
            course.userProgress?.recordingsWatched?.length || 0,
          assessmentAttempts: course.assessmentAttempts?.length || 0,
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }

    // Process Self-Paced Courses with detailed progress
    if (
      userDetails.mySelfPacedCourses &&
      userDetails.mySelfPacedCourses.length > 0
    ) {
      userDetails.mySelfPacedCourses.forEach((course) => {
        const courseData = {
          ...course,
          courseType: "Self-Paced",
          courseTitle: course.courseId ? course.courseId.title : course.title,
          // Add enrollment details
          enrollmentStatus: course.enrollmentData?.status || "unknown",
          registrationDate: course.enrollmentData?.registrationDate,
          expiryDate: course.enrollmentData?.expiryDate,
          paidAmount: course.enrollmentData?.paidAmount,
          promoCodeUsed: course.enrollmentData?.promoCodeUsed,
          // Add progress details
          overallPercentage: course.courseProgress?.overallPercentage || 0,
          courseStatus: course.courseProgress?.status || "not-started",
          completionDate: course.courseProgress?.completionDate,
          lastAccessedAt: course.courseProgress?.lastAccessedAt,
          totalWatchTime: course.courseProgress?.totalWatchTime || 0,
          averageExamScore: course.courseProgress?.averageExamScore || 0,
          certificateId: course.certificateId,
          // Add self-paced specific details
          completedVideos: course.courseProgress?.completedVideos?.length || 0,
          completedExams: course.courseProgress?.completedExams?.length || 0,
          totalVideos: course.courseId?.videos?.length || 0,
          videoNotes: course.videoNotes?.length || 0,
          bookmarks: course.bookmarks?.length || 0,
        };
        allCourses.push(courseData);

        if (course.wishlistStatus === 1) {
          wishlistCourses.push(courseData);
        }
      });
    }

    // Calculate comprehensive user statistics
    const userStats = {
      totalSpent: userDetails.paymentTransactions
        ? userDetails.paymentTransactions
            .filter((t) => t.paymentStatus === "completed")
            .reduce((sum, t) => sum + (t.finalAmount || 0), 0)
        : 0,
      totalTransactions: userDetails.paymentTransactions
        ? userDetails.paymentTransactions.filter(
            (t) => t.paymentStatus === "completed"
          ).length
        : 0,
      totalCourses: allCourses.length,
      completedCourses: allCourses.filter(
        (c) => c.courseStatus === "completed" || c.completionDate
      ).length,
      inProgressCourses: allCourses.filter(
        (c) => c.courseStatus === "in-progress"
      ).length,
      certificatesEarned: userDetails.myCertificates
        ? userDetails.myCertificates.length
        : 0,
      averageProgress:
        allCourses.length > 0
          ? Math.round(
              allCourses.reduce(
                (sum, c) =>
                  sum + (c.overallPercentage || c.attendancePercentage || 0),
                0
              ) / allCourses.length
            )
          : 0,
    };

    // Process professional information with detailed breakdown
    const professionalInfo = {
      basic: {
        title: userDetails.professionalInfo?.title || "Not specified",
        fieldOfStudy:
          userDetails.professionalInfo?.fieldOfStudy || "Not specified",
        specialty: userDetails.professionalInfo?.specialty || "Not specified",
        aestheticsExperience:
          userDetails.professionalInfo?.aestheticsExperience || "Not specified",
        yearsOfExperience:
          userDetails.professionalInfo?.yearsOfExperience || "Not specified",
        currentWorkplace:
          userDetails.professionalInfo?.currentWorkplace || "Not specified",
        trainingGoals:
          userDetails.professionalInfo?.trainingGoals || "Not specified",
      },
      license: {
        hasLicense:
          userDetails.professionalInfo?.licenseInfo?.hasLicense || false,
        licenseNumber:
          userDetails.professionalInfo?.licenseInfo?.licenseNumber ||
          "Not provided",
        licenseState:
          userDetails.professionalInfo?.licenseInfo?.licenseState ||
          "Not provided",
        licenseCountry:
          userDetails.professionalInfo?.licenseInfo?.licenseCountry ||
          "Not provided",
      },
      interests: userDetails.professionalInfo?.areasOfInterest || [],
    };

    // Process profile and documentation
    const profileInfo = {
      profilePicture: userDetails.profileData?.profilePicture || null,
      identificationDocument:
        userDetails.profileData?.identificationDocument || null,
      professionalDocuments:
        userDetails.profileData?.professionalDocuments || [],
      completionStatus: userDetails.profileData?.completionStatus || {
        basicInfo: false,
        professionalInfo: false,
        profilePicture: false,
        identificationDocument: false,
        overallPercentage: 0,
      },
    };

    // Process learning preferences and settings
    const userPreferences = {
      library: userDetails.libraryPreferences || {},
      learning: userDetails.learningPreferences || {},
      notifications: userDetails.notificationSettings || {},
    };

    // Process account status and security
    const accountInfo = {
      status: userDetails.accountStatus || {},
      twoFactorAuth: userDetails.twoFactorAuth || { enabled: false },
      loginActivity: userDetails.loginActivity || [],
    };

    res.render("admin-user-details", {
      userDetails: {
        ...userDetails,
        myCourses: allCourses,
        myWishlist: wishlistCourses,
        userStats: userStats,
        professionalInfo: professionalInfo,
        profileInfo: profileInfo,
        userPreferences: userPreferences,
        accountInfo: accountInfo,
      },
      user: req.user,
    });
  } catch (err) {
    console.error("❌ Error fetching user details:", err);
    req.flash("error", "Error fetching user details");
    res.redirect("/admin-users");
  }
};

// ✅ Approve User - FIXED EMAIL_FROM
exports.approveUser = async (req, res) => {
  try {
    const {
      userId,
      sendEmail: shouldSendEmail,
      emailSubject,
      emailContent,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isConfirmed: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`✅ User ${user.email} approved successfully`);

    if (shouldSendEmail !== false) {
      try {
        const subject =
          emailSubject || "Welcome to IAAI Training - Account Approved! 🎉";

        const htmlContent = emailContent
          ? `<!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: #1a365d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>IAAI Training Institute</h1>
                </div>
                <div class="content">
                  <h2>${subject}</h2>
                  <div style="white-space: pre-wrap;">${emailContent.replace(
                    /\n/g,
                    "<br>"
                  )}</div>
                </div>
              </div>
            </body>
            </html>`
          : `<!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: #1a365d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to IAAI Training Institute!</h1>
                </div>
                <div class="content">
                  <h2>Hello ${user.firstName} ${user.lastName}!</h2>
                  <p>Great news! Your account has been successfully approved.</p>
                  <p>You can now access all features of the IAAI Training platform:</p>
                  <ul>
                    <li>Browse and enroll in courses</li>
                    <li>Access training materials</li>
                    <li>Track your progress</li>
                    <li>Earn certificates</li>
                  </ul>
                  <center>
                    <a href="${req.protocol}://${req.get(
              "host"
            )}/login" class="button">Login to Your Account</a>
                  </center>
                  <p>If you have any questions, please contact our support team.</p>
                  <p>Best regards,<br>IAAI Training Team</p>
                </div>
              </div>
            </body>
            </html>`;

        await sendEmail({
          to: user.email,
          subject: subject,
          html: htmlContent,
        });

        return res.json({
          success: true,
          message: "✅ User Approved Successfully! Welcome email sent.",
          emailSent: true,
        });
      } catch (emailError) {
        console.error("❌ Error sending approval email:", emailError);
        return res.json({
          success: true,
          message:
            "✅ User Approved Successfully! (Note: Email notification failed)",
          emailSent: false,
          emailError: emailError.message,
        });
      }
    } else {
      return res.json({
        success: true,
        message: "✅ User Approved Successfully!",
        emailSent: false,
      });
    }
  } catch (err) {
    console.error("❌ Error approving user:", err);
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: err.message,
    });
  }
};

// ✅ Reject User - FIXED EMAIL_FROM
exports.rejectUser = async (req, res) => {
  try {
    const { userId, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const deletedUserRecord = new DeletedUser({
      originalUserId: user._id,
      userData: user.toObject(),
      deletedBy: {
        userId: req.user._id,
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`,
      },
      deletionReason: reason || "No reason provided",
    });

    await deletedUserRecord.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "IAAI Training - Account Application Update",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
              .reason-box { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Account Application Update</h1>
              </div>
              <div class="content">
                <h2>Hello ${user.firstName} ${user.lastName},</h2>
                <p>Thank you for your interest in IAAI Training Institute. After careful review, we regret to inform you that we are unable to approve your account at this time.</p>
                ${
                  reason
                    ? `
                  <div class="reason-box">
                    <h3 style="margin-top: 0; color: #dc3545;">Reason:</h3>
                    <p style="margin: 0;">${reason}</p>
                  </div>
                `
                    : ""
                }
                <h3>What You Can Do:</h3>
                <ul>
                  <li>Review the reason provided above</li>
                  <li>If you believe this is an error, please contact our support team</li>
                  <li>You may reapply after addressing the concerns mentioned</li>
                </ul>
                <p><strong>Need Assistance?</strong><br>
                If you have questions or would like to discuss this decision, please contact us at <a href="mailto:${
                  process.env.EMAIL_FROM
                }">${process.env.EMAIL_FROM}</a></p>
                <p>We appreciate your understanding and wish you the best in your professional journey.</p>
                <div class="footer">
                  <p>Best regards,<br>IAAI Training Institute Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message. Please do not reply to this email.<br>
                    © ${new Date().getFullYear()} IAAI Training Institute. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`✅ Rejection email sent to ${user.email}`);
    } catch (emailError) {
      console.error("❌ Error sending rejection email:", emailError);
    }

    await User.findByIdAndDelete(userId);

    console.log(`✅ User ${user.email} moved to recycle bin`);
    res.json({
      success: true,
      message:
        "✅ User rejected and moved to recycle bin. Notification email sent.",
    });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: err.message,
    });
  }
};

// ✅ View Recycle Bin
exports.getRecycleBin = async (req, res) => {
  try {
    const deletedUsers = await DeletedUser.find({ isRecovered: false })
      .sort({ deletedAt: -1 })
      .lean();

    res.render("admin-recycle-bin", {
      deletedUsers,
      user: req.user,
    });
  } catch (err) {
    console.error("❌ Error fetching recycle bin:", err);
    req.flash("error", "Error loading recycle bin");
    res.redirect("/admin-users");
  }
};

// ✅ Recover Deleted User
exports.recoverUser = async (req, res) => {
  try {
    const { deletedUserId } = req.params;

    const deletedUserRecord = await DeletedUser.findById(deletedUserId);
    if (!deletedUserRecord) {
      return res.status(404).json({
        success: false,
        message: "Deleted user record not found",
      });
    }

    if (deletedUserRecord.isRecovered) {
      return res.status(400).json({
        success: false,
        message: "User has already been recovered",
      });
    }

    const userData = deletedUserRecord.userData;
    delete userData._id;

    const restoredUser = new User(userData);
    await restoredUser.save();

    deletedUserRecord.isRecovered = true;
    deletedUserRecord.recoveredBy = {
      userId: req.user._id,
      email: req.user.email,
      name: `${req.user.firstName} ${req.user.lastName}`,
    };
    deletedUserRecord.recoveredAt = new Date();
    await deletedUserRecord.save();

    console.log(`✅ User ${userData.email} recovered successfully`);
    res.json({
      success: true,
      message: "✅ User recovered successfully!",
    });
  } catch (err) {
    console.error("❌ Error recovering user:", err);
    res.status(500).json({
      success: false,
      message: "Error recovering user",
    });
  }
};

// ✅ Permanently Delete User
exports.permanentlyDeleteUser = async (req, res) => {
  try {
    const { deletedUserId } = req.params;

    const result = await DeletedUser.findByIdAndDelete(deletedUserId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Deleted user record not found",
      });
    }

    console.log(`✅ User permanently deleted from recycle bin`);
    res.json({
      success: true,
      message: "✅ User permanently deleted!",
    });
  } catch (err) {
    console.error("❌ Error permanently deleting user:", err);
    res.status(500).json({
      success: false,
      message: "Error permanently deleting user",
    });
  }
};

// ✅ Update User Role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "admin", "instructor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user,
    });
  } catch (err) {
    console.error("❌ Error updating user role:", err);
    res.status(500).json({
      success: false,
      message: "Error updating user role",
    });
  }
};

// ✅ Reset User Password - FIXED EMAIL_FROM
exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request - IAAI Training",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a365d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 14px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
              .warning { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <h2>Hello ${user.firstName} ${user.lastName},</h2>
                <p>We received a request to reset your password for your IAAI Training account.</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Your Password</a>
                </div>
                <div class="warning">
                  <p style="margin: 0;"><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
                </div>
                <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
                <p>For security reasons, we recommend that you:</p>
                <ul>
                  <li>Use a strong, unique password</li>
                  <li>Never share your password with anyone</li>
                  <li>Enable two-factor authentication if available</li>
                </ul>
                <div class="footer">
                  <p>Best regards,<br>IAAI Training Security Team</p>
                  <p style="font-size: 12px;">
                    This is an automated security message. Please do not reply to this email.<br>
                    © ${new Date().getFullYear()} IAAI Training Institute. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`✅ Password reset email sent to ${user.email}`);

      res.json({
        success: true,
        message: "Password reset email sent successfully!",
      });
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      console.error("❌ Error sending reset email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Error sending reset email",
        error: emailError.message,
      });
    }
  } catch (err) {
    console.error("❌ Error resetting password:", err);
    res.status(500).json({
      success: false,
      message: "Error processing password reset",
    });
  }
};

// ✅ Export User Data (CSV/JSON)
exports.exportUserData = async (req, res) => {
  try {
    const { format = "csv" } = req.query;

    const users = await User.find()
      .populate("myInPersonCourses.courseId", "title courseCode")
      .populate("myLiveCourses.courseId", "title courseCode")
      .populate("mySelfPacedCourses.courseId", "title courseCode")
      .lean();

    const processedUsers = users.map((user) => {
      const totalSpent = user.paymentTransactions
        ? user.paymentTransactions
            .filter((t) => t.paymentStatus === "completed")
            .reduce((sum, t) => sum + (t.finalAmount || 0), 0)
        : 0;

      const totalCourses =
        (user.myInPersonCourses?.length || 0) +
        (user.myLiveCourses?.length || 0) +
        (user.mySelfPacedCourses?.length || 0);

      return {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber || "",
        country: user.country || "",
        profession: user.profession || "",
        role: user.role,
        isConfirmed: user.isConfirmed,
        totalCourses,
        totalSpent,
        registrationDate: user.createdAt,
        lastLogin: user.accountStatus?.lastLoginAt || "",
        paymentMethods: user.paymentTransactions?.length || 0,
      };
    });

    if (format === "csv") {
      const csvHeader =
        "First Name,Last Name,Email,Phone,Country,Profession,Role,Confirmed,Total Courses,Total Spent,Registration Date,Last Login,Payment Count\n";

      const csvData = processedUsers
        .map(
          (user) =>
            `"${user.firstName}","${user.lastName}","${user.email}","${
              user.phoneNumber
            }","${user.country}","${user.profession}","${user.role}","${
              user.isConfirmed
            }","${user.totalCourses}","${user.totalSpent.toFixed(
              2
            )}","${new Date(user.registrationDate).toLocaleDateString()}","${
              user.lastLogin
                ? new Date(user.lastLogin).toLocaleDateString()
                : ""
            }","${user.paymentMethods}"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="users-export.csv"'
      );
      res.send(csvHeader + csvData);
    } else {
      res.json({
        exportDate: new Date(),
        totalUsers: processedUsers.length,
        totalRevenue: processedUsers.reduce((sum, u) => sum + u.totalSpent, 0),
        users: processedUsers,
      });
    }
  } catch (err) {
    console.error("❌ Error exporting user data:", err);
    res.status(500).json({
      error: "Error exporting user data",
      message: err.message,
    });
  }
};

// ✅ API endpoint for recent transactions (for AJAX calls)
exports.getRecentTransactions = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const users = await User.find({
      "paymentTransactions.0": { $exists: true },
    })
      .select("firstName lastName email paymentTransactions")
      .lean();

    const allTransactions = [];

    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          allTransactions.push({
            ...transaction,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userId: user._id,
          });
        });
      }
    });

    allTransactions.sort(
      (a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)
    );

    const paginatedTransactions = allTransactions.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    res.json(paginatedTransactions);
  } catch (err) {
    console.error("❌ Error fetching recent transactions:", err);
    res.status(500).json({ error: "Error fetching transactions" });
  }
};

// ✅ API endpoint for single transaction details
exports.getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const user = await User.findOne({
      "paymentTransactions.transactionId": transactionId,
    })
      .select("firstName lastName email paymentTransactions")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = user.paymentTransactions.find(
      (t) => t.transactionId === transactionId
    );

    res.json({
      ...transaction,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
    });
  } catch (err) {
    console.error("❌ Error fetching transaction details:", err);
    res.status(500).json({ error: "Error fetching transaction details" });
  }
};

// ✅ Enhanced Payment Analytics with Filters
exports.getFilteredAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, courseType, paymentType } = req.query;

    const filters = {};

    if (startDate || endDate) {
      filters["paymentTransactions.transactionDate"] = {};
      if (startDate) {
        filters["paymentTransactions.transactionDate"].$gte = new Date(
          startDate
        );
      }
      if (endDate) {
        filters["paymentTransactions.transactionDate"].$lte = new Date(endDate);
      }
    }

    const users = await User.find(filters)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId")
      .lean();

    let filteredRevenue = 0;
    let filteredTransactions = [];
    const courseTypeBreakdown = {
      "In-Person": { revenue: 0, count: 0 },
      "Online Live": { revenue: 0, count: 0 },
      "Self-Paced": { revenue: 0, count: 0 },
    };

    users.forEach((user) => {
      if (user.paymentTransactions) {
        user.paymentTransactions.forEach((transaction) => {
          if (transaction.paymentStatus === "completed") {
            const transDate = new Date(transaction.transactionDate);
            if (startDate && transDate < new Date(startDate)) return;
            if (endDate && transDate > new Date(endDate)) return;

            if (paymentType !== "all") {
              if (paymentType === "early-bird" && !transaction.earlyBird)
                return;
              if (paymentType === "promo" && !transaction.promoCode) return;
              if (
                paymentType === "full-price" &&
                (transaction.promoCode || transaction.earlyBird)
              )
                return;
            }

            filteredRevenue += transaction.finalAmount || 0;
            filteredTransactions.push({
              ...transaction,
              userName: `${user.firstName} ${user.lastName}`,
              userEmail: user.email,
            });

            if (transaction.coursesRegistered) {
              transaction.coursesRegistered.forEach((course) => {
                if (courseType === "all" || course.courseType === courseType) {
                  if (courseTypeBreakdown[course.courseType]) {
                    courseTypeBreakdown[course.courseType].revenue +=
                      course.paidPrice || 0;
                    courseTypeBreakdown[course.courseType].count += 1;
                  }
                }
              });
            }
          }
        });
      }
    });

    res.json({
      filteredRevenue,
      transactionCount: filteredTransactions.length,
      courseTypeBreakdown,
      topTransactions: filteredTransactions
        .sort((a, b) => b.finalAmount - a.finalAmount)
        .slice(0, 10),
    });
  } catch (err) {
    console.error("❌ Error fetching filtered analytics:", err);
    res.status(500).json({ error: "Error fetching analytics" });
  }
};

// ✅ Remove Course from User
// ✅ Remove Course from User - COMPLETE FIX
exports.removeCourseFromUser = async (req, res) => {
  try {
    console.log("🗑️ DELETE REQUEST PARAMS:", req.params);
    console.log("🗑️ DELETE REQUEST BODY:", req.body);

    const { userId, enrollmentId, courseType: rawCourseType } = req.params;
    const { reason } = req.body;

    // Helper function to normalize course type
    const normalizeCourseType = (type) => {
      const typeMap = {
        "in-person": "InPersonAestheticTraining",
        "In-Person": "InPersonAestheticTraining",
        InPersonAestheticTraining: "InPersonAestheticTraining",
        "online-live": "OnlineLiveTraining",
        "Online Live": "OnlineLiveTraining",
        OnlineLiveTraining: "OnlineLiveTraining",
        "self-paced": "SelfPacedOnlineTraining",
        "Self-Paced": "SelfPacedOnlineTraining",
        SelfPacedOnlineTraining: "SelfPacedOnlineTraining",
      };
      return typeMap[type] || type;
    };

    // Normalize course type
    const courseType = normalizeCourseType(rawCourseType);
    console.log("📝 Normalized course type:", courseType);

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let enrollment = null;
    let courseArray = null;
    let courseArrayName = "";

    // Find the enrollment based on course type
    switch (courseType) {
      case "InPersonAestheticTraining":
        courseArray = user.myInPersonCourses;
        courseArrayName = "myInPersonCourses";
        enrollment = courseArray.find(
          (e) => e._id.toString() === enrollmentId.toString()
        );
        break;
      case "OnlineLiveTraining":
        courseArray = user.myLiveCourses;
        courseArrayName = "myLiveCourses";
        enrollment = courseArray.find(
          (e) => e._id.toString() === enrollmentId.toString()
        );
        break;
      case "SelfPacedOnlineTraining":
        courseArray = user.mySelfPacedCourses;
        courseArrayName = "mySelfPacedCourses";
        enrollment = courseArray.find(
          (e) => e._id.toString() === enrollmentId.toString()
        );
        break;
      default:
        console.error("❌ Invalid course type:", courseType);
        return res
          .status(400)
          .json({
            success: false,
            message: "Invalid course type: " + courseType,
          });
    }

    console.log("🔍 Found enrollment:", !!enrollment);
    console.log(
      "📚 Course array length:",
      courseArray ? courseArray.length : 0
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Course enrollment not found",
        debug: {
          userId,
          enrollmentId,
          courseType,
          availableEnrollments: courseArray
            ? courseArray.map((e) => e._id.toString())
            : [],
        },
      });
    }

    // Create deleted course record
    const deletedCourse = new DeletedCourse({
      originalEnrollmentId: enrollmentId,
      userId: userId,
      courseData: {
        courseId: enrollment.courseId,
        courseType: courseType,
        courseName:
          enrollment.enrollmentData?.courseName ||
          enrollment.courseName ||
          enrollment.courseTitle ||
          "Unknown Course",
        courseCode:
          enrollment.enrollmentData?.courseCode ||
          enrollment.courseCode ||
          "N/A",
        enrollmentData: enrollment.enrollmentData,
        userProgress: enrollment.userProgress || enrollment.courseProgress,
        assessmentData: {
          assessmentCompleted: enrollment.assessmentCompleted,
          assessmentScore: enrollment.assessmentScore,
          bestAssessmentScore: enrollment.bestAssessmentScore,
        },
      },
      deletedBy: {
        adminId: req.user._id,
        adminName: `${req.user.firstName} ${req.user.lastName}`,
        adminEmail: req.user.email,
      },
      deletionReason: reason || "Removed by admin",
    });

    await deletedCourse.save();
    console.log("💾 Saved to deleted course record");

    // Remove from user's course array using pull method
    user[courseArrayName].pull({ _id: enrollmentId });
    await user.save();

    console.log(
      `✅ Course ${enrollment.enrollmentData?.courseCode} removed from user ${user.email}`
    );

    res.json({
      success: true,
      message: "Course removed successfully and moved to recycle bin",
      removed: {
        courseCode: enrollment.enrollmentData?.courseCode,
        courseName: enrollment.enrollmentData?.courseName,
        enrollmentId: enrollmentId,
      },
    });
  } catch (error) {
    console.error("❌ Error removing course from user:", error);
    res.status(500).json({
      success: false,
      message: "Error removing course",
      error: error.message,
    });
  }
};

// ✅ Add Course to User
exports.addCourseToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { courseId, courseType } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Get course details
    let course = null;
    switch (courseType) {
      case "InPersonAestheticTraining":
        course = await InPersonAestheticTraining.findById(courseId);
        break;
      case "OnlineLiveTraining":
        course = await OnlineLiveTraining.findById(courseId);
        break;
      case "SelfPacedOnlineTraining":
        course = await SelfPacedOnlineTraining.findById(courseId);
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid course type" });
    }

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check if user already enrolled
    const existingEnrollment = user.getCourseEnrollment(courseId, courseType);
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "User already enrolled in this course",
      });
    }

    // Create enrollment object
    const enrollment = {
      courseId: courseId,
      enrollmentData: {
        status: "registered", // Admin added = registered status
        registrationDate: new Date(),
        courseName: course.basic?.title || course.title,
        courseCode: course.basic?.courseCode || course.courseCode,
        courseType: courseType,
        originalPrice: course.enrollment?.price || course.access?.price || 0,
        paidAmount: 0, // Admin added = no payment
        currency: "EUR",
        isLinkedCourse: false,
        isLinkedCourseFree: false,
      },
    };

    // Initialize progress tracking based on course type
    if (courseType === "InPersonAestheticTraining") {
      enrollment.userProgress = {
        attendanceRecords: [],
        overallAttendancePercentage: 0,
        assessmentAttempts: [],
        courseStatus: "not-started",
      };
      enrollment.assessmentCompleted = false;
      enrollment.assessmentScore = 0;
      enrollment.courseMaterials = {
        downloadedMaterials: [],
        sharedNotes: [],
        materialSummary: { totalDownloads: 0, uniqueMaterialsAccessed: 0 },
      };
      user.myInPersonCourses.push(enrollment);
    } else if (courseType === "OnlineLiveTraining") {
      enrollment.userProgress = {
        sessionsAttended: [],
        overallAttendancePercentage: 0,
        recordingsWatched: [],
        assessmentAttempts: [],
        courseStatus: "not-started",
      };
      enrollment.assessmentCompleted = false;
      enrollment.assessmentScore = 0;
      user.myLiveCourses.push(enrollment);
    } else if (courseType === "SelfPacedOnlineTraining") {
      enrollment.videoProgress = [];
      enrollment.examProgress = [];
      enrollment.courseProgress = {
        completedVideos: [],
        completedExams: [],
        overallPercentage: 0,
        totalWatchTime: 0,
        averageExamScore: 0,
        status: "not-started",
      };
      enrollment.videoNotes = [];
      enrollment.bookmarks = [];

      // Set expiry date for self-paced courses
      if (course.access?.accessDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + course.access.accessDays);
        enrollment.enrollmentData.expiryDate = expiryDate;
      }

      user.mySelfPacedCourses.push(enrollment);
    }

    await user.save();

    console.log(
      `✅ Course ${
        course.basic?.courseCode || course.courseCode
      } added to user ${user.email}`
    );

    res.json({
      success: true,
      message: `Course "${
        course.basic?.title || course.title
      }" added successfully`,
      enrollment: enrollment,
    });
  } catch (error) {
    console.error("❌ Error adding course to user:", error);
    res.status(500).json({ success: false, message: "Error adding course" });
  }
};

// ✅ Get Available Courses for Admin Selection
// ✅ Get Available Courses for Admin Selection - FIXED
exports.getAvailableCoursesForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Get all courses with broader query (remove isActive filter if not needed)
    const [inPersonCourses, liveCourses, selfPacedCourses] = await Promise.all([
      InPersonAestheticTraining.find({}) // ✅ REMOVE: isActive filter
        .select(
          "basic.title basic.courseCode schedule.startDate enrollment.price title courseCode" // ✅ ADD: fallback fields
        )
        .lean(),
      OnlineLiveTraining.find({})
        .select("basic schedule enrollment title courseCode") // Get the entire basic object
        .lean(),
      SelfPacedOnlineTraining.find({}) // ✅ REMOVE: isActive filter
        .select(
          "basic.title basic.courseCode access.price access.accessDays title courseCode"
        ) // ✅ ADD: fallback fields
        .lean(),
    ]);

    console.log("Found courses:", {
      inPerson: inPersonCourses.length,
      live: liveCourses.length,
      selfPaced: selfPacedCourses.length,
    }); // ✅ ADD: Debug logging

    // Filter out courses user is already enrolled in
    const userEnrollments = new Set();
    user.myInPersonCourses?.forEach((e) =>
      userEnrollments.add(`InPersonAestheticTraining-${e.courseId}`)
    );
    user.myLiveCourses?.forEach((e) =>
      userEnrollments.add(`OnlineLiveTraining-${e.courseId}`)
    );
    user.mySelfPacedCourses?.forEach((e) =>
      userEnrollments.add(`SelfPacedOnlineTraining-${e.courseId}`)
    );

    const availableCourses = [];

    // Process In-Person courses with fallback fields
    inPersonCourses.forEach((course) => {
      if (!userEnrollments.has(`InPersonAestheticTraining-${course._id}`)) {
        availableCourses.push({
          _id: course._id,
          title: course.basic?.title || course.title || "Untitled Course", // ✅ ADD: fallback
          courseCode: course.basic?.courseCode || course.courseCode || "N/A", // ✅ ADD: fallback
          courseType: "InPersonAestheticTraining",
          startDate: course.schedule?.startDate,
          price: course.enrollment?.price || 0,
          category: "In-Person Training",
        });
      }
    });

    // Process Online Live courses with fallback fields
    liveCourses.forEach((course) => {
      if (!userEnrollments.has(`OnlineLiveTraining-${course._id}`)) {
        availableCourses.push({
          _id: course._id,
          title: course.basic?.title || course.title || "Untitled Course", // ✅ ADD: fallback
          courseCode: course.basic?.courseCode || course.courseCode || "N/A", // ✅ ADD: fallback
          courseType: "OnlineLiveTraining",
          startDate: course.schedule?.startDate,
          price: course.enrollment?.price || 0,
          category: "Online Live Training",
        });
      }
    });

    // Process Self-Paced courses with fallback fields
    selfPacedCourses.forEach((course) => {
      if (!userEnrollments.has(`SelfPacedOnlineTraining-${course._id}`)) {
        availableCourses.push({
          _id: course._id,
          title: course.basic?.title || course.title || "Untitled Course", // ✅ ADD: fallback
          courseCode: course.basic?.courseCode || course.courseCode || "N/A", // ✅ ADD: fallback
          courseType: "SelfPacedOnlineTraining",
          accessDays: course.access?.accessDays || 365,
          price: course.access?.price || 0,
          category: "Self-Paced Training",
        });
      }
    });

    // Sort by category and title
    availableCourses.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.title.localeCompare(b.title);
    });

    console.log("Available courses after filtering:", availableCourses.length); // ✅ ADD: Debug logging

    res.json({
      success: true,
      courses: availableCourses,
    });
  } catch (error) {
    console.error("❌ Error getting available courses:", error);
    res.status(500).json({ success: false, message: "Error fetching courses" });
  }
};

// ✅ Get Deleted Courses (Recycle Bin for courses)
exports.getDeletedCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedCourses = await DeletedCourse.find({
      userId: userId,
      isRecovered: false,
    })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      deletedCourses: deletedCourses,
    });
  } catch (error) {
    console.error("❌ Error getting deleted courses:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching deleted courses" });
  }
};

// ✅ Recover Deleted Course
exports.recoverDeletedCourse = async (req, res) => {
  try {
    const { userId, deletedCourseId } = req.params;

    const deletedCourse = await DeletedCourse.findById(deletedCourseId);
    if (!deletedCourse || deletedCourse.userId.toString() !== userId) {
      return res
        .status(404)
        .json({ success: false, message: "Deleted course record not found" });
    }

    if (deletedCourse.isRecovered) {
      return res
        .status(400)
        .json({ success: false, message: "Course already recovered" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Recreate the enrollment
    const courseData = deletedCourse.courseData;
    const enrollment = {
      courseId: courseData.courseId,
      enrollmentData: courseData.enrollmentData,
      userProgress: courseData.userProgress,
      assessmentCompleted:
        courseData.assessmentData?.assessmentCompleted || false,
      assessmentScore: courseData.assessmentData?.assessmentScore || 0,
      bestAssessmentScore: courseData.assessmentData?.bestAssessmentScore || 0,
    };

    // Add to appropriate course array
    switch (courseData.courseType) {
      case "InPersonAestheticTraining":
        enrollment.courseMaterials = {
          downloadedMaterials: [],
          sharedNotes: [],
          materialSummary: { totalDownloads: 0, uniqueMaterialsAccessed: 0 },
        };
        user.myInPersonCourses.push(enrollment);
        break;
      case "OnlineLiveTraining":
        user.myLiveCourses.push(enrollment);
        break;
      case "SelfPacedOnlineTraining":
        enrollment.videoProgress = [];
        enrollment.examProgress = [];
        enrollment.courseProgress = courseData.userProgress || {
          completedVideos: [],
          completedExams: [],
          overallPercentage: 0,
          status: "not-started",
        };
        enrollment.videoNotes = [];
        enrollment.bookmarks = [];
        user.mySelfPacedCourses.push(enrollment);
        break;
    }

    await user.save();

    // Mark as recovered
    deletedCourse.isRecovered = true;
    deletedCourse.recoveredBy = {
      adminId: req.user._id,
      adminName: `${req.user.firstName} ${req.user.lastName}`,
      recoveredAt: new Date(),
    };
    await deletedCourse.save();

    console.log(
      `✅ Course ${courseData.courseCode} recovered for user ${user.email}`
    );

    res.json({
      success: true,
      message: "Course recovered successfully",
    });
  } catch (error) {
    console.error("❌ Error recovering deleted course:", error);
    res
      .status(500)
      .json({ success: false, message: "Error recovering course" });
  }
};
