// models/SelfPacedOnlineTraining.js
/**
 * Simplified Self-Paced Online Training Course Model
 *
 * Streamlined for video-based courses with optional exams
 * Follows similar structure to other models but much simpler
 *
 * @module SelfPacedOnlineTraining
 */

const mongoose = require("mongoose");

/**
 * Self-Paced Course Schema - Simplified Version
 */
const selfPacedCourseSchema = new mongoose.Schema(
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
        enum: ["draft", "published", "archived"],
      },
      courseType: {
        type: String,
        default: "self-paced",
        immutable: true,
      },
    },

    // ========================================
    // ACCESS & PRICING
    // ========================================
    access: {
      price: {
        type: Number,
        required: true,
        min: 0,
        default: 0, // Many might be free
      },
      currency: { type: String, default: "USD" },

      // Simple access duration
      accessDays: {
        type: Number,
        default: 365, // days, 0 = lifetime
      },

      // Basic tracking
      totalEnrollments: { type: Number, default: 0 },
    },

    // ========================================
    // COURSE CONTENT INFO
    // ========================================
    content: {
      // Learning objectives (simple list)
      objectives: [
        {
          type: String,
          maxLength: 200,
        },
      ],

      // Basic metadata
      targetAudience: [String],
      experienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "all-levels"],
        default: "all-levels",
      },
      prerequisites: String,

      // Duration estimate
      estimatedMinutes: {
        type: Number,
        min: 0,
        default: 60,
      },

      // Auto-calculated
      totalVideos: { type: Number, default: 0 },
      totalQuestions: { type: Number, default: 0 },
    },

    // ========================================
    // VIDEOS - Core of self-paced courses
    // ========================================
    // In your selfPacedOnlineTrainingModel.js, replace the videos array definition with this:

    videos: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true,
          required: true, // Add this to ensure it's always created
        },
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },

        // Video essentials
        videoUrl: {
          type: String,
          required: true,
        },
        duration: Number, // in minutes

        // Order
        sequence: {
          type: Number,
          required: true,
        },

        // Optional transcript
        transcript: String,

        // Upload tracking
        dateUploaded: {
          type: Date,
          default: Date.now,
        },

        // Optional quiz for this video - Enhanced structure
        exam: [
          {
            _id: {
              type: mongoose.Schema.Types.ObjectId,
              auto: true,
            },
            questionText: { type: String, required: true },
            type: {
              type: String,
              enum: ["multiple-choice", "true-false"],
              default: "multiple-choice",
            },
            options: [{ type: String, required: true }],
            correctAnswer: { type: String, required: true },
            points: { type: Number, default: 1 },
            explanation: String,
          },
        ],

        // Assessment settings for this video
        assessmentSettings: {
          passingScore: { type: Number, default: 70 },
          timeLimit: { type: Number, default: 0 }, // 0 = no limit
          instructions: String,
        },

        // Simple settings
        isPreview: { type: Boolean, default: false }, // Free preview
      },
    ],

    // ========================================
    // INSTRUCTOR
    // ========================================
    instructor: {
      instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Instructor",
        required: true,
      },
      name: String, // Cached for display
      title: String, // e.g., "Senior Aesthetician"
    },

    // ========================================
    // CERTIFICATE (UPDATED TO MATCH OTHER MODELS)
    // ========================================
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
        minimumAttendance: { type: Number, default: 100 }, // Self-paced = 100%
        minimumScore: { type: Number, default: 70 },
        practicalRequired: { type: Boolean, default: false },
        requireAllVideos: { type: Boolean, default: true }, // Moved here from root
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
    // SIMPLE MEDIA
    // ========================================
    media: {
      thumbnailUrl: String, // Course thumbnail
      previewVideoUrl: String, // Optional preview
    },

    // ========================================
    // BASIC SUPPORT
    // ========================================
    support: {
      email: { type: String, default: "support@iaa-i.com" },
      responseTime: { type: String, default: "48 hours" },
    },

    // ========================================
    // METADATA
    // ========================================
    metadata: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      publishedDate: Date,
      tags: [String], // For search/filter
      internalNotes: String,
    },
  },
  {
    timestamps: true,
    collection: "selfpacedonlinetrainings",
  }
);

