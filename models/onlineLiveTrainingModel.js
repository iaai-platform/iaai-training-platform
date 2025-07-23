// ████████████████████████████████████████████████████████████████████████████████
// ██                                                                            ██
// ██                      ONLINE LIVE TRAINING MODEL                          ██
// ██                           FINAL COMPLETE VERSION                          ██
// ██                                                                            ██
// ████████████████████████████████████████████████████████████████████████████████
/**
 * Complete Online Live Training Course Model
 *
 * Features:
 * ✅ Bidirectional Linked Course System
 * ✅ Early Bird Pricing with Dynamic Calculations
 * ✅ Multi-Authority Certification System
 * ✅ Advanced Session Management & Time Zones
 * ✅ Comprehensive Attendance Tracking
 * ✅ Certificate Suppression for Linked Courses
 * ✅ Recording & Replay Management
 * ✅ Interactive Engagement Tools
 * ✅ Technical Requirements Management
 *
 * @module OnlineLiveTraining
 * @version 2.0.0
 * @author IAAI Training Institute
 */

const mongoose = require("mongoose");

// ════════════════════════════════════════════════════════════════════════════════
// ║                                  SCHEMA DEFINITION                           ║
// ════════════════════════════════════════════════════════════════════════════════

const onlineLiveCourseSchema = new mongoose.Schema(
  {
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        BASIC COURSE INFORMATION                     │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                     SCHEDULING & TIME ZONES                         │
    // └─────────────────────────────────────────────────────────────────────┘
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
      // 🌍 Time zone management
      primaryTimezone: {
        type: String,
        required: true,
        default: "UTC",
      },
      displayTimezones: [String], // ['EST', 'PST', 'GMT']
      // 📅 Session pattern
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
      // 🗓️ Detailed sessions for multi-day courses
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    PRICING & ENROLLMENT MANAGEMENT                  │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      INSTRUCTOR MANAGEMENT                          │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                       PLATFORM & ACCESS                             │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        COURSE CONTENT                               │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    TECHNICAL REQUIREMENTS                           │
    // └─────────────────────────────────────────────────────────────────────┘
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
      requiredSoftware: [String],
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    INTERACTION & ENGAGEMENT                         │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                   🔗 LINKED TO IN-PERSON COURSE 🔗                  ┃
    // ┃                      Bidirectional Course Linking                   ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
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
      // 🎓 Certificate suppression when linked to in-person course
      suppressCertificate: { type: Boolean, default: false },
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      RECORDING & REPLAY                             │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      MEDIA & RESOURCES                              │
    // └─────────────────────────────────────────────────────────────────────┘
    media: {
      mainImage: {
        url: String,
        alt: String,
      },
      documents: [String], // PDF, Word docs, etc.
      images: [String], // Gallery images
      videos: [String], // Video URLs (uploaded + external)
      promotional: {
        brochureUrl: String,
        videoUrl: String,
        catalogUrl: String,
      },
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      DIGITAL MATERIALS                              │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    ASSESSMENT & TESTING                             │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                 🎓 MULTI-AUTHORITY CERTIFICATION 🎓                 ┃
    // ┃                  Advanced Certificate Management                    ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    certification: {
      enabled: { type: Boolean, default: true },
      type: {
        type: String,
        enum: ["completion", "achievement", "participation"],
        default: "completion",
      },
      // 🏛️ Primary Certification Authority
      issuingAuthorityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CertificationBody",
      },
      issuingAuthority: {
        type: String,
        default: "IAAI Training Institute",
      },
      // 🤝 Additional Certification Bodies
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
      // 📋 Requirements & Validation
      requirements: {
        minimumAttendance: { type: Number, default: 80 },
        minimumScore: { type: Number, default: 70 },
        practicalRequired: { type: Boolean, default: false },
        projectRequired: { type: Boolean, default: false },
      },
      // ⏰ Validity Period
      validity: {
        isLifetime: { type: Boolean, default: true },
        years: Number,
      },
      // 🔐 Digital Features
      features: {
        digitalBadge: { type: Boolean, default: true },
        qrVerification: { type: Boolean, default: true },
        autoGenerate: { type: Boolean, default: true },
        blockchain: { type: Boolean, default: false },
      },
      template: { type: String, default: "professional_v1" },
    },

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                    📊 ATTENDANCE TRACKING 📊                       ┃
    // ┃                   Advanced Session Monitoring                      ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    SUPPORT & CONTACT                                │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    POST-COURSE ACCESS                               │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                  PARTICIPANT EXPERIENCE                             │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        ANALYTICS                                    │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      NOTIFICATIONS                                  │
    // └─────────────────────────────────────────────────────────────────────┘
    notificationSettings: {
      courseUpdates: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      reminderSchedule: [Number], // Days before course: [7, 3, 1]
      marketingEmails: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        METADATA                                     │
    // └─────────────────────────────────────────────────────────────────────┘
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

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    ADDITIONAL FEATURES                              │
    // └─────────────────────────────────────────────────────────────────────┘
    cloneInfo: {
      isClone: { type: Boolean, default: false },
      originalCourseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OnlineLiveTraining",
      },
      clonedAt: Date,
      clonedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      cloneOptions: Object,
    },
    postponementReason: String,
    postponementDate: Date,
  },
  {
    timestamps: true,
    collection: "onlinelivetrainings",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ║                                   INDEXES                                    ║
// ════════════════════════════════════════════════════════════════════════════════

onlineLiveCourseSchema.index({ "basic.courseCode": 1 }, { unique: true });
onlineLiveCourseSchema.index({ "schedule.startDate": 1, "basic.status": 1 });
onlineLiveCourseSchema.index({ "platform.name": 1 });
onlineLiveCourseSchema.index({ "basic.category": 1, "basic.status": 1 });
onlineLiveCourseSchema.index({ "instructors.primary.instructorId": 1 });
onlineLiveCourseSchema.index({ "certification.issuingAuthorityId": 1 });
onlineLiveCourseSchema.index({ "linkedToInPerson.inPersonCourseId": 1 }); // NEW: For linking queries
onlineLiveCourseSchema.index({
  "basic.title": "text",
  "basic.description": "text",
}); // Text search
onlineLiveCourseSchema.index({ "enrollment.price": 1 }); // Price-based queries
onlineLiveCourseSchema.index({ "metadata.createdBy": 1 }); // Creator-based queries

// ════════════════════════════════════════════════════════════════════════════════
// ║                                VIRTUAL FIELDS                               ║
// ║                            Smart Computed Properties                         ║
// ════════════════════════════════════════════════════════════════════════════════

// ┌─────────────────────────────────────────────────────────────────────┐
// │                    📅 Schedule & Duration Virtuals                  │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("displayDuration").get(function () {
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

onlineLiveCourseSchema.virtual("isMultiDay").get(function () {
  if (this.schedule?.endDate && this.schedule?.startDate) {
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

// ┌─────────────────────────────────────────────────────────────────────┐
// │                     💺 Enrollment & Capacity Virtuals               │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("availableSeats").get(function () {
  const current = this.enrollment?.currentEnrollment || 0;
  const total = this.enrollment?.seatsAvailable || 0;
  return Math.max(0, total - current);
});

// ┌─────────────────────────────────────────────────────────────────────┐
// │                      🖥️ Platform & Technical Virtuals               │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("displayPlatform").get(function () {
  return this.platform?.name || "Online Platform";
});

