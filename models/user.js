// Final Complete User Model - All Index Issues Fixed
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
          //new
          certificateRequested: { type: Boolean, default: false },
          certificateFee: { type: Number, default: 0 },
          // ⭐ ADD THESE FIELDS:
          courseName: { type: String },
          courseCode: { type: String },
          courseType: { type: String },
          originalPrice: { type: Number, default: 0 },
          currency: { type: String, default: "EUR" },
          isLinkedCourse: { type: Boolean, default: false }, // ⭐ CRITICAL
          isLinkedCourseFree: { type: Boolean, default: false }, // ⭐ CRITICAL
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

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