// ========================================
// INDEXES
// ========================================

// Removed duplicate index on courseCode since it's already unique
selfPacedCourseSchema.index({ "basic.status": 1, "basic.category": 1 });
selfPacedCourseSchema.index({ "instructor.instructorId": 1 });

// ADD THIS NEW INDEX
selfPacedCourseSchema.index({ "certification.issuingAuthorityId": 1 });
// ========================================
// VIRTUAL FIELDS
// ========================================

/**
 * Generate automatic course code if not provided
 */
selfPacedCourseSchema.statics.generateCourseCode = async function (category) {
  try {
    // Count existing courses in this category
    const count = await this.countDocuments({
      "basic.category": category,
    });

    // Generate next number (pad with zeros)
    const nextNumber = (count + 1).toString().padStart(3, "0");

    // Create code based on category
    const categoryPrefixes = {
      aesthetic: "AES",
      medical: "MED",
      business: "BUS",
      technical: "TEC",
    };

    const prefix = categoryPrefixes[category] || "GEN";
    const courseCode = `SELF-${prefix}-${nextNumber}`;

    // Check if code already exists (safety check)
    const existingCourse = await this.findOne({
      "basic.courseCode": courseCode,
    });

    if (existingCourse) {
      // If code exists, try with next number
      const nextNextNumber = (count + 2).toString().padStart(3, "0");
      return `SELF-${prefix}-${nextNextNumber}`;
    }

    return courseCode;
  } catch (error) {
    console.error("Error generating course code:", error);
    // Fallback to timestamp-based code
    const timestamp = Date.now().toString().slice(-6);
    return `SELF-GEN-${timestamp}`;
  }
};

/**
 * Check if course is free
 */
selfPacedCourseSchema.virtual("isFree").get(function () {
  return this.access.price === 0;
});

/**
 * Calculate total duration in minutes
 */
selfPacedCourseSchema.virtual("totalDuration").get(function () {
  return this.videos.reduce((total, video) => total + (video.duration || 0), 0);
});

/**
 * Get total number of quiz questions
 */
selfPacedCourseSchema.virtual("totalQuizQuestions").get(function () {
  return this.videos.reduce(
    (total, video) => total + (video.exam ? video.exam.length : 0),
    0
  );
});

/**
 * Check if has any quizzes
 */
selfPacedCourseSchema.virtual("hasQuizzes").get(function () {
  return this.videos.some((video) => video.exam && video.exam.length > 0);
});

/**
 * Get preview videos
 */
selfPacedCourseSchema.virtual("previewVideos").get(function () {
  return this.videos.filter((video) => video.isPreview);
});

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Pre-save middleware
 */
selfPacedCourseSchema.pre("save", async function (next) {
  // Generate course code if not provided
  if (
    this.isNew &&
    (!this.basic.courseCode || this.basic.courseCode.trim() === "")
  ) {
    try {
      this.basic.courseCode = await this.constructor.generateCourseCode(
        this.basic.category
      );
      console.log("Auto-generated course code:", this.basic.courseCode);
    } catch (error) {
      console.error("Error auto-generating course code:", error);
      // Set a fallback code
      this.basic.courseCode = `SELF-${Date.now()}`;
    }
  }
  // Update counts (EXISTING CODE)
  this.content.totalVideos = this.videos.length;
  this.content.totalQuestions = this.videos.reduce(
    (total, video) => total + (video.exam ? video.exam.length : 0),
    0
  );

  // Calculate estimated minutes if not set (EXISTING CODE)
  if (!this.content.estimatedMinutes && this.videos.length > 0) {
    this.content.estimatedMinutes = this.totalDuration;
  }

  // Update instructor name (EXISTING CODE)
  if (
    this.isModified("instructor.instructorId") &&
    this.instructor.instructorId
  ) {
    try {
      const Instructor = mongoose.model("Instructor");
      const instructor = await Instructor.findById(
        this.instructor.instructorId
      ).select("firstName lastName fullName title");

      if (instructor) {
        this.instructor.name =
          instructor.fullName ||
          `${instructor.firstName} ${instructor.lastName}`;
        this.instructor.title = instructor.title;
      }
    } catch (error) {
      console.error("Error updating instructor name:", error);
    }
  }

  next();
});

