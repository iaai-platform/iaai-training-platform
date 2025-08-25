// This model removes all problematic certificate indexes that cause registration errors

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC USER INFORMATION (EXISTING)
    // ========================================
    // Basic User Information
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String },
    profession: { type: String },
    country: { type: String },

    // ========================================
    // 🆕 ENHANCED ADDRESS & BILLING INFORMATION
    // Critical for CCAvenue payment processing
    // ========================================
    addressInfo: {
      // Primary Address (Billing)
      address: {
        type: String,
        trim: true,
        maxlength: 255,
        default: null,
      },
      city: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null,
      },
      state: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null,
      },
      zipCode: {
        type: String,
        trim: true,
        maxlength: 10,
        default: null,
      },
      country: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null,
      },

      // ✅ NEW: Alternative phone number for billing
      alternativePhone: {
        type: String,
        trim: true,
        maxlength: 20,
        default: null,
      },

      // Address completion status
      isComplete: {
        type: Boolean,
        default: false,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // ========================================
    // 🆕 DELIVERY INFORMATION (for physical products/certificates)
    // ========================================
    deliveryInfo: {
      // Use different delivery address?
      useDifferentDeliveryAddress: {
        type: Boolean,
        default: false,
      },

      // Delivery Address (only if different from billing)
      deliveryAddress: {
        recipientName: {
          type: String,
          trim: true,
          maxlength: 100,
          default: null,
        },
        address: {
          type: String,
          trim: true,
          maxlength: 255,
          default: null,
        },
        city: {
          type: String,
          trim: true,
          maxlength: 50,
          default: null,
        },
        state: {
          type: String,
          trim: true,
          maxlength: 50,
          default: null,
        },
        zipCode: {
          type: String,
          trim: true,
          maxlength: 10,
          default: null,
        },
        country: {
          type: String,
          trim: true,
          maxlength: 50,
          default: null,
        },
        phone: {
          type: String,
          trim: true,
          maxlength: 20,
          default: null,
        },
      },

      // Delivery preferences
      deliveryNotes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      // For digital products
      preferredDeliveryMethod: {
        type: String,
        enum: ["email", "postal", "pickup", "digital_only"],
        default: "email",
      },
    },

    // ========================================
    // 🆕 ENHANCED PAYMENT PREFERENCES
    // ========================================
    paymentPreferences: {
      // Preferred currency for display
      preferredCurrency: {
        type: String,
        enum: ["EUR", "USD", "AED", "INR", "GBP"],
        default: "EUR",
      },

      // Preferred payment methods
      preferredPaymentMethods: [
        {
          type: String,
          enum: ["credit_card", "debit_card", "net_banking", "wallet", "upi"],
        },
      ],

      // Saved payment method preferences
      savedPaymentMethods: [
        {
          type: { type: String, enum: ["card", "bank", "wallet"] },
          last4: String,
          brand: String,
          expiryMonth: Number,
          expiryYear: Number,
          isDefault: { type: Boolean, default: false },
          addedAt: { type: Date, default: Date.now },
        },
      ],

      // Default billing address reference
      defaultBillingAddress: {
        type: String,
        enum: ["profile", "custom"],
        default: "profile",
      },

      // Tax information (for business users)
      taxInfo: {
        hasTaxId: { type: Boolean, default: false },
        taxId: { type: String, trim: true, default: null },
        taxType: {
          type: String,
          enum: ["vat", "gst", "ssn", "other"],
          default: null,
        },
        isBusinessCustomer: { type: Boolean, default: false },
      },
    },

    // ========================================
    // NEW: ENHANCED PROFESSIONAL INFORMATION
    // ========================================
    professionalInfo: {
      // Gender/Title Selection
      title: {
        type: String,
        enum: ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."],
        default: null,
      },

      // Field of Study (Professional Background)
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
        default: null,
      },

      // Specialty within their field
      specialty: {
        type: String,
        maxlength: 200,
        trim: true,
        default: null,
      },

      // Experience Level in Aesthetics
      aestheticsExperience: {
        type: String,
        enum: [
          "Totally Beginner",
          "Beginner",
          "Intermediate",
          "Advanced",
          "Expert/Master",
        ],
        default: null,
      },

      // Years of overall professional experience
      yearsOfExperience: {
        type: Number,
        min: 0,
        max: 60,
        default: null,
      },

      // Current workplace/practice
      currentWorkplace: {
        type: String,
        maxlength: 200,
        trim: true,
        default: null,
      },

      // Professional license information
      licenseInfo: {
        hasLicense: { type: Boolean, default: false },
        licenseNumber: {
          type: String,
          trim: true,
          default: null,
        },
        licenseState: {
          type: String,
          trim: true,
          default: null,
        },
        licenseCountry: {
          type: String,
          trim: true,
          default: null,
        },
      },

      // Areas of interest in aesthetics
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

      // Goals for aesthetic training
      trainingGoals: {
        type: String,
        maxlength: 500,
        trim: true,
        default: null,
      },
    },

    // ========================================
    // NEW: PROFILE & DOCUMENTATION
    // ========================================
    profileData: {
      // Profile Picture
      profilePicture: {
        filename: { type: String, default: null },
        originalName: { type: String, default: null },
        url: { type: String, default: null },
        uploadDate: { type: Date, default: null },
        fileSize: { type: Number, default: null }, // in bytes
        mimeType: { type: String, default: null },
      },

      // ID/Passport for Certificate Application
      identificationDocument: {
        filename: { type: String, default: null },
        originalName: { type: String, default: null },
        url: { type: String, default: null },
        uploadDate: { type: Date, default: null },
        fileSize: { type: Number, default: null },
        mimeType: { type: String, default: null },
        documentType: {
          type: String,
          enum: ["passport", "drivers_license", "national_id", "other"],
          default: null,
        },
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected", "not_submitted"],
          default: "not_submitted",
        },
        verificationNotes: { type: String, default: null },
        verifiedBy: { type: String, default: null }, // Admin ID
        verifiedAt: { type: Date, default: null },
      },

      // Additional professional documents
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
          fileSize: { type: Number },
          mimeType: { type: String },
          description: { type: String, maxlength: 200 },
        },
      ],

      // Profile completion tracking
      completionStatus: {
        basicInfo: { type: Boolean, default: false },
        addressInfo: { type: Boolean, default: false },
        professionalInfo: { type: Boolean, default: false },
        profilePicture: { type: Boolean, default: false },
        identificationDocument: { type: Boolean, default: false },
        paymentReady: { type: Boolean, default: false },
        overallPercentage: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now },
      },
    },

    // Additional User Properties
    isConfirmed: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["user", "admin", "instructor", "support"],
      default: "user",
    },

    // ADD THIS NEW SECTION RIGHT AFTER THE ROLE FIELD:
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                    🤝 SUPPORT TEAM INTEGRATION                      │
    // └─────────────────────────────────────────────────────────────────────┘
    originatedFromSupport: {
      // Reference to the SupportTeam who handled this user
      supportTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupportTeam",
        default: null,
      },

      // Reference to the specific case in SupportTeam model
      caseId: {
        type: String,
        default: null,
      },

      // When the user was transferred from support to user model
      transferDate: {
        type: Date,
        default: null,
      },

      // Name of support staff who handled the transfer
      supportStaffName: {
        type: String,
        default: null,
      },

      // Original contact form ID if applicable
      originalContactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContactUs",
        default: null,
      },

      // Support journey metrics
      supportJourney: {
        // How many days from first contact to registration
        daysFromContactToRegistration: { type: Number, default: 0 },

        // Total interactions with support team
        totalSupportInteractions: { type: Number, default: 0 },

        // Original lead source
        originalLeadSource: { type: String, default: null },

        // Conversion value attributed to support team
        attributedRevenue: { type: Number, default: 0 },

        // Support team conversion notes
        conversionNotes: { type: String, default: null },
      },
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
          paidAmount: Number, // Actual amount paid (after discounts)
          paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
          },
          promoCodeUsed: String,
          courseName: { type: String },
          courseCode: { type: String },
          courseType: { type: String },
          originalPrice: { type: Number, default: 0 },
          currency: { type: String, default: "EUR" },
          isLinkedCourse: { type: Boolean, default: false },
          isLinkedCourseFree: { type: Boolean, default: false },
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

          // Enhanced assessment attempts (detailed tracking)
          assessmentAttempts: [
            {
              attemptNumber: Number,
              attemptDate: Date,
              assessmentType: {
                type: String,
                enum: ["written", "practical", "combined"],
                default: "combined",
              },

              // Detailed scoring breakdown
              scores: {
                practicalScore: { type: Number, min: 0, max: 100 },
                theoryScore: { type: Number, min: 0, max: 100 },
                totalScore: { type: Number, min: 0, max: 100 },
                maxPossibleScore: { type: Number, default: 100 },
              },

              passed: { type: Boolean, default: false },

              // Question-by-question tracking
              answers: [
                {
                  questionIndex: Number,
                  questionText: String, // Cached for records
                  userAnswer: mongoose.Schema.Types.Mixed,
                  correctAnswer: mongoose.Schema.Types.Mixed,
                  isCorrect: Boolean,
                  points: Number,
                  earnedPoints: Number,
                  category: { type: String, enum: ["theory", "practical"] },
                },
              ],

              // Assessment metadata
              timeSpent: { type: Number, default: 0 }, // minutes
              instructorNotes: String,
              instructorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Instructor",
              },
              retakeAllowed: { type: Boolean, default: true },

              // Practical assessment details
              practicalDetails: {
                proceduresCompleted: [String],
                skillsAssessed: [String],
                equipmentUsed: [String],
                safetyCompliance: { type: Boolean, default: true },
              },
            },
          ],

          courseStatus: {
            type: String,
            enum: [
              "not-started",
              "in-progress",
              "completed",
              "failed-attendance",
              "failed-assessment",
            ],
            default: "not-started",
          },
          completionDate: Date,
        },

        // Assessment summary (for quick access - matches controller expectations)
        assessmentCompleted: { type: Boolean, default: false },
        assessmentScore: { type: Number, default: 0 }, // Latest/current score
        bestAssessmentScore: { type: Number, default: 0 },
        lastAssessmentDate: Date,
        practicalAssessmentPassed: { type: Boolean, default: false },
        theoryAssessmentPassed: { type: Boolean, default: false },
        totalAttempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 }, // Maximum allowed attempts
        currentAttempts: { type: Number, default: 0 },

        // Materials tracking
        courseMaterials: {
          // Downloaded materials tracking
          downloadedMaterials: [
            {
              materialId: { type: String, required: true }, // course.media.documents[index]
              materialName: String,
              materialType: {
                type: String,
                enum: ["pdf", "video", "presentation", "document", "image"],
                default: "document",
              },
              materialCategory: {
                type: String,
                enum: [
                  "course-handout",
                  "practical-guide",
                  "reference",
                  "certificate",
                  "other",
                ],
                default: "course-handout",
              },
              downloadDate: { type: Date, default: Date.now },
              downloadCount: { type: Number, default: 1 },
              lastAccessed: Date,
              fileSize: Number, // bytes
              originalUrl: String, // course material URL
            },
          ],

          // Instructor shared notes
          sharedNotes: [
            {
              noteId: {
                type: mongoose.Schema.Types.ObjectId,
                default: () => new mongoose.Types.ObjectId(),
              },
              title: String,
              content: String,
              sharedBy: String, // instructor name
              sharedByInstructorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Instructor",
              },
              sharedDate: { type: Date, default: Date.now },
              category: {
                type: String,
                enum: [
                  "lecture",
                  "practical",
                  "assignment",
                  "general",
                  "homework",
                ],
                default: "general",
              },
              isPublic: { type: Boolean, default: true },
              attachments: [String], // URLs to attached files
            },
          ],

          // User's personal notes
          personalNotes: {
            content: String,
            lastUpdated: Date,
            wordCount: { type: Number, default: 0 },
          },

          // Material access summary
          materialSummary: {
            totalDownloads: { type: Number, default: 0 },
            uniqueMaterialsAccessed: { type: Number, default: 0 },
            lastMaterialAccess: Date,
            favoriteCategory: String,
          },
        },

        // Certificate reference (if earned)
        certificateId: { type: String },

        // User's personal notes (general course notes)
        userNotes: String,

        // Notifications preferences for this course
        notificationsEnabled: { type: Boolean, default: true },
      },
    ],

    // 2. Online Live Course Enrollments
    // ✅ COMPLETE FIX: Replace the entire myLiveCourses section in your User model

    myLiveCourses: [
      {
        // Reference to course
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "OnlineLiveTraining",
        },

        // ⭐ ENHANCED: Complete enrollment data with certificate logic
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

          // ⭐ CRITICAL: This reflects the ACTUAL amount user will pay
          paidAmount: {
            type: Number,
            default: 0,
          }, // €0 for free course, €10 for certificate, full price for paid course

          paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
          },
          promoCodeUsed: String,

          // ⭐ CERTIFICATE LOGIC FIELDS
          certificateRequested: {
            type: Boolean,
            default: false,
          }, // User wants certificate?
          certificateFee: {
            type: Number,
            default: 0,
          }, // €10 for free courses, €0 for paid courses (included)

          // ⭐ COURSE INFORMATION
          courseName: { type: String },
          courseCode: { type: String },
          courseType: { type: String, default: "OnlineLiveTraining" },
          originalPrice: {
            type: Number,
            default: 0,
          }, // Course price from course model (could be €0)
          currency: { type: String, default: "EUR" },

          // ⭐ LINKED COURSE FLAGS
          isLinkedCourse: {
            type: Boolean,
            default: false,
          }, // Is this linked to in-person course?
          isLinkedCourseFree: {
            type: Boolean,
            default: false,
          }, // Is this FREE because it's linked?

          // ⭐ NEW: ENROLLMENT TYPE for clear classification
          enrollmentType: {
            type: String,
            enum: [
              "free_no_certificate", // Free course, no certificate (€0)
              "free_with_certificate", // Free course + certificate (€10)
              "paid_regular", // Paid course at regular price
              "paid_early_bird", // Paid course at early bird price
              "linked_free", // Free because linked to in-person
            ],
            default: function () {
              // Auto-calculate based on other fields
              if (this.isLinkedCourseFree) return "linked_free";
              if (this.originalPrice === 0) {
                return this.certificateRequested
                  ? "free_with_certificate"
                  : "free_no_certificate";
              }
              return this.earlyBirdApplied ? "paid_early_bird" : "paid_regular";
            },
          },

          // ⭐ PRICING BREAKDOWN for transparency
          pricingBreakdown: {
            baseCoursePrice: { type: Number, default: 0 }, // Course price (€0 for free)
            certificatePrice: { type: Number, default: 0 }, // Certificate fee (€10 for free courses)
            earlyBirdDiscount: { type: Number, default: 0 }, // Early bird savings
            finalPrice: { type: Number, default: 0 }, // Total amount to pay

            // Flags for quick reference
            isFreeBase: { type: Boolean, default: false }, // Base course is free?
            certificateIncluded: { type: Boolean, default: false }, // Certificate included in price?
            payingForCertificateOnly: { type: Boolean, default: false }, // Only paying for certificate?
          },

          // ⭐ EARLY BIRD PRICING (for paid courses)
          earlyBirdApplied: { type: Boolean, default: false },
          earlyBirdSavings: { type: Number, default: 0 },
          earlyBirdDeadline: { type: Date },

          // ⭐ ACCESS & EXPIRY
          accessGrantedDate: { type: Date },
          expiryDate: { type: Date },

          // ⭐ PAYMENT TRACKING
          paymentMethod: { type: String }, // "free", "certificate_fee", "full_payment"
          paymentDate: { type: Date },
          paymentNotes: { type: String }, // Additional context
        },

        // ⭐ EXISTING: User progress (UNCHANGED)
        userProgress: {
          sessionsAttended: [
            {
              sessionId: mongoose.Schema.Types.ObjectId,
              sessionDate: Date,
              sessionName: String, // Cached session title

              // ✅ ENHANCED: Detailed time tracking
              timeTracking: {
                joinTime: Date,
                leaveTime: Date,
                totalDuration: Number, // Total session duration (minutes)
                userDuration: Number, // User's attendance duration (minutes)
                attendancePercentage: { type: Number, default: 0 }, // User's % of session
                reconnections: { type: Number, default: 0 }, // How many times user rejoined
                lastActivity: Date, // Last interaction timestamp
              },

              // ✅ NEW: Attendance confirmation system
              attendanceConfirmation: {
                isConfirmed: { type: Boolean, default: false },
                confirmationMethod: {
                  type: String,
                  enum: [
                    "auto-duration",
                    "manual-instructor",
                    "quiz-completion",
                    "interaction-based",
                  ],
                  default: "auto-duration",
                },
                confirmationDate: Date,
                confirmedBy: String, // instructor name or 'system'
                confirmedByInstructorId: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "Instructor",
                },

                // Confirmation criteria
                meetsMinimumDuration: { type: Boolean, default: false }, // ≥80% of session
                meetsInteractionRequirement: { type: Boolean, default: false }, // participated in activities
                hasValidReason: { type: Boolean, default: false }, // if absent with excuse

                // Override options for instructors
                manualOverride: {
                  isOverridden: { type: Boolean, default: false },
                  overrideReason: String,
                  overriddenBy: String,
                  overrideDate: Date,
                },
              },

              // ✅ NEW: Session engagement tracking
              engagement: {
                chatMessages: { type: Number, default: 0 },
                questionsAsked: { type: Number, default: 0 },
                pollsParticipated: { type: Number, default: 0 },
                screenInteractions: { type: Number, default: 0 },
                cameraOnDuration: { type: Number, default: 0 }, // minutes
                micActiveTime: { type: Number, default: 0 }, // minutes
                engagementScore: { type: Number, default: 0 }, // 0-100 calculated score
              },

              // Session status
              status: {
                type: String,
                enum: ["attended", "partial", "absent", "excused", "late"],
                default: "attended",
              },

              // Technical issues tracking
              technicalIssues: [
                {
                  issueType: {
                    type: String,
                    enum: ["connection", "audio", "video", "platform"],
                  },
                  reportedAt: Date,
                  resolvedAt: Date,
                  impactOnAttendance: Boolean,
                },
              ],
            },
          ],

          // ✅ NEW: Overall attendance requirements and tracking
          attendanceRequirements: {
            // Course-level requirements
            minimumSessionsRequired: { type: Number, default: 0 }, // Set by course/instructor
            minimumAttendancePercentage: { type: Number, default: 80 }, // % of total course duration

            // Current status
            sessionsConfirmed: { type: Number, default: 0 },
            totalSessionsAvailable: { type: Number, default: 0 },
            confirmedAttendancePercentage: { type: Number, default: 0 },

            // Eligibility flags
            meetsSessionRequirement: { type: Boolean, default: false },
            meetsPercentageRequirement: { type: Boolean, default: false },
            meetsOverallRequirement: { type: Boolean, default: false },

            // Tracking
            lastCalculated: { type: Date, default: Date.now },
            excusedAbsences: { type: Number, default: 0 },
            unexcusedAbsences: { type: Number, default: 0 },
          },

          // ✅ EXISTING: Keep all existing fields
          overallAttendancePercentage: { type: Number, default: 0 },
          recordingsWatched: [
            {
              recordingId: mongoose.Schema.Types.ObjectId,
              lastWatchedAt: Date,
              watchCount: { type: Number, default: 0 },
            },
          ],

          // Keep existing assessment fields...
          assessmentAttempts: [
            /* existing */
          ],
          bestAssessmentScore: Number,
          courseStatus: {
            type: String,
            enum: [
              "not-started",
              "in-progress",
              "completed",
              "failed-attendance",
            ],
            default: "not-started",
          },
          completionDate: Date,
        },

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

        downloadedMaterials: [
          {
            materialId: mongoose.Schema.Types.ObjectId,
            downloadDate: Date,
          },
        ],

        // ⭐ ENHANCED: Certificate tracking
        certificate: {
          certificateRequested: { type: Boolean, default: false },
          certificateEarned: { type: Boolean, default: false },
          certificateFeePaid: { type: Number, default: 0 },
          certificateIssuedDate: { type: Date },
          certificateId: { type: String },
          certificateUrl: { type: String },
          verificationCode: { type: String },
        },

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
            /* existing */
          },
          registrationDate: {
            /* existing */
          },
          paidAmount: Number,
          paymentTransactionId: {
            /* existing */
          },
          promoCodeUsed: String,

          // ⭐ ADD THESE TO ALL ENROLLMENT SCHEMAS:
          courseName: { type: String },
          courseCode: { type: String },
          courseType: { type: String },
          originalPrice: { type: Number, default: 0 },
          currency: { type: String, default: "EUR" },
          isLinkedCourse: { type: Boolean, default: false },
          isLinkedCourseFree: { type: Boolean, default: false },
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

    // 4. Instructor assignments
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
    // NO UNIQUE CONSTRAINTS TO PREVENT INDEX ERRORS
    // ========================================
    myCertificates: [
      {
        // No unique constraint - prevents registration errors
        certificateId: { type: String },
        courseId: { type: mongoose.Schema.Types.ObjectId },
        courseType: {
          type: String,
          enum: [
            "SelfPacedOnlineTraining",
            "OnlineLiveTraining",
            "InPersonAestheticTraining",
          ],
        },

        // Certificate data
        certificateData: {
          recipientName: String,
          courseTitle: String,
          courseCode: String,
          instructorName: String,
          completionDate: Date,
          issueDate: { type: Date, default: Date.now },
          expiryDate: Date,

          // Achievement data (snapshot at completion)
          achievement: {
            attendancePercentage: Number,
            examScore: Number,
            totalHours: Number,
            grade: String,
          },

          // Verification - No unique constraint
          verificationCode: String,
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
    // PAYMENT TRANSACTIONS
    // ========================================
    // ========================================
    // ENHANCED PAYMENT TRANSACTIONS SYSTEM
    // ========================================
    paymentTransactions: [
      {
        // Transaction Identification
        transactionId: { type: String, required: true }, // Our internal transaction ID
        orderNumber: { type: String, required: true, unique: true }, // Unique order number
        receiptNumber: { type: String, required: true },

        // Timestamps
        createdAt: { type: Date, default: Date.now },
        transactionDate: { type: Date, default: Date.now },
        completedAt: Date, // When payment was confirmed

        // Payment Gateway Details (CCAvenue)
        ccavenue: {
          orderId: String, // CCAvenue order ID
          trackingId: String, // CCAvenue tracking ID
          bankRefNo: String, // Bank reference number
          paymentMode: String, // "Net Banking", "Credit Card", etc.
          cardName: String, // Card/Bank name
          statusCode: String,
          statusMessage: String,
          failureMessage: String,
          merchantParam1: String, // Additional merchant parameters
          merchantParam2: String,
          merchantParam3: String,
        },

        // Payment Status & Method
        paymentStatus: {
          type: String,
          enum: [
            "pending",
            "processing",
            "completed",
            "failed",
            "cancelled",
            "refunded",
          ],
          default: "pending",
        },
        paymentMethod: String, // "CCAvenue", "Promo Code", "Credit Card"

        // Financial Details
        financial: {
          subtotal: { type: Number, required: true }, // Original total before discounts
          discountAmount: { type: Number, default: 0 }, // Total discount applied
          earlyBirdSavings: { type: Number, default: 0 }, // Early bird discount
          promoCodeDiscount: { type: Number, default: 0 }, // Promo code discount
          tax: { type: Number, default: 0 },
          processingFee: { type: Number, default: 0 },
          finalAmount: { type: Number, required: true }, // Amount actually charged
          currency: { type: String, default: "EUR" },
        },

        // Discount Information
        discounts: {
          promoCode: {
            code: String,
            discountType: { type: String, enum: ["percentage", "fixed"] },
            discountValue: Number,
            discountAmount: Number,
          },
          earlyBird: {
            applied: { type: Boolean, default: false },
            totalSavings: { type: Number, default: 0 },
            coursesWithEarlyBird: [String], // Course IDs that had early bird
          },
        },

        // Course Items in This Transaction
        items: [
          {
            courseId: { type: mongoose.Schema.Types.ObjectId, required: true },
            courseType: {
              type: String,
              enum: [
                "InPersonAestheticTraining",
                "OnlineLiveTraining",
                "SelfPacedOnlineTraining",
              ],
              required: true,
            },
            courseTitle: String,
            courseCode: String,

            // Pricing for this specific course
            originalPrice: Number, // Original course price
            earlyBirdPrice: Number, // Early bird price (if applicable)
            finalPrice: Number, // Actual price paid for this course
            isEarlyBird: { type: Boolean, default: false },
            earlyBirdSavings: { type: Number, default: 0 },
            earlyBirdDeadline: Date,

            // Course Schedule Information
            courseSchedule: {
              startDate: Date,
              endDate: Date,
              duration: String,
              location: String, // For in-person courses
              platform: String, // For online courses
              accessDays: Number, // For self-paced courses
              expiryDate: Date, // For self-paced courses
            },

            // Instructor Information (cached for records)
            instructor: {
              name: String,
              id: mongoose.Schema.Types.ObjectId,
            },
          },
        ],

        // Customer Information (snapshot at time of purchase)
        customerInfo: {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          name: String,
          email: String,
          phone: String,
          country: String,
          billingAddress: {
            name: String,
            address: String,
            city: String,
            state: String,
            country: String,
            zip: String,
          },
        },

        // Gift Information (if applicable)
        gift: {
          isGift: { type: Boolean, default: false },
          recipientEmail: String,
          recipientName: String,
          giftMessage: String,
          senderName: String,
        },

        // Additional Information
        metadata: {
          userAgent: String, // Browser/device info
          ipAddress: String,
          sessionId: String,
          orderNotes: String,
          source: { type: String, default: "website" }, // "website", "mobile", "api"
        },

        // Communication Records
        communications: [
          {
            type: { type: String, enum: ["email", "sms", "notification"] },
            template: String,
            sentAt: Date,
            status: {
              type: String,
              enum: ["sent", "delivered", "failed", "bounced"],
            },
            recipientEmail: String,
            subject: String,
          },
        ],

        // Refund Information (if applicable)
        refund: {
          isRefunded: { type: Boolean, default: false },
          refundAmount: Number,
          refundDate: Date,
          refundReason: String,
          refundTransactionId: String,
          refundMethod: String,
          processedBy: mongoose.Schema.Types.ObjectId,
        },

        // Receipt & Documentation
        documentation: {
          receiptUrl: String,
          invoiceUrl: String,
          contractUrl: String,
          certificateEligible: { type: Boolean, default: true },
        },
      },
    ],

    // ========================================
    // PAYMENT PREFERENCES & SETTINGS
    // ========================================
    paymentPreferences: {
      preferredCurrency: { type: String, default: "EUR" },
      savedPaymentMethods: [
        {
          type: { type: String, enum: ["card", "bank", "wallet"] },
          last4: String,
          brand: String,
          expiryMonth: Number,
          expiryYear: Number,
          isDefault: { type: Boolean, default: false },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      billingAddress: {
        name: String,
        address: String,
        city: String,
        state: String,
        country: String,
        zip: String,
        isDefault: { type: Boolean, default: true },
      },
    },

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
// SAFE INDEXES - NO CERTIFICATE INDEXES
// These indexes will not cause registration errors
// ========================================

// Essential indexes for performance
userSchema.index({ email: 1 }, { unique: true }); // Keep email unique
userSchema.index({ "myInPersonCourses.courseId": 1 });
userSchema.index({ "myLiveCourses.courseId": 1 });
userSchema.index({ "mySelfPacedCourses.courseId": 1 });

// Transaction indexes (these don't cause issues because they're required fields)
userSchema.index({ "paymentTransactions.transactionId": 1 });
userSchema.index({ "paymentTransactions.receiptNumber": 1 });

// Role and status indexes for admin queries
userSchema.index({ role: 1 });
userSchema.index({ isConfirmed: 1 });
userSchema.index({ "accountStatus.isActive": 1 });

// New indexes for professional information
userSchema.index({ "professionalInfo.fieldOfStudy": 1 });
userSchema.index({ "professionalInfo.aestheticsExperience": 1 });
userSchema.index({
  "profileData.identificationDocument.verificationStatus": 1,
});

// REMOVED ALL CERTIFICATE INDEXES TO PREVENT REGISTRATION ERRORS:
// userSchema.index({ "myCertificates.certificateId": 1 });
// userSchema.index({ "myCertificates.verificationCode": 1 });
// userSchema.index({ "myCertificates.certificateData.verificationCode": 1 });

// ========================================
// ENHANCED INDEXES
// ========================================
userSchema.index(
  { "paymentTransactions.orderNumber": 1 },
  { unique: true, sparse: true }
);
userSchema.index({ "paymentTransactions.transactionId": 1 });
userSchema.index(
  { "paymentTransactions.ccavenue.orderId": 1 },
  { sparse: true }
);
userSchema.index(
  { "paymentTransactions.ccavenue.trackingId": 1 },
  { sparse: true }
);
userSchema.index({ "paymentTransactions.paymentStatus": 1 });
userSchema.index({ "paymentTransactions.createdAt": -1 });
// 🆕 New indexes for address and payment info
userSchema.index({ "addressInfo.country": 1 });
userSchema.index({ "addressInfo.isComplete": 1 });
userSchema.index({ "paymentPreferences.preferredCurrency": 1 });

// ═══════════════════════════════════════════════════════════════════════════════
// ║                                INDEXES                                     ║
// ║                     Add these to your existing indexes                     ║
// ═══════════════════════════════════════════════════════════════════════════════

// ADD THESE INDEXES TO YOUR EXISTING USER SCHEMA INDEXES SECTION:

userSchema.index({ "originatedFromSupport.supportTeamId": 1 });
userSchema.index({ "originatedFromSupport.caseId": 1 });
userSchema.index({ "originatedFromSupport.transferDate": -1 });
userSchema.index({
  "originatedFromSupport.supportJourney.attributedRevenue": -1,
});

// Compound index for support analytics
userSchema.index({
  "originatedFromSupport.supportTeamId": 1,
  "originatedFromSupport.transferDate": -1,
});
// ========================================
// VIRTUAL FIELDS
// ========================================
//new
// Full name with title (for display purposes)

userSchema.virtual("fullName").get(function () {
  const title = this.professionalInfo?.title || "";
  const firstName = this.firstName || "";
  const lastName = this.lastName || "";
  return `${title} ${firstName} ${lastName}`.trim();
});

// Display name without title
userSchema.virtual("displayName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// 🆕 Payment readiness check
userSchema.virtual("isPaymentReady").get(function () {
  return !!(
    this.firstName &&
    this.lastName &&
    this.email &&
    this.phoneNumber &&
    (this.addressInfo?.address || this.country) &&
    (this.addressInfo?.city || this.addressInfo?.country)
  );
});

// 🆕 Complete billing address virtual
userSchema.virtual("completeBillingAddress").get(function () {
  return {
    name: this.fullName,
    email: this.email,
    phone: this.phoneNumber || this.addressInfo?.alternativePhone,
    address: this.addressInfo?.address || "Address not provided",
    city: this.addressInfo?.city || "City not provided",
    state: this.addressInfo?.state || "State not provided",
    country:
      this.addressInfo?.country || this.country || "Country not provided",
    zip: this.addressInfo?.zipCode || "00000",
  };
});

// 🆕 Enhanced profile completion calculation
userSchema.virtual("profileCompletionPercentage").get(function () {
  let completion = 0;
  const weights = {
    basicInfo: 20, // firstName, lastName, email
    contactInfo: 15, // phone, basic address
    addressInfo: 20, // complete address information
    professionalInfo: 25, // professional details
    profilePicture: 10, // profile picture
    identification: 10, // ID verification
  };

  // Basic info completion
  if (this.firstName && this.lastName && this.email) {
    completion += weights.basicInfo;
  }

  // Contact info completion
  if (this.phoneNumber && (this.country || this.addressInfo?.country)) {
    completion += weights.contactInfo;
  }

  // Address info completion
  if (
    this.addressInfo?.address &&
    this.addressInfo?.city &&
    this.addressInfo?.country
  ) {
    completion += weights.addressInfo;
  }

  // Professional info completion
  if (
    this.professionalInfo?.fieldOfStudy &&
    this.professionalInfo?.aestheticsExperience
  ) {
    completion += weights.professionalInfo;
  }

  // Profile picture completion
  if (this.profileData?.profilePicture?.url) {
    completion += weights.profilePicture;
  }

  // ID document completion
  if (this.profileData?.identificationDocument?.url) {
    completion += weights.identification;
  }

  return Math.round(completion);
});

// Check if user completed basic registration (minimal signup)
userSchema.virtual("hasCompletedBasicRegistration").get(function () {
  return !!(this.firstName && this.lastName && this.email && this.isConfirmed);
});

// Check if professional profile is complete (for advanced features)
userSchema.virtual("isProfessionalProfileComplete").get(function () {
  return (
    this.professionalInfo?.fieldOfStudy &&
    this.professionalInfo?.aestheticsExperience &&
    this.professionalInfo?.specialty &&
    this.profileData?.identificationDocument?.verificationStatus === "verified"
  );
});

// Check if user can receive certificates (needs ID verification)
userSchema.virtual("canReceiveCertificates").get(function () {
  return (
    this.profileData?.identificationDocument?.verificationStatus === "verified"
  );
});

// Get user's experience level for course recommendations
userSchema.virtual("experienceLevel").get(function () {
  return this.professionalInfo?.aestheticsExperience || "Not specified";
});

// Get professional status for display
userSchema.virtual("professionalStatus").get(function () {
  const field = this.professionalInfo?.fieldOfStudy;
  const experience = this.professionalInfo?.aestheticsExperience;

  if (!field || !experience) {
    return "Profile incomplete";
  }

  return `${field} - ${experience}`;
});

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
//new
userSchema.methods.updateAddressInfo = function (addressData) {
  if (!this.addressInfo) {
    this.addressInfo = {};
  }

  Object.keys(addressData).forEach((key) => {
    if (addressData[key] !== undefined && addressData[key] !== null) {
      this.addressInfo[key] = addressData[key];
    }
  });

  // Check if address is complete
  this.addressInfo.isComplete = !!(
    this.addressInfo.address &&
    this.addressInfo.city &&
    this.addressInfo.country
  );

  this.addressInfo.lastUpdated = new Date();

  // Update profile completion
  this.updateProfileCompletion();
  return this.save();
};

// Get CCAvenue-ready billing data
userSchema.methods.getCCAvenueReadyData = function () {
  const billingData = this.completeBillingAddress;

  return {
    // Mandatory fields
    billing_name: billingData.name.substring(0, 50),
    billing_email: billingData.email,
    billing_tel: billingData.phone?.substring(0, 20) || "0000000000",
    billing_address: billingData.address.substring(0, 255),
    billing_city: billingData.city.substring(0, 50),
    billing_state: billingData.state.substring(0, 50),
    billing_zip: billingData.zip.substring(0, 10),
    billing_country: billingData.country.substring(0, 50),

    // Delivery (same as billing for digital products)
    delivery_name: billingData.name.substring(0, 50),
    delivery_address: billingData.address.substring(0, 255),
    delivery_city: billingData.city.substring(0, 50),
    delivery_state: billingData.state.substring(0, 50),
    delivery_zip: billingData.zip.substring(0, 10),
    delivery_country: billingData.country.substring(0, 50),
    delivery_tel: billingData.phone?.substring(0, 20) || "0000000000",

    // Additional
    customer_identifier: this.email,
    delivery_cust_notes:
      this.deliveryInfo?.deliveryNotes ||
      "Digital course enrollment - no physical delivery required",
  };
};

// Enhanced profile completion update
userSchema.methods.updateProfileCompletion = function () {
  if (!this.profileData) {
    this.profileData = {};
  }

  if (!this.profileData.completionStatus) {
    this.profileData.completionStatus = {};
  }

  const completion = this.profileData.completionStatus;

  // Check various completion aspects
  completion.basicInfo = !!(this.firstName && this.lastName && this.email);
  completion.addressInfo = !!(
    this.addressInfo?.address &&
    this.addressInfo?.city &&
    this.addressInfo?.country
  );
  completion.professionalInfo = !!(
    this.professionalInfo?.fieldOfStudy &&
    this.professionalInfo?.aestheticsExperience
  );
  completion.profilePicture = !!this.profileData?.profilePicture?.url;
  completion.identificationDocument =
    !!this.profileData?.identificationDocument?.url;
  completion.paymentReady = this.isPaymentReady;
  completion.overallPercentage = this.profileCompletionPercentage;
  completion.lastUpdated = new Date();

  return this;
};

// Upload profile picture
userSchema.methods.uploadProfilePicture = function (fileData) {
  if (!this.profileData) {
    this.profileData = {};
  }

  this.profileData.profilePicture = {
    filename: fileData.filename,
    originalName: fileData.originalname,
    url: fileData.url || `/uploads/profiles/${fileData.filename}`,
    uploadDate: new Date(),
    fileSize: fileData.size,
    mimeType: fileData.mimetype,
  };

  this.updateProfileCompletion();
  return this.save();
};

// Upload identification document
userSchema.methods.uploadIdentificationDocument = function (
  fileData,
  documentType = "passport"
) {
  if (!this.profileData) {
    this.profileData = {};
  }

  this.profileData.identificationDocument = {
    filename: fileData.filename,
    originalName: fileData.originalname,
    url: fileData.url || `/uploads/identification/${fileData.filename}`,
    uploadDate: new Date(),
    fileSize: fileData.size,
    mimeType: fileData.mimetype,
    documentType: documentType,
    verificationStatus: "pending",
  };

  this.updateProfileCompletion();
  return this.save();
};

// Update professional information
userSchema.methods.updateProfessionalInfo = function (professionalData) {
  if (!this.professionalInfo) {
    this.professionalInfo = {};
  }

  // Update fields that are provided
  Object.keys(professionalData).forEach((key) => {
    if (professionalData[key] !== undefined && professionalData[key] !== null) {
      this.professionalInfo[key] = professionalData[key];
    }
  });

  this.updateProfileCompletion();
  return this.save();
};

// Get professional summary for display
userSchema.methods.getProfessionalSummary = function () {
  const prof = this.professionalInfo || {};

  return {
    title: prof.title || null,
    fieldOfStudy: prof.fieldOfStudy || "Not specified",
    specialty: prof.specialty || "Not specified",
    experience: prof.aestheticsExperience || "Not specified",
    yearsOfExperience: prof.yearsOfExperience || null,
    hasLicense: prof.licenseInfo?.hasLicense || false,
    areasOfInterest: prof.areasOfInterest || [],
  };
};
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

// Cleanup orphaned enrollments
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

//new
// Add this to your User model (user.js)
userSchema.statics.getNotificationRecipients = function (
  emailType = "course_announcement"
) {
  const filter = {
    isConfirmed: true,
    "accountStatus.isLocked": { $ne: true },
    "notificationSettings.email": true,
  };

  // For commercial emails (new course announcements)
  if (emailType === "course_announcement") {
    filter["notificationSettings.courseUpdates"] = true;
    // Could also check promotions: true for marketing emails
  }

  // For transactional emails (registration confirmations, etc.)
  // No additional filters needed - these should go to all confirmed users

  return this.find(filter).select("email firstName lastName");
};

//new
// ✅ ENHANCED: User Model Methods for Certificate Logic

// Add these methods to the User schema

/**
 * ⭐ NEW: Update live course enrollment with certificate logic
 */
userSchema.methods.updateLiveCourseEnrollment = function (courseId, updates) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Update basic enrollment data
  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      enrollment.enrollmentData[key] = updates[key];
    }
  });

  // ⭐ CRITICAL: Update certificate pricing logic
  this.calculateLiveCoursePricing(enrollment, updates);

  return this.save();
};

/**
 * ⭐ NEW: Calculate pricing for live course enrollment
 */
userSchema.methods.calculateLiveCoursePricing = function (
  enrollment,
  updates = {}
) {
  const enrollmentData = enrollment.enrollmentData;

  // Get base course information
  const originalCoursePrice = enrollmentData.originalPrice || 0;
  const isLinkedCourse = enrollmentData.isLinkedCourseFree || false;
  const certificateRequested =
    updates.certificateRequested !== undefined
      ? updates.certificateRequested
      : enrollmentData.certificateRequested || false;

  // Initialize certificate pricing breakdown
  if (!enrollmentData.certificatePricing) {
    enrollmentData.certificatePricing = {};
  }

  const pricing = enrollmentData.certificatePricing;
  pricing.originalCoursePrice = originalCoursePrice;
  pricing.isFreeBase = originalCoursePrice === 0;

  // ⭐ CRITICAL: Calculate based on course type and certificate request
  if (isLinkedCourse) {
    // Linked courses are always free, no certificates
    pricing.certificatePrice = 0;
    pricing.finalPrice = 0;
    pricing.certificateOnly = false;
    enrollmentData.paidAmount = 0;
    enrollmentData.certificateRequested = false;
    enrollmentData.certificateFee = 0;
    enrollmentData.accessDetails.enrollmentType = "linked_free";
    enrollmentData.paymentDetails.paymentReason = "linked_course_free";
  } else if (originalCoursePrice === 0) {
    // Free course logic
    if (certificateRequested) {
      // Free course + certificate = €10
      pricing.certificatePrice = 10;
      pricing.finalPrice = 10;
      pricing.certificateOnly = true;
      enrollmentData.paidAmount = 10;
      enrollmentData.certificateRequested = true;
      enrollmentData.certificateFee = 10;
      enrollmentData.accessDetails.enrollmentType = "free_with_certificate";
      enrollmentData.paymentDetails.paymentReason = "certificate_fee";
      enrollmentData.paymentDetails.baseAmount = 0;
      enrollmentData.paymentDetails.certificateAmount = 10;
      enrollmentData.paymentDetails.totalPaid = 10;
    } else {
      // Free course, no certificate = €0
      pricing.certificatePrice = 0;
      pricing.finalPrice = 0;
      pricing.certificateOnly = false;
      enrollmentData.paidAmount = 0;
      enrollmentData.certificateRequested = false;
      enrollmentData.certificateFee = 0;
      enrollmentData.accessDetails.enrollmentType = "free_no_certificate";
      enrollmentData.paymentDetails.paymentReason = "free_course";
      enrollmentData.paymentDetails.baseAmount = 0;
      enrollmentData.paymentDetails.certificateAmount = 0;
      enrollmentData.paymentDetails.totalPaid = 0;
    }
  } else {
    // Paid course logic
    const isEarlyBird = enrollmentData.earlyBirdApplied || false;
    const earlyBirdPrice = isEarlyBird
      ? originalCoursePrice - (enrollmentData.earlyBirdSavings || 0)
      : originalCoursePrice;

    pricing.certificatePrice = 0; // Included in paid courses
    pricing.finalPrice = earlyBirdPrice;
    pricing.certificateOnly = false;
    enrollmentData.paidAmount = earlyBirdPrice;
    enrollmentData.certificateRequested = true; // Automatically included
    enrollmentData.certificateFee = 0; // Included in course price
    enrollmentData.accessDetails.enrollmentType = isEarlyBird
      ? "paid_early_bird"
      : "paid_regular";
    enrollmentData.paymentDetails.paymentReason = isEarlyBird
      ? "early_bird_discount"
      : "full_course_fee";
    enrollmentData.paymentDetails.baseAmount = earlyBirdPrice;
    enrollmentData.paymentDetails.certificateAmount = 0;
    enrollmentData.paymentDetails.totalPaid = earlyBirdPrice;
  }

  // Update access details
  enrollmentData.accessDetails.accessGrantedDate = new Date();
  enrollmentData.accessDetails.certificateEligible = true;

  console.log(`💰 Live course pricing calculated:`, {
    courseId: enrollment.courseId,
    originalPrice: originalCoursePrice,
    certificateRequested: certificateRequested,
    finalPrice: pricing.finalPrice,
    enrollmentType: enrollmentData.accessDetails.enrollmentType,
    paymentReason: enrollmentData.paymentDetails.paymentReason,
  });

  return pricing;
};

/**
 * ⭐ NEW: Get live course enrollment summary
 */
userSchema.methods.getLiveCourseEnrollmentSummary = function (courseId) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    return null;
  }

  const data = enrollment.enrollmentData;
  const pricing = data.certificatePricing || {};

  return {
    courseId: enrollment.courseId,
    status: data.status,
    enrollmentType: data.accessDetails?.enrollmentType || "unknown",

    // Pricing breakdown
    originalCoursePrice: pricing.originalCoursePrice || data.originalPrice || 0,
    certificateFee: data.certificateFee || 0,
    totalPaid: data.paidAmount || 0,

    // Certificate info
    certificateRequested: data.certificateRequested || false,
    certificateIncluded:
      data.accessDetails?.enrollmentType?.includes("paid") || false,
    certificateEligible: data.accessDetails?.certificateEligible || false,

    // Course type
    isLinkedCourseFree: data.isLinkedCourseFree || false,
    isFreeBase: pricing.isFreeBase || false,
    isPaidCourse: (pricing.originalCoursePrice || 0) > 0,

    // Payment details
    paymentReason: data.paymentDetails?.paymentReason || "unknown",
    paymentBreakdown: {
      baseAmount: data.paymentDetails?.baseAmount || 0,
      certificateAmount: data.paymentDetails?.certificateAmount || 0,
      totalPaid: data.paymentDetails?.totalPaid || 0,
    },
  };
};

