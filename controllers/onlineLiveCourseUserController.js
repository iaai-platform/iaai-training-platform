// controllers/onlineLiveCourseUserController.js - UPDATED WITH TWO-TABLE APPROACH

const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const User = require("../models/user");
const Instructor = require("../models/Instructor");
const CoursePool = require("../models/CoursePool");
const emailService = require("../utils/emailService");

// Helper to count enrolled students
const getEnrolledCount = async (courseId) => {
  const count = await User.countDocuments({
    "myLiveCourses.courseId": courseId,
    "myLiveCourses.enrollmentData.status": { $in: ["paid", "registered"] },
  });
  return count;
};

// 🔧 UPDATED: Controller to display Online Live Training Courses with two tables
exports.getOnlineLiveTraining = async (req, res) => {
  try {
    console.log("📚 Fetching online live courses...");

    const now = new Date();

    // 🔧 UPDATED: Fetch ALL courses including completed ones
    const allCourses = await OnlineLiveTraining.find({
      "basic.status": { $ne: "cancelled" },
    }).lean();

    console.log(`📊 Found ${allCourses.length} total online live courses`);

    // 🔧 NEW: Process courses and separate into categories
    const upcomingCourses = [];
    const completedCourses = [];

    for (let course of allCourses) {
      // Get enrolled count
      const enrolledCount = await getEnrolledCount(course._id);

      // Transform the course to flat structure expected by the view
      const transformedCourse = {
        _id: course._id,
        courseCode: course.basic?.courseCode || "N/A",
        title: course.basic?.title || "Untitled Course",
        description: course.basic?.description || "",
        status: course.basic?.status || "draft",

        // Schedule fields
        startDate: course.schedule?.startDate,
        endDate: course.schedule?.endDate,
        duration: course.schedule?.duration || "1 session",
        registrationDeadline: course.schedule?.registrationDeadline,

        // Pricing fields
        price: course.enrollment?.price || 0,
        earlyBirdPrice: course.enrollment?.earlyBirdPrice,
        currency: course.enrollment?.currency || "EUR",
        seatsAvailable: course.enrollment?.seatsAvailable || 50,

        // Platform fields
        platform: course.platform?.name || "Zoom",
        courseUrl: course.platform?.accessUrl,
        meetingId: course.platform?.meetingId,
        passcode: course.platform?.passcode,

        // Instructor fields
        instructor: course.instructors?.primary?.name || "TBA",
        coInstructors:
          course.instructors?.additional?.map((i) => i.name).filter(Boolean) ||
          [],

        // Images
        images: {
          mainImage: course.media?.mainImage,
          brochures:
            course.media?.documents?.filter((url) =>
              url.includes("brochure")
            ) || [],
          catalogs:
            course.media?.documents?.filter((url) => url.includes("catalog")) ||
            [],
        },

        // Calculated fields
        enrolledStudents: enrolledCount,
        availableSeats: Math.max(
          0,
          (course.enrollment?.seatsAvailable || 50) - enrolledCount
        ),
        isMultiDay:
          course.schedule?.sessions?.length > 1 ||
          (course.schedule?.endDate &&
            course.schedule?.startDate &&
            new Date(course.schedule.endDate).getTime() !==
              new Date(course.schedule.startDate).getTime()),

        // Certificate info
        certificateProvided: course.certification?.enabled !== false,

        // Additional display fields
        hasEarlyBird:
          course.enrollment?.earlyBirdPrice &&
          course.enrollment.earlyBirdPrice < course.enrollment.price,

        mainImageUrl:
          course.media?.mainImage?.url ||
          course.media?.promotional?.brochureUrl ||
          "/images/default-online-course.jpg",

        // Platform icon mapping
        platformIcon:
          {
            zoom: "fa-video",
            "microsoft teams": "fa-microsoft",
            webex: "fa-laptop",
            "google meet": "fa-google",
            gotowebinar: "fa-chalkboard-teacher",
            custom: "fa-desktop",
          }[course.platform?.name?.toLowerCase()] || "fa-video",
      };

      // 🔧 NEW: Determine if course is completed/expired
      const startDate = transformedCourse.startDate
        ? new Date(transformedCourse.startDate)
        : null;
      const endDate = transformedCourse.endDate
        ? new Date(transformedCourse.endDate)
        : null;

      let isCompleted = false;
      let currentStatus = transformedCourse.status;

      // Update status based on dates
      if (endDate && now > endDate) {
        currentStatus = "completed";
        isCompleted = true;
      } else if (
        !endDate &&
        startDate &&
        now > new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      ) {
        currentStatus = "completed";
        isCompleted = true;
      } else if (
        startDate &&
        now >= startDate &&
        (!endDate || now <= endDate)
      ) {
        currentStatus = "in-progress";
      } else if (transformedCourse.availableSeats <= 0) {
        currentStatus = "full";
      } else if (startDate && now < startDate) {
        currentStatus = "open";
      }

      // Calculate display status
      if (transformedCourse.availableSeats <= 0) {
        transformedCourse.displayStatus = "Full";
      } else if (startDate && startDate <= now) {
        transformedCourse.displayStatus = "In Progress";
      } else if (
        transformedCourse.registrationDeadline &&
        new Date(transformedCourse.registrationDeadline) <= now
      ) {
        transformedCourse.displayStatus = "Registration Closed";
      } else {
        transformedCourse.displayStatus = "Open to Register";
      }

      // Calculate days until start
      if (startDate && startDate > now) {
        const daysUntilStart = Math.ceil(
          (startDate - now) / (1000 * 60 * 60 * 24)
        );
        transformedCourse.daysUntilStart = daysUntilStart;
        transformedCourse.timeUntilStart = `${daysUntilStart} day${
          daysUntilStart !== 1 ? "s" : ""
        }`;
      } else {
        transformedCourse.daysUntilStart = 0;
        transformedCourse.timeUntilStart = "Started";
      }

      // Update the status in the transformed course
      transformedCourse.status = currentStatus;

      // 🔧 NEW: Categorize courses
      if (isCompleted) {
        completedCourses.push(transformedCourse);
        console.log(
          `📚 Added to completed: ${transformedCourse.title} (${transformedCourse.status})`
        );
      } else {
        upcomingCourses.push(transformedCourse);
        console.log(
          `📅 Added to upcoming: ${transformedCourse.title} (${transformedCourse.status})`
        );
      }
    }

    // Sort courses
    upcomingCourses.sort((a, b) => {
      if (
        a.displayStatus === "In Progress" &&
        b.displayStatus !== "In Progress"
      )
        return 1;
      if (
        a.displayStatus !== "In Progress" &&
        b.displayStatus === "In Progress"
      )
        return -1;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    });

    completedCourses.sort(
      (a, b) => new Date(b.startDate) - new Date(a.startDate)
    ); // Most recent first

    const user = req.user || null;

    console.log(`✅ Final categorization:`);
    console.log(`   📅 Upcoming courses: ${upcomingCourses.length}`);
    console.log(`   📚 Completed courses: ${completedCourses.length}`);
    console.log(
      `👤 User: ${user ? `${user.firstName} (${user.email})` : "Not logged in"}`
    );

    // 🔧 NEW: Pass both arrays to template
    res.render("online-live-training", {
      // Pass separate arrays for the two tables
      upcomingCourses: upcomingCourses,
      completedCourses: completedCourses,

      // Keep backward compatibility with existing template
      courses: [...upcomingCourses, ...completedCourses],

      user: user,

      // Additional stats
      stats: {
        totalCourses: upcomingCourses.length + completedCourses.length,
        upcomingCount: upcomingCourses.length,
        completedCount: completedCourses.length,
        availableCount: upcomingCourses.filter(
          (course) =>
            course.displayStatus === "Open to Register" &&
            (course.availableSeats || 0) > 0
        ).length,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching online live courses:", err);
    res.status(500).send("Server error: " + err.message);
  }
};

// Keep all other existing methods unchanged...
// (getCourseDetails, joinLiveSession, getCourseMaterials, etc.)

// 2. Controller to display specific course details
exports.getCourseDetails = async (req, res) => {
  try {
    console.log("📋 Fetching course details for ID:", req.params.courseId);

    const course = await OnlineLiveTraining.findById(req.params.courseId)
      .populate("instructors.primary.instructorId")
      .populate("instructors.additional.instructorId")
      .populate("certification.issuingAuthorityId")
      .populate("certification.certificationBodies.bodyId")
      .lean();

    if (!course) {
      console.log("❌ Course not found");
      return res.status(404).render("error", {
        message: "Course not found",
        error: { status: 404 },
      });
    }

    console.log("✅ Course found:", course.basic?.title);

    const currentDate = new Date();
    const courseStartDate = new Date(course.schedule?.startDate);
    const courseEndDate = course.schedule?.endDate
      ? new Date(course.schedule.endDate)
      : null;

    // Transform course data to match view expectations
    const transformedCourse = {
      _id: course._id,

      // Basic fields
      courseCode: course.basic?.courseCode || "N/A",
      title: course.basic?.title || "Untitled Course",
      description: course.basic?.description || "",
      aboutThisCourse: course.basic?.aboutThisCourse || "",
      status: course.basic?.status || "draft",
      category: course.basic?.category,

      // Schedule fields
      startDate: course.schedule?.startDate,
      endDate: course.schedule?.endDate,
      duration: course.schedule?.duration || "1 session",
      registrationDeadline: course.schedule?.registrationDeadline,
      primaryTimezone: course.schedule?.primaryTimezone || "UTC",
      displayTimezones: course.schedule?.displayTimezones || [],

      startTime:
        course.schedule?.sessions?.length > 0
          ? course.schedule.sessions[0].startTime
          : null,
      endTime:
        course.schedule?.sessions?.length > 0
          ? course.schedule.sessions[0].endTime
          : null,
      sessionTime:
        course.schedule?.sessions?.length > 0
          ? `${course.schedule.sessions[0].startTime} - ${course.schedule.sessions[0].endTime}`
          : null,

      // Session details for multi-day courses
      isMultiDay: course.schedule?.sessions?.length > 1,
      courseDays:
        course.schedule?.sessions?.map((session) => ({
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          topic: session.title,
          description: session.type,
          dayNumber: session.dayNumber,
        })) || [],

      // Enrollment fields
      price: course.enrollment?.price || 0,
      earlyBirdPrice: course.enrollment?.earlyBirdPrice,
      currency: course.enrollment?.currency || "USD",
      seatsAvailable: course.enrollment?.seatsAvailable || 50,
      minEnrollment: course.enrollment?.minEnrollment || 10,
      waitlistEnabled: course.enrollment?.waitlistEnabled,

      // Platform fields
      platform: course.platform?.name || "Zoom",
      courseUrl: course.platform?.accessUrl,
      meetingId: course.platform?.meetingId,
      passcode: course.platform?.passcode,
      platformFeatures: course.platform?.features || {},

      // Instructor fields - properly structured
      instructor:
        course.instructors?.primary?.instructorId?.fullName ||
        course.instructors?.primary?.name ||
        "TBA",
      instructorDetails: course.instructors?.primary?.instructorId
        ? {
            _id: course.instructors.primary.instructorId._id,
            fullName: course.instructors.primary.instructorId.fullName,
            firstName: course.instructors.primary.instructorId.firstName,
            lastName: course.instructors.primary.instructorId.lastName,
            title: course.instructors.primary.instructorId.title,
            bio: course.instructors.primary.instructorId.bio,
            profilePicture:
              course.instructors.primary.instructorId.profileImage,
            qualifications:
              course.instructors.primary.instructorId.qualifications || [],
            specializations:
              course.instructors.primary.instructorId.specializations || [],
            yearsOfExperience:
              course.instructors.primary.instructorId.experience,
            achievements:
              course.instructors.primary.instructorId.achievements || [],
          }
        : null,

      // Co-instructors
      coInstructors:
        course.instructors?.additional
          ?.map((inst) => inst.instructorId?.fullName || inst.name)
          .filter(Boolean) || [],
      coInstructorDetails:
        course.instructors?.additional
          ?.map((inst) =>
            inst.instructorId
              ? {
                  _id: inst.instructorId._id,
                  fullName: inst.instructorId.fullName,
                  title: inst.instructorId.title,
                  bio: inst.instructorId.bio,
                  profilePicture: inst.instructorId.profileImage,
                  role: inst.role,
                }
              : null
          )
          .filter(Boolean) || [],

      // Content fields
      objectives: course.content?.objectives || [],
      modules: course.content?.modules || [],
      targetAudience: course.content?.targetAudience?.join(", ") || "",
      experienceLevel: course.content?.experienceLevel || "all-levels",
      prerequisites: course.content?.prerequisites || "None",
      detailedSyllabus: course.content?.detailedSyllabus,

      // Technical requirements - ENHANCED
      systemRequirements: course.technical?.systemRequirements || {},
      internetSpeed: course.technical?.internetSpeed || {},
      requiredSoftware: course.technical?.requiredSoftware || [],
      equipment: course.technical?.equipment || {},
      techCheckRequired: course.technical?.techCheckRequired,
      techCheckDate: course.technical?.techCheckDate,
      techCheckUrl: course.technical?.techCheckUrl,

      // Interaction features - ENHANCED
      interactionFeatures: course.interaction?.features || {},
      participationRequired: course.interaction?.participationRequired,
      cameraRequired: course.interaction?.cameraRequired,
      engagementTools: course.interaction?.engagementTools || [],
      networkingOptions: course.interaction?.networkingOptions || {},

      // Recording info - ENHANCED
      recordingAvailable:
        course.recording?.enabled !== false &&
        course.recording?.availability?.forStudents !== false,
      recordingDuration: course.recording?.availability?.duration || 90,
      recordingDownloadable:
        course.recording?.availability?.downloadable || false,
      recordingDetails: {
        available: course.recording?.availability?.forStudents !== false,
        duration: course.recording?.availability?.duration || 90,
        downloadable: course.recording?.availability?.downloadable || false,
        passwordProtected:
          course.recording?.availability?.passwordProtected || false,
      },

      // Media - properly structured
      mainImage:
        course.media?.mainImage?.url || "/images/default-online-course.jpg",
      mainImageAlt: course.media?.mainImage?.alt || course.basic?.title,
      videos: course.media?.videos || [],
      promotional: {
        brochureUrl: course.media?.promotional?.brochureUrl,
        videoUrl: course.media?.promotional?.videoUrl,
        catalogUrl: course.media?.promotional?.catalogUrl,
      },

      // Materials - ENHANCED
      materials: {
        handouts: course.materials?.handouts || [],
        virtualLabs: course.materials?.virtualLabs || [],
        lms: course.materials?.lms || {},
      },
      resources: course.media?.links || [],

      // Assessment & Certification - ENHANCED
      assessmentRequired: course.assessment?.required,
      assessmentType: course.assessment?.type,
      passingScore: course.assessment?.passingScore || 70,
      questions: course.assessment?.questions || [],
      certificateProvided: course.certification?.enabled,
      certificateType: course.certification?.type || "completion",
      certificateRequirements: course.certification?.requirements || {},
      certificateFeatures: course.certification?.features || {},

      // Support information - ENHANCED
      supportContact: course.support?.contact || {},
      supportHours: course.support?.hours || {},
      supportChannels: course.support?.channels || {},

      // Experience features - ENHANCED
      onboarding: course.experience?.onboarding || {},
      accessibility: course.experience?.accessibility || {},
      gamification: course.experience?.gamification || {},

      // Post-course access - ENHANCED
      postCourseAccess: course.postCourse?.accessDuration || {},
      alumniFeatures: course.postCourse?.alumni || {},

      // Certification Body - NEW
      certificationBody: course.certification?.issuingAuthorityId
        ? {
            name: course.certification.issuingAuthorityId.companyName,
            displayName: course.certification.issuingAuthorityId.displayName,
            logo: course.certification.issuingAuthorityId.logo,
            website: course.certification.issuingAuthorityId.website,
            accreditation:
              course.certification.issuingAuthorityId.accreditation || [],
          }
        : null,

      // Calculate additional fields
      hasEarlyBird:
        course.enrollment?.earlyBirdPrice &&
        course.enrollment.earlyBirdPrice < course.enrollment.price,
    };

    // Calculate enrollment data
    const enrolledCount = await getEnrolledCount(course._id);
    transformedCourse.enrolledStudents = enrolledCount;
    transformedCourse.availableSeats = Math.max(
      0,
      transformedCourse.seatsAvailable - enrolledCount
    );

    // Determine course status and messaging
    let courseStatusMessage = "";
    let canJoinSession = false;
    let showJoinButton = false;

    if (currentDate < courseStartDate) {
      const daysUntilStart = Math.ceil(
        (courseStartDate - currentDate) / (1000 * 60 * 60 * 24)
      );
      const hoursUntilStart = Math.ceil(
        (courseStartDate - currentDate) / (1000 * 60 * 60)
      );

      if (hoursUntilStart <= 24) {
        courseStatusMessage = `Course starts in ${hoursUntilStart} hour${
          hoursUntilStart !== 1 ? "s" : ""
        }`;
      } else {
        courseStatusMessage = `Course starts in ${daysUntilStart} day${
          daysUntilStart !== 1 ? "s" : ""
        }`;
      }

      // Show join button 15 minutes before start
      const minutesUntilStart = (courseStartDate - currentDate) / (1000 * 60);
      if (minutesUntilStart <= 15) {
        canJoinSession = true;
        showJoinButton = true;
        courseStatusMessage = "Session starting soon! You can join now.";
      }
    } else if (courseEndDate && currentDate > courseEndDate) {
      courseStatusMessage = "This course has ended.";
    } else {
      courseStatusMessage = "This course session is currently live!";
      canJoinSession = true;
      showJoinButton = true;
    }

    // Check if user has already registered
    let userRegistrationStatus = null;
    if (req.user) {
      const user = await User.findById(req.user._id);
      const userCourse = user.myLiveCourses?.find(
        (c) => c.courseId.toString() === course._id.toString()
      );

      if (userCourse) {
        userRegistrationStatus = {
          status: userCourse.enrollmentData.status,
          isRegistered: ["paid", "registered"].includes(
            userCourse.enrollmentData.status
          ),
          isInCart: userCourse.enrollmentData.status === "cart",
          isInWishlist: userCourse.enrollmentData.status === "wishlist",
          attendanceConfirmed:
            userCourse.userProgress?.overallAttendancePercentage > 0,
          canAccessRecordings:
            userCourse.userProgress?.overallAttendancePercentage > 0,
          dateOfRegistration: userCourse.enrollmentData.registrationDate,
        };

        // Only show join button for registered users
        if (!userRegistrationStatus.isRegistered) {
          showJoinButton = false;
        }
      }
    }

    // Prepare assessment information
    const assessmentInfo = {
      hasAssessment:
        transformedCourse.assessmentRequired &&
        transformedCourse.assessmentType !== "none",
      requiresQuiz:
        transformedCourse.assessmentType === "quiz" ||
        transformedCourse.assessmentType === "both",
      requiresPractical:
        transformedCourse.assessmentType === "practical" ||
        transformedCourse.assessmentType === "both",
      passingScore: transformedCourse.passingScore,
      totalQuestions: transformedCourse.questions.length,
      mustPassToGetCertificate: transformedCourse.assessmentRequired,
      retakesAllowed: course.assessment?.retakesAllowed || 1,
      timeLimit: course.assessment?.timeLimit || null,
    };

    // Update display status
    if (transformedCourse.availableSeats <= 0) {
      transformedCourse.status = "Full";
    } else if (courseStartDate <= currentDate) {
      transformedCourse.status = "In Progress";
    } else if (
      transformedCourse.registrationDeadline &&
      new Date(transformedCourse.registrationDeadline) <= currentDate
    ) {
      transformedCourse.status = "Registration Closed";
    } else {
      transformedCourse.status = "Open to Register";
    }

    console.log(
      "🎯 Rendering course details page with enhanced transformed data"
    );

    res.render("online-live-training-details", {
      course: transformedCourse,
      user: req.user,
      courseStatusMessage,
      canJoinSession,
      showJoinButton,
      userRegistrationStatus,
      assessmentInfo,
    });
  } catch (err) {
    console.error("❌ Error fetching course details:", err);
    res.status(500).render("error", {
      message: "Server error while fetching course details",
      error: { status: 500, stack: err.stack },
    });
  }
};
// 5. Join live session (for registered students)
exports.joinLiveSession = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please log in to join the session",
      });
    }

    // Check if user is registered for this course
    const user = await User.findById(req.user._id);
    const userCourse = user.myLiveCourses?.find(
      (c) =>
        c.courseId.toString() === courseId &&
        ["paid", "registered"].includes(c.enrollmentData.status)
    );

    if (!userCourse) {
      return res.status(403).json({
        success: false,
        message: "You must be registered for this course to join the session",
      });
    }

    const course = await OnlineLiveTraining.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if course is currently live or about to start
    const now = new Date();
    const startDate = new Date(course.schedule.startDate);
    const endDate = course.schedule.endDate
      ? new Date(course.schedule.endDate)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    const minutesUntilStart = (startDate - now) / (1000 * 60);

    if (minutesUntilStart > 15) {
      return res.status(400).json({
        success: false,
        message: `This session hasn't started yet. You can join 15 minutes before the start time.`,
      });
    }

    if (now > endDate) {
      return res.status(400).json({
        success: false,
        message: "This session has ended",
      });
    }

    // Update user's attendance
    const sessionAttendance = {
      sessionDate: now,
      joinTime: now,
      attendancePercentage: 0,
    };

    userCourse.userProgress.sessionsAttended.push(sessionAttendance);
    await user.save();

    // Return session details
    if (course.platform?.accessUrl) {
      res.json({
        success: true,
        courseUrl: course.platform.accessUrl,
        platform: course.platform.name || "Zoom",
        title: course.basic.title,
        instructor: course.instructors?.primary?.name,
        message: "Redirecting to live session...",
        sessionInfo: {
          startTime: course.schedule.startDate,
          endTime: course.schedule.endDate,
          platform: course.platform.name,
          meetingId: course.platform.meetingId || null,
          passcode: course.platform.passcode || null,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Session link not available. Please contact support.",
      });
    }
  } catch (error) {
    console.error("Error joining live session:", error);
    res.status(500).json({
      success: false,
      message: "Error joining session",
    });
  }
};