/**
 * UPDATED - Enhanced Pre-save middleware for certification bodies (matching other models)
 */
selfPacedCourseSchema.pre("save", async function (next) {
  // Handle primary certification body
  if (
    this.certification &&
    (this.isModified("certification.issuingAuthorityId") || this.isNew)
  ) {
    if (this.certification.issuingAuthorityId) {
      const issuingAuthorityId = this.certification.issuingAuthorityId;
      try {
        const CertificationBody = mongoose.model("CertificationBody");
        const body = await CertificationBody.findById(
          issuingAuthorityId
        ).select("companyName displayName");

        if (body) {
          this.certification.issuingAuthority =
            body.displayName || body.companyName;
        } else {
          this.certification.issuingAuthority = "IAAI Training Institute";
          this.certification.issuingAuthorityId = undefined;
          console.warn(
            `Primary CertificationBody with ID ${issuingAuthorityId} not found. Reverting to default.`
          );
        }
      } catch (error) {
        console.error("Error updating primary issuing authority name:", error);
        this.certification.issuingAuthority = "IAAI Training Institute";
        this.certification.issuingAuthorityId = undefined;
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
        }
      } catch (err) {
        console.error(
          "Error re-validating existing primary issuing authority:",
          err
        );
        this.certification.issuingAuthority = "IAAI Training Institute";
        this.certification.issuingAuthorityId = undefined;
      }
    }
  } else {
    this.certification = {};
  }

  // Handle additional certification bodies
  if (
    this.certification?.certificationBodies &&
    Array.isArray(this.certification.certificationBodies)
  ) {
    const updatedCertificationBodies = [];
    for (let i = 0; i < this.certification.certificationBodies.length; i++) {
      const cbEntry = this.certification.certificationBodies[i];
      if (cbEntry?.bodyId) {
        try {
          const certBody = await mongoose
            .model("CertificationBody")
            .findById(cbEntry.bodyId)
            .select("companyName displayName");

          if (certBody) {
            cbEntry.name = certBody.displayName || certBody.companyName;
            updatedCertificationBodies.push(cbEntry);
          } else {
            console.warn(
              `Additional CertificationBody with ID ${cbEntry.bodyId} not found. Skipping.`
            );
          }
        } catch (error) {
          console.error(
            `Error retrieving additional certification body for ID ${cbEntry.bodyId}:`,
            error
          );
        }
      } else {
        console.warn(
          `Invalid additional certification body entry at index ${i}. Skipping.`
        );
      }
    }
    this.certification.certificationBodies = updatedCertificationBodies;
  } else if (this.certification) {
    this.certification.certificationBodies = [];
  }

  next();
});

// ========================================
// INSTANCE METHODS
// ========================================

/**
 * UPDATED - Set certification issuing authority (for primary authority)
 */