/**
 * ⭐ NEW: Create live course enrollment with certificate logic
 */
userSchema.methods.createLiveCourseEnrollment = function (
  courseData,
  options = {}
) {
  const {
    courseId,
    courseName,
    courseCode,
    originalPrice = 0,
    currency = "EUR",
    certificateRequested = false,
    isLinkedCourseFree = false,
    earlyBirdApplied = false,
    earlyBirdSavings = 0,
    status = "cart",
  } = courseData;

  // Create base enrollment structure
  const enrollment = {
    courseId: courseId,
    enrollmentData: {
      status: status,
      registrationDate: new Date(),
      courseName: courseName,
      courseCode: courseCode,
      courseType: "OnlineLiveTraining",
      originalPrice: originalPrice,
      currency: currency,
      isLinkedCourse: isLinkedCourseFree,
      isLinkedCourseFree: isLinkedCourseFree,
      certificateRequested: certificateRequested,
      certificateFee: 0, // Will be calculated
      paidAmount: 0, // Will be calculated
      earlyBirdApplied: earlyBirdApplied,
      earlyBirdSavings: earlyBirdSavings,

      // Initialize pricing structure
      certificatePricing: {
        originalCoursePrice: originalPrice,
        certificatePrice: 0,
        finalPrice: 0,
        isFreeBase: originalPrice === 0,
        certificateOnly: false,
      },

      // Initialize access details
      accessDetails: {
        enrollmentType: "unknown", // Will be calculated
        certificateEligible: true,
      },

      // Initialize payment details
      paymentDetails: {
        baseAmount: 0,
        certificateAmount: 0,
        totalPaid: 0,
        paymentReason: "unknown",
      },
    },
  };

  // Add to user's live courses
  if (!this.myLiveCourses) {
    this.myLiveCourses = [];
  }
  this.myLiveCourses.push(enrollment);

  // Calculate pricing based on certificate logic
  this.calculateLiveCoursePricing(enrollment);

  console.log(`✅ Live course enrollment created:`, {
    courseId: courseId,
    enrollmentType: enrollment.enrollmentData.accessDetails.enrollmentType,
    finalPrice: enrollment.enrollmentData.certificatePricing.finalPrice,
    certificateRequested: certificateRequested,
  });

  return enrollment;
};

