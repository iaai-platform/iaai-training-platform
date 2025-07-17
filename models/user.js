// Optimized User Model - Store Only User-Specific Data
// Course details are fetched from course models when needed

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Basic User Information
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String },
    profession: { type: String },
    country: { type: String },

    // Additional User Properties
    isConfirmed: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["user", "admin", "instructor"],
      default: "user",
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // ========================================
    // OPTIMIZED COURSE ENROLLMENTS
    // ========================================

    // 1. In-Person Course Enrollments
    myInPersonCourses: [
      {
        // Reference to course
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "InPersonAestheticTraining",
        },

        // User-specific enrollment data only
        enrollmentData: {
          status: {
            type: String,
            enum: [
              "wishlist",
              "cart",
              "paid",
              "registered",
              "completed",
              "cancelled",
            ],
            default: "cart",
          },
          registrationDate: { type: Date, default: Date.now },
          paidAmount: Number, // Actual amount paid (after discounts)
          paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
          },
          promoCodeUsed: String,
        },

        // User's progress/interaction
        userProgress: {
          attendanceRecords: [
            {
              date: Date,
              checkIn: Date,
              checkOut: Date,
              hoursAttended: Number,
              status: {
                type: String,
                enum: ["present", "absent", "late", "excused"],
              },
            },
          ],
          overallAttendancePercentage: { type: Number, default: 0 },
          assessmentScore: Number,
          assessmentCompleted: { type: Boolean, default: false },
          courseStatus: {
            type: String,
            enum: ["not-started", "in-progress", "completed"],
            default: "not-started",
          },
          completionDate: Date,
        },

        // Certificate reference (if earned)
        certificateId: { type: String },

        // User's personal notes
        userNotes: String,

        // Notifications preferences for this course
        notificationsEnabled: { type: Boolean, default: true },
      },
    ],

    // 2. Online Live Course Enrollments
    myLiveCourses: [
      {
        // Reference to course
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "OnlineLiveTraining",
        },

        // User-specific enrollment data
        enrollmentData: {
          status: {
            type: String,
            enum: [
              "wishlist",
              "cart",
              "paid",
              "registered",
              "completed",
              "cancelled",
            ],
            default: "cart",
          },
          registrationDate: { type: Date, default: Date.now },
          paidAmount: Number,
          paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
          },
          promoCodeUsed: String,
        },

        // User's progress/interaction
        userProgress: {
          sessionsAttended: [
            {
              sessionId: mongoose.Schema.Types.ObjectId, // Reference to course.schedule.sessions
              sessionDate: Date,
              joinTime: Date,
              leaveTime: Date,
              duration: Number, // minutes
              attendancePercentage: Number,
            },
          ],
          overallAttendancePercentage: { type: Number, default: 0 },

          // Recording access tracking
          recordingsWatched: [
            {
              recordingId: mongoose.Schema.Types.ObjectId,
              lastWatchedAt: Date,
              watchCount: { type: Number, default: 0 },
            },
          ],

          // Assessments
          assessmentAttempts: [
            {
              attemptDate: Date,
              score: Number,
              passed: Boolean,
            },
          ],
          bestAssessmentScore: Number,

          courseStatus: {
            type: String,
            enum: ["not-started", "in-progress", "completed"],
            default: "not-started",
          },
          completionDate: Date,
        },

        //assesssment
        assessmentAttempts: [
          {
            attemptNumber: Number,
            attemptDate: Date,
            score: Number,
            passed: Boolean,
            answers: [
              {
                questionIndex: Number,
                userAnswer: Number,
                isCorrect: Boolean,
              },
            ],
            detailedResults: [
              {
                questionIndex: Number,
                question: String,
                userAnswer: Number,
                correctAnswer: Number,
                isCorrect: Boolean,
                points: Number,
                earnedPoints: Number,
              },
            ],
          },
        ],

        // Assessment summary fields
        assessmentCompleted: { type: Boolean, default: false },
        assessmentScore: { type: Number, default: 0 },
        bestAssessmentScore: { type: Number, default: 0 },
        lastAssessmentDate: Date,
        assessmentHistory: [
          {
            attemptNumber: Number,
            date: Date,
            score: Number,
            passed: Boolean,
            answers: mongoose.Schema.Types.Mixed,
            totalQuestions: Number,
            correctAnswers: Number,
            detailedResults: mongoose.Schema.Types.Mixed,
          },
        ],

        // Downloaded materials tracking
        downloadedMaterials: [
          {
            materialId: mongoose.Schema.Types.ObjectId,
            downloadDate: Date,
          },
        ],

        // Certificate reference
        certificateId: { type: String },

        // User's notes
        userNotes: String,
        notificationsEnabled: { type: Boolean, default: true },
      },
    ],

    // 3. Self-Paced Course Enrollments
    mySelfPacedCourses: [
      {
        // Reference to course
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "SelfPacedOnlineTraining",
        },

        // User-specific enrollment data
        enrollmentData: {
          status: {
            type: String,
            enum: ["wishlist", "cart", "paid", "registered", "expired"],
            default: "cart",
          },
          registrationDate: { type: Date, default: Date.now },
          expiryDate: Date, // Calculated based on course.access.accessDays
          paidAmount: Number,
          paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
          },
          promoCodeUsed: String,
        },

        // Video progress tracking
        videoProgress: [
          {
            videoId: { type: mongoose.Schema.Types.ObjectId }, // Reference to course.videos._id
            watchProgress: {
              currentTime: { type: Number, default: 0 }, // seconds
              totalDuration: Number, // seconds (cached for performance)
              percentageWatched: { type: Number, default: 0 },
              isCompleted: { type: Boolean, default: false },
              completedDate: Date,
              lastWatchedAt: Date,
              watchCount: { type: Number, default: 0 },
            },
          },
        ],

        // Exam/Quiz progress
        examProgress: [
          {
            videoId: { type: mongoose.Schema.Types.ObjectId }, // Video that contains the exam
            attempts: [
              {
                attemptNumber: Number,
                attemptDate: Date,
                answers: [
                  {
                    questionId: mongoose.Schema.Types.ObjectId,
                    userAnswer: String,
                    isCorrect: Boolean,
                  },
                ],
                score: Number,
                passed: Boolean,
                timeSpent: Number, // seconds
              },
            ],
            bestScore: Number,
            isPassed: { type: Boolean, default: false },
          },
        ],

        // Overall course progress
        courseProgress: {
          completedVideos: [mongoose.Schema.Types.ObjectId], // Video IDs
          completedExams: [mongoose.Schema.Types.ObjectId], // Video IDs that have exams
          overallPercentage: { type: Number, default: 0 },
          totalWatchTime: { type: Number, default: 0 }, // minutes
          averageExamScore: { type: Number, default: 0 },
          lastAccessedAt: Date,
          status: {
            type: String,
            enum: ["not-started", "in-progress", "completed"],
            default: "not-started",
          },
          completionDate: Date,
        },

        // User's notes for videos
        videoNotes: [
          {
            videoId: mongoose.Schema.Types.ObjectId,
            notes: String,
            lastUpdated: Date,
          },
        ],

        // Bookmarks
        bookmarks: [
          {
            videoId: mongoose.Schema.Types.ObjectId,
            timestamp: Number, // seconds
            title: String,
            createdAt: { type: Date, default: Date.now },
          },
        ],

        // Certificate reference
        certificateId: { type: String },
      },
    ],

    // 4. Instructor assignments (unchanged)
    myTrainingInstruction: {
      experience: { type: String },
      expertise: { type: String },
      cv: { type: String },

      appliedForCourses: [
        {
          courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "InPersonAestheticTraining",
          },
          status: {
            type: String,
            enum: ["Pending", "Reviewed", "Accepted", "Rejected"],
            default: "Pending",
          },
          applicationDate: { type: Date, default: Date.now },
        },
      ],

      allocatedCourses: [
        {
          courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "InPersonAestheticTraining",
          },
          allocatedDate: { type: Date, default: Date.now },
        },
      ],
    },

    // ========================================
    // CERTIFICATES (Store actual certificates)
    // ========================================
    myCertificates: [
      {
        certificateId: {
          type: String,
          required: function () {
            return this.courseId != null;
          },
        },
        courseId: { type: mongoose.Schema.Types.ObjectId, required: true },
        courseType: {
          type: String,
          enum: [
            "SelfPacedOnlineTraining",
            "OnlineLiveTraining",
            "InPersonAestheticTraining",
          ],
          required: true,
        },

        // Certificate is immutable once issued
        certificateData: {
          recipientName: { type: String, required: true },
          courseTitle: { type: String, required: true },
          courseCode: { type: String, required: true },
          instructorName: String,
          completionDate: { type: Date, required: true },
          issueDate: { type: Date, default: Date.now },
          expiryDate: Date,

          // Achievement data (snapshot at completion)
          achievement: {
            attendancePercentage: Number,
            examScore: Number,
            totalHours: Number,
            grade: String,
          },

          // Verification
          verificationCode: { type: String, required: true, unique: true },
          digitalSignature: String,
          qrCodeUrl: String,

          // Files
          pdfUrl: String,
          imageUrl: String,
        },

        // Usage tracking
        downloadCount: { type: Number, default: 0 },
        lastDownloaded: Date,
        isPublic: { type: Boolean, default: false },
        shareUrl: String,
      },
    ],

    // ========================================
    // SIMPLIFIED PAYMENT TRANSACTIONS
    // ========================================
    paymentTransactions: [
      {
        transactionId: { type: String, required: true, unique: true },
        receiptNumber: { type: String, required: true, unique: true },
        transactionDate: { type: Date, default: Date.now },

        // Payment details
        paymentMethod: String,
        paymentStatus: {
          type: String,
          enum: ["pending", "completed", "failed", "refunded"],
          default: "completed",
        },

        // Amounts
        subtotal: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        finalAmount: { type: Number, required: true },
        currency: { type: String, default: "USD" },

        // Items purchased (just references)
        items: [
          {
            courseId: mongoose.Schema.Types.ObjectId,
            courseType: String,
            originalPrice: Number,
            paidPrice: Number,
          },
        ],

        // Promo code
        promoCode: String,

        // Receipt
        receiptUrl: String,
      },
    ],

    // ========================================
    // USER PREFERENCES & SETTINGS
    // ========================================

    // Library preferences
    libraryPreferences: {
      defaultView: { type: String, enum: ["grid", "list"], default: "grid" },
      sortBy: {
        type: String,
        enum: ["recent", "title", "progress"],
        default: "recent",
      },
      showCompleted: { type: Boolean, default: true },
      favorites: [
        {
          courseId: mongoose.Schema.Types.ObjectId,
          courseType: String,
          addedAt: { type: Date, default: Date.now },
        },
      ],
    },

    // Learning preferences
    learningPreferences: {
      videoQuality: {
        type: String,
        enum: ["auto", "720p", "1080p"],
        default: "auto",
      },
      playbackSpeed: { type: Number, default: 1 },
      autoplay: { type: Boolean, default: true },
      subtitles: { type: Boolean, default: false },
      language: { type: String, default: "en" },
    },

    // Notification settings
    notificationSettings: {
      email: { type: Boolean, default: true },
      courseUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      reminders: { type: Boolean, default: true },
    },

    // Security settings
    twoFactorAuth: {
      enabled: { type: Boolean, default: false },
      secret: String,
    },

    // Account status
    accountStatus: {
      isActive: { type: Boolean, default: true },
      isLocked: { type: Boolean, default: false },
      lastLoginAt: Date,
      loginAttempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================
userSchema.index({ email: 1 });
userSchema.index({ "myInPersonCourses.courseId": 1 });
userSchema.index({ "myLiveCourses.courseId": 1 });
userSchema.index({ "mySelfPacedCourses.courseId": 1 });
userSchema.index(
  { "myCertificates.certificateId": 1 },
  {
    sparse: true,
    partialFilterExpression: { "myCertificates.certificateId": { $ne: null } },
  }
);
userSchema.index({ "myCertificates.verificationCode": 1 });
userSchema.index({ "paymentTransactions.transactionId": 1 });

// ========================================
// VIRTUAL FIELDS
// ========================================

// Get all enrolled courses with populated data
userSchema.virtual("enrolledCourses").get(async function () {
  const courses = [];

  // Populate in-person courses
  await this.populate("myInPersonCourses.courseId");
  this.myInPersonCourses.forEach((enrollment) => {
    if (
      ["paid", "registered", "completed"].includes(
        enrollment.enrollmentData.status
      )
    ) {
      courses.push({
        type: "in-person",
        enrollment: enrollment,
        course: enrollment.courseId,
      });
    }
  });

  // Populate online live courses
  await this.populate("myLiveCourses.courseId");
  this.myLiveCourses.forEach((enrollment) => {
    if (
      ["paid", "registered", "completed"].includes(
        enrollment.enrollmentData.status
      )
    ) {
      courses.push({
        type: "online-live",
        enrollment: enrollment,
        course: enrollment.courseId,
      });
    }
  });

  // Populate self-paced courses
  await this.populate("mySelfPacedCourses.courseId");
  this.mySelfPacedCourses.forEach((enrollment) => {
    if (["paid", "registered"].includes(enrollment.enrollmentData.status)) {
      const isExpired =
        enrollment.enrollmentData.expiryDate &&
        enrollment.enrollmentData.expiryDate < new Date();
      if (!isExpired) {
        courses.push({
          type: "self-paced",
          enrollment: enrollment,
          course: enrollment.courseId,
        });
      }
    }
  });

  return courses;
});

// ========================================
// INSTANCE METHODS
// ========================================

// Check if user has access to a course
userSchema.methods.hasAccessToCourse = function (courseId, courseType) {
  const courseIdStr = courseId.toString();

  switch (courseType) {
    case "InPersonAestheticTraining":
      const inPerson = this.myInPersonCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
      return (
        inPerson &&
        ["paid", "registered", "completed"].includes(
          inPerson.enrollmentData.status
        )
      );

    case "OnlineLiveTraining":
      const online = this.myLiveCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
      return (
        online &&
        ["paid", "registered", "completed"].includes(
          online.enrollmentData.status
        )
      );

    case "SelfPacedOnlineTraining":
      const selfPaced = this.mySelfPacedCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
      if (!selfPaced) return false;
      if (!["paid", "registered"].includes(selfPaced.enrollmentData.status))
        return false;
      // Check expiry
      return (
        !selfPaced.enrollmentData.expiryDate ||
        selfPaced.enrollmentData.expiryDate > new Date()
      );

    default:
      return false;
  }
};

// Get course enrollment
userSchema.methods.getCourseEnrollment = function (courseId, courseType) {
  const courseIdStr = courseId.toString();

  switch (courseType) {
    case "InPersonAestheticTraining":
      return this.myInPersonCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
    case "OnlineLiveTraining":
      return this.myLiveCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
    case "SelfPacedOnlineTraining":
      return this.mySelfPacedCourses.find(
        (c) => c.courseId.toString() === courseIdStr
      );
    default:
      return null;
  }
};

// Update video progress
userSchema.methods.updateVideoProgress = async function (
  courseId,
  videoId,
  currentTime,
  duration
) {
  const enrollment = this.mySelfPacedCourses.find(
    (c) => c.courseId.toString() === courseId.toString()
  );
  if (!enrollment) return null;

  // Find or create video progress
  let progress = enrollment.videoProgress.find(
    (p) => p.videoId.toString() === videoId.toString()
  );

  if (!progress) {
    progress = {
      videoId: videoId,
      watchProgress: {
        currentTime: 0,
        totalDuration: duration,
        percentageWatched: 0,
        isCompleted: false,
        watchCount: 0,
      },
    };
    enrollment.videoProgress.push(progress);
  }

  // Update progress
  progress.watchProgress.currentTime = currentTime;
  progress.watchProgress.totalDuration = duration;
  progress.watchProgress.percentageWatched =
    duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  progress.watchProgress.lastWatchedAt = new Date();

  // Mark as completed if watched > 90%
  if (
    progress.watchProgress.percentageWatched >= 90 &&
    !progress.watchProgress.isCompleted
  ) {
    progress.watchProgress.isCompleted = true;
    progress.watchProgress.completedDate = new Date();
    progress.watchProgress.watchCount++;

    // Add to completed videos
    if (!enrollment.courseProgress.completedVideos.includes(videoId)) {
      enrollment.courseProgress.completedVideos.push(videoId);
    }
  }

  // Update overall progress
  const course = await mongoose
    .model("SelfPacedOnlineTraining")
    .findById(courseId);
  if (course) {
    const totalVideos = course.videos.length;
    const completedVideos = enrollment.courseProgress.completedVideos.length;
    enrollment.courseProgress.overallPercentage =
      totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

    if (enrollment.courseProgress.overallPercentage === 100) {
      enrollment.courseProgress.status = "completed";
      enrollment.courseProgress.completionDate = new Date();
    } else if (completedVideos > 0) {
      enrollment.courseProgress.status = "in-progress";
    }
  }

  enrollment.courseProgress.lastAccessedAt = new Date();

  return this.save();
};

// Record exam attempt
userSchema.methods.recordExamAttempt = function (
  courseId,
  videoId,
  answers,
  score
) {
  const enrollment = this.mySelfPacedCourses.find(
    (c) => c.courseId.toString() === courseId.toString()
  );
  if (!enrollment) return null;

  // Find or create exam progress
  let examProgress = enrollment.examProgress.find(
    (e) => e.videoId.toString() === videoId.toString()
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

  // Add attempt
  const attempt = {
    attemptNumber: examProgress.attempts.length + 1,
    attemptDate: new Date(),
    answers: answers,
    score: score,
    passed: score >= 70, // Assuming 70% pass mark
  };

  examProgress.attempts.push(attempt);

  // Update best score and pass status
  if (score > examProgress.bestScore) {
    examProgress.bestScore = score;
  }
  if (attempt.passed) {
    examProgress.isPassed = true;
    if (!enrollment.courseProgress.completedExams.includes(videoId)) {
      enrollment.courseProgress.completedExams.push(videoId);
    }
  }

  // Update average exam score
  const allScores = enrollment.examProgress
    .map((ep) => ep.bestScore)
    .filter((score) => score > 0);

  enrollment.courseProgress.averageExamScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b) / allScores.length)
      : 0;

  return this.save();
};