// 6. Get course materials (for registered students)
exports.getCourseMaterials = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is registered for this course
    const user = await User.findById(req.user._id);
    const userCourse = user.myLiveCourses?.find(
      (c) =>
        c.courseId.toString() === courseId &&
        ["paid", "registered"].includes(c.enrollmentData.status)
    );

    if (!userCourse) {
      return res.status(403).json({
        success: false,
        message: "You must be registered for this course to access materials",
      });
    }

    const course = await OnlineLiveTraining.findById(
      courseId,
      "materials media basic"
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Organize materials by type
    const organizedMaterials = {
      handouts: course.materials?.handouts || [],
      virtualLabs: course.materials?.virtualLabs || [],
      documents: course.media?.documents || [],
      resources: course.media?.links || [],
      totalFiles:
        (course.materials?.handouts?.length || 0) +
        (course.media?.documents?.length || 0) +
        (course.media?.links?.length || 0),
    };

    res.json({
      success: true,
      courseTitle: course.basic.title,
      materials: organizedMaterials,
      hasAccess: true,
    });
  } catch (error) {
    console.error("Error fetching course materials:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching course materials",
    });
  }
};

// 7. Get assessment for course (for students who attended)
exports.getCourseAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is registered and has attended
    const user = await User.findById(req.user._id);
    const userCourse = user.myLiveCourses?.find(
      (c) =>
        c.courseId.toString() === courseId &&
        ["paid", "registered"].includes(c.enrollmentData.status)
    );

    if (!userCourse) {
      return res.status(403).json({
        success: false,
        message: "You must be registered for this course",
      });
    }

    // For live courses, check attendance
    if (userCourse.userProgress.overallAttendancePercentage < 80) {
      return res.status(403).json({
        success: false,
        message:
          "You must attend at least 80% of the course before taking the assessment",
      });
    }

    const course = await OnlineLiveTraining.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if assessment is required
    if (!course.assessment?.required || course.assessment?.type === "none") {
      return res.status(400).json({
        success: false,
        message: "This course does not have an assessment",
      });
    }

    // Check if user has already passed
    if (
      userCourse.userProgress.bestAssessmentScore >=
      course.assessment.passingScore
    ) {
      return res.json({
        success: true,
        alreadyPassed: true,
        score: userCourse.userProgress.bestAssessmentScore,
        message: "You have already passed this assessment",
      });
    }

    // Prepare assessment data
    const assessmentData = {
      courseTitle: course.basic.title,
      assessmentType: course.assessment.type,
      passingScore: course.assessment.passingScore || 70,
      timeLimit: course.assessment.timeLimit,
      totalQuestions: course.assessment.questions?.length || 0,
      attempts: userCourse.userProgress.assessmentAttempts?.length || 0,
      maxAttempts: course.assessment.retakesAllowed + 1 || 2,
    };

    // If quiz, prepare questions
    if (
      course.assessment.type === "quiz" ||
      course.assessment.type === "both"
    ) {
      // Shuffle questions and remove correct answers
      const questions = course.assessment.questions.map((q, index) => ({
        id: index,
        question: q.question,
        options: q.answers,
        // Don't send correct answer to client
      }));

      assessmentData.questions = questions;
    }

    res.json({
      success: true,
      assessment: assessmentData,
    });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching assessment",
    });
  }
};