onlineLiveCourseSchema.virtual("technicalDifficulty").get(function () {
  const softwareCount = this.technical?.requiredSoftware?.length || 0;
  const featuresCount = Object.values(this.platform?.features || {}).filter(
    (f) => f
  ).length;

  if (softwareCount <= 1 && featuresCount <= 3) return "Basic";
  if (softwareCount <= 3 && featuresCount <= 6) return "Intermediate";
  return "Advanced";
});

// ┌─────────────────────────────────────────────────────────────────────┐
// │                      👥 Instructor Virtuals                         │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("allInstructors").get(function () {
  const instructors = [];
  if (this.instructors?.primary) {
    instructors.push(this.instructors.primary);
  }
  if (
    this.instructors?.additional &&
    Array.isArray(this.instructors.additional)
  ) {
    instructors.push(...this.instructors.additional);
  }
  return instructors;
});

onlineLiveCourseSchema.virtual("instructorNames").get(function () {
  const names = [];
  if (this.instructors?.primary?.name) {
    names.push(this.instructors.primary.name);
  }
  if (
    this.instructors?.additional &&
    Array.isArray(this.instructors.additional)
  ) {
    names.push(
      ...this.instructors.additional.map((i) => i?.name).filter(Boolean)
    );
  }
  return names.join(", ");
});

