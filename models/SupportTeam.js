// ████████████████████████████████████████████████████████████████████████████████
// ██                                                                            ██
// ██                         SUPPORT TEAM MODEL                               ██
// ██                     Complete Database Schema                             ██
// ██                                                                            ██
// ████████████████████████████████████████████████████████████████████████████████
/**
 * Complete Support Team Management Model
 *
 * Features:
 * ✅ Support Staff Management
 * ✅ Assigned Cases with Multiple Courses Support
 * ✅ Complete Applicant Data Management
 * ✅ Multi-Course Interest Tracking
 * ✅ Document Management System
 * ✅ Follow-up & Communication Records
 * ✅ Transfer to User Model Integration
 * ✅ Comprehensive Status Tracking
 *
 * @module SupportTeam
 * @version 1.0.0
 * @author IAAI Training Institute
 */

const mongoose = require("mongoose");

// ════════════════════════════════════════════════════════════════════════════════
// ║                                  SCHEMA DEFINITION                           ║
// ════════════════════════════════════════════════════════════════════════════════

const supportTeamSchema = new mongoose.Schema(
  {
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    1. SUPPORT STAFF GENERAL INFORMATION             │
    // └─────────────────────────────────────────────────────────────────────┘
    supportInfo: {
      supportId: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        // Auto-generate format: SUP001, SUP002, etc.
      },
      supportName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
      },
      supportEmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      supportPhone: {
        type: String,
        trim: true,
        maxLength: 20,
      },
      supportStatus: {
        type: String,
        enum: ["active", "inactive", "on-leave", "terminated"],
        default: "active",
      },
      department: {
        type: String,
        enum: ["sales", "customer-service", "technical", "general"],
        default: "sales",
      },
      // Link to User model for authentication
      linkedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      // Support staff capabilities
      capabilities: {
        languages: [String], // ["English", "Arabic", "Turkish"]
        specializations: [String], // ["Medical", "Aesthetic", "Business"]
        maxCasesAllowed: { type: Number, default: 20 },
        canHandlePayments: { type: Boolean, default: true },
        canCreateContracts: { type: Boolean, default: false },
      },
      // Performance metrics
      performance: {
        totalCasesHandled: { type: Number, default: 0 },
        successfulConversions: { type: Number, default: 0 },
        averageResponseTime: { type: Number, default: 0 }, // hours
        conversionRate: { type: Number, default: 0 }, // percentage
        lastPerformanceUpdate: { type: Date, default: Date.now },
      },
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    2. ASSIGNED CASES MANAGEMENT                     │
    // └─────────────────────────────────────────────────────────────────────┘
    assignedCases: [
      {
        // 2.1 - Basic Case Information
        caseInfo: {
          caseId: {
            type: String,
            required: true,
            unique: true,
            // Auto-generate format: CASE-2024-001, CASE-2024-002
          },
          dateCreated: { type: Date, default: Date.now },
          priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
          },
          source: {
            type: String,
            enum: [
              "contact-form",
              "phone",
              "email",
              "social-media",
              "referral",
              "walk-in",
            ],
            default: "contact-form",
          },
          // Link to original ContactUs entry if applicable
          originalContactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ContactUs",
          },
        },

        // Basic Applicant Information (from ContactUs)
        basicInfo: {
          fullName: { type: String, required: true, trim: true },
          email: { type: String, required: true, lowercase: true, trim: true },
          phoneNumber: { type: String, required: true, trim: true },
          medicalSpecialty: { type: String, trim: true },
          initialMessage: { type: String, maxLength: 1000 },
          preferredContactMethod: {
            type: String,
            enum: ["email", "phone", "whatsapp", "any"],
            default: "email",
          },
          preferredContactTime: String, // "Morning 9-12", "Evening 18-21"
        },

        // 2.2 - Additional Information for Assigned Applicant
        // (Copied from User Model - Detailed Information)
        detailedInfo: {
          // Professional Information
          title: {
            type: String,
            enum: ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."],
          },
          fieldOfStudy: {
            type: String,
            enum: [
              "Doctor (MD, DO, OB/GYN)",
              "Dentist (DDS, DMD, BDS)",
              "Physician Assistant (PA)",
              "Nurse Practitioner (NP)",
              "Registered Nurse (RN)",
              "Licensed Practical Nurse (LPN)",
              "Medical Assistant",
              "Pharmacist",
              "Physical Therapist",
              "Occupational Therapist",
              "Medical Student",
              "Nursing Student",
              "Other Healthcare Professional",
              "Non-Healthcare Professional",
            ],
          },
          specialty: { type: String, maxLength: 200, trim: true },
          aestheticsExperience: {
            type: String,
            enum: [
              "Totally Beginner",
              "Beginner",
              "Intermediate",
              "Advanced",
              "Expert/Master",
            ],
          },
          yearsOfExperience: { type: Number, min: 0, max: 60 },
          currentWorkplace: { type: String, maxLength: 200, trim: true },
          licenseInfo: {
            hasLicense: { type: Boolean, default: false },
            licenseNumber: { type: String, trim: true },
            licenseState: { type: String, trim: true },
            licenseCountry: { type: String, trim: true },
          },
          areasOfInterest: [
            {
              type: String,
              enum: [
                "Botox & Neurotoxins",
                "Dermal Fillers",
                "Chemical Peels",
                "Laser Treatments",
                "Microneedling",
                "PDO Threads",
                "Body Contouring",
                "Skin Rejuvenation",
                "Hair Restoration",
                "IV Therapy",
                "Weight Management",
                "Advanced Techniques",
              ],
            },
          ],
          trainingGoals: { type: String, maxLength: 500, trim: true },
        },

        // 2.3 - Document Upload for Assigned Applicant
        // (Copied from User Model - Document Upload)
        documentUploads: {
          profilePicture: {
            filename: String,
            originalName: String,
            url: String,
            uploadDate: Date,
            fileSize: Number,
            mimeType: String,
          },
          identificationDocument: {
            filename: String,
            originalName: String,
            url: String,
            uploadDate: Date,
            fileSize: Number,
            mimeType: String,
            documentType: {
              type: String,
              enum: ["passport", "drivers_license", "national_id", "other"],
            },
            verificationStatus: {
              type: String,
              enum: ["pending", "verified", "rejected", "not_submitted"],
              default: "not_submitted",
            },
            verificationNotes: String,
            verifiedBy: String,
            verifiedAt: Date,
          },
          professionalDocuments: [
            {
              type: {
                type: String,
                enum: [
                  "cv",
                  "resume",
                  "license",
                  "certificate",
                  "diploma",
                  "other",
                ],
                required: true,
              },
              filename: { type: String, required: true },
              originalName: { type: String, required: true },
              url: { type: String, required: true },
              uploadDate: { type: Date, default: Date.now },
              fileSize: Number,
              mimeType: String,
              description: { type: String, maxLength: 200 },
            },
          ],
        },

        // 2.4 - Billing & Address Information for Assigned Applicant
        // (Copied from User Model - Billing & Address Information)
        billingAddressInfo: {
          // Primary Address (Billing)
          address: { type: String, trim: true, maxLength: 255 },
          city: { type: String, trim: true, maxLength: 50 },
          state: { type: String, trim: true, maxLength: 50 },
          zipCode: { type: String, trim: true, maxLength: 10 },
          country: { type: String, trim: true, maxLength: 50 },
          alternativePhone: { type: String, trim: true, maxLength: 20 },
          isComplete: { type: Boolean, default: false },
          lastUpdated: { type: Date, default: Date.now },

          // Delivery Information
          useDifferentDeliveryAddress: { type: Boolean, default: false },
          deliveryAddress: {
            recipientName: { type: String, trim: true, maxLength: 100 },
            address: { type: String, trim: true, maxLength: 255 },
            city: { type: String, trim: true, maxLength: 50 },
            state: { type: String, trim: true, maxLength: 50 },
            zipCode: { type: String, trim: true, maxLength: 10 },
            country: { type: String, trim: true, maxLength: 50 },
            phone: { type: String, trim: true, maxLength: 20 },
          },
          deliveryNotes: { type: String, trim: true, maxLength: 500 },
          preferredDeliveryMethod: {
            type: String,
            enum: ["email", "postal", "pickup", "digital_only"],
            default: "email",
          },

          // Payment Preferences
          preferredCurrency: {
            type: String,
            enum: ["EUR", "USD", "AED", "INR", "GBP"],
            default: "EUR",
          },
          preferredPaymentMethods: [
            {
              type: String,
              enum: [
                "credit_card",
                "debit_card",
                "net_banking",
                "wallet",
                "upi",
                "bank_transfer",
              ],
            },
          ],
        },

        // 2.5 - Assigned Applicant Interested Courses (Multiple Courses Support)
        interestedCourses: [
          {
            courseInterestId: {
              type: String,
              default: () => new mongoose.Types.ObjectId().toString(),
            },

            // Course Reference
            courseId: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
              refPath: "assignedCases.$.interestedCourses.$.courseType",
            },
            courseType: {
              type: String,
              required: true,
              enum: [
                "InPersonAestheticTraining",
                "OnlineLiveTraining",
                "SelfPacedOnlineTraining",
              ],
            },

            // High-level Course Information (cached for quick access)
            courseSnapshot: {
              courseCode: String,
              title: String,
              category: String,
              price: Number,
              earlyBirdPrice: Number,
              currency: String,
              startDate: Date,
              endDate: Date,
              duration: String,
              instructorName: String,
              location: String, // for in-person courses
              platform: String, // for online courses
              seatsAvailable: Number,
              currentEnrollment: Number,
            },

            // Interest & Interaction Details
            interestLevel: {
              type: String,
              enum: ["low", "medium", "high", "very-high"],
              default: "medium",
            },
            interestDate: { type: Date, default: Date.now },
            sourceOfInterest: {
              type: String,
              enum: [
                "website",
                "support-recommendation",
                "marketing",
                "referral",
              ],
              default: "support-recommendation",
            },

            // Pricing & Financial Details
            quotedPrice: Number,
            discountOffered: Number,
            discountType: {
              type: String,
              enum: ["percentage", "fixed", "early-bird", "special"],
            },
            finalQuotedPrice: Number,
            validUntil: Date,

            // Course-specific Requirements
            hasPrerequisites: { type: Boolean, default: false },
            prerequisitesMet: { type: Boolean, default: true },
            prerequisiteNotes: String,
            specialRequirements: String,

            // Status for this specific course
            courseStatus: {
              type: String,
              enum: [
                "interested",
                "quote-sent",
                "negotiating",
                "ready-to-pay",
                "payment-pending",
                "enrolled",
                "declined",
                "on-hold",
              ],
              default: "interested",
            },
            statusLastUpdated: { type: Date, default: Date.now },
            statusNotes: String,
          },
        ],

        // 2.6 - Status of Assigned Applicant (Overall)
        applicantStatus: {
          currentStatus: {
            type: String,
            enum: [
              "not-started",
              "under-contact",
              "interested-not-registered",
              "refused-after-contact",
              "payment-pending",
              "registered-course",
              "completed-course",
              "dormant",
              "transferred-to-user",
            ],
            default: "not-started",
          },
          statusHistory: [
            {
              status: String,
              date: { type: Date, default: Date.now },
              reason: String,
              changedBy: String, // Support staff name
            },
          ],
          lastContactDate: Date,
          nextFollowUpDate: Date,
          totalCoursesInterested: { type: Number, default: 0 },
          totalCoursesEnrolled: { type: Number, default: 0 },
          estimatedValue: { type: Number, default: 0 }, // Total potential revenue
          actualValue: { type: Number, default: 0 }, // Actual revenue generated
        },

        // 2.7 - Follow-up Records
        followUpRecords: [
          {
            followUpNumber: { type: Number, required: true },
            followUpName: { type: String, required: true }, // "Initial Contact", "Price Discussion"
            followUpDate: { type: Date, default: Date.now },
            followUpType: {
              type: String,
              enum: ["call", "email", "whatsapp", "meeting", "video-call"],
              required: true,
            },
            duration: Number, // minutes
            outcome: {
              type: String,
              enum: ["positive", "negative", "neutral", "no-response"],
            },
            feedbackAfterFollowUp: { type: String, maxLength: 1000 },
            nextActionRequired: String,
            nextActionDate: Date,
            attendees: [String], // Other people involved
            recordedBy: {
              type: String,
              default: function () {
                return this.parent().parent().supportInfo.supportName;
              },
            },
          },
        ],

        // 2.8 - Case Documents
        caseDocuments: [
          {
            documentType: {
              type: String,
              enum: [
                "po",
                "bank-payment",
                "transaction-receipt",
                "contract",
                "proposal",
                "brochure",
                "other",
              ],
              required: true,
            },
            filename: { type: String, required: true },
            originalName: { type: String, required: true },
            url: { type: String, required: true },
            uploadDate: { type: Date, default: Date.now },
            fileSize: Number,
            mimeType: String,
            description: String,
            uploadedBy: String, // Support staff name
            relatedCourseId: String, // Link to specific course if applicable
          },
        ],

        // 2.9 - Transfer Status to User Model
        transferStatus: {
          // User Account Creation
          userAccountCreated: { type: Boolean, default: false },
          transferredUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          userTransferDate: Date,
          userTransferNotes: String,

          // Course Registration Transfer
          courseRegistrationTransferred: { type: Boolean, default: false },
          transferredCourses: [
            {
              courseId: mongoose.Schema.Types.ObjectId,
              courseType: String,
              transferDate: Date,
              enrollmentStatus: String,
              paymentStatus: String,
            },
          ],

          // Transfer Completion
          fullTransferCompleted: { type: Boolean, default: false },
          transferCompletionDate: Date,
          transferredBy: String, // Support staff name
          transferNotes: String,
        },

        // 2.10 - Email Communication Record
        emailCommunications: [
          {
            emailType: {
              type: String,
              enum: [
                "introduction",
                "follow-up",
                "contract",
                "payment-reminder",
                "course-info",
                "brochure",
                "welcome",
                "other",
              ],
              required: true,
            },
            subject: { type: String, required: true },
            sentDate: { type: Date, default: Date.now },
            sentTo: [String], // Email addresses
            ccEmails: [String],
            templateUsed: String,
            emailContent: String, // Store email content for reference
            attachments: [String], // File URLs

            // Tracking
            delivered: { type: Boolean, default: false },
            opened: { type: Boolean, default: false },
            clicked: { type: Boolean, default: false },
            replied: { type: Boolean, default: false },
            bounced: { type: Boolean, default: false },

            // Response tracking
            responseReceived: { type: Boolean, default: false },
            responseDate: Date,
            responseContent: String,

            sentBy: String, // Support staff name
            relatedCourseId: String, // If email is about specific course
          },
        ],

        // Case Analytics & Metrics
        caseMetrics: {
          totalInteractions: { type: Number, default: 0 },
          totalEmailsSent: { type: Number, default: 0 },
          totalCallsMade: { type: Number, default: 0 },
          averageResponseTime: { type: Number, default: 0 }, // hours
          caseAgeInDays: { type: Number, default: 0 },
          lastInteractionDate: Date,
          conversionProbability: { type: Number, default: 50 }, // percentage
        },

        // Internal Notes & Comments
        internalNotes: [
          {
            note: { type: String, required: true },
            noteDate: { type: Date, default: Date.now },
            noteBy: String, // Support staff name
            priority: {
              type: String,
              enum: ["low", "medium", "high"],
              default: "medium",
            },
            category: {
              type: String,
              enum: ["general", "payment", "technical", "personal", "urgent"],
              default: "general",
            },
          },
        ],
      },
    ],

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    SUPPORT STAFF SETTINGS & PREFERENCES             │
    // └─────────────────────────────────────────────────────────────────────┘
    settings: {
      notifications: {
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: false },
        newCaseAssignment: { type: Boolean, default: true },
        followUpReminders: { type: Boolean, default: true },
        paymentAlerts: { type: Boolean, default: true },
      },
      workingHours: {
        timezone: { type: String, default: "UTC" },
        mondayToFriday: {
          startTime: { type: String, default: "09:00" },
          endTime: { type: String, default: "17:00" },
        },
        weekend: {
          working: { type: Boolean, default: false },
          startTime: String,
          endTime: String,
        },
      },
      dashboardPreferences: {
        defaultView: {
          type: String,
          enum: ["all-cases", "pending-cases", "my-performance"],
          default: "pending-cases",
        },
        casesPerPage: { type: Number, default: 10 },
        sortBy: {
          type: String,
          enum: ["date", "priority", "status", "value"],
          default: "date",
        },
      },
    },

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    METADATA & SYSTEM INFO                           │
    // └─────────────────────────────────────────────────────────────────────┘
    metadata: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      version: { type: Number, default: 1 },
      lastLogin: Date,
      totalLogins: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
      deactivationReason: String,
      deactivationDate: Date,
    },
  },
  {
    timestamps: true,
    collection: "supportteams",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// ║                                   INDEXES                                    ║
// ════════════════════════════════════════════════════════════════════════════════

// Support staff indexes
supportTeamSchema.index({ "supportInfo.supportId": 1 }, { unique: true });
supportTeamSchema.index({ "supportInfo.supportEmail": 1 }, { unique: true });
supportTeamSchema.index({ "supportInfo.supportStatus": 1 });
supportTeamSchema.index({ "supportInfo.linkedUserId": 1 });

// Case management indexes
supportTeamSchema.index({ "assignedCases.caseInfo.caseId": 1 });
supportTeamSchema.index({ "assignedCases.basicInfo.email": 1 });
supportTeamSchema.index({ "assignedCases.applicantStatus.currentStatus": 1 });
supportTeamSchema.index({ "assignedCases.caseInfo.dateCreated": -1 });
supportTeamSchema.index({
  "assignedCases.applicantStatus.nextFollowUpDate": 1,
});

// Course interest indexes
supportTeamSchema.index({ "assignedCases.interestedCourses.courseId": 1 });
supportTeamSchema.index({ "assignedCases.interestedCourses.courseType": 1 });
supportTeamSchema.index({ "assignedCases.interestedCourses.courseStatus": 1 });

// Performance indexes
supportTeamSchema.index({ "supportInfo.performance.conversionRate": -1 });
supportTeamSchema.index({ "metadata.lastLogin": -1 });

// ════════════════════════════════════════════════════════════════════════════════
// ║                                VIRTUAL FIELDS                               ║
// ════════════════════════════════════════════════════════════════════════════════

// Support staff virtual fields
supportTeamSchema.virtual("activeCasesCount").get(function () {
  return this.assignedCases.filter(
    (case_) =>
      ![
        "completed-course",
        "transferred-to-user",
        "refused-after-contact",
      ].includes(case_.applicantStatus.currentStatus)
  ).length;
});

supportTeamSchema.virtual("pendingFollowUpsCount").get(function () {
  const today = new Date();
  return this.assignedCases.filter(
    (case_) =>
      case_.applicantStatus.nextFollowUpDate &&
      case_.applicantStatus.nextFollowUpDate <= today
  ).length;
});

supportTeamSchema.virtual("conversionRate").get(function () {
  const totalCases = this.assignedCases.length;
  const convertedCases = this.assignedCases.filter(
    (case_) => case_.applicantStatus.currentStatus === "registered-course"
  ).length;
  return totalCases > 0 ? Math.round((convertedCases / totalCases) * 100) : 0;
});

// Case virtual fields
supportTeamSchema.virtual("assignedCases.totalInteractions").get(function () {
  return this.followUpRecords.length + this.emailCommunications.length;
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                               MIDDLEWARE                                     ║
// ════════════════════════════════════════════════════════════════════════════════

supportTeamSchema.pre("save", function (next) {
  // Auto-generate support ID if not provided
  if (this.isNew && !this.supportInfo.supportId) {
    this.generateSupportId();
  }

  // Auto-generate case IDs for new cases
  this.assignedCases.forEach((case_, index) => {
    if (!case_.caseInfo.caseId) {
      case_.caseInfo.caseId = this.generateCaseId();
    }

    // Update case metrics
    case_.caseMetrics.totalInteractions =
      case_.followUpRecords.length + case_.emailCommunications.length;
    case_.caseMetrics.totalEmailsSent = case_.emailCommunications.length;
    case_.caseMetrics.totalCallsMade = case_.followUpRecords.filter(
      (f) => f.followUpType === "call"
    ).length;

    // Calculate case age
    const caseAge = Math.floor(
      (new Date() - case_.caseInfo.dateCreated) / (1000 * 60 * 60 * 24)
    );
    case_.caseMetrics.caseAgeInDays = caseAge;

    // Update interested courses count
    case_.applicantStatus.totalCoursesInterested =
      case_.interestedCourses.length;
    case_.applicantStatus.totalCoursesEnrolled = case_.interestedCourses.filter(
      (c) => c.courseStatus === "enrolled"
    ).length;

    // Calculate estimated and actual value
    case_.applicantStatus.estimatedValue = case_.interestedCourses.reduce(
      (sum, course) =>
        sum + (course.finalQuotedPrice || course.courseSnapshot.price || 0),
      0
    );
    case_.applicantStatus.actualValue = case_.interestedCourses
      .filter((c) => c.courseStatus === "enrolled")
      .reduce(
        (sum, course) =>
          sum + (course.finalQuotedPrice || course.courseSnapshot.price || 0),
        0
      );
  });

  // Update performance metrics
  this.updatePerformanceMetrics();

  next();
});

// ════════════════════════════════════════════════════════════════════════════════
// ║                              INSTANCE METHODS                               ║
// ════════════════════════════════════════════════════════════════════════════════

// Generate unique support ID
supportTeamSchema.methods.generateSupportId = function () {
  const timestamp = Date.now().toString().slice(-6);
  this.supportInfo.supportId = `SUP${timestamp}`;
};

// Generate unique case ID
supportTeamSchema.methods.generateCaseId = function () {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `CASE-${year}-${timestamp}`;
};

// Update performance metrics
supportTeamSchema.methods.updatePerformanceMetrics = function () {
  const totalCases = this.assignedCases.length;
  const conversions = this.assignedCases.filter(
    (c) => c.applicantStatus.currentStatus === "registered-course"
  ).length;

  this.supportInfo.performance.totalCasesHandled = totalCases;
  this.supportInfo.performance.successfulConversions = conversions;
  this.supportInfo.performance.conversionRate =
    totalCases > 0 ? Math.round((conversions / totalCases) * 100) : 0;
  this.supportInfo.performance.lastPerformanceUpdate = new Date();
};

// Add new case
supportTeamSchema.methods.addNewCase = function (contactData) {
  const newCase = {
    caseInfo: {
      caseId: this.generateCaseId(),
      source: contactData.source || "contact-form",
      originalContactId: contactData.originalContactId,
    },
    basicInfo: {
      fullName: contactData.name,
      email: contactData.email,
      phoneNumber: contactData.phone || "",
      medicalSpecialty: contactData.medicalSpecialty || "",
      initialMessage: contactData.message || "",
    },
    applicantStatus: {
      currentStatus: "not-started",
      statusHistory: [
        {
          status: "not-started",
          date: new Date(),
          reason: "Case assigned from contact form",
          changedBy: this.supportInfo.supportName,
        },
      ],
    },
  };

  this.assignedCases.push(newCase);
  return newCase;
};

// Add follow-up record
supportTeamSchema.methods.addFollowUp = function (caseId, followUpData) {
  const case_ = this.assignedCases.find((c) => c.caseInfo.caseId === caseId);
  if (!case_) throw new Error("Case not found");

  const followUpNumber = case_.followUpRecords.length + 1;
  case_.followUpRecords.push({
    followUpNumber,
    ...followUpData,
    recordedBy: this.supportInfo.supportName,
  });

  case_.applicantStatus.lastContactDate = new Date();
  return this.save();
};

// Add email communication
supportTeamSchema.methods.addEmailCommunication = function (caseId, emailData) {
  const case_ = this.assignedCases.find((c) => c.caseInfo.caseId === caseId);
  if (!case_) throw new Error("Case not found");

  case_.emailCommunications.push({
    ...emailData,
    sentBy: this.supportInfo.supportName,
  });

  return this.save();
};

// Update case status
supportTeamSchema.methods.updateCaseStatus = function (
  caseId,
  newStatus,
  reason
) {
  const case_ = this.assignedCases.find((c) => c.caseInfo.caseId === caseId);
  if (!case_) throw new Error("Case not found");

  case_.applicantStatus.statusHistory.push({
    status: newStatus,
    date: new Date(),
    reason,
    changedBy: this.supportInfo.supportName,
  });

  case_.applicantStatus.currentStatus = newStatus;
  return this.save();
};

// Transfer case to User model
supportTeamSchema.methods.transferToUser = async function (caseId) {
  const case_ = this.assignedCases.find((c) => c.caseInfo.caseId === caseId);
  if (!case_) throw new Error("Case not found");

  const User = mongoose.model("User");

  // Create user account
  const newUser = new User({
    firstName: case_.basicInfo.fullName.split(" ")[0],
    lastName: case_.basicInfo.fullName.split(" ").slice(1).join(" "),
    email: case_.basicInfo.email,
    phoneNumber: case_.basicInfo.phoneNumber,
    // Copy other relevant data...
  });

  await newUser.save();

  // Update transfer status
  case_.transferStatus.userAccountCreated = true;
  case_.transferStatus.transferredUserId = newUser._id;
  case_.transferStatus.userTransferDate = new Date();
  case_.transferStatus.transferredBy = this.supportInfo.supportName;

  // Update case status
  this.updateCaseStatus(
    caseId,
    "transferred-to-user",
    "Case successfully transferred to user model"
  );

  return { success: true, userId: newUser._id };
};

// ════════════════════════════════════════════════════════════════════════════════
// ║                               STATIC METHODS                                ║
// ════════════════════════════════════════════════════════════════════════════════

// Find support staff by case load
supportTeamSchema.statics.findAvailableStaff = function () {
  return this.aggregate([
    { $match: { "supportInfo.supportStatus": "active" } },
    { $addFields: { activeCases: { $size: "$assignedCases" } } },
    {
      $match: {
        activeCases: { $lt: "$supportInfo.capabilities.maxCasesAllowed" },
      },
    },
    { $sort: { activeCases: 1, "supportInfo.performance.conversionRate": -1 } },
  ]);
};

// Assign case to best available support staff
supportTeamSchema.statics.assignCaseToStaff = async function (contactData) {
  const availableStaff = await this.findAvailableStaff();
  if (availableStaff.length === 0) {
    throw new Error("No available support staff");
  }

  const selectedStaff = await this.findById(availableStaff[0]._id);
  const newCase = selectedStaff.addNewCase(contactData);
  await selectedStaff.save();

  return { supportStaff: selectedStaff, case: newCase };
};

// Get performance metrics for all staff
supportTeamSchema.statics.getTeamPerformance = function () {
  return this.aggregate([
    { $match: { "supportInfo.supportStatus": "active" } },
    {
      $group: {
        _id: null,
        totalStaff: { $sum: 1 },
        totalCases: { $sum: "$supportInfo.performance.totalCasesHandled" },
        totalConversions: {
          $sum: "$supportInfo.performance.successfulConversions",
        },
        avgConversionRate: { $avg: "$supportInfo.performance.conversionRate" },
      },
    },
  ]);
};

module.exports =
  mongoose.models.SupportTeam ||
  mongoose.model("SupportTeam", supportTeamSchema);