// 8. Submit assessment answers
exports.submitAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers, assessmentType } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(req.user._id);
    const userCourseIndex = user.myLiveCourses.findIndex(
      (c) => c.courseId.toString() === courseId
    );

    if (userCourseIndex === -1) {
      return res.status(403).json({
        success: false,
        message: "You are not registered for this course",
      });
    }

    const course = await OnlineLiveTraining.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Calculate score for quiz
    let score = 0;
    if (assessmentType === "quiz" && answers) {
      answers.forEach((answer, index) => {
        if (
          course.assessment.questions[index] &&
          answer === course.assessment.questions[index].correctAnswer
        ) {
          score++;
        }
      });

      score = Math.round((score / course.assessment.questions.length) * 100);
    }

    // Update user's assessment data
    const passingScore = course.assessment.passingScore || 70;
    const passed = score >= passingScore;

    // Create assessment attempt
    const attempt = {
      attemptDate: new Date(),
      score: score,
      passed: passed,
    };

    if (!user.myLiveCourses[userCourseIndex].userProgress.assessmentAttempts) {
      user.myLiveCourses[userCourseIndex].userProgress.assessmentAttempts = [];
    }

    user.myLiveCourses[userCourseIndex].userProgress.assessmentAttempts.push(
      attempt
    );

    // Update best score
    if (
      score >
      (user.myLiveCourses[userCourseIndex].userProgress.bestAssessmentScore ||
        0)
    ) {
      user.myLiveCourses[userCourseIndex].userProgress.bestAssessmentScore =
        score;
    }

    await user.save();

    res.json({
      success: true,
      passed: passed,
      score: score,
      passingScore: passingScore,
      message: passed
        ? "Congratulations! You have passed the assessment."
        : "You did not pass. You may retake the assessment if attempts remain.",
      attemptsRemaining:
        (course.assessment.retakesAllowed + 1 || 2) -
        user.myLiveCourses[userCourseIndex].userProgress.assessmentAttempts
          .length,
    });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting assessment",
    });
  }
};

// Export all functions
module.exports = exports;