selfPacedCourseSchema.methods.setIssuingAuthority = async function (bodyId) {
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
 * UPDATED - Remove certification issuing authority (revert to default)
 */
selfPacedCourseSchema.methods.removeIssuingAuthority = function () {
  if (this.certification) {
    this.certification.issuingAuthorityId = undefined;
    this.certification.issuingAuthority = "IAAI Training Institute";
  }
  return this.save();
};

/**
 * NEW - Add additional certification body
 */
selfPacedCourseSchema.methods.addCertificationBody = async function (
  bodyId,
  role = "co-issuer"
) {
  const CertificationBody = mongoose.model("CertificationBody");
  const body = await CertificationBody.findById(bodyId).select(
    "companyName displayName"
  );

  if (!body) {
    throw new Error("Certification body not found for provided ID.");
  }

  if (!this.certification.certificationBodies) {
    this.certification.certificationBodies = [];
  }

  // Check if already exists
  const exists = this.certification.certificationBodies.some(
    (cb) => cb.bodyId.toString() === bodyId.toString()
  );

  if (exists) {
    throw new Error("Certification body already added to this course.");
  }

  this.certification.certificationBodies.push({
    bodyId,
    name: body.displayName || body.companyName,
    role,
  });

  return this.save();
};

/**
 * NEW - Remove additional certification body
 */
selfPacedCourseSchema.methods.removeCertificationBody = function (bodyId) {
  if (this.certification.certificationBodies) {
    this.certification.certificationBodies =
      this.certification.certificationBodies.filter(
        (cb) => cb.bodyId.toString() !== bodyId.toString()
      );
  }
  return this.save();
};

/**
 * NEW - Get all certification bodies (primary + additional)
 */
selfPacedCourseSchema.methods.getAllCertificationBodies = function () {
  const bodies = [];

  // Add primary
  if (this.certification.issuingAuthorityId) {
    bodies.push({
      bodyId: this.certification.issuingAuthorityId,
      name: this.certification.issuingAuthority,
      role: "primary",
    });
  }

  // Add additional
  if (this.certification.certificationBodies) {
    bodies.push(...this.certification.certificationBodies);
  }

  return bodies;
};

// REPLACE these three methods in your selfPacedOnlineTrainingModel.js file:

/**
 * Enhanced addVideo method with proper ID generation
 */
selfPacedCourseSchema.methods.addVideo = function (videoData) {
  // Auto-increment sequence if not provided
  if (!videoData.sequence) {
    const maxSequence = Math.max(...this.videos.map((v) => v.sequence || 0), 0);
    videoData.sequence = maxSequence + 1;
  }

  // Ensure the video will get an _id (this is the key fix!)
  if (!videoData._id) {
    videoData._id = new mongoose.Types.ObjectId();
  }

  // Set default values
  videoData.dateUploaded = videoData.dateUploaded || new Date();
  videoData.isPreview = videoData.isPreview || false;

  // Ensure exam questions have IDs if they exist
  if (videoData.exam && Array.isArray(videoData.exam)) {
    videoData.exam = videoData.exam.map((question) => ({
      ...question,
      _id: question._id || new mongoose.Types.ObjectId(),
    }));
  }

  console.log("Adding video with ID:", videoData._id);

  this.videos.push(videoData);
  return this.save();
};

/**
 * Enhanced removeVideo method to handle both ObjectId and index
 */
selfPacedCourseSchema.methods.removeVideo = function (videoId) {
  let videoIndex = -1;

  // Try to find by ObjectId first
  if (mongoose.Types.ObjectId.isValid(videoId)) {
    videoIndex = this.videos.findIndex((v) => v._id.toString() === videoId);
  }

  // If not found and videoId is a number, use as index
  if (videoIndex === -1 && !isNaN(videoId)) {
    const index = parseInt(videoId);
    if (index >= 0 && index < this.videos.length) {
      videoIndex = index;
    }
  }

  if (videoIndex === -1) {
    throw new Error("Video not found");
  }

  // Remove the video
  this.videos.splice(videoIndex, 1);

  // Resequence remaining videos
  this.videos.forEach((video, index) => {
    video.sequence = index + 1;
  });

  console.log("Removed video at index:", videoIndex);

  return this.save();
};

/**
 * Enhanced updateVideo method to handle both ObjectId and index
 */
selfPacedCourseSchema.methods.updateVideo = function (videoId, updates) {
  let video;

  // Try to find by ObjectId first
  if (mongoose.Types.ObjectId.isValid(videoId)) {
    video = this.videos.id(videoId);
  }

  // If not found and videoId is a number, try by index
  if (!video && !isNaN(videoId)) {
    const index = parseInt(videoId);
    if (index >= 0 && index < this.videos.length) {
      video = this.videos[index];
    }
  }

  if (!video) {
    throw new Error("Video not found");
  }

  // Update video properties
  Object.keys(updates).forEach((key) => {
    if (key !== "_id") {
      // Don't update the ID
      video[key] = updates[key];
    }
  });

  // Ensure exam questions have IDs if updated
  if (updates.exam && Array.isArray(updates.exam)) {
    video.exam = updates.exam.map((question) => ({
      ...question,
      _id: question._id || new mongoose.Types.ObjectId(),
    }));
  }

  console.log("Updated video:", video._id || "by index");

  return this.save();
};

/**
 * Calculate user progress percentage
 */
selfPacedCourseSchema.methods.calculateProgress = function (completedVideoIds) {
  if (this.videos.length === 0) return 0;

  const completedCount = this.videos.filter((video) =>
    completedVideoIds.includes(video._id.toString())
  ).length;

  return Math.round((completedCount / this.videos.length) * 100);
};

/**
 * UPDATED - Check if user is eligible for certificate (using new requirements structure)
 */
selfPacedCourseSchema.methods.isCertificateEligible = function (userProgress) {
  if (!this.certification.enabled) return false;

  // Check video completion using new structure
  if (
    this.certification.requirements.requireAllVideos &&
    userProgress.completionRate < 100
  ) {
    return false;
  }

  // Check quiz scores if applicable
  if (
    this.hasQuizzes &&
    userProgress.averageScore < this.certification.requirements.minimumScore
  ) {
    return false;
  }

  return true;
};

/**
 * Get next video in sequence
 */
selfPacedCourseSchema.methods.getNextVideo = function (currentVideoId) {
  const sortedVideos = this.videos.sort((a, b) => a.sequence - b.sequence);
  const currentIndex = sortedVideos.findIndex(
    (v) => v._id.toString() === currentVideoId
  );

  return currentIndex >= 0 && currentIndex < sortedVideos.length - 1
    ? sortedVideos[currentIndex + 1]
    : null;
};

// ========================================
// STATIC METHODS
// ========================================

/**
 * Find published courses
 */
selfPacedCourseSchema.statics.findPublished = function () {
  return this.find({ "basic.status": "published" })
    .populate("instructor.instructorId", "firstName lastName photo")
    .sort({ createdAt: -1 });
};

/**
 * Find by category
 */
selfPacedCourseSchema.statics.findByCategory = function (category) {
  return this.find({
    "basic.category": category,
    "basic.status": "published",
  }).populate("instructor.instructorId", "firstName lastName photo");
};

/**
 * Find free courses
 */
selfPacedCourseSchema.statics.findFreeCourses = function () {
  return this.find({
    "access.price": 0,
    "basic.status": "published",
  });
};

/**
 * Search courses
 */
selfPacedCourseSchema.statics.searchCourses = function (searchTerm) {
  const searchRegex = new RegExp(searchTerm, "i");
  return this.find({
    "basic.status": "published",
    $or: [
      { "basic.title": searchRegex },
      { "basic.description": searchRegex },
      { "metadata.tags": searchRegex },
      { "instructor.name": searchRegex },
    ],
  });
};

/**
 * Get short courses (under 30 minutes)
 */
selfPacedCourseSchema.statics.getShortCourses = function () {
  return this.find({
    "basic.status": "published",
    "content.estimatedMinutes": { $lte: 30 },
  });
};

// ========================================
// EXPORT MODEL
// ========================================

module.exports =
  mongoose.models.SelfPacedOnlineTraining ||
  mongoose.model("SelfPacedOnlineTraining", selfPacedCourseSchema);