// ┌─────────────────────────────────────────────────────────────────────┐
// │                     📅 Session & Pattern Virtuals                   │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("sessionFrequency").get(function () {
  const patterns = {
    single: "Single Session",
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Every Two Weeks",
    monthly: "Monthly",
    custom: "Custom Schedule",
  };
  return patterns[this.schedule?.pattern] || "Custom Schedule";
});

// ┌─────────────────────────────────────────────────────────────────────┐
// │                       📁 Media & Files Virtuals                     │
// └─────────────────────────────────────────────────────────────────────┘

onlineLiveCourseSchema.virtual("totalFilesCount").get(function () {
  let count = 0;
  if (this.media?.mainImage?.url) count += 1;
  if (this.media?.documents) count += this.media.documents.length;
  if (this.media?.images) count += this.media.images.length;
  if (this.media?.videos) count += this.media.videos.length;
  return count;
});

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                   💰 EARLY BIRD PRICING VIRTUALS 💰                 ┃
// ┃                      Smart Pricing Calculations                     ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

onlineLiveCourseSchema.virtual("earlyBirdDeadline").get(function () {
  if (this.schedule?.startDate && this.enrollment?.earlyBirdDays) {
    const deadline = new Date(this.schedule.startDate);
    deadline.setDate(deadline.getDate() - this.enrollment.earlyBirdDays);
    return deadline;
  }
  return null;
});

onlineLiveCourseSchema.virtual("isEarlyBirdActive").get(function () {
  if (!this.enrollment?.earlyBirdPrice || this.enrollment.earlyBirdPrice <= 0) {
    return false;
  }
  const deadline = this.earlyBirdDeadline;
  if (!deadline) return false;
  return new Date() <= deadline;
});

onlineLiveCourseSchema.virtual("earlyBirdDaysRemaining").get(function () {
  const deadline = this.earlyBirdDeadline;
  if (!deadline) return 0;
  const now = new Date();
  if (now > deadline) return 0;
  const timeDiff = deadline.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(0, daysDiff);
});

onlineLiveCourseSchema.virtual("currentPrice").get(function () {
  if (this.isEarlyBirdActive && this.enrollment?.earlyBirdPrice) {
    return this.enrollment.earlyBirdPrice;
  }
  return this.enrollment?.price || 0;
});

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                    🔗 LINKED COURSE VIRTUALS 🔗                     ┃
// ┃                    Smart Course Relationship                        ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