/**
 * ⭐ NEW: Bulk get cart items with proper certificate pricing
 */
userSchema.methods.getLiveCourseCartItems = function () {
  return this.myLiveCourses
    .filter((enrollment) => enrollment.enrollmentData.status === "cart")
    .map((enrollment) => {
      const summary = this.getLiveCourseEnrollmentSummary(enrollment.courseId);
      return {
        ...summary,
        enrollmentId: enrollment._id,
        addedDate: enrollment.enrollmentData.registrationDate,
        title: enrollment.enrollmentData.courseName,
        courseCode: enrollment.enrollmentData.courseCode,
      };
    });
};
// ═══════════════════════════════════════════════════════════════════════════════
// ║                            ADDITIONAL METHODS                              ║
// ║                   Add these to User schema methods section                 ║
// ═══════════════════════════════════════════════════════════════════════════════

// ADD THESE METHODS TO YOUR EXISTING USER SCHEMA METHODS (around line 2500+)

/**
 * 📊 Check if user originated from support team
 */
userSchema.methods.isFromSupportTeam = function () {
  return !!this.originatedFromSupport?.supportTeamId;
};

/**
 * 🤝 Link user to support team case
 */
userSchema.methods.linkToSupportCase = function (supportData) {
  this.originatedFromSupport = {
    supportTeamId: supportData.supportTeamId,
    caseId: supportData.caseId,
    transferDate: new Date(),
    supportStaffName: supportData.supportStaffName,
    originalContactId: supportData.originalContactId,
    supportJourney: {
      daysFromContactToRegistration: supportData.daysFromContact || 0,
      totalSupportInteractions: supportData.totalInteractions || 0,
      originalLeadSource: supportData.originalLeadSource,
      conversionNotes: supportData.conversionNotes,
    },
  };

  return this.save();
};

