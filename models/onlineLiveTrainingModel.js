// models/onlineLiveTrainingModel.js
/**
 * Updated Online Live Training Course Model
 *
 * Simplified structure based on In-Person model design patterns
 * Maintains all online-specific functionality with cleaner organization
 *
 * @module OnlineLiveTraining
 */

const mongoose = require("mongoose");

/**
 * Simplified Online Live Training Schema
 * Maximum 2-level nesting for easier form integration
 */
const onlineLiveCourseSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================
    basic: {
      courseCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
      },
      title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 200,
      },
      description: {
        type: String,
        required: true,
        maxLength: 2000,
      },
      aboutThisCourse: {
        type: String,
        maxLength: 500,
      },
      category: {
        type: String,
        enum: ["aesthetic", "medical", "business", "technical"],
        required: true,
      },
      status: {
        type: String,
        default: "draft",
        enum: [
          "draft",
          "open",
          "full",
          "in-progress",
          "completed",
          "cancelled",
        ],
      },
      courseType: {
        type: String,
        default: "online-live",
        immutable: true,
      },
    },

    // ========================================
    // SCHEDULING & TIME ZONES
    // ========================================
    schedule: {
      startDate: {
        type: Date,
        required: true,
        index: true,
      },
      endDate: {
        type: Date,
      },
      duration: {
        type: String,
        required: true, // e.g., "2 days", "8 hours"
      },
      registrationDeadline: {
        type: Date,
      },
      // Time zone management
      primaryTimezone: {
        type: String,
        required: true,
        default: "UTC",
      },
      displayTimezones: [String], // ['EST', 'PST', 'GMT']
      // Session pattern
      pattern: {
        type: String,
        enum: ["single", "daily", "weekly", "biweekly", "monthly", "custom"],
        default: "single",
      },
      sessionTime: {
        startTime: String, // "14:00"
        endTime: String, // "16:00"
        breakDuration: { type: Number, default: 10 }, // minutes
      },
      // Detailed sessions for multi-day courses
      sessions: [
        {
          dayNumber: Number,
          date: Date,
          startTime: String,
          endTime: String,
          title: String,
          type: {
            type: String,
            enum: ["lecture", "practical", "workshop", "q&a", "exam"],
            default: "lecture",
          },
          instructorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Instructor",
          },
        },
      ],
    },

    // ========================================
    // PRICING & ENROLLMENT
    // ========================================
    enrollment: {
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      earlyBirdPrice: {
        type: Number,
        min: 0,
      },
      earlyBirdDays: {
        type: Number,
        min: 1,
        max: 365,
        default: 30,
        validate: {
          validator: function (value) {
            if (this.earlyBirdPrice && this.earlyBirdPrice > 0) {
              return value && value > 0;
            }
            return true;
          },
          message: "Early bird days is required when early bird price is set",
        },
      },
      currency: { type: String, default: "USD" },
      seatsAvailable: {
        type: Number,
        default: 50,
        min: 1,
      },
      minEnrollment: {
        type: Number,
        min: 1,
      },
      currentEnrollment: { type: Number, default: 0 },
      waitlistEnabled: { type: Boolean, default: true },
      registrationUrl: String,
    },

    // ========================================
    // INSTRUCTORS
    // ========================================
    instructors: {
      primary: {
        instructorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Instructor",
        },
        name: String, // Cached for display
        role: { type: String, default: "Lead Instructor" },
      },
      additional: [
        {
          instructorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Instructor",
          },
          name: String,
          role: {
            type: String,
            enum: ["Co-Instructor", "Guest Instructor", "Assistant"],
            default: "Co-Instructor",
          },
          sessions: [String], // Session IDs they teach
        },
      ],
    },

    // ========================================
    // PLATFORM & ACCESS
    // ========================================
    platform: {
      name: {
        type: String,
        required: true,
        enum: [
          "Zoom",
          "Microsoft Teams",
          "Google Meet",
          "Webex",
          "GoToWebinar",
          "Custom",
        ],
      },
      accessUrl: {
        type: String,
        required: true,
      },
      meetingId: String,
      passcode: String,
      backupPlatform: String,
      backupUrl: String,
      features: {
        breakoutRooms: { type: Boolean, default: true },
        polling: { type: Boolean, default: true },
        whiteboard: { type: Boolean, default: true },
        recording: { type: Boolean, default: true },
        chat: { type: Boolean, default: true },
        screenSharing: { type: Boolean, default: true },
      },
    },

    // ========================================
    // COURSE CONTENT
    // ========================================
    content: {
      objectives: [
        {
          type: String,
          maxLength: 200,
        },
      ],
      modules: [
        {
          title: { type: String, required: true },
          description: String,
          duration: String,
          order: Number,
        },
      ],
      targetAudience: [String], // ["Medical doctors", "Nurses"]
      experienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "all-levels"],
        default: "all-levels",
      },
      prerequisites: String,
      detailedSyllabus: String,
    },

    // ========================================
    // TECHNICAL REQUIREMENTS
    // ========================================
    technical: {
      systemRequirements: {
        os: [String], // ["Windows 10+", "macOS 10.14+"]
        browsers: [String], // ["Chrome 80+", "Firefox 78+"]
        minimumRAM: { type: String, default: "4GB" },
        processor: { type: String, default: "Dual-core 2GHz" },
      },
      internetSpeed: {
        minimum: { type: String, default: "5 Mbps" },
        recommended: { type: String, default: "25 Mbps" },
      },
      requiredSoftware: [String], // Simple list of software names
      equipment: {
        camera: {
          type: String,
          enum: ["required", "recommended", "optional"],
          default: "recommended",
        },
        microphone: {
          type: String,
          enum: ["required", "recommended", "optional"],
          default: "required",
        },
        headset: {
          type: String,
          enum: ["required", "recommended", "optional"],
          default: "recommended",
        },
      },
      techCheckRequired: { type: Boolean, default: true },
      techCheckDate: Date,
      techCheckUrl: String,
    },

    // ========================================
    // INTERACTION & ENGAGEMENT
    // ========================================
    interaction: {
      participationRequired: { type: Boolean, default: true },
      cameraRequired: { type: Boolean, default: false },
      features: {
        polls: { type: Boolean, default: true },
        quizzes: { type: Boolean, default: true },
        breakoutRooms: { type: Boolean, default: true },
        qa: { type: Boolean, default: true },
        chat: { type: Boolean, default: true },
        reactions: { type: Boolean, default: true },
      },
      engagementTools: [String], // ["Mentimeter", "Kahoot", "Padlet"]
      networkingOptions: {
        virtualCoffeeBreaks: { type: Boolean, default: false },
        discussionForum: { type: Boolean, default: true },
        linkedInGroup: String,
        slackChannel: String,
      },
    },

    //new
    linkedToInPerson: {
      inPersonCourseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InPersonAestheticTraining",
        default: null,
      },
      isLinked: { type: Boolean, default: false },
      linkType: {
        type: String,
        enum: ["prerequisite", "supplementary", "follow-up"],
      },
      // NEW: Certificate suppression when linked
      suppressCertificate: { type: Boolean, default: false },
    },

    // ========================================
    // RECORDING & REPLAY
    // ========================================
    recording: {
      enabled: { type: Boolean, default: true },
      type: {
        type: String,
        enum: ["cloud", "local", "none"],
        default: "cloud",
      },
      availability: {
        forStudents: { type: Boolean, default: true },
        duration: { type: Number, default: 90 }, // days
        downloadable: { type: Boolean, default: false },
        passwordProtected: { type: Boolean, default: false },
      },
      sessions: [
        {
          sessionNumber: Number,
          date: Date,
          url: String,
          duration: Number, // minutes
          password: String,
          views: { type: Number, default: 0 },
        },
      ],
      autoTranscription: { type: Boolean, default: false },
    },

    // ========================================
    // MEDIA & RESOURCES (Simplified)
    // ========================================
    // ========================================
    // MEDIA & RESOURCES (Fixed)
    // ========================================
    media: {
      // Main course image - should be an object with url and alt
      mainImage: {
        url: String,
        alt: String,
      },

      // Document files (PDFs, Word docs, etc.)
      documents: [String], // Array of file URLs

      // Gallery images
      images: [String], // Array of image URLs

      // Video files and external links
      videos: [String], // Array of video URLs (both uploaded files and external links)

      // Promotional materials
      promotional: {
        brochureUrl: String,
        videoUrl: String,
        catalogUrl: String,
      },

      // Additional links (articles, websites, etc.)
      links: [
        {
          title: String,
          url: String,
          type: {
            type: String,
            enum: ["article", "video", "tool", "website"],
            default: "website",
          },
        },
      ],
    },
    // ========================================
    // DIGITAL MATERIALS
    // ========================================
    materials: {
      handouts: [
        {
          title: String,
          url: String,
          releaseTime: {
            type: String,
            enum: ["immediate", "scheduled", "after-session"],
            default: "immediate",
          },
          scheduledDate: Date,
        },
      ],
      virtualLabs: [
        {
          name: String,
          platform: String,
          url: String,
          duration: Number, // hours of access
        },
      ],
      lms: {
        enabled: { type: Boolean, default: false },
        platform: String, // "Moodle", "Canvas"
        courseUrl: String,
      },
    },

    // ========================================
    // ASSESSMENT & CERTIFICATION
    // ========================================
    assessment: {
      required: { type: Boolean, default: false },
      type: {
        type: String,
        enum: ["none", "quiz", "practical", "both"],
        default: "none",
      },
      passingScore: {
        type: Number,
        default: 70,
        min: 0,
        max: 100,
      },
      retakesAllowed: { type: Number, default: 1 },
      proctoring: {
        enabled: { type: Boolean, default: false },
        type: { type: String, enum: ["live", "ai", "none"], default: "none" },
      },
      platform: String, // "Google Forms", "Typeform"
      timeLimit: Number, // minutes
      questions: [
        {
          question: String,
          answers: [String],
          correctAnswer: Number,
          points: { type: Number, default: 1 },
        },
      ],
    },

    certification: {
      enabled: { type: Boolean, default: true },
      type: {
        type: String,
        enum: ["completion", "achievement", "participation"],
        default: "completion",
      },

      // Primary certification body
      issuingAuthorityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CertificationBody",
      },
      issuingAuthority: {
        type: String,
        default: "IAAI Training Institute",
      },

      // Additional certification bodies array
      certificationBodies: [
        {
          bodyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CertificationBody",
          },
          name: String,
          role: {
            type: String,
            enum: ["co-issuer", "endorser", "partner"],
            default: "co-issuer",
          },
        },
      ],

      requirements: {
        minimumAttendance: { type: Number, default: 80 },
        minimumScore: { type: Number, default: 70 },
        practicalRequired: { type: Boolean, default: false },
        projectRequired: { type: Boolean, default: false },
      },
      validity: {
        isLifetime: { type: Boolean, default: true },
        years: Number,
      },
      features: {
        digitalBadge: { type: Boolean, default: true },
        qrVerification: { type: Boolean, default: true },
        autoGenerate: { type: Boolean, default: true },
        blockchain: { type: Boolean, default: false },
      },
      template: { type: String, default: "professional_v1" },
    },

    // ========================================
    // ATTENDANCE & TRACKING
    // ========================================
    attendance: {
      trackingEnabled: { type: Boolean, default: true },
      method: {
        type: String,
        enum: ["automatic", "manual", "hybrid"],
        default: "automatic",
      },
      minimumRequired: { type: Number, default: 80 }, // percentage
      lateJoinWindow: { type: Number, default: 15 }, // minutes
      rules: {
        minimumSessionTime: { type: Number, default: 80 }, // percentage
        breakAttendanceRequired: { type: Boolean, default: false },
      },
      // Simplified attendance records
      records: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          sessionDate: Date,
          joinTime: Date,
          leaveTime: Date,
          duration: Number, // minutes
          percentage: Number,
          status: {
            type: String,
            enum: ["present", "absent", "partial", "excused"],
            default: "present",
          },
          deviceType: String, // "desktop", "mobile"
        },
      ],
    },

    // ========================================
    // SUPPORT & CONTACT
    // ========================================
    support: {
      contact: {
        email: { type: String, default: "info@iaa-i.com" },
        phone: String,
        whatsapp: { type: String, default: "+90 536 745 86 66" },
      },
      hours: {
        available: { type: Boolean, default: true },
        schedule: { type: String, default: "9 AM - 6 PM (Monday-Friday)" },
        timezone: String,
      },
      channels: {
        email: { type: Boolean, default: true },
        liveChat: { type: Boolean, default: false },
        ticketing: { type: Boolean, default: false },
      },
      emergencyProcedures: {
        platformFailure: String,
        instructorDisconnection: String,
      },
    },

    // ========================================
    // POST-COURSE ACCESS
    // ========================================
    postCourse: {
      accessDuration: {
        recordings: { type: Number, default: 90 }, // days
        materials: { type: Number, default: 180 }, // days
        forum: { type: Number, default: 365 }, // days
      },
      alumni: {
        refresherAccess: { type: Boolean, default: true },
        updatesIncluded: { type: Boolean, default: true },
        communityAccess: { type: Boolean, default: true },
        futureDiscount: Number, // percentage
      },
      continuedLearning: {
        monthlyWebinars: { type: Boolean, default: false },
        newsletter: { type: Boolean, default: true },
        advancedCourses: [String], // Course codes
      },
    },

    // ========================================
    // PARTICIPANT EXPERIENCE
    // ========================================
    experience: {
      onboarding: {
        welcomeVideoUrl: String,
        platformGuideUrl: String,
        checklistUrl: String,
        orientationDate: Date,
        orientationRequired: { type: Boolean, default: false },
      },
      accessibility: {
        closedCaptions: { type: Boolean, default: true },
        transcripts: { type: Boolean, default: true },
        signLanguage: { type: Boolean, default: false },
        audioDescription: { type: Boolean, default: false },
      },
      gamification: {
        enabled: { type: Boolean, default: false },
        points: { type: Boolean, default: false },
        badges: { type: Boolean, default: false },
        leaderboard: { type: Boolean, default: false },
      },
    },

    // ========================================
    // ANALYTICS (Simplified)
    // ========================================
    analytics: {
      engagement: {
        averageAttendance: Number,
        completionRate: Number,
        satisfactionScore: Number,
        dropoffRate: Number,
      },
      participation: {
        totalQuestions: { type: Number, default: 0 },
        totalPolls: { type: Number, default: 0 },
        totalChats: { type: Number, default: 0 },
      },
      technical: {
        avgConnectionQuality: Number,
        totalIssues: { type: Number, default: 0 },
      },
    },

    // ========================================
    // NOTIFICATIONS
    // ========================================
    notificationSettings: {
      courseUpdates: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      reminderSchedule: [Number], // Days before course: [7, 3, 1]
      marketingEmails: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },

    // ========================================
    // METADATA
    // ========================================
    metadata: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      version: { type: Number, default: 1 },
      tags: [String],
      internalNotes: String,
      isTemplate: { type: Boolean, default: false },
      templateName: String,
      lastModified: { type: Date, default: Date.now },
    },
    // Added for cloning feature, should not be directly part of general schema structure
    cloneInfo: {
      isClone: { type: Boolean, default: false },
      originalCourseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OnlineLiveTraining",
      },
      clonedAt: Date,
      clonedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      cloneOptions: Object, // Store the options used for cloning
    },
    postponementReason: String, // Added for postponement feature
    postponementDate: Date, // Added for postponement feature
  },
  {
    timestamps: true,
    collection: "onlinelivetrainings",
    // Ensure virtuals are included when converting to JSON or object
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========================================
// INDEXES
// ========================================

// IMPORTANT: The courseCode field is nested under basic.courseCode, not at the root level
onlineLiveCourseSchema.index({ "basic.courseCode": 1 }, { unique: true });
onlineLiveCourseSchema.index({ "schedule.startDate": 1, "basic.status": 1 });
onlineLiveCourseSchema.index({ "platform.name": 1 });
onlineLiveCourseSchema.index({ "basic.category": 1, "basic.status": 1 });
onlineLiveCourseSchema.index({ "instructors.primary.instructorId": 1 });
onlineLiveCourseSchema.index({ "certification.issuingAuthorityId": 1 });

// Additional useful indexes for queries
onlineLiveCourseSchema.index({
  "basic.title": "text",
  "basic.description": "text",
}); // Text search
onlineLiveCourseSchema.index({ "schedule.startDate": 1 }); // Date-based queries
onlineLiveCourseSchema.index({ "enrollment.price": 1 }); // Price-based queries
onlineLiveCourseSchema.index({ "metadata.createdBy": 1 }); // Creator-based queries

// ========================================
// VIRTUAL FIELDS
// ========================================

/**
 * Display duration
 */
onlineLiveCourseSchema.virtual("displayDuration").get(function () {
  // console.log('DEBUG VIRTUAL: displayDuration accessed.'); // ADD THIS
  if (this.schedule?.endDate && this.schedule?.startDate) {
    const days =
      Math.ceil(
        (this.schedule.endDate - this.schedule.startDate) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  return this.schedule?.duration || "1 session";
});

/**
 * Is multi-day course
 */
onlineLiveCourseSchema.virtual("isMultiDay").get(function () {
  // console.log('DEBUG VIRTUAL: isMultiDay accessed.'); // ADD THIS
  if (this.schedule?.endDate && this.schedule?.startDate) {
    // Compare dates only, ignoring time, to determine if it spans multiple days
    const startOfDay = new Date(
      this.schedule.startDate.getFullYear(),
      this.schedule.startDate.getMonth(),
      this.schedule.startDate.getDate()
    );
    const endOfDay = new Date(
      this.schedule.endDate.getFullYear(),
      this.schedule.endDate.getMonth(),
      this.schedule.endDate.getDate()
    );
    return startOfDay.getTime() !== endOfDay.getTime();
  }
  return false;
});

/**
 * Available seats
 */
onlineLiveCourseSchema.virtual("availableSeats").get(function () {
  // console.log('DEBUG VIRTUAL: availableSeats accessed.'); // ADD THIS
  // Ensure currentEnrollment and seatsAvailable are numbers, default to 0 if null/undefined
  const current = this.enrollment?.currentEnrollment || 0;
  const total = this.enrollment?.seatsAvailable || 0;
  return Math.max(0, total - current); // Ensure it doesn't go below 0
});

/**
 * Platform display name
 */
onlineLiveCourseSchema.virtual("displayPlatform").get(function () {
  // console.log('DEBUG VIRTUAL: displayPlatform accessed.'); // ADD THIS
  return this.platform?.name || "Online Platform";
});

/**
 * All instructors combined (primary + additional)
 */
onlineLiveCourseSchema.virtual("allInstructors").get(function () {
  // console.log('DEBUG VIRTUAL: allInstructors accessed.'); // ADD THIS
  const instructors = [];
  if (this.instructors?.primary) {
    // Use optional chaining
    instructors.push(this.instructors.primary);
  }
  if (
    this.instructors?.additional &&
    Array.isArray(this.instructors.additional)
  ) {
    // Use optional chaining
    instructors.push(...this.instructors.additional);
  }
  return instructors;
});

/**
 * Instructor names display (comma-separated string)
 */
onlineLiveCourseSchema.virtual("instructorNames").get(function () {
  // console.log('DEBUG VIRTUAL: instructorNames accessed.'); // ADD THIS
  const names = [];
  if (this.instructors?.primary?.name) {
    // Use optional chaining
    names.push(this.instructors.primary.name);
  }
  if (
    this.instructors?.additional &&
    Array.isArray(this.instructors.additional)
  ) {
    // Use optional chaining
    names.push(
      ...this.instructors.additional.map((i) => i?.name).filter(Boolean)
    ); // Use optional chaining on 'i'
  }
  return names.join(", ");
});

/**
 * Session frequency display
 */
onlineLiveCourseSchema.virtual("sessionFrequency").get(function () {
  // console.log('DEBUG VIRTUAL: sessionFrequency accessed.'); // ADD THIS
  const patterns = {
    single: "Single Session",
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Every Two Weeks",
    monthly: "Monthly",
    custom: "Custom Schedule",
  };
  return patterns[this.schedule?.pattern] || "Custom Schedule"; // Use optional chaining
});

/**
 * Total files count in media section
 */
onlineLiveCourseSchema.virtual("totalFilesCount").get(function () {
  // console.log('DEBUG VIRTUAL: totalFilesCount accessed.'); // ADD THIS
  let count = 0;
  if (this.media?.mainImage?.url) count += 1; // Use optional chaining
  if (this.media?.documents) count += this.media.documents.length; // Use optional chaining
  if (this.media?.images) count += this.media.images.length; // Use optional chaining
  if (this.media?.videos) count += this.media.videos.length; // Use optional chaining
  return count;
});

/**
 * Technical difficulty level based on requirements
 */
onlineLiveCourseSchema.virtual("technicalDifficulty").get(function () {
  // console.log('DEBUG VIRTUAL: technicalDifficulty accessed.'); // ADD THIS
  const softwareCount = this.technical?.requiredSoftware?.length || 0; // Use optional chaining
  const featuresCount = Object.values(this.platform?.features || {}).filter(
    (f) => f
  ).length; // Use optional chaining and default empty object

  if (softwareCount <= 1 && featuresCount <= 3) return "Basic";
  if (softwareCount <= 3 && featuresCount <= 6) return "Intermediate";
  return "Advanced";
});

// ========================================
// MIDDLEWARE (Hooks)
// ========================================

/**
 * Pre-validate middleware to ensure instructor is set before course goes live (non-draft).
 * This runs before save() and applies schema validation.
 */
onlineLiveCourseSchema.pre("validate", function (next) {
  console.log(
    "DEBUG MODEL: Pre-validate hook triggered for status:",
    this.basic.status
  ); // ADD THIS
  // Only require primary instructor for non-draft courses
  if (this.basic.status && this.basic.status !== "draft") {
    if (!this.instructors?.primary?.instructorId) {
      this.invalidate(
        "instructors.primary.instructorId",
        "Primary instructor is required for non-draft courses",
        this.instructors.primary?.instructorId
      );
      console.log(
        "DEBUG MODEL: Validation error: Primary instructor missing for non-draft."
      ); // ADD THIS
    }
  }
  next();
});

/**
 * Pre-save middleware to update instructor names and assigned courses in Instructor model.
 * Made more robust with null checks and error handling.
 */
onlineLiveCourseSchema.pre("save", async function (next) {
  console.log("DEBUG MODEL: Pre-save instructor hook triggered."); // ADD THIS
  // UNCOMMENT THE LINE BELOW TO TEMPORARILY BYPASS THIS HOOK FOR TESTING
  // return next();

  // Only execute if 'instructors' path or any sub-path within it is modified, or if it's a new document
  if (this.isModified("instructors") || this.isNew) {
    console.log(
      "DEBUG MODEL: Instructors modified or new document. Processing instructors..."
    ); // ADD THIS
    try {
      const Instructor = mongoose.model("Instructor");

      // --- Handle Primary Instructor ---
      if (this.instructors && this.instructors.primary) {
        // Ensure primary exists as an object
        console.log("DEBUG MODEL: Processing primary instructor."); // ADD THIS
        if (this.instructors.primary.instructorId) {
          const primaryInstructorId = this.instructors.primary.instructorId;
          console.log(
            "DEBUG MODEL: Looking up primary instructor ID:",
            primaryInstructorId
          ); // ADD THIS
          const primaryInstructor = await Instructor.findById(
            primaryInstructorId
          ).select("firstName lastName fullName assignedCourses");

          if (primaryInstructor) {
            this.instructors.primary.name =
              primaryInstructor.fullName ||
              `${primaryInstructor.firstName} ${primaryInstructor.lastName}`;
            console.log(
              "DEBUG MODEL: Primary instructor found:",
              this.instructors.primary.name
            ); // ADD THIS

            // Add/Update assignment in Instructor's assignedCourses
            const existingAssignment = primaryInstructor.assignedCourses.find(
              (c) => c.courseId && c.courseId.toString() === this._id.toString()
            );

            if (!existingAssignment) {
              primaryInstructor.assignedCourses.push({
                courseId: this._id,
                courseType: "OnlineLiveTraining",
                courseTitle: this.basic.title,
                startDate: this.schedule.startDate,
                endDate: this.schedule.endDate,
                role: this.instructors.primary.role,
              });
            } else {
              existingAssignment.courseTitle = this.basic.title;
              existingAssignment.startDate = this.schedule.startDate;
              existingAssignment.endDate = this.schedule.endDate;
              existingAssignment.role = this.instructors.primary.role;
            }
            // Use lean() for read and validateBeforeSave: false for update to prevent recursive hooks/validation
            await primaryInstructor.save({ validateBeforeSave: false });
            console.log(
              "DEBUG MODEL: Primary instructor assignment saved/updated."
            ); // ADD THIS
          } else {
            this.instructors.primary.instructorId = undefined; // Clear the invalid ID
            this.instructors.primary.name = undefined; // Clear the name
            this.instructors.primary.role = undefined; // Clear the role
            console.warn(
              `⚠️ Model: Primary instructor with ID ${primaryInstructorId} not found. Clearing primary instructor details.`
            );
          }
        } else {
          // If primary.instructorId is not provided or is empty
          this.instructors.primary.instructorId = undefined;
          this.instructors.primary.name = undefined;
          this.instructors.primary.role = undefined;
          console.log(
            "DEBUG MODEL: Primary instructor ID not provided. Clearing primary instructor details."
          ); // ADD THIS
        }
      } else if (this.instructors) {
        // If instructors.primary was not an object (e.g., null or undefined) but instructors parent exists
        this.instructors.primary = {}; // Ensure it's an empty object if initially null/undefined
        console.log(
          "DEBUG MODEL: Instructors.primary was not an object, initialized to empty."
        ); // ADD THIS
      } else {
        // If the entire instructors object is missing, ensure it's initialized
        this.instructors = { primary: {}, additional: [] };
        console.log(
          "DEBUG MODEL: Entire instructors object was missing, initialized to default."
        ); // ADD THIS
      }

      // --- Handle Additional Instructors ---
      console.log("DEBUG MODEL: Processing additional instructors..."); // ADD THIS
      if (
        this.instructors?.additional &&
        Array.isArray(this.instructors.additional)
      ) {
        const updatedAdditionalInstructors = [];
        for (let i = 0; i < this.instructors.additional.length; i++) {
          const inst = this.instructors.additional[i];
          console.log(
            `DEBUG MODEL: Checking additional instructor ${i}:`,
            inst
          ); // ADD THIS
          if (inst?.instructorId) {
            const additionalInstructor = await Instructor.findById(
              inst.instructorId
            ).select("firstName lastName fullName assignedCourses");

            if (additionalInstructor) {
              inst.name =
                additionalInstructor.fullName ||
                `${additionalInstructor.firstName} ${additionalInstructor.lastName}`;
              updatedAdditionalInstructors.push(inst);
              console.log(
                "DEBUG MODEL: Additional instructor found:",
                inst.name
              ); // ADD THIS

              // Add/Update assignment in Instructor's assignedCourses
              const existingAssignment =
                additionalInstructor.assignedCourses.find(
                  (c) =>
                    c.courseId && c.courseId.toString() === this._id.toString()
                );

              if (!existingAssignment) {
                additionalInstructor.assignedCourses.push({
                  courseId: this._id,
                  courseType: "OnlineLiveTraining",
                  courseTitle: this.basic.title,
                  startDate: this.schedule.startDate,
                  endDate: this.schedule.endDate,
                  role: inst.role,
                });
              } else {
                existingAssignment.courseTitle = this.basic.title;
                existingAssignment.startDate = this.schedule.startDate;
                existingAssignment.endDate = this.schedule.endDate;
                existingAssignment.role = inst.role;
              }
              await additionalInstructor.save({ validateBeforeSave: false });
              console.log(
                `DEBUG MODEL: Additional instructor ${inst.name} assignment saved/updated.`
              ); // ADD THIS
            } else {
              console.warn(
                `⚠️ Model: Additional instructor with ID ${inst.instructorId} not found. Skipping this entry.`
              );
            }
          } else {
            console.warn(
              `⚠️ Model: Invalid additional instructor entry at index ${i} (missing ID). Skipping.`
            );
          }
        }
        this.instructors.additional = updatedAdditionalInstructors;
      } else if (this.instructors) {
        // If instructors.additional was not an array, or was explicitly null/undefined
        this.instructors.additional = []; // Ensure it's an empty array
        console.log(
          "DEBUG MODEL: Instructors.additional was not an array, initialized to empty."
        ); // ADD THIS
      } else {
        // If the entire instructors object was missing (already handled above, but for completeness)
        this.instructors = { primary: {}, additional: [] };
        console.log(
          "DEBUG MODEL: Entire instructors object was missing, initialized to default (second check)."
        ); // ADD THIS
      }
    } catch (error) {
      console.error(
        "❌ Model Error: during instructor processing in pre-save:",
        error
      );
      // Re-throw or next(error) if this error should block the save
    }
  }
  next();
});

/**
 * Pre-save middleware to update certification body name.
 * Handles cases where the ID might be invalid or not found.
 */
onlineLiveCourseSchema.pre("save", async function (next) {
  console.log("DEBUG MODEL: Pre-save certification body hook triggered."); // ADD THIS
  // UNCOMMENT THE LINE BELOW TO TEMPORARILY BYPASS THIS HOOK FOR TESTING
  // return next();

  // Check if certification sub-document exists, and if issuingAuthorityId is modified or it's a new document
  if (
    this.certification &&
    (this.isModified("certification.issuingAuthorityId") || this.isNew)
  ) {
    console.log(
      "DEBUG MODEL: Primary certification body modified or new document. Processing..."
    ); // ADD THIS
    if (this.certification.issuingAuthorityId) {
      // Only try to look up if an ID is provided
      const issuingAuthorityId = this.certification.issuingAuthorityId;
      console.log(
        "DEBUG MODEL: Looking up primary certification body ID:",
        issuingAuthorityId
      ); // ADD THIS
      try {
        const CertificationBody = mongoose.model("CertificationBody");
        const body = await CertificationBody.findById(
          issuingAuthorityId
        ).select("companyName displayName"); // Fetch both names

        if (body) {
          this.certification.issuingAuthority =
            body.displayName || body.companyName;
          console.log(
            `DEBUG MODEL: Primary cert body found: ${this.certification.issuingAuthority}`
          ); // ADD THIS
        } else {
          // If CertificationBody not found for the given ID
          this.certification.issuingAuthority = "IAAI Training Institute"; // Revert to default name
          this.certification.issuingAuthorityId = undefined; // Clear the invalid ID
          console.warn(
            `⚠️ Model: Primary CertificationBody with ID ${issuingAuthorityId} not found. Reverting to default 'IAAI Training Institute'.`
          );
        }
      } catch (error) {
        // Handle potential cast errors (e.g., invalid ObjectId string) or database errors during lookup
        console.error(
          "❌ Model Error: retrieving primary certification body for name update:",
          error
        );
        this.certification.issuingAuthority = "IAAI Training Institute"; // Default name on error
        this.certification.issuingAuthorityId = undefined; // Clear the ID as it might be malformed
      }
    } else {
      // If issuingAuthorityId is explicitly null, undefined, or empty string from frontend
      this.certification.issuingAuthority = "IAAI Training Institute"; // Default name
      this.certification.issuingAuthorityId = undefined; // Ensure ID is truly undefined in DB
      console.log(
        "DEBUG MODEL: Primary cert body ID not provided. Reverting to default."
      ); // ADD THIS
    }
  } else if (this.certification) {
    // If certification.issuingAuthorityId was not modified and not new, but certification exists
    // Ensure the name is still set if an ID exists, in case the original name was missing
    if (
      this.certification.issuingAuthorityId &&
      !this.certification.issuingAuthority
    ) {
      console.log(
        "DEBUG MODEL: Re-validating existing primary issuing authority name."
      ); // ADD THIS
      try {
        const CertificationBody = mongoose.model("CertificationBody");
        const body = await CertificationBody.findById(
          this.certification.issuingAuthorityId
        ).select("companyName displayName");
        if (body) {
          this.certification.issuingAuthority =
            body.displayName || body.companyName;
        } else {
          this.certification.issuingAuthority = "IAAI Training Institute";
          this.certification.issuingAuthorityId = undefined;
          console.warn(
            `⚠️ Model: Existing Primary CertificationBody ID ${this.certification.issuingAuthorityId} no longer found. Reverting to default.`
          );
        }
      } catch (err) {
        console.error(
          "❌ Model Error: re-validating existing primary issuing authority name:",
          err
        );
        this.certification.issuingAuthority = "IAAI Training Institute";
        this.certification.issuingAuthorityId = undefined;
      }
    }
  } else {
    // If the entire certification object is missing
    this.certification = {}; // Initialize to empty object if null/undefined
    console.log(
      "DEBUG MODEL: Entire certification object was missing, initialized to empty."
    ); // ADD THIS
  }

  // --- Handle Additional Certification Bodies ---
  console.log("DEBUG MODEL: Processing additional certification bodies..."); // ADD THIS
  if (
    this.certification?.certificationBodies &&
    Array.isArray(this.certification.certificationBodies)
  ) {
    const updatedCertificationBodies = [];
    for (let i = 0; i < this.certification.certificationBodies.length; i++) {
      const cbEntry = this.certification.certificationBodies[i];
      console.log(`DEBUG MODEL: Checking additional cert body ${i}:`, cbEntry); // ADD THIS
      if (cbEntry?.bodyId) {
        // Ensure entry exists and has a bodyId
        try {
          const certBody = await mongoose
            .model("CertificationBody")
            .findById(cbEntry.bodyId)
            .select("companyName displayName");

          if (certBody) {
            cbEntry.name = certBody.displayName || certBody.companyName;
            updatedCertificationBodies.push(cbEntry); // Keep this valid entry
            console.log(
              "DEBUG MODEL: Additional cert body found:",
              cbEntry.name
            ); // ADD THIS
          } else {
            console.warn(
              `⚠️ Model: Additional CertificationBody with ID ${cbEntry.bodyId} not found. Skipping this entry.`
            );
          }
        } catch (error) {
          console.error(
            `❌ Model Error: retrieving additional certification body for ID ${cbEntry.bodyId}:`,
            error
          );
        }
      } else {
        console.warn(
          `⚠️ Model: Invalid additional certification body entry at index ${i} (missing ID). Skipping.`
        );
      }
    }
    this.certification.certificationBodies = updatedCertificationBodies; // Replace with cleaned list
    console.log(
      `DEBUG MODEL: Finished processing additional cert bodies. Count: ${this.certification.certificationBodies.length}`
    ); // ADD THIS
  } else if (this.certification) {
    // If certification.certificationBodies was not an array, or was explicitly null/undefined
    this.certification.certificationBodies = []; // Ensure it's an empty array
    console.log(
      "DEBUG MODEL: Certification.certificationBodies was not an array, initialized to empty."
    ); // ADD THIS
  } else {
    // If the entire certification object was missing (already handled above, but for completeness)
    this.certification = {};
    this.certification.certificationBodies = [];
    console.log(
      "DEBUG MODEL: Entire certification object was missing, initialized to default (second check)."
    ); // ADD THIS
  }

  next();
});

/**
 * Pre-save middleware to set registration deadline if not provided.
 * Also updates the lastModified timestamp.
 */
onlineLiveCourseSchema.pre("save", function (next) {
  console.log("DEBUG MODEL: Pre-save general defaults hook triggered."); // ADD THIS
  // Set registration deadline if not provided
  if (
    this.schedule &&
    !this.schedule.registrationDeadline &&
    this.schedule.startDate
  ) {
    const deadline = new Date(this.schedule.startDate);
    deadline.setDate(deadline.getDate() - 7); // 1 week before
    this.schedule.registrationDeadline = deadline;
    console.log(
      "DEBUG MODEL: Registration deadline set:",
      this.schedule.registrationDeadline
    ); // ADD THIS
  }

  // Update lastModified
  this.metadata.lastModified = new Date();
  console.log("DEBUG MODEL: Metadata lastModified updated."); // ADD THIS

  next();
});

// ========================================
// INSTANCE METHODS
// ========================================

/**
 * Check if course has available seats
 */
onlineLiveCourseSchema.methods.hasAvailableSeats = function () {
  // console.log('DEBUG INSTANCE METHOD: hasAvailableSeats accessed.'); // ADD THIS
  return this.availableSeats > 0;
};

/**
 * Calculate attendance percentage for a user
 */
onlineLiveCourseSchema.methods.getAttendancePercentage = function (userId) {
  // console.log('DEBUG INSTANCE METHOD: getAttendancePercentage accessed.'); // ADD THIS
  const userRecords =
    this.attendance?.records?.filter(
      // Use optional chaining
      (record) =>
        record.userId && record.userId.toString() === userId.toString()
    ) || [];

  if (userRecords.length === 0) return 0;

  const totalSessions = this.schedule?.sessions?.length || 1; // Use optional chaining
  // Ensure rules and minimumSessionTime exist before using them
  const minSessionTimeThreshold =
    this.attendance?.rules?.minimumSessionTime || 0;
  const attendedSessions = userRecords.filter(
    (record) =>
      record.percentage && record.percentage >= minSessionTimeThreshold
  ).length;

  return Math.round((attendedSessions / totalSessions) * 100);
};

/**
 * Check certificate eligibility
 */
onlineLiveCourseSchema.methods.isCertificateEligible = function (userId) {
  // console.log('DEBUG INSTANCE METHOD: isCertificateEligible accessed.'); // ADD THIS
  if (!this.certification?.enabled) return false;

  const attendancePercentage = this.getAttendancePercentage(userId);
  const meetsAttendance =
    attendancePercentage >=
    (this.certification?.requirements?.minimumAttendance || 0);

  // Add assessment check if required
  let meetsAssessment = true;
  if (this.assessment?.required) {
    // Placeholder: You'd implement actual assessment score checking here
    meetsAssessment = true; // For now, assumes true if assessment required but not implemented
  }

  // Corrected: Ensure these lines are syntactically correct (removed trailing comments)
  const meetsPractical =
    !this.certification?.requirements?.practicalRequired || true;
  const meetsProject =
    !this.certification?.requirements?.projectRequired || true;

  return meetsAttendance && meetsAssessment && meetsPractical && meetsProject;
};

/**
 * Get accessible recordings for a user
 */
onlineLiveCourseSchema.methods.getAccessibleRecordings = function (userId) {
  // console.log('DEBUG INSTANCE METHOD: getAccessibleRecordings accessed.'); // ADD THIS
  if (!this.recording?.availability?.forStudents) {
    // Use optional chaining
    return [];
  }

  const now = new Date();
  const accessDays = this.recording.availability.duration;

  // Filter based on session date and access duration
  return (this.recording?.sessions || []).filter((session) => {
    if (!session.date) return false; // Skip sessions without a date
    const daysSinceRecording = Math.floor(
      (now - new Date(session.date)) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRecording <= accessDays;
  });
};

/**
 * Calculate total course hours
 */
onlineLiveCourseSchema.methods.calculateTotalHours = function () {
  // console.log('DEBUG INSTANCE METHOD: calculateTotalHours accessed.'); // ADD THIS
  let totalHours = 0;

  if (this.schedule?.sessions && this.schedule.sessions.length > 0) {
    // Use optional chaining
    this.schedule.sessions.forEach((session) => {
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01T${session.startTime}`);
        const end = new Date(`2000-01-01T${session.endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        totalHours += hours;
      }
    });
  } else if (this.schedule?.sessionTime) {
    // Use optional chaining
    if (
      this.schedule.sessionTime.startTime &&
      this.schedule.sessionTime.endTime
    ) {
      const start = new Date(
        `2000-01-01T${this.schedule.sessionTime.startTime}`
      );
      const end = new Date(`2000-01-01T${this.schedule.sessionTime.endTime}`);
      const sessionHours = (end - start) / (1000 * 60 * 60);
      const days = this.isMultiDay
        ? Math.ceil(
            (this.schedule.endDate - this.schedule.startDate) /
              (1000 * 60 * 60 * 24)
          ) + 1
        : 1;
      totalHours = sessionHours * days;
    }
  }

  return totalHours;
};

/**
 * Generate technical requirements summary
 */
onlineLiveCourseSchema.methods.getTechnicalRequirementsSummary = function () {
  // console.log('DEBUG INSTANCE METHOD: getTechnicalRequirementsSummary accessed.'); // ADD THIS
  return {
    platform: this.platform?.name, // Use optional chaining
    accessUrl: this.platform?.accessUrl, // Use optional chaining
    systemRequirements: this.technical?.systemRequirements, // Use optional chaining
    internetSpeed: this.technical?.internetSpeed, // Use optional chaining
    equipment: this.technical?.equipment, // Use optional chaining
    techCheckRequired: this.technical?.techCheckRequired, // Use optional chaining
    techCheckDate: this.technical?.techCheckDate, // Use optional chaining
  };
};

/**
 * Calculate engagement score (simplified logic)
 */
onlineLiveCourseSchema.methods.calculateEngagementScore = function (userId) {
  // console.log('DEBUG INSTANCE METHOD: calculateEngagementScore accessed.'); // ADD THIS
  const attendancePercentage = this.getAttendancePercentage(userId);
  // Default to 0 if participation object is missing
  const participationScore =
    (this.analytics?.participation?.totalQuestions || 0) > 0 ? 80 : 60; // Use optional chaining

  return Math.round(attendancePercentage * 0.7 + participationScore * 0.3);
};

/**
 * Add file to media sub-document
 * @param {string} category - 'mainImage', 'documents', 'images', 'videos'
 * @param {string} url - The URL of the file
 * @returns {Promise<Document>} The saved course document
 */
onlineLiveCourseSchema.methods.addFile = function (category, url) {
  // console.log('DEBUG INSTANCE METHOD: addFile accessed.'); // ADD THIS
  if (!this.media) this.media = {}; // Ensure media object exists

  if (category === "mainImage") {
    this.media.mainImage = { url, alt: this.basic?.title + " main image" }; // Add alt text
  } else if (["documents", "images", "videos"].includes(category)) {
    if (!this.media[category]) this.media[category] = []; // Ensure array exists
    if (!this.media[category].includes(url)) {
      // Prevent duplicates
      this.media[category].push(url);
    }
  } else {
    throw new Error(`Invalid file category: ${category}`);
  }

  return this.save();
};

/**
 * Remove file from media sub-document
 * @param {string} category - 'mainImage', 'documents', 'images', 'videos'
 * @param {string} url - The URL of the file to remove
 * @returns {Promise<boolean>} True if removed, false if not found
 */
onlineLiveCourseSchema.methods.removeFile = async function (category, url) {
  // console.log('DEBUG INSTANCE METHOD: removeFile accessed.'); // ADD THIS
  if (!this.media) return false;

  let modified = false;
  if (category === "mainImage") {
    if (this.media.mainImage?.url === url) {
      this.media.mainImage = undefined; // Set to undefined to remove the sub-document
      modified = true;
    }
  } else if (this.media[category] && Array.isArray(this.media[category])) {
    const initialLength = this.media[category].length;
    this.media[category] = this.media[category].filter(
      (fileUrl) => fileUrl !== url
    );
    if (this.media[category].length < initialLength) {
      modified = true;
    }
  } else {
    console.warn(
      `Attempted to remove file from unknown category or non-array: ${category}`
    );
    return false;
  }

  if (modified) {
    await this.save(); // Save after modification
    return true;
  }
  return false;
};

/**
 * Get all media URLs from the course document
 * @returns {string[]} Array of all file URLs
 */
onlineLiveCourseSchema.methods.getAllMediaUrls = function () {
  // console.log('DEBUG INSTANCE METHOD: getAllMediaUrls accessed.'); // ADD THIS
  const urls = [];

  if (this.media?.mainImage?.url) {
    urls.push(this.media.mainImage.url);
  }

  // Use optional chaining for arrays
  if (this.media?.documents) {
    urls.push(...this.media.documents);
  }
  if (this.media?.images) {
    urls.push(...this.media.images);
  }
  // This will include both uploaded video files and external video links
  if (this.media?.videos) {
    urls.push(
      ...this.media.videos.filter((url) => url.startsWith("/uploads/"))
    ); // Only include actual uploaded files
  }

  if (this.media?.promotional) {
    if (this.media.promotional.brochureUrl)
      urls.push(this.media.promotional.brochureUrl);
    if (this.media.promotional.videoUrl)
      urls.push(this.media.promotional.videoUrl);
    if (this.media.promotional.catalogUrl)
      urls.push(this.media.promotional.catalogUrl);
  }

  return urls;
};

/**
 * Set certification issuing authority (for primary authority)
 * @param {ObjectId} bodyId - The ID of the CertificationBody
 * @returns {Promise<Document>} The updated course document
 */
onlineLiveCourseSchema.methods.setIssuingAuthority = async function (bodyId) {
  // console.log('DEBUG INSTANCE METHOD: setIssuingAuthority accessed.'); // ADD THIS
  const CertificationBody = mongoose.model("CertificationBody");
  const body = await CertificationBody.findById(bodyId).select(
    "companyName displayName"
  );

  if (!body) {
    throw new Error("Certification body not found for provided ID.");
  }

  this.certification.issuingAuthorityId = bodyId;
  this.certification.issuingAuthority = body.displayName || body.companyName;

  return this.save();
};

/**
 * Remove certification issuing authority (revert to default)
 * @returns {Promise<Document>} The updated course document
 */
onlineLiveCourseSchema.methods.removeIssuingAuthority = function () {
  // console.log('DEBUG INSTANCE METHOD: removeIssuingAuthority accessed.'); // ADD THIS
  if (this.certification) {
    this.certification.issuingAuthorityId = undefined;
    this.certification.issuingAuthority = "IAAI Training Institute"; // Default value
  }
  return this.save();
};

/**
 * Custom validation method for publishing a course (more strict than schema validation).
 * This is meant to be called manually in the controller before setting status to 'open'.
 */
onlineLiveCourseSchema.methods.validateForPublication = function () {
  // console.log('DEBUG INSTANCE METHOD: validateForPublication accessed.'); // ADD THIS
  const errors = [];

  // Basic info checks
  if (
    !this.basic?.title ||
    this.basic.title.trim() === "" ||
    this.basic.title === "New Online Course"
  ) {
    errors.push("Course title must be finalized before publishing.");
  }
  if (
    !this.basic?.description ||
    this.basic.description.trim() === "" ||
    this.basic.description === "Course description to be added"
  ) {
    errors.push("Course description must be completed before publishing.");
  }
  if (!this.basic?.courseCode || this.basic.courseCode.trim() === "") {
    errors.push("Course code is required before publishing.");
  }

  // Schedule checks
  if (!this.schedule?.startDate) {
    errors.push("Start date is required before publishing.");
  }
  if (!this.schedule?.duration || this.schedule.duration.trim() === "") {
    errors.push("Course duration is required before publishing.");
  }
  if (
    !this.schedule?.primaryTimezone ||
    this.schedule.primaryTimezone.trim() === ""
  ) {
    errors.push("Primary timezone is required before publishing.");
  }
  // Optional: check if sessions array is empty if pattern is 'custom' or multi-session
  if (
    this.schedule.pattern === "custom" &&
    (!this.schedule.sessions || this.schedule.sessions.length === 0)
  ) {
    errors.push("Custom schedule requires at least one session to be defined.");
  }

  // Enrollment checks
  if (
    this.enrollment?.price === undefined ||
    this.enrollment.price === null ||
    this.enrollment.price < 0
  ) {
    errors.push("A valid price is required before publishing.");
  }
  if (!this.enrollment?.seatsAvailable || this.enrollment.seatsAvailable < 1) {
    errors.push(
      "Number of available seats must be greater than 0 before publishing."
    );
  }

  // Instructor checks (primary must exist)
  if (!this.instructors?.primary?.instructorId) {
    errors.push("A primary instructor must be assigned before publishing.");
  }

  // Platform checks
  if (!this.platform?.name || this.platform.name.trim() === "") {
    errors.push("Platform name is required before publishing.");
  }
  if (!this.platform?.accessUrl || this.platform.accessUrl.trim() === "") {
    errors.push("Platform access URL is required before publishing.");
  }

  // Minimal content checks
  if (!this.content?.objectives || this.content.objectives.length === 0) {
    errors.push(
      "At least one learning objective is recommended before publishing."
    );
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

/**
 * Search courses by a given term across various fields.
 */
onlineLiveCourseSchema.statics.searchCourses = function (searchTerm) {
  // console.log('DEBUG STATIC METHOD: searchCourses accessed.'); // ADD THIS
  const searchRegex = new RegExp(searchTerm, "i");
  return this.find({
    $or: [
      { "basic.title": searchRegex },
      { "basic.description": searchRegex },
      { "platform.name": searchRegex },
      { "instructors.primary.name": searchRegex }, // Search by primary instructor's cached name
      { "basic.courseCode": searchRegex },
      { "metadata.tags": searchRegex }, // Search by tags
    ],
  });
};

//new to manage linked
/**
 * Check if this course is linked to an in-person course
 */
onlineLiveCourseSchema.virtual("isLinkedToInPerson").get(function () {
  return (
    this.linkedToInPerson?.isLinked && this.linkedToInPerson?.inPersonCourseId
  );
});

/**
 * Check if certificate should be issued for this online course
 */
onlineLiveCourseSchema.methods.canIssueCertificate = async function (userId) {
  // Check basic eligibility first
  if (!this.isCertificateEligible(userId)) {
    return {
      eligible: false,
      reason: "Does not meet basic course requirements",
    };
  }

  // If not linked to in-person course, issue certificate
  if (!this.isLinkedToInPerson) {
    return { eligible: true };
  }

  // If linked but certificate is not suppressed, issue certificate
  if (!this.linkedToInPerson.suppressCertificate) {
    return { eligible: true };
  }

  // Certificate is suppressed for linked courses
  return {
    eligible: false,
    reason:
      "Certificate will be issued upon completion of the linked in-person course",
    linkedInPersonCourseId: this.linkedToInPerson.inPersonCourseId,
  };
};

// ========================================
// EXPORT MODEL
// ========================================

module.exports =
  mongoose.models.OnlineLiveTraining ||
  mongoose.model("OnlineLiveTraining", onlineLiveCourseSchema);