onlineLiveCourseSchema.virtual("isLinkedToInPerson").get(function () {
  return (
    this.linkedToInPerson?.isLinked && this.linkedToInPerson?.inPersonCourseId
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                               MIDDLEWARE                                     ║
// ║                        Automatic Data Synchronization                       ║
// ════════════════════════════════════════════════════════════════════════════════

onlineLiveCourseSchema.pre("validate", function (next) {
  console.log(
    "🔍 OnlineLiveTraining pre-validate hook triggered for status:",
    this.basic.status
  );
  // Only require primary instructor for non-draft courses
  if (this.basic.status && this.basic.status !== "draft") {
    if (!this.instructors?.primary?.instructorId) {
      this.invalidate(
        "instructors.primary.instructorId",
        "Primary instructor is required for non-draft courses",
        this.instructors.primary?.instructorId
      );
      console.log(
        "❌ Validation error: Primary instructor missing for non-draft."
      );
    }
  }
  next();
});

onlineLiveCourseSchema.pre("save", async function (next) {
  console.log("🚀 OnlineLiveTraining pre-save middleware triggered.");

  try {
    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                    👥 INSTRUCTOR PROCESSING                       ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    if (this.isModified("instructors") || this.isNew) {
      console.log("📚 Processing instructors...");

      const Instructor = mongoose.model("Instructor");

      // Handle Primary Instructor
      if (this.instructors && this.instructors.primary) {
        if (this.instructors.primary.instructorId) {
          const primaryInstructorId = this.instructors.primary.instructorId;
          console.log("🔍 Looking up primary instructor:", primaryInstructorId);

          const primaryInstructor = await Instructor.findById(
            primaryInstructorId
          ).select("firstName lastName fullName assignedCourses");

          if (primaryInstructor) {
            this.instructors.primary.name =
              primaryInstructor.fullName ||
              `${primaryInstructor.firstName} ${primaryInstructor.lastName}`;
            console.log(
              "✅ Primary instructor found:",
              this.instructors.primary.name
            );

            // Update instructor's assigned courses
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

            await primaryInstructor.save({ validateBeforeSave: false });
            console.log("💾 Primary instructor assignment updated.");
          } else {
            this.instructors.primary.instructorId = undefined;
            this.instructors.primary.name = undefined;
            this.instructors.primary.role = undefined;
            console.warn("⚠️ Primary instructor not found. Clearing details.");
          }
        } else {
          this.instructors.primary.instructorId = undefined;
          this.instructors.primary.name = undefined;
          this.instructors.primary.role = undefined;
        }
      } else if (this.instructors) {
        this.instructors.primary = {};
      } else {
        this.instructors = { primary: {}, additional: [] };
      }

      // Handle Additional Instructors
      if (
        this.instructors?.additional &&
        Array.isArray(this.instructors.additional)
      ) {
        const updatedAdditionalInstructors = [];

        for (let i = 0; i < this.instructors.additional.length; i++) {
          const inst = this.instructors.additional[i];

          if (inst?.instructorId) {
            const additionalInstructor = await Instructor.findById(
              inst.instructorId
            ).select("firstName lastName fullName assignedCourses");

            if (additionalInstructor) {
              inst.name =
                additionalInstructor.fullName ||
                `${additionalInstructor.firstName} ${additionalInstructor.lastName}`;
              updatedAdditionalInstructors.push(inst);

              // Update instructor's assigned courses
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
            } else {
              console.warn(
                `⚠️ Additional instructor ${inst.instructorId} not found.`
              );
            }
          }
        }

        this.instructors.additional = updatedAdditionalInstructors;
      } else if (this.instructors) {
        this.instructors.additional = [];
      }
    }

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                🎓 CERTIFICATION BODY PROCESSING                   ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    if (
      this.certification &&
      (this.isModified("certification.issuingAuthorityId") || this.isNew)
    ) {
      console.log("🏛️ Processing primary certification body...");

      if (this.certification.issuingAuthorityId) {
        const issuingAuthorityId = this.certification.issuingAuthorityId;
        const CertificationBody = mongoose.model("CertificationBody");
        const body = await CertificationBody.findById(
          issuingAuthorityId
        ).select("companyName displayName");

        if (body) {
          this.certification.issuingAuthority =
            body.displayName || body.companyName;
          console.log(
            "✅ Primary cert body found:",
            this.certification.issuingAuthority
          );
        } else {
          this.certification.issuingAuthority = "IAAI Training Institute";
          this.certification.issuingAuthorityId = undefined;
          console.warn(
            "⚠️ Primary certification body not found. Reverting to default."
          );
        }
      } else {
        this.certification.issuingAuthority = "IAAI Training Institute";
        this.certification.issuingAuthorityId = undefined;
      }
    } else if (this.certification) {
      if (
        this.certification.issuingAuthorityId &&
        !this.certification.issuingAuthority
      ) {
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
        }
      }
    } else {
      this.certification = {};
    }

    // Handle Additional Certification Bodies
    if (
      this.certification?.certificationBodies &&
      Array.isArray(this.certification.certificationBodies)
    ) {
      const updatedCertificationBodies = [];

      for (let i = 0; i < this.certification.certificationBodies.length; i++) {
        const cbEntry = this.certification.certificationBodies[i];

        if (cbEntry?.bodyId) {
          const certBody = await mongoose
            .model("CertificationBody")
            .findById(cbEntry.bodyId)
            .select("companyName displayName");

          if (certBody) {
            cbEntry.name = certBody.displayName || certBody.companyName;
            updatedCertificationBodies.push(cbEntry);
          } else {
            console.warn(
              `⚠️ Additional certification body ${cbEntry.bodyId} not found.`
            );
          }
        }
      }

      this.certification.certificationBodies = updatedCertificationBodies;
    } else if (this.certification) {
      this.certification.certificationBodies = [];
    }

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃                      🛠️ GENERAL DEFAULTS                          ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

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
        "📅 Registration deadline set:",
        this.schedule.registrationDeadline
      );
    }

    // Update lastModified
    this.metadata.lastModified = new Date();

    console.log(
      "✅ OnlineLiveTraining pre-save middleware completed successfully."
    );
    next();
  } catch (error) {
    console.error(
      "❌ CRITICAL ERROR in OnlineLiveTraining pre-save middleware:",
      error
    );
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                              INSTANCE METHODS                               ║
// ║                          Course-Specific Operations                          ║
// ════════════════════════════════════════════════════════════════════════════════

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                   🎓 CERTIFICATE ELIGIBILITY METHODS                ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

/**
 * 🎓 Check if certificate should be issued for this online course
 * Handles linked course certificate suppression
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

/**
 * 📊 Check basic certificate eligibility for a user
 */
onlineLiveCourseSchema.methods.isCertificateEligible = function (userId) {
  if (!this.certification?.enabled) return false;

  const attendancePercentage = this.getAttendancePercentage(userId);
  const meetsAttendance =
    attendancePercentage >=
    (this.certification?.requirements?.minimumAttendance || 0);

  let meetsAssessment = true;
  if (this.assessment?.required) {
    meetsAssessment = true; // Placeholder for actual assessment implementation
  }

  const meetsPractical =
    !this.certification?.requirements?.practicalRequired || true;
  const meetsProject =
    !this.certification?.requirements?.projectRequired || true;

  return meetsAttendance && meetsAssessment && meetsPractical && meetsProject;
};

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                     💰 PRICING METHODS                              ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

/**
 * 💰 Get comprehensive pricing information with early bird details
 */
onlineLiveCourseSchema.methods.getPricingInfo = function () {
  const earlyBirdDeadline = this.earlyBirdDeadline;

  return {
    regularPrice: this.enrollment?.price || 0,
    earlyBirdPrice: this.enrollment?.earlyBirdPrice || null,
    earlyBirdDays: this.enrollment?.earlyBirdDays || null,
    earlyBirdDeadline: earlyBirdDeadline,
    isEarlyBirdActive: this.isEarlyBirdActive,
    currentPrice: this.currentPrice,
    daysRemaining: this.earlyBirdDaysRemaining,
    savings:
      this.isEarlyBirdActive && this.enrollment?.earlyBirdPrice
        ? this.enrollment.price - this.enrollment.earlyBirdPrice
        : 0,
    currency: this.enrollment?.currency || "USD",
  };
};

/**
 * 💰 Check if a specific date qualifies for early bird pricing
 */
onlineLiveCourseSchema.methods.isEarlyBirdValidOnDate = function (date) {
  if (!this.enrollment?.earlyBirdPrice || this.enrollment.earlyBirdPrice <= 0) {
    return false;
  }
  const deadline = this.earlyBirdDeadline;
  if (!deadline) return false;
  return new Date(date) <= deadline;
};

/**
 * 💰 Get price for a specific date
 */
onlineLiveCourseSchema.methods.getPriceOnDate = function (date) {
  if (this.isEarlyBirdValidOnDate(date)) {
    return this.enrollment?.earlyBirdPrice || this.enrollment?.price || 0;
  }
  return this.enrollment?.price || 0;
};

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                      📊 ATTENDANCE METHODS                          ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

/**
 * 📊 Calculate attendance percentage for a user
 */
onlineLiveCourseSchema.methods.getAttendancePercentage = function (userId) {
  const userRecords =
    this.attendance?.records?.filter(
      (record) =>
        record.userId && record.userId.toString() === userId.toString()
    ) || [];

  if (userRecords.length === 0) return 0;

  const totalSessions = this.schedule?.sessions?.length || 1;
  const minSessionTimeThreshold =
    this.attendance?.rules?.minimumSessionTime || 0;
  const attendedSessions = userRecords.filter(
    (record) =>
      record.percentage && record.percentage >= minSessionTimeThreshold
  ).length;

  return Math.round((attendedSessions / totalSessions) * 100);
};

/**
 * ⏰ Calculate total course hours
 */
onlineLiveCourseSchema.methods.calculateTotalHours = function () {
  let totalHours = 0;

  if (this.schedule?.sessions && this.schedule.sessions.length > 0) {
    this.schedule.sessions.forEach((session) => {
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01T${session.startTime}`);
        const end = new Date(`2000-01-01T${session.endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        totalHours += hours;
      }
    });
  } else if (this.schedule?.sessionTime) {
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

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                       🎯 UTILITY METHODS                            ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

/**
 * 💺 Check if course has available seats
 */
onlineLiveCourseSchema.methods.hasAvailableSeats = function () {
  return this.availableSeats > 0;
};

/**
 * 🎬 Get accessible recordings for a user
 */
onlineLiveCourseSchema.methods.getAccessibleRecordings = function (userId) {
  if (!this.recording?.availability?.forStudents) {
    return [];
  }

  const now = new Date();
  const accessDays = this.recording.availability.duration;

  return (this.recording?.sessions || []).filter((session) => {
    if (!session.date) return false;
    const daysSinceRecording = Math.floor(
      (now - new Date(session.date)) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRecording <= accessDays;
  });
};

/**
 * 🔧 Generate technical requirements summary
 */
onlineLiveCourseSchema.methods.getTechnicalRequirementsSummary = function () {
  return {
    platform: this.platform?.name,
    accessUrl: this.platform?.accessUrl,
    systemRequirements: this.technical?.systemRequirements,
    internetSpeed: this.technical?.internetSpeed,
    equipment: this.technical?.equipment,
    techCheckRequired: this.technical?.techCheckRequired,
    techCheckDate: this.technical?.techCheckDate,
  };
};

/**
 * 📈 Calculate engagement score (simplified logic)
 */
onlineLiveCourseSchema.methods.calculateEngagementScore = function (userId) {
  const attendancePercentage = this.getAttendancePercentage(userId);
  const participationScore =
    (this.analytics?.participation?.totalQuestions || 0) > 0 ? 80 : 60;

  return Math.round(attendancePercentage * 0.7 + participationScore * 0.3);
};

/**
 * 📁 Add file to media
 */
onlineLiveCourseSchema.methods.addFile = function (category, url) {
  if (!this.media) this.media = {};

  if (category === "mainImage") {
    this.media.mainImage = { url, alt: this.basic?.title + " main image" };
  } else if (["documents", "images", "videos"].includes(category)) {
    if (!this.media[category]) this.media[category] = [];
    if (!this.media[category].includes(url)) {
      this.media[category].push(url);
    }
  } else {
    throw new Error(`Invalid file category: ${category}`);
  }

  return this.save();
};

/**
 * 🗑️ Remove file from media
 */
onlineLiveCourseSchema.methods.removeFile = async function (category, url) {
  if (!this.media) return false;

  let modified = false;
  if (category === "mainImage") {
    if (this.media.mainImage?.url === url) {
      this.media.mainImage = undefined;
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
    await this.save();
    return true;
  }
  return false;
};

/**
 * 📁 Get all media URLs for cleanup
 */
onlineLiveCourseSchema.methods.getAllMediaUrls = function () {
  const urls = [];

  if (this.media?.mainImage?.url) {
    urls.push(this.media.mainImage.url);
  }

  if (this.media?.documents) {
    urls.push(...this.media.documents);
  }
  if (this.media?.images) {
    urls.push(...this.media.images);
  }
  if (this.media?.videos) {
    urls.push(
      ...this.media.videos.filter((url) => url.startsWith("/uploads/"))
    );
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
 * 🏛️ Set certification issuing authority
 */
onlineLiveCourseSchema.methods.setIssuingAuthority = async function (bodyId) {
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
 * 🔄 Remove certification issuing authority (revert to default)
 */
onlineLiveCourseSchema.methods.removeIssuingAuthority = function () {
  if (this.certification) {
    this.certification.issuingAuthorityId = undefined;
    this.certification.issuingAuthority = "IAAI Training Institute";
  }
  return this.save();
};

/**
 * ✅ Custom validation method for publishing a course
 */
onlineLiveCourseSchema.methods.validateForPublication = function () {
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

  // Instructor checks
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

  // Content checks
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

// ════════════════════════════════════════════════════════════════════════════════
// ║                               STATIC METHODS                                ║
// ║                          Database Query Helpers                             ║
// ════════════════════════════════════════════════════════════════════════════════

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃                      🔍 QUERY HELPER METHODS                        ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

/**
 * 📅 Find upcoming courses
 */
onlineLiveCourseSchema.statics.findUpcoming = function () {
  return this.find({
    "schedule.startDate": { $gte: new Date() },
    "basic.status": "open",
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 🖥️ Find courses by platform
 */
onlineLiveCourseSchema.statics.findByPlatform = function (platform) {
  return this.find({
    "platform.name": new RegExp(platform, "i"),
    "basic.status": { $in: ["open", "full"] },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 💺 Find available courses with seats
 */
onlineLiveCourseSchema.statics.findAvailable = function () {
  return this.find({
    "basic.status": "open",
    "schedule.startDate": { $gte: new Date() },
    $expr: {
      $lt: ["$enrollment.currentEnrollment", "$enrollment.seatsAvailable"],
    },
  });
};

/**
 * 🕐 Find courses by timezone
 */
onlineLiveCourseSchema.statics.findByTimezone = function (timezone) {
  return this.find({
    $or: [
      { "schedule.primaryTimezone": timezone },
      { "schedule.displayTimezones": timezone },
    ],
    "basic.status": { $in: ["open", "full"] },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 🔗 Find courses linked to specific in-person course
 */
onlineLiveCourseSchema.statics.findLinkedToInPerson = function (
  inPersonCourseId
) {
  return this.find({
    "linkedToInPerson.inPersonCourseId": inPersonCourseId,
    "linkedToInPerson.isLinked": true,
  });
};

/**
 * 🎬 Find courses with recordings available
 */
onlineLiveCourseSchema.statics.findWithRecordings = function () {
  return this.find({
    "recording.enabled": true,
    "recording.availability.forStudents": true,
    "basic.status": { $in: ["completed", "in-progress"] },
  });
};

/**
 * 🔍 Search courses with text
 */
onlineLiveCourseSchema.statics.searchCourses = function (searchTerm) {
  const searchRegex = new RegExp(searchTerm, "i");
  return this.find({
    $or: [
      { "basic.title": searchRegex },
      { "basic.description": searchRegex },
      { "platform.name": searchRegex },
      { "instructors.primary.name": searchRegex },
      { "basic.courseCode": searchRegex },
      { "metadata.tags": searchRegex },
    ],
  });
};

/**
 * 📊 Get course analytics
 */
onlineLiveCourseSchema.statics.getCourseAnalytics = function (filters = {}) {
  const pipeline = [
    { $match: { "basic.status": { $ne: "draft" }, ...filters } },
    {
      $group: {
        _id: null,
        totalCourses: { $sum: 1 },
        totalEnrollments: { $sum: "$enrollment.currentEnrollment" },
        averagePrice: { $avg: "$enrollment.price" },
        platformBreakdown: { $push: "$platform.name" },
        categoryBreakdown: { $push: "$basic.category" },
      },
    },
  ];

  return this.aggregate(pipeline);
};

/**
 * 💰 Find courses with early bird pricing active
 */
onlineLiveCourseSchema.statics.findEarlyBirdActive = function () {
  const now = new Date();
  return this.find({
    "enrollment.earlyBirdPrice": { $gt: 0 },
    "basic.status": "open",
    $expr: {
      $lte: [
        now,
        {
          $dateSubtract: {
            startDate: "$schedule.startDate",
            unit: "day",
            amount: "$enrollment.earlyBirdDays",
          },
        },
      ],
    },
  });
};

/**
 * 📋 Find courses by category with advanced filtering
 */
onlineLiveCourseSchema.statics.findByCategory = function (
  category,
  options = {}
) {
  const query = {
    "basic.category": category,
    "basic.status": {
      $in: options.statuses || ["open", "full", "in-progress"],
    },
  };

  if (options.startDate) {
    query["schedule.startDate"] = { $gte: options.startDate };
  }

  if (options.maxPrice) {
    query["enrollment.price"] = { $lte: options.maxPrice };
  }

  if (options.platform) {
    query["platform.name"] = new RegExp(options.platform, "i");
  }

  return this.find(query).sort({ "schedule.startDate": 1 });
};

/**
 * 🎯 Find courses by experience level
 */
onlineLiveCourseSchema.statics.findByExperienceLevel = function (level) {
  return this.find({
    "content.experienceLevel": level,
    "basic.status": { $in: ["open", "full"] },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 📈 Get enrollment statistics
 */
onlineLiveCourseSchema.statics.getEnrollmentStats = function (dateRange = {}) {
  const matchStage = {
    "basic.status": { $ne: "draft" },
  };

  if (dateRange.start || dateRange.end) {
    matchStage["schedule.startDate"] = {};
    if (dateRange.start)
      matchStage["schedule.startDate"].$gte = new Date(dateRange.start);
    if (dateRange.end)
      matchStage["schedule.startDate"].$lte = new Date(dateRange.end);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: "$basic.category",
        totalCourses: { $sum: 1 },
        totalCapacity: { $sum: "$enrollment.seatsAvailable" },
        totalEnrolled: { $sum: "$enrollment.currentEnrollment" },
        averagePrice: { $avg: "$enrollment.price" },
        averageOccupancy: {
          $avg: {
            $multiply: [
              {
                $divide: [
                  "$enrollment.currentEnrollment",
                  "$enrollment.seatsAvailable",
                ],
              },
              100,
            ],
          },
        },
      },
    },
    { $sort: { totalEnrolled: -1 } },
  ];

  return this.aggregate(pipeline);
};

/**
 * 🔧 Find courses needing technical setup
 */
onlineLiveCourseSchema.statics.findRequiringTechCheck = function () {
  return this.find({
    "technical.techCheckRequired": true,
    "basic.status": { $in: ["open", "full"] },
    "schedule.startDate": { $gte: new Date() },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 👥 Find courses by instructor
 */
onlineLiveCourseSchema.statics.findByInstructor = function (instructorId) {
  return this.find({
    $or: [
      { "instructors.primary.instructorId": instructorId },
      { "instructors.additional.instructorId": instructorId },
    ],
    "basic.status": { $ne: "cancelled" },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * 🎓 Find courses eligible for certificates
 */
onlineLiveCourseSchema.statics.findCertificateEligible = function () {
  return this.find({
    "certification.enabled": true,
    "basic.status": { $in: ["completed", "in-progress"] },
  });
};

// ████████████████████████████████████████████████████████████████████████████████
// ██                                                                            ██
// ██                              EXPORT MODEL                                 ██
// ██                                                                            ██
// ████████████████████████████████████████████████████████████████████████████████

module.exports =
  mongoose.models.OnlineLiveTraining ||
  mongoose.model("OnlineLiveTraining", onlineLiveCourseSchema);