/**
 * 💰 Update support attribution revenue
 */
userSchema.methods.updateSupportAttribution = function (revenue, notes = null) {
  if (this.originatedFromSupport?.supportTeamId) {
    this.originatedFromSupport.supportJourney.attributedRevenue += revenue;
    if (notes) {
      this.originatedFromSupport.supportJourney.conversionNotes = notes;
    }
    return this.save();
  }
  return Promise.resolve(this);
};

/**
 * 📈 Get support team performance data for this user
 */
userSchema.methods.getSupportAttribution = function () {
  if (!this.isFromSupportTeam()) {
    return null;
  }

  return {
    supportTeamId: this.originatedFromSupport.supportTeamId,
    supportStaffName: this.originatedFromSupport.supportStaffName,
    caseId: this.originatedFromSupport.caseId,
    transferDate: this.originatedFromSupport.transferDate,
    daysToConversion:
      this.originatedFromSupport.supportJourney.daysFromContactToRegistration,
    totalInteractions:
      this.originatedFromSupport.supportJourney.totalSupportInteractions,
    attributedRevenue:
      this.originatedFromSupport.supportJourney.attributedRevenue,
    originalSource:
      this.originatedFromSupport.supportJourney.originalLeadSource,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ║                              STATIC METHODS                                ║
// ║                    Add these to User schema statics section                ║
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 📊 Get support team performance analytics
 */
userSchema.statics.getSupportTeamAnalytics = function (
  supportTeamId = null,
  dateRange = {}
) {
  const matchStage = {
    "originatedFromSupport.supportTeamId": { $exists: true },
  };

  if (supportTeamId) {
    matchStage["originatedFromSupport.supportTeamId"] = supportTeamId;
  }

  if (dateRange.start || dateRange.end) {
    matchStage["originatedFromSupport.transferDate"] = {};
    if (dateRange.start)
      matchStage["originatedFromSupport.transferDate"].$gte = new Date(
        dateRange.start
      );
    if (dateRange.end)
      matchStage["originatedFromSupport.transferDate"].$lte = new Date(
        dateRange.end
      );
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$originatedFromSupport.supportTeamId",
        supportStaffName: { $first: "$originatedFromSupport.supportStaffName" },
        totalUsers: { $sum: 1 },
        totalRevenue: {
          $sum: "$originatedFromSupport.supportJourney.attributedRevenue",
        },
        avgDaysToConversion: {
          $avg: "$originatedFromSupport.supportJourney.daysFromContactToRegistration",
        },
        avgInteractions: {
          $avg: "$originatedFromSupport.supportJourney.totalSupportInteractions",
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

/**
 * 🔍 Find users from specific support team
 */
userSchema.statics.findBySupportTeam = function (supportTeamId) {
  return this.find({
    "originatedFromSupport.supportTeamId": supportTeamId,
  }).sort({ "originatedFromSupport.transferDate": -1 });
};

// ========================================
// INSTANCE METHODS FOR PAYMENT MANAGEMENT
// ========================================

/**
 * Create a new payment transaction record
 */
userSchema.methods.createPaymentTransaction = function (transactionData) {
  const transaction = {
    // ✅ REQUIRED FIELDS
    transactionId:
      transactionData.transactionId ||
      `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orderNumber:
      transactionData.orderNumber ||
      `ORD_${Date.now()}_${this._id.toString().slice(-6)}`,
    receiptNumber:
      transactionData.receiptNumber ||
      `REC_${Date.now()}_${Math.floor(Math.random() * 1000)}`,

    // Timestamps
    createdAt: new Date(),
    transactionDate: new Date(),
    completedAt: transactionData.completedAt || null,

    // Payment details
    paymentStatus: transactionData.paymentStatus || "pending",
    paymentMethod: transactionData.paymentMethod || "CCAvenue",

    // ✅ REQUIRED: Financial object with all required fields
    // In paymentTransactions financial object, update to:
    financial: {
      subtotal: { type: Number, required: true }, // EUR amount
      subtotalAED: { type: Number }, // ✅ ADD: AED equivalent
      discountAmount: { type: Number, default: 0 }, // EUR
      discountAmountAED: { type: Number, default: 0 }, // ✅ ADD: AED equivalent
      earlyBirdSavings: { type: Number, default: 0 }, // EUR
      promoCodeDiscount: { type: Number, default: 0 }, // EUR
      tax: { type: Number, default: 0 },
      processingFee: { type: Number, default: 0 },
      finalAmount: { type: Number, required: true }, // EUR amount (business logic)
      finalAmountAED: { type: Number }, // ✅ ADD: AED amount (sent to bank)
      currency: { type: String, default: "EUR" }, // Base currency
      currencyPaid: { type: String, default: "AED" }, // ✅ ADD: Currency actually paid to bank
      exchangeRate: { type: Number, default: 4.0 }, // ✅ ADD: Rate used for conversion
    },

    // Discounts
    discounts: transactionData.discounts || {},

    // Items
    items: transactionData.items || [],

    // ✅ REQUIRED: Customer info with userId
    customerInfo: {
      userId: this._id, // ✅ REQUIRED - Always use the current user's ID
      name:
        transactionData.customerInfo?.name ||
        `${this.firstName} ${this.lastName}`,
      email: transactionData.customerInfo?.email || this.email,
      phone: transactionData.customerInfo?.phone || this.phoneNumber,
      country: transactionData.customerInfo?.country || this.country,
      billingAddress: transactionData.customerInfo?.billingAddress || {
        name: `${this.firstName} ${this.lastName}`,
        address: "",
        city: "",
        state: "",
        country: this.country || "",
        zip: "",
      },
    },

    // Gift information
    gift: transactionData.gift || { isGift: false },

    // Metadata
    metadata: transactionData.metadata || {},

    // CCAvenue details (for paid transactions)
    ccavenue: transactionData.ccavenue || {},

    // Communications
    communications: [],

    // Refund information
    refund: {
      isRefunded: false,
      refundAmount: 0,
      refundDate: null,
      refundReason: null,
      refundTransactionId: null,
      refundMethod: null,
      processedBy: null,
    },

    // Documentation
    documentation: {
      receiptUrl: null,
      invoiceUrl: null,
      contractUrl: null,
      certificateEligible: true,
    },
  };

  // Add the transaction to the user's paymentTransactions array
  this.paymentTransactions.push(transaction);

  // Return the transaction for reference
  return transaction;
};
/**
 * Update payment transaction with CCAvenue response
 */
userSchema.methods.updatePaymentTransaction = function (
  transactionId,
  ccavenueResponse
) {
  const transaction = this.paymentTransactions.find(
    (t) => t.transactionId === transactionId
  );

  if (transaction) {
    transaction.ccavenue = {
      orderId: ccavenueResponse.order_id,
      trackingId: ccavenueResponse.tracking_id,
      bankRefNo: ccavenueResponse.bank_ref_no,
      paymentMode: ccavenueResponse.payment_mode,
      cardName: ccavenueResponse.card_name,
      statusCode: ccavenueResponse.status_code,
      statusMessage: ccavenueResponse.status_message,
      failureMessage: ccavenueResponse.failure_message || "",
    };

    transaction.paymentStatus =
      ccavenueResponse.order_status === "Success" ? "completed" : "failed";
    transaction.completedAt = new Date();

    return transaction;
  }

  return null;
};

/**
 * Get payment transaction by various identifiers
 */
userSchema.methods.getPaymentTransaction = function (
  identifier,
  type = "transactionId"
) {
  return this.paymentTransactions.find((t) => t[type] === identifier);
};

/**
 * Update course enrollment status after successful payment
 */
userSchema.methods.updateEnrollmentStatusAfterPayment = function (
  transactionId
) {
  const transaction = this.getPaymentTransaction(transactionId);

  if (transaction && transaction.paymentStatus === "completed") {
    transaction.items.forEach((item) => {
      // Update enrollment status based on course type
      if (item.courseType === "InPersonAestheticTraining") {
        const enrollment = this.myInPersonCourses.find(
          (e) =>
            e.courseId.toString() === item.courseId.toString() &&
            e.enrollmentData.status === "cart"
        );
        if (enrollment) {
          enrollment.enrollmentData.status = "paid";
          enrollment.enrollmentData.paidAmount = item.finalPrice;
          enrollment.enrollmentData.paymentTransactionId = transactionId;
        }
      } else if (item.courseType === "OnlineLiveTraining") {
        const enrollment = this.myLiveCourses.find(
          (e) =>
            e.courseId.toString() === item.courseId.toString() &&
            e.enrollmentData.status === "cart"
        );
        if (enrollment) {
          enrollment.enrollmentData.status = "paid";
          enrollment.enrollmentData.paidAmount = item.finalPrice;
          enrollment.enrollmentData.paymentTransactionId = transactionId;
        }
      } else if (item.courseType === "SelfPacedOnlineTraining") {
        const enrollment = this.mySelfPacedCourses.find(
          (e) =>
            e.courseId.toString() === item.courseId.toString() &&
            e.enrollmentData.status === "cart"
        );
        if (enrollment) {
          enrollment.enrollmentData.status = "paid";
          enrollment.enrollmentData.paidAmount = item.finalPrice;
          enrollment.enrollmentData.paymentTransactionId = transactionId;

          // Set expiry date for self-paced courses
          if (item.courseSchedule.accessDays) {
            const expiryDate = new Date();
            expiryDate.setDate(
              expiryDate.getDate() + item.courseSchedule.accessDays
            );
            enrollment.enrollmentData.expiryDate = expiryDate;
          }
        }
      }
    });
  }
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 2: ADD HELPER METHODS TO USER MODEL                │
// │                    Location: Before module.exports                         │
// └─────────────────────────────────────────────────────────────────────────────┘

// ADD these methods to userSchema.methods (before module.exports):

// ✅ METHOD 1: Track material downloads
userSchema.methods.trackMaterialDownload = function (courseId, materialData) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Initialize materials if not exists
  if (!enrollment.courseMaterials) {
    enrollment.courseMaterials = {
      downloadedMaterials: [],
      sharedNotes: [],
      materialSummary: { totalDownloads: 0, uniqueMaterialsAccessed: 0 },
    };
  }

  // Find existing download record
  const existing = enrollment.courseMaterials.downloadedMaterials.find(
    (m) => m.materialId === materialData.materialId
  );

  if (existing) {
    // Update existing record
    existing.downloadCount++;
    existing.lastAccessed = new Date();
    enrollment.courseMaterials.materialSummary.totalDownloads++;
  } else {
    // Create new download record
    enrollment.courseMaterials.downloadedMaterials.push({
      materialId: materialData.materialId,
      materialName: materialData.name,
      materialType: materialData.type || "document",
      materialCategory: materialData.category || "course-handout",
      downloadDate: new Date(),
      downloadCount: 1,
      lastAccessed: new Date(),
      fileSize: materialData.fileSize || 0,
      originalUrl: materialData.url,
    });

    enrollment.courseMaterials.materialSummary.totalDownloads++;
    enrollment.courseMaterials.materialSummary.uniqueMaterialsAccessed =
      enrollment.courseMaterials.downloadedMaterials.length;
  }

  // Update summary
  enrollment.courseMaterials.materialSummary.lastMaterialAccess = new Date();

  return this.save();
};

// ✅ METHOD 2: Record enhanced assessment
userSchema.methods.recordInPersonAssessment = function (
  courseId,
  assessmentData
) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Initialize assessment attempts if not exists
  if (!enrollment.userProgress.assessmentAttempts) {
    enrollment.userProgress.assessmentAttempts = [];
  }

  // Create new attempt
  const attempt = {
    attemptNumber: enrollment.userProgress.assessmentAttempts.length + 1,
    attemptDate: new Date(),
    assessmentType: assessmentData.type || "combined",

    scores: {
      practicalScore: assessmentData.practicalScore || 0,
      theoryScore: assessmentData.theoryScore || 0,
      totalScore: assessmentData.totalScore,
      maxPossibleScore: assessmentData.maxPossibleScore || 100,
    },

    passed: assessmentData.totalScore >= 70,
    answers: assessmentData.answers || [],
    timeSpent: assessmentData.timeSpent || 0,
    instructorNotes: assessmentData.instructorNotes || "",
    instructorId: assessmentData.instructorId,

    practicalDetails: {
      proceduresCompleted: assessmentData.proceduresCompleted || [],
      skillsAssessed: assessmentData.skillsAssessed || [],
      equipmentUsed: assessmentData.equipmentUsed || [],
      safetyCompliance: assessmentData.safetyCompliance !== false,
    },
  };

  enrollment.userProgress.assessmentAttempts.push(attempt);
  enrollment.userProgress.totalAttempts =
    enrollment.userProgress.assessmentAttempts.length;

  // Update best score and completion status
  enrollment.userProgress.bestAssessmentScore = Math.max(
    enrollment.userProgress.bestAssessmentScore || 0,
    assessmentData.totalScore
  );

  if (attempt.passed) {
    enrollment.userProgress.assessmentCompleted = true;
    enrollment.userProgress.practicalAssessmentPassed =
      assessmentData.practicalScore >= 70;
    enrollment.userProgress.theoryAssessmentPassed =
      assessmentData.theoryScore >= 70;
    enrollment.userProgress.lastAssessmentDate = new Date();

    // Update course status if attendance is also sufficient
    if (enrollment.userProgress.overallAttendancePercentage >= 80) {
      enrollment.userProgress.courseStatus = "completed";
      enrollment.userProgress.completionDate = new Date();
    }
  } else {
    // Check if this was the final attempt
    const maxAttempts = 3; // or get from course settings
    if (enrollment.userProgress.totalAttempts >= maxAttempts) {
      enrollment.userProgress.courseStatus = "failed-assessment";
    }
  }

  return this.save();
};

// ✅ METHOD 3: Add instructor shared notes
userSchema.methods.addInstructorNote = function (courseId, noteData) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  if (!enrollment.courseMaterials) {
    enrollment.courseMaterials = { downloadedMaterials: [], sharedNotes: [] };
  }

  enrollment.courseMaterials.sharedNotes.push({
    title: noteData.title,
    content: noteData.content,
    sharedBy: noteData.instructorName,
    sharedByInstructorId: noteData.instructorId,
    category: noteData.category || "general",
    isPublic: noteData.isPublic !== false,
    attachments: noteData.attachments || [],
  });

  return this.save();
};

// ✅ METHOD 4: Update personal notes
userSchema.methods.updatePersonalNotes = function (courseId, notesContent) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  if (!enrollment.courseMaterials) {
    enrollment.courseMaterials = { downloadedMaterials: [], sharedNotes: [] };
  }

  enrollment.courseMaterials.personalNotes = {
    content: notesContent,
    lastUpdated: new Date(),
    wordCount: notesContent ? notesContent.split(/\s+/).length : 0,
  };

  return this.save();
};

// ✅ METHOD 5: Get course completion status
userSchema.methods.getInPersonCourseStatus = function (courseId) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    return null;
  }

  const attendanceOk =
    enrollment.userProgress.overallAttendancePercentage >= 80;
  const assessmentOk = enrollment.userProgress.assessmentCompleted;

  return {
    courseId: courseId,
    enrollmentStatus: enrollment.enrollmentData.status,
    courseStatus: enrollment.userProgress.courseStatus,

    attendance: {
      percentage: enrollment.userProgress.overallAttendancePercentage,
      required: 80,
      meets: attendanceOk,
    },

    assessment: {
      completed: enrollment.userProgress.assessmentCompleted,
      bestScore: enrollment.userProgress.bestAssessmentScore,
      totalAttempts: enrollment.userProgress.totalAttempts || 0,
      practicalPassed: enrollment.userProgress.practicalAssessmentPassed,
      theoryPassed: enrollment.userProgress.theoryAssessmentPassed,
      meets: assessmentOk,
    },

    materials: {
      totalDownloads:
        enrollment.courseMaterials?.materialSummary?.totalDownloads || 0,
      uniqueMaterials:
        enrollment.courseMaterials?.materialSummary?.uniqueMaterialsAccessed ||
        0,
      hasPersonalNotes: !!enrollment.courseMaterials?.personalNotes?.content,
    },

    completion: {
      eligible: attendanceOk && assessmentOk,
      completionDate: enrollment.userProgress.completionDate,
    },
  };
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 3: CONTROLLER METHODS                              │
// │                    Add these to your course controller                     │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ CONTROLLER 1: Download course material
const downloadCourseMaterial = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    const userId = req.user.id;

    // Get course and material info
    const course = await InPersonAestheticTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Find material in course (this depends on your course structure)
    let material = null;
    let materialIndex = -1;

    // Check documents array
    if (course.media?.documents) {
      materialIndex = course.media.documents.findIndex((doc) =>
        doc.includes(materialId)
      );
      if (materialIndex !== -1) {
        material = {
          id: materialId,
          name: `Course Document ${materialIndex + 1}`,
          type: "document",
          url: course.media.documents[materialIndex],
        };
      }
    }

    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    // Get user and track download
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is enrolled
    const enrollment = user.myInPersonCourses.find(
      (e) =>
        e.courseId.toString() === courseId &&
        ["paid", "registered", "completed"].includes(e.enrollmentData.status)
    );

    if (!enrollment) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    // Track the download
    await user.trackMaterialDownload(courseId, {
      materialId: materialId,
      name: material.name,
      type: material.type,
      category: "course-handout",
      url: material.url,
      fileSize: 0, // You can get this from file system if needed
    });

    res.json({
      success: true,
      message: "Download tracked successfully",
      material: material,
      downloadUrl: material.url,
    });
  } catch (error) {
    console.error("Error tracking material download:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 2: Submit assessment
const submitInPersonAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const {
      assessmentType,
      answers,
      practicalScore,
      theoryScore,
      totalScore,
      timeSpent,
      proceduresCompleted,
      skillsAssessed,
      equipmentUsed,
    } = req.body;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check enrollment
    const enrollment = user.myInPersonCourses.find(
      (e) =>
        e.courseId.toString() === courseId &&
        ["paid", "registered"].includes(e.enrollmentData.status)
    );

    if (!enrollment) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    // Record assessment
    await user.recordInPersonAssessment(courseId, {
      type: assessmentType,
      practicalScore: practicalScore,
      theoryScore: theoryScore,
      totalScore: totalScore,
      answers: answers,
      timeSpent: timeSpent,
      instructorId: req.body.instructorId,
      proceduresCompleted: proceduresCompleted,
      skillsAssessed: skillsAssessed,
      equipmentUsed: equipmentUsed,
      safetyCompliance: req.body.safetyCompliance,
    });

    // Get updated status
    const status = user.getInPersonCourseStatus(courseId);

    res.json({
      success: true,
      message: "Assessment submitted successfully",
      passed: totalScore >= 70,
      score: totalScore,
      status: status,
    });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 3: Get course progress
const getInPersonCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const status = user.getInPersonCourseStatus(courseId);
    if (!status) {
      return res.status(404).json({ error: "Course enrollment not found" });
    }

    res.json({
      success: true,
      progress: status,
    });
  } catch (error) {
    console.error("Error getting course progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 4: Update personal notes
const updatePersonalNotes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.updatePersonalNotes(courseId, notes);

    res.json({
      success: true,
      message: "Notes updated successfully",
    });
  } catch (error) {
    console.error("Error updating notes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 4: ROUTE DEFINITIONS                               │
// │                    Add these to your routes file                           │
// └─────────────────────────────────────────────────────────────────────────────┘

// Add these routes to your course routes file:
/*
// Material downloads
router.get('/in-person/:courseId/materials/:materialId/download', 
  authenticate, downloadCourseMaterial);

// Assessment submission
router.post('/in-person/:courseId/assessment/submit', 
  authenticate, submitInPersonAssessment);

// Course progress
router.get('/in-person/:courseId/progress', 
  authenticate, getInPersonCourseProgress);

// Personal notes
router.put('/in-person/:courseId/notes', 
  authenticate, updatePersonalNotes);
*/

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 5: FRONTEND USAGE EXAMPLES                         │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ FRONTEND 1: Download material
const downloadMaterial = async (courseId, materialId) => {
  try {
    const response = await fetch(
      `/api/courses/in-person/${courseId}/materials/${materialId}/download`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      // Open download URL
      window.open(data.downloadUrl, "_blank");
      console.log("Download tracked:", data.material);
    }
  } catch (error) {
    console.error("Download error:", error);
  }
};

// ✅ FRONTEND 2: Submit assessment
const submitAssessment = async (courseId, assessmentData) => {
  try {
    const response = await fetch(
      `/api/courses/in-person/${courseId}/assessment/submit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assessmentData),
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("Assessment result:", data);
      return data;
    }
  } catch (error) {
    console.error("Assessment submission error:", error);
  }
};

// ✅ FRONTEND 3: Get progress
const getCourseProgress = async (courseId) => {
  try {
    const response = await fetch(
      `/api/courses/in-person/${courseId}/progress`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      return data.progress;
    }
  } catch (error) {
    console.error("Progress fetch error:", error);
  }
};

//new for online live
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 2: ADD HELPER METHODS TO USER MODEL                │
// │                    Location: Before module.exports                         │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ METHOD 1: Track live session attendance
userSchema.methods.trackLiveSessionAttendance = function (
  courseId,
  sessionData
) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Find existing session or create new
  let sessionRecord = enrollment.userProgress.sessionsAttended.find(
    (s) => s.sessionId.toString() === sessionData.sessionId.toString()
  );

  if (!sessionRecord) {
    // Create new session record
    sessionRecord = {
      sessionId: sessionData.sessionId,
      sessionDate: sessionData.sessionDate,
      sessionName: sessionData.sessionName || "Live Session",
      timeTracking: {
        totalDuration: sessionData.totalDuration || 0,
        userDuration: 0,
        attendancePercentage: 0,
        reconnections: 0,
      },
      attendanceConfirmation: {
        isConfirmed: false,
        meetsMinimumDuration: false,
        meetsInteractionRequirement: false,
      },
      engagement: {
        chatMessages: 0,
        questionsAsked: 0,
        pollsParticipated: 0,
        screenInteractions: 0,
        engagementScore: 0,
      },
      status: "attended",
      technicalIssues: [],
    };
    enrollment.userProgress.sessionsAttended.push(sessionRecord);
  }

  // Update time tracking
  if (sessionData.joinTime)
    sessionRecord.timeTracking.joinTime = sessionData.joinTime;
  if (sessionData.leaveTime)
    sessionRecord.timeTracking.leaveTime = sessionData.leaveTime;

  // Calculate attendance duration and percentage
  if (
    sessionRecord.timeTracking.joinTime &&
    sessionRecord.timeTracking.leaveTime
  ) {
    const attendedMs =
      sessionRecord.timeTracking.leaveTime -
      sessionRecord.timeTracking.joinTime;
    sessionRecord.timeTracking.userDuration = Math.round(
      attendedMs / (1000 * 60)
    ); // minutes

    if (sessionRecord.timeTracking.totalDuration > 0) {
      sessionRecord.timeTracking.attendancePercentage = Math.round(
        (sessionRecord.timeTracking.userDuration /
          sessionRecord.timeTracking.totalDuration) *
          100
      );
    }
  }

  // Update engagement if provided
  if (sessionData.engagement) {
    Object.keys(sessionData.engagement).forEach((key) => {
      if (sessionRecord.engagement[key] !== undefined) {
        sessionRecord.engagement[key] = sessionData.engagement[key];
      }
    });
  }

  // Update last activity
  sessionRecord.timeTracking.lastActivity = new Date();

  return this.save();
};

// ✅ METHOD 2: Confirm attendance for a session
userSchema.methods.confirmLiveAttendance = function (
  courseId,
  sessionId,
  confirmationData
) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  const sessionRecord = enrollment.userProgress.sessionsAttended.find(
    (s) => s.sessionId.toString() === sessionId.toString()
  );

  if (!sessionRecord) {
    throw new Error("Session record not found");
  }

  // Update confirmation details
  sessionRecord.attendanceConfirmation.isConfirmed = true;
  sessionRecord.attendanceConfirmation.confirmationDate = new Date();
  sessionRecord.attendanceConfirmation.confirmationMethod =
    confirmationData.method || "manual-instructor";
  sessionRecord.attendanceConfirmation.confirmedBy =
    confirmationData.confirmedBy || "instructor";

  if (confirmationData.instructorId) {
    sessionRecord.attendanceConfirmation.confirmedByInstructorId =
      confirmationData.instructorId;
  }

  // Check confirmation criteria
  sessionRecord.attendanceConfirmation.meetsMinimumDuration =
    sessionRecord.timeTracking.attendancePercentage >= 80;

  sessionRecord.attendanceConfirmation.meetsInteractionRequirement =
    sessionRecord.engagement.engagementScore >= 50; // threshold for interaction

  // Handle manual override if provided
  if (confirmationData.manualOverride) {
    sessionRecord.attendanceConfirmation.manualOverride = {
      isOverridden: true,
      overrideReason: confirmationData.manualOverride.reason,
      overriddenBy: confirmationData.confirmedBy,
      overrideDate: new Date(),
    };
  }

  // Update session status based on attendance
  if (
    sessionRecord.attendanceConfirmation.meetsMinimumDuration ||
    sessionRecord.attendanceConfirmation.manualOverride.isOverridden
  ) {
    sessionRecord.status = "attended";
  } else if (sessionRecord.timeTracking.attendancePercentage > 50) {
    sessionRecord.status = "partial";
  } else {
    sessionRecord.status = confirmationData.hasValidReason
      ? "excused"
      : "absent";
  }

  // Recalculate overall attendance requirements
  this.calculateLiveAttendanceRequirements(courseId);

  return this.save();
};

// ✅ METHOD 3: Calculate overall attendance requirements
userSchema.methods.calculateLiveAttendanceRequirements = function (courseId) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  const requirements = enrollment.userProgress.attendanceRequirements;
  const sessions = enrollment.userProgress.sessionsAttended;

  // Count confirmed sessions
  requirements.sessionsConfirmed = sessions.filter(
    (s) =>
      s.attendanceConfirmation.isConfirmed &&
      (s.status === "attended" || s.status === "excused")
  ).length;

  requirements.totalSessionsAvailable = sessions.length;

  // Calculate confirmed attendance percentage
  if (requirements.totalSessionsAvailable > 0) {
    requirements.confirmedAttendancePercentage = Math.round(
      (requirements.sessionsConfirmed / requirements.totalSessionsAvailable) *
        100
    );
  }

  // Check if requirements are met
  requirements.meetsSessionRequirement =
    requirements.sessionsConfirmed >= requirements.minimumSessionsRequired;

  requirements.meetsPercentageRequirement =
    requirements.confirmedAttendancePercentage >=
    requirements.minimumAttendancePercentage;

  requirements.meetsOverallRequirement =
    requirements.meetsSessionRequirement &&
    requirements.meetsPercentageRequirement;

  // Count excused vs unexcused absences
  requirements.excusedAbsences = sessions.filter(
    (s) => s.status === "excused"
  ).length;
  requirements.unexcusedAbsences = sessions.filter(
    (s) => s.status === "absent"
  ).length;

  requirements.lastCalculated = new Date();

  // Update overall course status
  if (
    requirements.meetsOverallRequirement &&
    enrollment.userProgress.bestAssessmentScore >= 70
  ) {
    enrollment.userProgress.courseStatus = "completed";
    enrollment.userProgress.completionDate = new Date();
  } else if (
    !requirements.meetsOverallRequirement &&
    requirements.totalSessionsAvailable >= requirements.minimumSessionsRequired
  ) {
    enrollment.userProgress.courseStatus = "failed-attendance";
  }

  return this;
};

