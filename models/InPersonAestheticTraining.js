// models/InPersonAestheticTraining.js
/**
 * Simplified In-Person Aesthetic Training Course Model
 *
 * FIXED: Media structure simplified to align with form expectations
 * Removed complex courseMaterials structure
 *
 * @module InPersonAestheticTraining
 */

const mongoose = require("mongoose");

/**
 * Simplified In-Person Course Schema
 * Organized into logical sections with consistent 2-level nesting maximum
 */
const inPersonCourseSchema = new mongoose.Schema(
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
    },

    // ========================================
    // SCHEDULING
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
      timeSlots: {
        startTime: { type: String, default: "09:00" },
        endTime: { type: String, default: "17:00" },
        lunchBreak: { type: String, default: "12:30-13:30" },
      },
      registrationDeadline: {
        type: Date,
      },
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
        default: 30, // Default: early bird expires 30 days before course
        validate: {
          validator: function (value) {
            // Only validate if earlyBirdPrice is set
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
        default: 10,
        min: 1,
      },
      minEnrollment: {
        type: Number,
        default: 5,
        min: 1,
      },
      currentEnrollment: { type: Number, default: 0 },
    },

    // ========================================
    // INSTRUCTORS
    // ========================================
    instructors: {
      primary: {
        instructorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Instructor",
          required: true,
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
          name: String, // Cached for display
          role: {
            type: String,
            enum: [
              "Lead Instructor",
              "Co-Instructor",
              "Guest Instructor",
              "Assistant",
            ],
            default: "Co-Instructor",
          },
        },
      ],
    },

    // ========================================
    // VENUE INFORMATION
    // ========================================
    venue: {
      name: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: [
          "hospital",
          "training-center",
          "clinic",
          "university",
          "conference-center",
        ],
        default: "training-center",
      },
      facilities: [String], // ["OR", "Lab", "Lecture Hall"]
      mapUrl: String,
      parkingAvailable: { type: Boolean, default: true },
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
          duration: String, // "2 hours"
          order: Number,
        },
      ],
      targetAudience: [String], // ["Medical doctors", "Nurses"]
      experienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "all-levels"],
        default: "intermediate",
      },
      prerequisites: String, // Simple text description
      technicalRequirements: String,
    },

    // ========================================
    // PRACTICAL TRAINING
    // ========================================
    practical: {
      hasHandsOn: {
        type: Boolean,
        default: true,
      },
      procedures: [String], // ["Botox injection", "Filler placement"]
      equipment: [String], // ["Injection kit", "Ultrasound"]
      trainingType: [
        {
          type: String,
          enum: [
            "live-patient",
            "cadaver",
            "simulation",
            "observation",
            "model",
          ],
        },
      ],
      studentRatio: {
        type: String,
        default: "1:1", // "1:1", "2:1", "small-group"
      },
      safetyRequirements: {
        ppeRequired: { type: Boolean, default: true },
        healthClearance: { type: Boolean, default: false },
        insuranceRequired: { type: Boolean, default: false },
      },
    },

    //new
    // Update the linkedCourse section in InPersonAestheticTraining model
    linkedCourse: {
      onlineCourseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OnlineLiveTraining",
        default: null,
      },
      isRequired: { type: Boolean, default: false },
      relationship: {
        type: String,
        enum: ["prerequisite", "supplementary", "follow-up"],
        default: "prerequisite",
      },
      completionRequired: { type: Boolean, default: true },
      // ⭐ NEW: Pricing override for linked course
      isFree: { type: Boolean, default: true }, // Linked courses are free by default
      customPrice: { type: Number, default: 0 }, // Allow custom pricing if needed
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
      questions: [
        {
          question: { type: String, required: true },
          answers: [{ type: String, required: true }],
          correctAnswer: { type: Number, required: true },
          points: { type: Number, default: 1 },
        },
      ],
    },

    // In models/InPersonAestheticTraining.js
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

      // ADD THIS - Additional certification bodies array
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
      },
      validity: {
        isLifetime: { type: Boolean, default: true },
        years: Number,
      },
      features: {
        digitalBadge: { type: Boolean, default: true },
        qrVerification: { type: Boolean, default: true },
        autoGenerate: { type: Boolean, default: true },
      },
    },

    // ========================================
    // INCLUSIONS & SERVICES
    // ========================================
    inclusions: {
      meals: {
        breakfast: { type: Boolean, default: false },
        lunch: { type: Boolean, default: true },
        coffee: { type: Boolean, default: true },
        dietaryOptions: { type: Boolean, default: true },
      },
      accommodation: {
        included: { type: Boolean, default: false },
        assistanceProvided: { type: Boolean, default: true },
        partnerHotels: [String], // Hotel names or booking links
      },
      materials: {
        courseMaterials: { type: Boolean, default: true },
        certificatePrinting: { type: Boolean, default: true },
        practiceSupplies: { type: Boolean, default: false },
        takeHome: { type: Boolean, default: true },
      },
      services: {
        airportTransfer: { type: Boolean, default: false },
        localTransport: { type: Boolean, default: false },
        translation: { type: Boolean, default: false },
      },
    },

    // ========================================
    // FILES & MEDIA - SIMPLIFIED STRUCTURE
    // ========================================
    media: {
      // Main course image
      mainImage: {
        url: String,
        alt: String,
      },

      documents: [String], // Course documents (PDF, PPT, DOC, etc.)
      images: [String], // Gallery images, photos
      videos: [String], // Video URLs (YouTube, Vimeo, direct links)

      // Promotional content URLs
      promotional: {
        brochureUrl: String,
        videoUrl: String,
        catalogUrl: String,
      },

      // External links with metadata
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
    // ATTENDANCE & TRACKING
    // ========================================
    attendance: {
      trackingEnabled: { type: Boolean, default: true },
      minimumRequired: { type: Number, default: 80 }, // percentage
      checkInMethod: {
        type: String,
        enum: ["manual", "qr-code", "digital-signature"],
        default: "manual",
      },
      records: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          date: Date,
          checkIn: Date,
          checkOut: Date,
          hoursAttended: Number,
          status: {
            type: String,
            enum: ["present", "absent", "late", "excused"],
            default: "present",
          },
        },
      ],
    },

    // ========================================
    // CONTACT & SUPPORT
    // ========================================
    contact: {
      email: { type: String, default: "info@iaa-i.com" },
      phone: String,
      whatsapp: { type: String, default: "+90 536 745 86 66" },
      registrationUrl: String,
      supportHours: { type: String, default: "9 AM - 6 PM (Monday-Friday)" },
    },

    // ========================================
    // Notification
    // ========================================

    notificationSettings: {
      courseUpdates: {
        type: Boolean,
        default: true, // Users are opted in by default
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      marketingEmails: {
        type: Boolean,
        default: true,
      },
      weeklyDigest: {
        type: Boolean,
        default: false,
      },
    },

    // ========================================
    // METADATA
    // ========================================
    metadata: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      version: { type: Number, default: 1 },
      tags: [String], // For internal organization
      notes: String, // Internal notes
      isTemplate: { type: Boolean, default: false },
      templateName: String,
    },
  },
  {
    timestamps: true,
    collection: "inpersonaesthetictrainings",
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

inPersonCourseSchema.index({ "basic.courseCode": 1 }, { unique: true });
inPersonCourseSchema.index({ "schedule.startDate": 1, "basic.status": 1 });
inPersonCourseSchema.index({ "venue.city": 1, "venue.country": 1 });
inPersonCourseSchema.index({ "basic.category": 1, "basic.status": 1 });
inPersonCourseSchema.index({ "instructors.primary.instructorId": 1 });

inPersonCourseSchema.index({ "certification.issuingAuthorityId": 1 });

// ========================================
// VIRTUAL FIELDS
// ========================================

/**
 * Display duration (human readable)
 */
inPersonCourseSchema.virtual("displayDuration").get(function () {
  if (this.schedule.endDate && this.schedule.startDate) {
    const days =
      Math.ceil(
        (this.schedule.endDate - this.schedule.startDate) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  return this.schedule.duration || "1 day";
});

/**
 * Location display
 */
inPersonCourseSchema.virtual("displayLocation").get(function () {
  return `${this.venue.city}, ${this.venue.country}`;
});

/**
 * Available seats
 */
inPersonCourseSchema.virtual("availableSeats").get(function () {
  return this.enrollment.seatsAvailable - this.enrollment.currentEnrollment;
});

/**
 * Is multi-day course
 */
inPersonCourseSchema.virtual("isMultiDay").get(function () {
  if (this.schedule.endDate && this.schedule.startDate) {
    return (
      this.schedule.endDate.getTime() !== this.schedule.startDate.getTime()
    );
  }
  return false;
});

/**
 * All instructors (combined)
 */
inPersonCourseSchema.virtual("allInstructors").get(function () {
  const instructors = [];
  if (this.instructors.primary) {
    instructors.push(this.instructors.primary);
  }
  if (this.instructors.additional) {
    instructors.push(...this.instructors.additional);
  }
  return instructors;
});

/**
 * Instructor names (comma-separated)
 */
inPersonCourseSchema.virtual("instructorNames").get(function () {
  const names = [];
  if (this.instructors.primary?.name) {
    names.push(this.instructors.primary.name);
  }
  if (this.instructors.additional) {
    names.push(
      ...this.instructors.additional.map((i) => i.name).filter(Boolean)
    );
  }
  return names.join(", ");
});

/**
 * Total files count
 */
inPersonCourseSchema.virtual("totalFilesCount").get(function () {
  let count = 0;
  if (this.media.mainImage?.url) count += 1;
  if (this.media.documents) count += this.media.documents.length;
  if (this.media.images) count += this.media.images.length;
  if (this.media.videos) count += this.media.videos.length;
  return count;
});

/**
 * Has media content
 */
inPersonCourseSchema.virtual("hasMediaContent").get(function () {
  return (
    this.totalFilesCount > 0 ||
    this.media.promotional?.brochureUrl ||
    this.media.promotional?.videoUrl ||
    (this.media.links && this.media.links.length > 0)
  );
});

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Pre-save middleware to update instructor names
 */
inPersonCourseSchema.pre("save", async function (next) {
  if (this.isModified("instructors")) {
    try {
      const Instructor = mongoose.model("Instructor");

      // Update primary instructor name
      if (
        this.instructors.primary?.instructorId &&
        !this.instructors.primary.name
      ) {
        const instructor = await Instructor.findById(
          this.instructors.primary.instructorId
        ).select("firstName lastName fullName");
        if (instructor) {
          this.instructors.primary.name =
            instructor.fullName ||
            `${instructor.firstName} ${instructor.lastName}`;
        }
      }

      // Update additional instructor names
      if (this.instructors.additional) {
        for (let i = 0; i < this.instructors.additional.length; i++) {
          const inst = this.instructors.additional[i];
          if (inst.instructorId && !inst.name) {
            const instructor = await Instructor.findById(
              inst.instructorId
            ).select("firstName lastName fullName");
            if (instructor) {
              this.instructors.additional[i].name =
                instructor.fullName ||
                `${instructor.firstName} ${instructor.lastName}`;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error updating instructor names:", error);
    }
  }

  if (
    this.isModified("certification.issuingAuthorityId") &&
    this.certification?.issuingAuthorityId
  ) {
    try {
      const CertificationBody = mongoose.model("CertificationBody");
      const body = await CertificationBody.findById(
        this.certification.issuingAuthorityId
      ).select("companyName");
      if (body) {
        this.certification.issuingAuthority = body.companyName;
      }
    } catch (error) {
      console.error("Error updating issuing authority name:", error);
    }
  }

  next();
});

/**
 * Pre-save middleware to validate dates
 */
inPersonCourseSchema.pre("save", function (next) {
  // Set registration deadline if not provided
  if (!this.schedule.registrationDeadline && this.schedule.startDate) {
    const deadline = new Date(this.schedule.startDate);
    deadline.setDate(deadline.getDate() - 7); // 1 week before
    this.schedule.registrationDeadline = deadline;
  }

  next();
});

/**
 * Pre-save middleware to clean up empty arrays
 */
inPersonCourseSchema.pre("save", function (next) {
  // Clean up empty media arrays
  if (this.media) {
    if (this.media.documents && this.media.documents.length === 0) {
      this.media.documents = undefined;
    }
    if (this.media.images && this.media.images.length === 0) {
      this.media.images = undefined;
    }
    if (this.media.videos && this.media.videos.length === 0) {
      this.media.videos = undefined;
    }
    if (this.media.links && this.media.links.length === 0) {
      this.media.links = undefined;
    }
  }

  next();
});

// ========================================
// VIRTUAL FIELDS - ADD THESE TO YOUR EXISTING VIRTUALS
// ========================================

/**
 * Early bird deadline (calculated from start date and early bird days)
 */
inPersonCourseSchema.virtual("earlyBirdDeadline").get(function () {
  if (this.schedule?.startDate && this.enrollment?.earlyBirdDays) {
    const deadline = new Date(this.schedule.startDate);
    deadline.setDate(deadline.getDate() - this.enrollment.earlyBirdDays);
    return deadline;
  }
  return null;
});

/**
 * Check if early bird pricing is currently active
 */
inPersonCourseSchema.virtual("isEarlyBirdActive").get(function () {
  if (!this.enrollment?.earlyBirdPrice || this.enrollment.earlyBirdPrice <= 0) {
    return false;
  }

  const deadline = this.earlyBirdDeadline;
  if (!deadline) return false;

  return new Date() <= deadline;
});

/**
 * Days remaining for early bird pricing
 */
inPersonCourseSchema.virtual("earlyBirdDaysRemaining").get(function () {
  const deadline = this.earlyBirdDeadline;
  if (!deadline) return 0;

  const now = new Date();
  if (now > deadline) return 0;

  const timeDiff = deadline.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(0, daysDiff);
});

/**
 * Current effective price (early bird or regular)
 */
inPersonCourseSchema.virtual("currentPrice").get(function () {
  if (this.isEarlyBirdActive && this.enrollment?.earlyBirdPrice) {
    return this.enrollment.earlyBirdPrice;
  }
  return this.enrollment?.price || 0;
});

// ========================================
// INSTANCE METHODS - ADD THESE TO YOUR EXISTING METHODS
// ========================================

/**
 * Get pricing information with early bird details
 */
inPersonCourseSchema.methods.getPricingInfo = function () {
  const now = new Date();
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
 * Check if a specific date qualifies for early bird pricing
 */
inPersonCourseSchema.methods.isEarlyBirdValidOnDate = function (date) {
  if (!this.enrollment?.earlyBirdPrice || this.enrollment.earlyBirdPrice <= 0) {
    return false;
  }

  const deadline = this.earlyBirdDeadline;
  if (!deadline) return false;

  return new Date(date) <= deadline;
};

/**
 * Get price for a specific date
 */
inPersonCourseSchema.methods.getPriceOnDate = function (date) {
  if (this.isEarlyBirdValidOnDate(date)) {
    return this.enrollment?.earlyBirdPrice || this.enrollment?.price || 0;
  }
  return this.enrollment?.price || 0;
};

// ========================================
// INSTANCE METHODS
// ========================================

/**
 * Check if course has available seats
 */
inPersonCourseSchema.methods.hasAvailableSeats = function () {
  return this.enrollment.currentEnrollment < this.enrollment.seatsAvailable;
};

/**
 * Get lead instructor
 */
inPersonCourseSchema.methods.getLeadInstructor = async function () {
  if (this.instructors.primary?.instructorId) {
    return await mongoose
      .model("Instructor")
      .findById(this.instructors.primary.instructorId);
  }
  return null;
};

/**
 * Calculate attendance percentage for a user
 */
inPersonCourseSchema.methods.getAttendancePercentage = function (userId) {
  const userRecords = this.attendance.records.filter(
    (record) => record.userId.toString() === userId.toString()
  );

  if (userRecords.length === 0) return 0;

  const totalHours = userRecords.reduce(
    (sum, record) => sum + (record.hoursAttended || 0),
    0
  );
  const maxHours = this.calculateTotalHours();

  return maxHours > 0 ? Math.round((totalHours / maxHours) * 100) : 0;
};

/**
 * Check certificate eligibility for a user
 */
inPersonCourseSchema.methods.isCertificateEligible = function (userId) {
  if (!this.certification.enabled) return false;

  const attendancePercentage = this.getAttendancePercentage(userId);
  const meetsAttendance =
    attendancePercentage >= this.certification.requirements.minimumAttendance;

  // Add assessment check if required
  let meetsAssessment = true;
  if (this.assessment.required) {
    // Implementation depends on how you store user assessment results
    // This is a placeholder
    meetsAssessment = true;
  }

  return meetsAttendance && meetsAssessment;
};

/**
 * Calculate total course hours (basic estimation)
 */
inPersonCourseSchema.methods.calculateTotalHours = function () {
  // Simple calculation based on start/end times and days
  if (this.schedule.startDate && this.schedule.endDate) {
    const days =
      Math.ceil(
        (this.schedule.endDate - this.schedule.startDate) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return days * 8; // Assume 8 hours per day
  }

  // Parse duration string if available
  const durationMatch = this.schedule.duration?.match(/(\d+)\s*(hour|day)/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    return unit === "day" ? value * 8 : value;
  }

  return 8; // Default to 8 hours
};

/**
 * Add file to media - SIMPLIFIED
 */
inPersonCourseSchema.methods.addFile = function (category, url) {
  if (!this.media) this.media = {};

  if (category === "mainImage") {
    this.media.mainImage = { url };
  } else if (["documents", "images", "videos"].includes(category)) {
    if (!this.media[category]) this.media[category] = [];
    this.media[category].push(url);
  }

  return this.save();
};

/**
 * Remove file from media - SIMPLIFIED
 */
inPersonCourseSchema.methods.removeFile = function (category, url) {
  if (!this.media) return false;

  if (category === "mainImage") {
    this.media.mainImage = null;
  } else if (this.media[category] && Array.isArray(this.media[category])) {
    this.media[category] = this.media[category].filter(
      (fileUrl) => fileUrl !== url
    );
  }

  return this.save();
};

/**
 * Add multiple files to media
 */
inPersonCourseSchema.methods.addFiles = function (category, urls) {
  if (!this.media) this.media = {};

  if (["documents", "images", "videos"].includes(category)) {
    if (!this.media[category]) this.media[category] = [];
    this.media[category].push(...urls);
  }

  return this.save();
};

/**
 * Get all media URLs for cleanup
 */
inPersonCourseSchema.methods.getAllMediaUrls = function () {
  const urls = [];

  if (this.media?.mainImage?.url) {
    urls.push(this.media.mainImage.url);
  }

  ["documents", "images", "videos"].forEach((category) => {
    if (this.media?.[category]) {
      urls.push(...this.media[category]);
    }
  });

  return urls;
};

/**
 * Set certification issuing authority
 */
inPersonCourseSchema.methods.setIssuingAuthority = async function (bodyId) {
  const CertificationBody = mongoose.model("CertificationBody");
  const body = await CertificationBody.findById(bodyId).select("companyName");

  if (!body) {
    throw new Error("Certification body not found");
  }

  this.certification.issuingAuthorityId = bodyId;
  this.certification.issuingAuthority = body.companyName;

  return this.save();
};

/**
 * Remove certification issuing authority (revert to default)
 */
inPersonCourseSchema.methods.removeIssuingAuthority = function () {
  this.certification.issuingAuthorityId = undefined;
  this.certification.issuingAuthority = "IAAI Training Institute"; // Default
  return this.save();
};

// ========================================
// STATIC METHODS
// ========================================

/**
 * Find upcoming courses
 */
inPersonCourseSchema.statics.findUpcoming = function () {
  return this.find({
    "schedule.startDate": { $gte: new Date() },
    "basic.status": "open",
  }).sort({ "schedule.startDate": 1 });
};

/**
 * Find courses by city
 */
inPersonCourseSchema.statics.findByCity = function (city) {
  return this.find({
    "venue.city": new RegExp(city, "i"),
    "basic.status": { $in: ["open", "full"] },
  }).sort({ "schedule.startDate": 1 });
};

/**
 * Find available courses with seats
 */
inPersonCourseSchema.statics.findAvailable = function () {
  return this.find({
    "basic.status": "open",
    "schedule.startDate": { $gte: new Date() },
    $expr: {
      $lt: ["$enrollment.currentEnrollment", "$enrollment.seatsAvailable"],
    },
  });
};

/**
 * Search courses with text
 */
inPersonCourseSchema.statics.searchCourses = function (searchTerm) {
  const searchRegex = new RegExp(searchTerm, "i");
  return this.find({
    $or: [
      { "basic.title": searchRegex },
      { "basic.description": searchRegex },
      { "venue.city": searchRegex },
      { "instructors.primary.name": searchRegex },
    ],
  });
};

//new
// Add method to check if user wants notifications
module.exports =
  mongoose.models.InPersonAestheticTraining ||
  mongoose.model("InPersonAestheticTraining", inPersonCourseSchema);

// ========================================
// EXPORT MODEL
// ========================================

module.exports =
  mongoose.models.InPersonAestheticTraining ||
  mongoose.model("InPersonAestheticTraining", inPersonCourseSchema);
