//contactUsModel.js
// ████████████████████████████████████████████████████████████████████████████████
// ██                                                                            ██
// ██                         CONTACT US MODEL                                  ██
// ██                    Enhanced with SupportTeam Integration                  ██
// ██                                                                            ██
// ████████████████████████████████████████████████████████████████████████████████

const mongoose = require("mongoose");

// ════════════════════════════════════════════════════════════════════════════════
// ║                                  SCHEMA DEFINITION                           ║
// ════════════════════════════════════════════════════════════════════════════════

const contactUsSchema = new mongoose.Schema(
  {
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        BASIC CONTACT INFORMATION                    │
    // └─────────────────────────────────────────────────────────────────────┘
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      trim: true,
      maxLength: 20,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    message: {
      type: String,
      required: true,
      maxLength: 2000,
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                     ENHANCED CONTACT DETAILS                        │
    // └─────────────────────────────────────────────────────────────────────┘

    // Additional form fields
    medicalSpecialty: {
      type: String,
      trim: true,
      maxLength: 100,
    },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
    },
    courseOfInterest: {
      type: String,
      trim: true,
      maxLength: 200,
    },
    preferredContactMethod: {
      type: String,
      enum: ["email", "phone", "whatsapp", "any"],
      default: "email",
    },
    preferredContactTime: {
      type: String,
      enum: ["morning", "afternoon", "evening", "anytime"],
      default: "anytime",
    },
    country: {
      type: String,
      trim: true,
      maxLength: 50,
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                      ASSIGNMENT & PROCESSING                        │
    // └─────────────────────────────────────────────────────────────────────┘

    // Assignment status
    assignmentStatus: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "processing",
        "converted",
        "closed",
        "spam",
      ],
      default: "pending",
      index: true,
    },

    // Support team assignment
    assignedTo: {
      supportTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupportTeam",
      },
      supportStaffName: String,
      assignedDate: Date,
      assignedBy: String, // Admin who assigned manually
      caseId: String, // Reference to case in SupportTeam model
    },

    // Priority scoring (for auto-assignment)
    priorityScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    // Auto-assignment eligibility
    autoAssignmentEligible: {
      type: Boolean,
      default: true,
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                        TRACKING & ANALYTICS                         │
    // └─────────────────────────────────────────────────────────────────────┘

    // Source tracking
    source: {
      type: String,
      enum: [
        "website-form",
        "landing-page",
        "social-media",
        "referral",
        "advertisement",
        "other",
      ],
      default: "website-form",
    },

    // UTM parameters for marketing tracking
    utmData: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },

    // Browser and device info
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      country: String,
      city: String,
      referrer: String,
    },

    // Response tracking
    responseTracking: {
      firstResponseSent: { type: Boolean, default: false },
      firstResponseDate: Date,
      totalResponsesSent: { type: Number, default: 0 },
      lastResponseDate: Date,
      customerReplied: { type: Boolean, default: false },
      customerReplyDate: Date,
    },

    // Conversion tracking
    conversionData: {
      converted: { type: Boolean, default: false },
      conversionDate: Date,
      coursesEnrolled: [String],
      totalRevenue: { type: Number, default: 0 },
      conversionDays: Number, // Days from contact to conversion
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                         QUALITY & FILTERING                         │
    // └─────────────────────────────────────────────────────────────────────┘

    // Spam detection
    spamScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Quality indicators
    qualityFlags: {
      duplicateEmail: { type: Boolean, default: false },
      duplicatePhone: { type: Boolean, default: false },
      suspiciousContent: { type: Boolean, default: false },
      incompleteInfo: { type: Boolean, default: false },
      highPriority: { type: Boolean, default: false },
    },

    // Follow-up requirements
    followUpRequired: {
      type: Boolean,
      default: true,
    },
    nextFollowUpDate: Date,

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                           SYSTEM METADATA                           │
    // └─────────────────────────────────────────────────────────────────────┘

    // Original submission date
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Processing metadata
    processedDate: Date,
    processedBy: String,

    // Admin notes
    adminNotes: [
      {
        note: String,
        addedBy: String,
        addedDate: { type: Date, default: Date.now },
      },
    ],

    // Archive flag
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedDate: Date,
    archivedReason: String,
  },
  {
    timestamps: true,
    collection: "contactus",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ║                                   INDEXES                                    ║
// ════════════════════════════════════════════════════════════════════════════════

contactUsSchema.index({ email: 1 });
contactUsSchema.index({ assignmentStatus: 1, date: -1 });
contactUsSchema.index({ "assignedTo.supportTeamId": 1 });
contactUsSchema.index({ priorityScore: -1 });
contactUsSchema.index({ nextFollowUpDate: 1 });
contactUsSchema.index({ "qualityFlags.highPriority": 1 });
contactUsSchema.index({ autoAssignmentEligible: 1, assignmentStatus: 1 });
contactUsSchema.index({ date: -1 }); // For recent queries
contactUsSchema.index({ "conversionData.converted": 1 }); // For analytics

// Compound indexes for common queries
contactUsSchema.index({ assignmentStatus: 1, priorityScore: -1, date: -1 });
contactUsSchema.index({ source: 1, date: -1 });

// ════════════════════════════════════════════════════════════════════════════════
// ║                                VIRTUAL FIELDS                               ║
// ════════════════════════════════════════════════════════════════════════════════

// Calculate days since submission
contactUsSchema.virtual("daysSinceSubmission").get(function () {
  return Math.floor((new Date() - this.date) / (1000 * 60 * 60 * 24));
});

// Check if urgent follow-up needed
contactUsSchema.virtual("isUrgentFollowUp").get(function () {
  if (!this.nextFollowUpDate) return false;
  const daysDiff = Math.floor(
    (new Date() - this.nextFollowUpDate) / (1000 * 60 * 60 * 24)
  );
  return daysDiff >= 0; // Overdue or due today
});

// Calculate priority level for display
contactUsSchema.virtual("priorityLevel").get(function () {
  if (this.priorityScore >= 80) return "High";
  if (this.priorityScore >= 60) return "Medium";
  return "Low";
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                               MIDDLEWARE                                     ║
// ════════════════════════════════════════════════════════════════════════════════

// Pre-save middleware for automatic processing
contactUsSchema.pre("save", async function (next) {
  // Calculate priority score for new submissions
  if (this.isNew) {
    this.calculatePriorityScore();
    await this.detectDuplicatesAndSpam();
  }

  // Update next follow-up date if not set
  if (this.isNew && this.followUpRequired && !this.nextFollowUpDate) {
    this.nextFollowUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  }

  next();
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                              INSTANCE METHODS                               ║
// ════════════════════════════════════════════════════════════════════════════════

// Calculate priority score based on various factors
contactUsSchema.methods.calculatePriorityScore = function () {
  let score = 50; // Base score

  // Medical specialty bonus
  if (
    this.medicalSpecialty &&
    this.medicalSpecialty.toLowerCase().includes("doctor")
  ) {
    score += 20;
  }

  // Experience level bonus
  const experienceBonuses = {
    expert: 15,
    advanced: 10,
    intermediate: 5,
    beginner: 0,
  };
  score += experienceBonuses[this.experienceLevel] || 0;

  // Course interest bonus
  if (this.courseOfInterest && this.courseOfInterest.trim() !== "") {
    score += 10;
  }

  // Phone provided bonus
  if (this.phone && this.phone.trim() !== "") {
    score += 5;
  }

  // Message quality bonus
  if (this.message && this.message.length > 100) {
    score += 5;
  }

  // Time-based urgency (newer submissions get higher priority)
  const hoursSinceSubmission = (new Date() - this.date) / (1000 * 60 * 60);
  if (hoursSinceSubmission < 4) score += 10;
  else if (hoursSinceSubmission < 24) score += 5;

  this.priorityScore = Math.min(100, Math.max(0, score));

  // Set high priority flag
  this.qualityFlags.highPriority = this.priorityScore >= 80;
};

// Detect duplicates and spam
contactUsSchema.methods.detectDuplicatesAndSpam = async function () {
  const ContactUs = this.constructor;

  // Check for duplicate email in last 30 days
  const duplicateEmail = await ContactUs.findOne({
    email: this.email,
    _id: { $ne: this._id },
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  this.qualityFlags.duplicateEmail = !!duplicateEmail;

  // Check for duplicate phone if provided
  if (this.phone) {
    const duplicatePhone = await ContactUs.findOne({
      phone: this.phone,
      _id: { $ne: this._id },
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    this.qualityFlags.duplicatePhone = !!duplicatePhone;
  }

  // Basic spam detection
  const spamKeywords = [
    "viagra",
    "casino",
    "lottery",
    "winner",
    "congratulations",
  ];
  const messageWords = this.message.toLowerCase();
  const spamMatches = spamKeywords.filter((keyword) =>
    messageWords.includes(keyword)
  );

  this.spamScore = spamMatches.length * 20;
  this.qualityFlags.suspiciousContent = this.spamScore > 40;

  // Check for incomplete information
  this.qualityFlags.incompleteInfo =
    !this.phone || !this.medicalSpecialty || this.message.length < 20;

  // Auto-assignment eligibility
  this.autoAssignmentEligible =
    !this.qualityFlags.suspiciousContent && this.spamScore < 60;
};

// Assign to support team
contactUsSchema.methods.assignToSupport = async function (
  supportTeamId,
  assignedBy = "auto"
) {
  const SupportTeam = mongoose.model("SupportTeam");

  try {
    const supportStaff = await SupportTeam.findById(supportTeamId);
    if (!supportStaff) {
      throw new Error("Support staff not found");
    }

    // Create case in SupportTeam
    const newCase = supportStaff.addNewCase({
      name: this.name,
      email: this.email,
      phone: this.phone,
      medicalSpecialty: this.medicalSpecialty,
      message: this.message,
      originalContactId: this._id,
      source: this.source || "contact-form",
      courseOfInterest: this.courseOfInterest,
      experienceLevel: this.experienceLevel,
      preferredContactMethod: this.preferredContactMethod,
      country: this.country,
    });

    await supportStaff.save();

    // Update this contact record
    this.assignmentStatus = "assigned";
    this.assignedTo = {
      supportTeamId: supportTeamId,
      supportStaffName: supportStaff.supportInfo.supportName,
      assignedDate: new Date(),
      assignedBy: assignedBy,
      caseId: newCase.caseInfo.caseId,
    };
    this.processedDate = new Date();
    this.processedBy = assignedBy;

    await this.save();

    return {
      success: true,
      caseId: newCase.caseInfo.caseId,
      supportStaff: supportStaff.supportInfo.supportName,
    };
  } catch (error) {
    throw new Error(`Assignment failed: ${error.message}`);
  }
};

// Mark as converted
contactUsSchema.methods.markAsConverted = function (
  coursesEnrolled = [],
  revenue = 0
) {
  this.assignmentStatus = "converted";
  this.conversionData.converted = true;
  this.conversionData.conversionDate = new Date();
  this.conversionData.coursesEnrolled = coursesEnrolled;
  this.conversionData.totalRevenue = revenue;
  this.conversionData.conversionDays = this.daysSinceSubmission;

  return this.save();
};

// ════════════════════════════════════════════════════════════════════════════════
// ║                               STATIC METHODS                                ║
// ════════════════════════════════════════════════════════════════════════════════

// Get unassigned contacts eligible for auto-assignment
contactUsSchema.statics.getUnassignedContacts = function () {
  return this.find({
    assignmentStatus: "pending",
    autoAssignmentEligible: true,
    spamScore: { $lt: 60 },
  }).sort({ priorityScore: -1, date: 1 });
};

// Auto-assign contacts to support team using intelligent load balancing
contactUsSchema.statics.autoAssignToSupportTeam = async function () {
  const SupportTeam = mongoose.model("SupportTeam");

  try {
    // Get unassigned contacts
    const unassignedContacts = await this.getUnassignedContacts().limit(20);

    if (unassignedContacts.length === 0) {
      return { success: true, message: "No contacts to assign", assigned: 0 };
    }

    // Get available support staff with current workload
    const availableStaff = await SupportTeam.aggregate([
      {
        $match: {
          "supportInfo.supportStatus": "active",
          "supportInfo.capabilities.maxCasesAllowed": { $gt: 0 },
        },
      },
      {
        $addFields: {
          activeCases: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $not: {
                    $in: [
                      "$$this.applicantStatus.currentStatus",
                      [
                        "completed-course",
                        "transferred-to-user",
                        "refused-after-contact",
                      ],
                    ],
                  },
                },
              },
            },
          },
          pendingFollowUps: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $and: [
                    {
                      $lte: [
                        "$$this.applicantStatus.nextFollowUpDate",
                        new Date(),
                      ],
                    },
                    {
                      $ne: [
                        "$$this.applicantStatus.currentStatus",
                        "completed-course",
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $lt: ["$activeCases", "$supportInfo.capabilities.maxCasesAllowed"],
          },
        },
      },
      {
        $addFields: {
          workloadScore: {
            $add: [
              { $multiply: ["$activeCases", 2] }, // Active cases weight more
              "$pendingFollowUps", // Pending follow-ups add to workload
              {
                $multiply: [
                  {
                    $subtract: [100, "$supportInfo.performance.conversionRate"],
                  },
                  0.1,
                ],
              }, // Lower conversion rate = higher score (worse)
            ],
          },
        },
      },
      { $sort: { workloadScore: 1 } }, // Sort by lowest workload first
    ]);

    if (availableStaff.length === 0) {
      return {
        success: false,
        message: "No available support staff",
        assigned: 0,
      };
    }

    // Smart assignment algorithm
    let assignedCount = 0;
    let staffIndex = 0;

    for (const contact of unassignedContacts) {
      // Get the staff member with lowest current workload
      const selectedStaff = availableStaff[staffIndex % availableStaff.length];

      try {
        await contact.assignToSupport(selectedStaff._id, "auto-assignment");
        assignedCount++;

        // Update the workload for next assignment
        selectedStaff.activeCases++;
        availableStaff.sort((a, b) => {
          const scoreA = a.activeCases * 2 + a.pendingFollowUps;
          const scoreB = b.activeCases * 2 + b.pendingFollowUps;
          return scoreA - scoreB;
        });
      } catch (error) {
        console.error(
          `Failed to assign contact ${contact._id}:`,
          error.message
        );
      }
    }

    return {
      success: true,
      message: `Successfully assigned ${assignedCount} contacts`,
      assigned: assignedCount,
      total: unassignedContacts.length,
    };
  } catch (error) {
    return {
      success: false,
      message: `Auto-assignment failed: ${error.message}`,
      assigned: 0,
    };
  }
};

// Get contacts needing follow-up
contactUsSchema.statics.getNeedingFollowUp = function () {
  return this.find({
    assignmentStatus: { $in: ["assigned", "processing"] },
    nextFollowUpDate: { $lte: new Date() },
  }).sort({ nextFollowUpDate: 1 });
};

// Get analytics data
contactUsSchema.statics.getAnalytics = function (dateRange = {}) {
  const matchStage = {};

  if (dateRange.start || dateRange.end) {
    matchStage.date = {};
    if (dateRange.start) matchStage.date.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.date.$lte = new Date(dateRange.end);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalContacts: { $sum: 1 },
        assignedContacts: {
          $sum: { $cond: [{ $eq: ["$assignmentStatus", "assigned"] }, 1, 0] },
        },
        convertedContacts: {
          $sum: { $cond: ["$conversionData.converted", 1, 0] },
        },
        totalRevenue: { $sum: "$conversionData.totalRevenue" },
        avgPriorityScore: { $avg: "$priorityScore" },
        avgConversionDays: { $avg: "$conversionData.conversionDays" },
      },
    },
  ]);
};

// Clean up old spam/rejected contacts
contactUsSchema.statics.cleanupOldContacts = function (daysOld = 90) {
  return this.deleteMany({
    date: { $lt: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000) },
    assignmentStatus: { $in: ["spam", "closed"] },
    "conversionData.converted": false,
  });
};

module.exports = mongoose.model("ContactUs", contactUsSchema);