// ✅ METHOD 4: Set attendance requirements for course
userSchema.methods.setLiveAttendanceRequirements = function (
  courseId,
  requirements
) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  if (!enrollment.userProgress.attendanceRequirements) {
    enrollment.userProgress.attendanceRequirements = {};
  }

  // Update requirements
  if (requirements.minimumSessions !== undefined) {
    enrollment.userProgress.attendanceRequirements.minimumSessionsRequired =
      requirements.minimumSessions;
  }

  if (requirements.minimumPercentage !== undefined) {
    enrollment.userProgress.attendanceRequirements.minimumAttendancePercentage =
      requirements.minimumPercentage;
  }

  // Recalculate with new requirements
  this.calculateLiveAttendanceRequirements(courseId);

  return this.save();
};

// ✅ METHOD 5: Get live course attendance status
userSchema.methods.getLiveAttendanceStatus = function (courseId) {
  const enrollment = this.myLiveCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    return null;
  }

  const requirements = enrollment.userProgress.attendanceRequirements;
  const sessions = enrollment.userProgress.sessionsAttended;

  return {
    courseId: courseId,

    requirements: {
      minimumSessions: requirements.minimumSessionsRequired,
      minimumPercentage: requirements.minimumAttendancePercentage,
    },

    current: {
      totalSessions: requirements.totalSessionsAvailable,
      confirmedSessions: requirements.sessionsConfirmed,
      attendancePercentage: requirements.confirmedAttendancePercentage,
      excusedAbsences: requirements.excusedAbsences,
      unexcusedAbsences: requirements.unexcusedAbsences,
    },

    eligibility: {
      meetsSessionRequirement: requirements.meetsSessionRequirement,
      meetsPercentageRequirement: requirements.meetsPercentageRequirement,
      meetsOverallRequirement: requirements.meetsOverallRequirement,
      canGetCertificate:
        requirements.meetsOverallRequirement &&
        enrollment.userProgress.bestAssessmentScore >= 70,
    },

    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      sessionName: s.sessionName,
      date: s.sessionDate,
      attendance: {
        duration: s.timeTracking.userDuration,
        percentage: s.timeTracking.attendancePercentage,
        confirmed: s.attendanceConfirmation.isConfirmed,
        status: s.status,
      },
      engagement: {
        score: s.engagement.engagementScore,
        interactions:
          s.engagement.chatMessages +
          s.engagement.questionsAsked +
          s.engagement.pollsParticipated,
      },
    })),
  };
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 3: CONTROLLER METHODS                              │
// │                    Add these to your course controller                     │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ CONTROLLER 1: Track session attendance (called during/after live session)
const trackLiveSessionAttendance = async (req, res) => {
  try {
    const { courseId, sessionId } = req.params;
    const userId = req.user.id;
    const { joinTime, leaveTime, totalDuration, sessionName, engagement } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.trackLiveSessionAttendance(courseId, {
      sessionId,
      sessionDate: new Date(),
      sessionName,
      joinTime: new Date(joinTime),
      leaveTime: new Date(leaveTime),
      totalDuration,
      engagement,
    });

    res.json({
      success: true,
      message: "Session attendance tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking live session attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 2: Confirm attendance (instructor action)
const confirmLiveAttendance = async (req, res) => {
  try {
    const { courseId, sessionId } = req.params;
    const { userId } = req.body; // User being confirmed
    const { method, hasValidReason, manualOverride } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.confirmLiveAttendance(courseId, sessionId, {
      method: method || "manual-instructor",
      confirmedBy: req.user.name, // Instructor name
      instructorId: req.user.id,
      hasValidReason,
      manualOverride,
    });

    // Get updated status
    const status = user.getLiveAttendanceStatus(courseId);

    res.json({
      success: true,
      message: "Attendance confirmed successfully",
      status: status,
    });
  } catch (error) {
    console.error("Error confirming live attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 3: Get attendance status
const getLiveAttendanceStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const status = user.getLiveAttendanceStatus(courseId);
    if (!status) {
      return res.status(404).json({ error: "Course enrollment not found" });
    }

    res.json({
      success: true,
      attendance: status,
    });
  } catch (error) {
    console.error("Error getting live attendance status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ CONTROLLER 4: Set course attendance requirements (instructor/admin action)
const setAttendanceRequirements = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { minimumSessions, minimumPercentage, userIds } = req.body;

    // If userIds provided, update specific users; otherwise update all enrolled users
    const usersToUpdate = userIds || [];

    if (usersToUpdate.length === 0) {
      // Get all enrolled users
      const enrolledUsers = await User.find({
        "myLiveCourses.courseId": courseId,
        "myLiveCourses.enrollmentData.status": { $in: ["paid", "registered"] },
      });

      usersToUpdate.push(...enrolledUsers.map((u) => u._id));
    }

    // Update requirements for each user
    for (const userId of usersToUpdate) {
      const user = await User.findById(userId);
      if (user) {
        await user.setLiveAttendanceRequirements(courseId, {
          minimumSessions,
          minimumPercentage,
        });
      }
    }

    res.json({
      success: true,
      message: `Attendance requirements updated for ${usersToUpdate.length} users`,
      requirements: {
        minimumSessions,
        minimumPercentage,
      },
    });
  } catch (error) {
    console.error("Error setting attendance requirements:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 4: ROUTE DEFINITIONS                               │
// └─────────────────────────────────────────────────────────────────────────────┘

/*
// Add these routes to your course routes file:

// Track session attendance (during/after live session)
router.post('/online-live/:courseId/sessions/:sessionId/attendance', 
  authenticate, trackLiveSessionAttendance);

// Confirm attendance (instructor action)
router.post('/online-live/:courseId/sessions/:sessionId/confirm-attendance', 
  authenticate, requireInstructorRole, confirmLiveAttendance);

// Get attendance status
router.get('/online-live/:courseId/attendance-status', 
  authenticate, getLiveAttendanceStatus);

// Set attendance requirements (admin/instructor action)
router.put('/online-live/:courseId/attendance-requirements', 
  authenticate, requireInstructorRole, setAttendanceRequirements);
*/

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 5: FRONTEND INTEGRATION EXAMPLES                   │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ FRONTEND 1: Track attendance during live session
const trackSessionAttendance = async (courseId, sessionId, attendanceData) => {
  try {
    const response = await fetch(
      `/api/courses/online-live/${courseId}/sessions/${sessionId}/attendance`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          joinTime: attendanceData.joinTime,
          leaveTime: attendanceData.leaveTime,
          totalDuration: attendanceData.totalDuration,
          sessionName: attendanceData.sessionName,
          engagement: {
            chatMessages: attendanceData.chatCount,
            questionsAsked: attendanceData.questionCount,
            pollsParticipated: attendanceData.pollCount,
            engagementScore: attendanceData.engagementScore,
          },
        }),
      }
    );

    const data = await response.json();
    console.log("Attendance tracked:", data);
  } catch (error) {
    console.error("Error tracking attendance:", error);
  }
};

// ✅ FRONTEND 2: Instructor confirms student attendance
const confirmStudentAttendance = async (
  courseId,
  sessionId,
  userId,
  confirmationData
) => {
  try {
    const response = await fetch(
      `/api/courses/online-live/${courseId}/sessions/${sessionId}/confirm-attendance`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${instructorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          method: "manual-instructor",
          hasValidReason: confirmationData.hasExcuse,
          manualOverride: confirmationData.forceConfirm
            ? {
                reason: confirmationData.overrideReason,
              }
            : null,
        }),
      }
    );

    const data = await response.json();
    console.log("Attendance confirmed:", data);
    return data.status;
  } catch (error) {
    console.error("Error confirming attendance:", error);
  }
};

// ✅ FRONTEND 3: Get student attendance dashboard
const getAttendanceDashboard = async (courseId) => {
  try {
    const response = await fetch(
      `/api/courses/online-live/${courseId}/attendance-status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      return data.attendance; // Use for dashboard display
    }
  } catch (error) {
    console.error("Error getting attendance status:", error);
  }
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                    STEP 6: AUTOMATIC ATTENDANCE TRACKING                   │
// │                    Integration with video conferencing platforms           │
// └─────────────────────────────────────────────────────────────────────────────┘

// ✅ ZOOM WEBHOOK EXAMPLE: Auto-track attendance from Zoom
const handleZoomWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (
      event === "meeting.participant_joined" ||
      event === "meeting.participant_left"
    ) {
      const { meeting, participant } = payload.object;

      // Find user by email or meeting participant ID
      const user = await User.findOne({ email: participant.email });
      if (!user) return res.status(200).send("OK");

      // Find course by meeting ID (you'll need to store this mapping)
      const courseId = await getCourseIdFromMeetingId(meeting.id);
      const sessionId = meeting.id; // or use a separate session tracking system

      if (event === "meeting.participant_joined") {
        await user.trackLiveSessionAttendance(courseId, {
          sessionId: sessionId,
          sessionDate: new Date(),
          sessionName: meeting.topic,
          joinTime: new Date(participant.join_time),
          totalDuration: meeting.duration,
          engagement: {
            chatMessages: 0, // Will be updated separately
            questionsAsked: 0,
            pollsParticipated: 0,
          },
        });
      } else if (event === "meeting.participant_left") {
        await user.trackLiveSessionAttendance(courseId, {
          sessionId: sessionId,
          leaveTime: new Date(participant.leave_time),
        });

        // Auto-confirm attendance if meets duration requirement
        const sessionRecord = user.myLiveCourses
          .find((e) => e.courseId.toString() === courseId)
          ?.userProgress.sessionsAttended.find(
            (s) => s.sessionId.toString() === sessionId
          );

        if (
          sessionRecord &&
          sessionRecord.timeTracking.attendancePercentage >= 80
        ) {
          await user.confirmLiveAttendance(courseId, sessionId, {
            method: "auto-duration",
            confirmedBy: "system",
          });
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Zoom webhook error:", error);
    res.status(500).send("Error");
  }
};

// Helper function to map meeting IDs to course IDs
const getCourseIdFromMeetingId = async (meetingId) => {
  // This depends on how you store the mapping
  // Could be in course model, separate collection, etc.
  const course = await OnlineLiveTraining.findOne({
    "platform.meetingId": meetingId,
  });
  return course?._id;
};

// ========================================
// ✅ LIBRARY TEMPLATE ALIGNMENT METHODS
// These methods provide the exact fields that the in-person library template expects
// ========================================

/**
 * ✅ Get In-Person Course Library Data
 * Provides all fields needed by the library template
 */
userSchema.methods.getInPersonCourseLibraryData = async function () {
  // Populate course data
  await this.populate({
    path: "myInPersonCourses.courseId",
    select: "basic schedule venue instructors media assessment",
  });

  return this.myInPersonCourses
    .filter(
      (enrollment) =>
        enrollment.courseId &&
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData?.status
        )
    )
    .map((enrollment) => {
      const course = enrollment.courseId;
      const now = new Date();

      // ✅ LIBRARY TEMPLATE REQUIRED FIELDS
      return {
        // Basic course info
        courseId: enrollment.courseId._id,
        title: course.basic?.title || "Course Title",
        courseCode: course.basic?.courseCode || "N/A",
        description:
          course.basic?.description || "Professional training course",
        instructor: this.getInstructorName(course),

        // Schedule info
        startDate: course.schedule?.startDate,
        endDate: course.schedule?.endDate,
        duration: course.schedule?.duration,
        location: course.venue
          ? `${course.venue.city}, ${course.venue.country}`
          : "Training Center",
        venue: course.venue?.name || "IAAI Training Center",

        // ✅ ATTENDANCE FIELDS (library template expects these)
        attendanceConfirmed: this.isAttendanceConfirmed(enrollment),
        attendancePercentage: this.getAttendancePercentage(enrollment),

        // ✅ ASSESSMENT FIELDS (library template expects these)
        assessmentRequired: course.assessment?.required || false,
        assessmentCompleted: this.isAssessmentCompleted(enrollment),
        assessmentPassed: this.isAssessmentPassed(enrollment),
        assessmentScore: this.getAssessmentScore(enrollment),
        passingScore: course.assessment?.passingScore || 70,
        maxAttempts: enrollment.maxAttempts || 3,
        currentAttempts:
          enrollment.currentAttempts || enrollment.totalAttempts || 0,
        canRetake: this.canRetakeAssessment(enrollment),
        lastAssessmentDate: enrollment.lastAssessmentDate,

        // ✅ CERTIFICATE FIELDS (library template expects these)
        canViewCertificate: this.canViewCertificate(enrollment),
        hasCertificate: !!enrollment.certificateId,
        certificateId: enrollment.certificateId,

        // ✅ COURSE STATUS FIELDS (library template expects these)
        courseEnded: this.isCourseEnded(course, now),
        courseInProgress: this.isCourseInProgress(course, now),
        courseNotStarted: this.isCourseNotStarted(course, now),

        // ✅ ACTION ELIGIBILITY FIELDS (library template expects these)
        canGetCertificate: this.canGetCertificate(enrollment, course),
        canConfirmAttendance: this.canConfirmAttendance(
          enrollment,
          course,
          now
        ),

        // ✅ ENROLLMENT DATA
        status: enrollment.enrollmentData?.status,
        dateOfRegistration: enrollment.enrollmentData?.registrationDate,

        // ✅ MEDIA/MATERIALS
        media: course.media || {},

        // ✅ CERTIFICATE ELIGIBILITY REASON (for UI messages)
        certificateEligibilityReason: this.getCertificateEligibilityReason(
          enrollment,
          course
        ),
      };
    });
};

/**
 * ✅ Get Instructor Name
 */
userSchema.methods.getInstructorName = function (course) {
  if (course.instructors?.primary?.instructorId) {
    const instructor = course.instructors.primary.instructorId;
    return (
      instructor.fullName ||
      `${instructor.firstName} ${instructor.lastName}` ||
      course.instructors.primary.name
    );
  }
  return course.instructors?.primary?.name || "IAAI Team";
};

/**
 * ✅ Check if attendance is confirmed
 * Used by library template for attendance display
 */
userSchema.methods.isAttendanceConfirmed = function (enrollment) {
  // Method 1: Check overall attendance percentage
  if (enrollment.userProgress?.overallAttendancePercentage >= 80) {
    return true;
  }

  // Method 2: Check course completion status
  if (enrollment.userProgress?.courseStatus === "completed") {
    return true;
  }

  // Method 3: Check attendance records
  if (enrollment.userProgress?.attendanceRecords?.length > 0) {
    const records = enrollment.userProgress.attendanceRecords;
    const presentCount = records.filter((r) => r.status === "present").length;
    return presentCount / records.length >= 0.8; // 80% attendance
  }

  // Method 4: Default false for explicit confirmation
  return false;
};

/**
 * ✅ Get attendance percentage
 */
userSchema.methods.getAttendancePercentage = function (enrollment) {
  // Method 1: Direct percentage
  if (enrollment.userProgress?.overallAttendancePercentage !== undefined) {
    return enrollment.userProgress.overallAttendancePercentage;
  }

  // Method 2: Calculate from records
  if (enrollment.userProgress?.attendanceRecords?.length > 0) {
    const records = enrollment.userProgress.attendanceRecords;
    const presentCount = records.filter((r) => r.status === "present").length;
    return Math.round((presentCount / records.length) * 100);
  }

  // Method 3: Default based on course status
  if (enrollment.userProgress?.courseStatus === "completed") {
    return 100;
  }

  return 0;
};

/**
 * ✅ Check if assessment is completed
 */
userSchema.methods.isAssessmentCompleted = function (enrollment) {
  // Method 1: Direct flag
  if (enrollment.assessmentCompleted) {
    return true;
  }

  // Method 2: Check if has attempts with passing score
  if (enrollment.userProgress?.assessmentAttempts?.length > 0) {
    return enrollment.userProgress.assessmentAttempts.some(
      (attempt) => attempt.scores?.totalScore >= 70 || attempt.passed
    );
  }

  // Method 3: Check score fields
  if (enrollment.assessmentScore || enrollment.bestAssessmentScore) {
    return true;
  }

  return false;
};

/**
 * ✅ Check if assessment is passed
 */
userSchema.methods.isAssessmentPassed = function (enrollment) {
  const bestScore = this.getAssessmentScore(enrollment);
  return bestScore >= 70;
};

/**
 * ✅ Get assessment score
 */
userSchema.methods.getAssessmentScore = function (enrollment) {
  // Method 1: Best assessment score
  if (enrollment.bestAssessmentScore) {
    return enrollment.bestAssessmentScore;
  }

  // Method 2: Current assessment score
  if (enrollment.assessmentScore) {
    return enrollment.assessmentScore;
  }

  // Method 3: Calculate from attempts
  if (enrollment.userProgress?.assessmentAttempts?.length > 0) {
    const attempts = enrollment.userProgress.assessmentAttempts;
    const bestAttempt = attempts.reduce((best, current) => {
      const currentScore = current.scores?.totalScore || 0;
      const bestScore = best.scores?.totalScore || 0;
      return currentScore > bestScore ? current : best;
    }, attempts[0]);

    return bestAttempt.scores?.totalScore || 0;
  }

  return 0;
};

/**
 * ✅ Check if can retake assessment
 */
userSchema.methods.canRetakeAssessment = function (enrollment) {
  const maxAttempts = enrollment.maxAttempts || 3;
  const currentAttempts =
    enrollment.currentAttempts ||
    enrollment.totalAttempts ||
    enrollment.userProgress?.assessmentAttempts?.length ||
    0;

  return currentAttempts < maxAttempts && !this.isAssessmentPassed(enrollment);
};

/**
 * ✅ Check if can view certificate
 */
userSchema.methods.canViewCertificate = function (enrollment) {
  return !!enrollment.certificateId;
};

/**
 * FIXED: Check if course ended with proper timezone handling
 */
userSchema.methods.isCourseEnded = function (course, now = new Date()) {
  if (!course.schedule?.startDate) return false;

  const courseTimezone = course.schedule.primaryTimezone || "UTC";
  const startDate = new Date(course.schedule.startDate);
  const endDate = new Date(
    course.schedule.endDate || course.schedule.startDate
  );

  // If we have session time, combine it with the date
  if (course.schedule.sessionTime?.endTime) {
    const [endHours, endMinutes] = course.schedule.sessionTime.endTime
      .split(":")
      .map(Number);
    endDate.setUTCHours(endHours, endMinutes, 0, 0);
  }

  // Convert to course timezone for accurate comparison
  const nowUTC = now.getTime();
  const endDateUTC = endDate.getTime();

  // Get timezone offset difference
  const nowInCourseTimezone = new Date(nowUTC);
  const endDateInCourseTimezone = new Date(endDateUTC);

  return endDateInCourseTimezone.getTime() < nowUTC;
};

/**
 * FIXED: Check if course in progress with proper timezone handling
 */
userSchema.methods.isCourseInProgress = function (course, now = new Date()) {
  if (!course.schedule?.startDate) return false;

  const courseTimezone = course.schedule.primaryTimezone || "UTC";
  const startDate = new Date(course.schedule.startDate);
  const endDate = new Date(
    course.schedule.endDate || course.schedule.startDate
  );

  // If we have session times, use them
  if (course.schedule.sessionTime?.startTime) {
    const [startHours, startMinutes] = course.schedule.sessionTime.startTime
      .split(":")
      .map(Number);
    startDate.setUTCHours(startHours, startMinutes, 0, 0);
  }

  if (course.schedule.sessionTime?.endTime) {
    const [endHours, endMinutes] = course.schedule.sessionTime.endTime
      .split(":")
      .map(Number);
    endDate.setUTCHours(endHours, endMinutes, 0, 0);
  }

  const nowUTC = now.getTime();
  const startDateUTC = startDate.getTime();
  const endDateUTC = endDate.getTime();

  return startDateUTC <= nowUTC && nowUTC <= endDateUTC;
};

/**
 * FIXED: Check if course not started with proper timezone handling
 */
userSchema.methods.isCourseNotStarted = function (course, now = new Date()) {
  if (!course.schedule?.startDate) return true;

  const startDate = new Date(course.schedule.startDate);

  // If we have session start time, use it
  if (course.schedule.sessionTime?.startTime) {
    const [startHours, startMinutes] = course.schedule.sessionTime.startTime
      .split(":")
      .map(Number);
    startDate.setUTCHours(startHours, startMinutes, 0, 0);
  }

  const nowUTC = now.getTime();
  const startDateUTC = startDate.getTime();

  return startDateUTC > nowUTC;
};
/**
 * ✅ Check if can get certificate
 */
userSchema.methods.canGetCertificate = function (enrollment, course) {
  const courseEnded = this.isCourseEnded(course);
  const attendanceOk = this.isAttendanceConfirmed(enrollment);
  const assessmentOk =
    !course.assessment?.required || this.isAssessmentPassed(enrollment);
  const noCertificateYet = !enrollment.certificateId;

  return courseEnded && attendanceOk && assessmentOk && noCertificateYet;
};

/**
 * ✅ Check if can confirm attendance
 */
userSchema.methods.canConfirmAttendance = function (
  enrollment,
  course,
  now = new Date()
) {
  const courseEnded = this.isCourseEnded(course, now);
  const courseInProgress = this.isCourseInProgress(course, now);
  const attendanceNotConfirmed = !this.isAttendanceConfirmed(enrollment);

  // Can confirm during course or within grace period after end
  const gracePeriodEnd = new Date(
    course.schedule?.endDate || course.schedule?.startDate
  );
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 day grace period

  const withinGracePeriod = now <= gracePeriodEnd;

  return (
    attendanceNotConfirmed &&
    (courseInProgress || (courseEnded && withinGracePeriod))
  );
};

/**
 * ✅ Get certificate eligibility reason
 */
userSchema.methods.getCertificateEligibilityReason = function (
  enrollment,
  course
) {
  const courseEnded = this.isCourseEnded(course);
  const attendanceOk = this.isAttendanceConfirmed(enrollment);
  const assessmentOk =
    !course.assessment?.required || this.isAssessmentPassed(enrollment);
  const hasCertificate = !!enrollment.certificateId;

  if (hasCertificate) {
    return "Certificate already issued";
  }

  if (!courseEnded) {
    return "Course must be completed first";
  }

  if (!attendanceOk) {
    return "Minimum 80% attendance required";
  }

  if (course.assessment?.required && !assessmentOk) {
    return "Assessment must be passed first";
  }

  if (courseEnded && attendanceOk && assessmentOk) {
    return "Ready for certificate generation";
  }

  return "Requirements not yet met";
};

// ========================================
// ✅ LIBRARY CONTROLLER HELPER METHOD
// For use in library controllers to get formatted course data
// ========================================

/**
 * ✅ Static method to get library data for a user
 * Usage: const libraryData = await User.getInPersonLibraryData(userId);
 */
userSchema.statics.getInPersonLibraryData = async function (userId) {
  const user = await this.findById(userId);
  if (!user) return [];

  return await user.getInPersonCourseLibraryData();
};

// ========================================
// ✅ UPDATE EXISTING METHODS FOR LIBRARY ALIGNMENT
// These ensure enrollment data is properly maintained for library display
// ========================================

/**
 * ✅ Update assessment completion for library alignment
 */
userSchema.methods.updateAssessmentForLibrary = function (
  courseId,
  assessmentData
) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Update summary fields for library template
  enrollment.assessmentCompleted = true;
  enrollment.assessmentScore = assessmentData.totalScore;
  enrollment.bestAssessmentScore = Math.max(
    enrollment.bestAssessmentScore || 0,
    assessmentData.totalScore
  );
  enrollment.lastAssessmentDate = new Date();
  enrollment.currentAttempts = (enrollment.currentAttempts || 0) + 1;

  // Also update detailed progress
  if (!enrollment.userProgress.assessmentAttempts) {
    enrollment.userProgress.assessmentAttempts = [];
  }

  enrollment.userProgress.assessmentAttempts.push({
    attemptNumber: enrollment.currentAttempts,
    attemptDate: new Date(),
    assessmentType: assessmentData.type || "combined",
    scores: {
      practicalScore: assessmentData.practicalScore || 0,
      theoryScore: assessmentData.theoryScore || 0,
      totalScore: assessmentData.totalScore,
      maxPossibleScore: 100,
    },
    passed: assessmentData.totalScore >= 70,
    answers: assessmentData.answers || [],
    timeSpent: assessmentData.timeSpent || 0,
  });

  return this.save();
};

/**
 * ✅ Update attendance for library alignment
 */
userSchema.methods.updateAttendanceForLibrary = function (
  courseId,
  attendanceData
) {
  const enrollment = this.myInPersonCourses.find(
    (e) => e.courseId.toString() === courseId.toString()
  );

  if (!enrollment) {
    throw new Error("Course enrollment not found");
  }

  // Update overall attendance percentage
  if (!enrollment.userProgress) {
    enrollment.userProgress = {};
  }

  enrollment.userProgress.overallAttendancePercentage =
    attendanceData.percentage || 100;

  // Add attendance record if provided
  if (attendanceData.record) {
    if (!enrollment.userProgress.attendanceRecords) {
      enrollment.userProgress.attendanceRecords = [];
    }

    enrollment.userProgress.attendanceRecords.push({
      date: attendanceData.record.date || new Date(),
      checkIn: attendanceData.record.checkIn,
      checkOut: attendanceData.record.checkOut,
      hoursAttended: attendanceData.record.hoursAttended || 8,
      status: attendanceData.record.status || "present",
    });
  }

  return this.save();
};

// ========================================
// ✅ VIRTUAL FIELDS FOR LIBRARY TEMPLATE
// These provide computed properties that the template can access directly
// ========================================

userSchema.virtual("inPersonCoursesForLibrary").get(async function () {
  return await this.getInPersonCourseLibraryData();
});

// ========================================
// ✅ MIDDLEWARE TO MAINTAIN LIBRARY DATA CONSISTENCY
// Ensures data is always in sync for library display
// ========================================

userSchema.pre("save", function (next) {
  // Sync assessment summary fields
  this.myInPersonCourses.forEach((enrollment) => {
    if (enrollment.userProgress?.assessmentAttempts?.length > 0) {
      const attempts = enrollment.userProgress.assessmentAttempts;
      const bestAttempt = attempts.reduce((best, current) => {
        const currentScore = current.scores?.totalScore || 0;
        const bestScore = best.scores?.totalScore || 0;
        return currentScore > bestScore ? current : best;
      }, attempts[0]);

      // Update summary fields
      enrollment.bestAssessmentScore = bestAttempt.scores?.totalScore || 0;
      enrollment.assessmentCompleted =
        bestAttempt.passed || bestAttempt.scores?.totalScore >= 70;
      enrollment.totalAttempts = attempts.length;
      enrollment.currentAttempts = attempts.length;
    }
  });

  next();
});
// ┌─────────────────────────────────────────────────────────────────────────────┐
//
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