// Get library courses with populated data
userSchema.methods.getLibraryCourses = async function (options = {}) {
  const {
    type = "all", // 'all', 'in-person', 'online-live', 'self-paced'
    status = "all", // 'all', 'active', 'completed', 'upcoming'
    sortBy = "recent", // 'recent', 'title', 'progress'
  } = options;

  const courses = [];
  const now = new Date();

  // Helper function to check status
  const matchesStatus = (enrollment, courseData) => {
    if (status === "all") return true;

    if (status === "completed") {
      return (
        enrollment.courseProgress?.status === "completed" ||
        enrollment.userProgress?.courseStatus === "completed"
      );
    }

    if (status === "upcoming") {
      return courseData.schedule?.startDate > now;
    }

    if (status === "active") {
      return (
        !matchesStatus(enrollment, courseData, "completed") &&
        !matchesStatus(enrollment, courseData, "upcoming")
      );
    }

    return true;
  };

  // In-Person Courses
  if (type === "all" || type === "in-person") {
    await this.populate({
      path: "myInPersonCourses.courseId",
      select: "basic schedule venue instructors media",
    });

    this.myInPersonCourses.forEach((enrollment) => {
      if (
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData.status
        ) &&
        enrollment.courseId &&
        matchesStatus(enrollment, enrollment.courseId)
      ) {
        courses.push({
          type: "in-person",
          enrollment: enrollment,
          course: enrollment.courseId,
          sortDate: enrollment.enrollmentData.registrationDate,
        });
      }
    });
  }

  // Online Live Courses
  if (type === "all" || type === "online-live") {
    await this.populate({
      path: "myLiveCourses.courseId",
      select: "basic schedule platform instructors media recording",
    });

    this.myLiveCourses.forEach((enrollment) => {
      if (
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData.status
        ) &&
        enrollment.courseId &&
        matchesStatus(enrollment, enrollment.courseId)
      ) {
        courses.push({
          type: "online-live",
          enrollment: enrollment,
          course: enrollment.courseId,
          sortDate: enrollment.enrollmentData.registrationDate,
        });
      }
    });
  }

  // Self-Paced Courses
  if (type === "all" || type === "self-paced") {
    await this.populate({
      path: "mySelfPacedCourses.courseId",
      select: "basic content instructor media videos",
    });

    this.mySelfPacedCourses.forEach((enrollment) => {
      const isExpired =
        enrollment.enrollmentData.expiryDate &&
        enrollment.enrollmentData.expiryDate < now;

      if (
        ["paid", "registered"].includes(enrollment.enrollmentData.status) &&
        !isExpired &&
        enrollment.courseId &&
        matchesStatus(enrollment, enrollment.courseId)
      ) {
        courses.push({
          type: "self-paced",
          enrollment: enrollment,
          course: enrollment.courseId,
          sortDate:
            enrollment.courseProgress.lastAccessedAt ||
            enrollment.enrollmentData.registrationDate,
        });
      }
    });
  }

  // Add this as a utility function or instance method in User model
  userSchema.methods.cleanupOrphanedEnrollments = async function () {
    // Clean up In-Person courses
    this.myInPersonCourses = this.myInPersonCourses.filter(
      (enrollment) => enrollment.courseId
    );

    // Clean up Live courses
    this.myLiveCourses = this.myLiveCourses.filter(
      (enrollment) => enrollment.courseId
    );

    // Clean up Self-Paced courses
    this.mySelfPacedCourses = this.mySelfPacedCourses.filter(
      (enrollment) => enrollment.courseId
    );

    return this.save();
  };

  // Sort courses
  if (sortBy === "recent") {
    courses.sort((a, b) => b.sortDate - a.sortDate);
  } else if (sortBy === "title") {
    courses.sort((a, b) =>
      a.course.basic.title.localeCompare(b.course.basic.title)
    );
  } else if (sortBy === "progress") {
    courses.sort((a, b) => {
      const progressA =
        a.enrollment.courseProgress?.overallPercentage ||
        a.enrollment.userProgress?.overallAttendancePercentage ||
        0;
      const progressB =
        b.enrollment.courseProgress?.overallPercentage ||
        b.enrollment.userProgress?.overallAttendancePercentage ||
        0;
      return progressB - progressA;
    });
  }

  return courses;
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
