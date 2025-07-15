// models/CoursePoolItem.js

const mongoose = require('mongoose');

const CoursePoolItemSchema = new mongoose.Schema({
  // ========================================
  // BASIC INFORMATION (mostly from existing course)
  // ========================================
  basic: {
    // Keep courseCode unique for the pool to avoid duplicate templates
    courseCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // Add index for faster lookups
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
      index: true // Add index for searching
    },
    description: {
      type: String,
      required: true,
      maxLength: 2000
    },
    category: {
      type: String,
      enum: ['aesthetic', 'medical', 'business', 'technical'],
      required: true,
      index: true // Add index for filtering
    },
  },

  // ========================================
  // SCHEDULING (minimal, as dates change)
  // We'll keep duration, but remove specific dates
  // ========================================
  schedule: {
    duration: {
      type: String,
      required: true // e.g., "2 days", "8 hours"
    },
    // timeSlots might be generic enough to keep, but actual dates are out
    timeSlots: {
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      lunchBreak: { type: String, default: '12:30-13:30' }
    }
  },

  // ========================================
  // ENROLLMENT (remove price and specific enrollment numbers)
  // Keep only structural information if needed, or remove completely.
  // For simplicity, let's keep only fields relevant to *potential* enrollment structure
  // without concrete numbers.
  // ========================================
  enrollment: {
    currency: { type: String, default: 'USD' }, // Still relevant for general pricing
    // seatsAvailable, minEnrollment, currentEnrollment, price, earlyBirdPrice are omitted
  },

  // ========================================
  // INSTRUCTORS (removed, as they change)
  // ========================================
  // instructors: { ... }, // Omitted

  // ========================================
  // VENUE INFORMATION (removed, as it changes)
  // ========================================
  // venue: { ... }, // Omitted

  // ========================================
  // COURSE CONTENT (kept)
  // ========================================
  content: {
    objectives: [{
      type: String,
      maxLength: 200
    }],
    modules: [{
      title: { type: String, required: true },
      description: String,
      duration: String,
      order: Number
    }],
    targetAudience: [String],
    experienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all-levels'],
      default: 'intermediate'
    },
    prerequisites: String,
    technicalRequirements: String
  },

  // ========================================
  // PRACTICAL TRAINING (kept)
  // ========================================
  practical: {
    hasHandsOn: {
      type: Boolean,
      default: true
    },
    procedures: [String],
    equipment: [String],
    trainingType: [{
      type: String,
      enum: ['live-patient', 'cadaver', 'simulation', 'observation', 'model']
    }],
    studentRatio: {
      type: String,
      default: '1:1'
    },
    safetyRequirements: {
      ppeRequired: { type: Boolean, default: true },
      healthClearance: { type: Boolean, default: false },
      insuranceRequired: { type: Boolean, default: false }
    }
  },

  // ========================================
  // ASSESSMENT & CERTIFICATION (kept)
  // ========================================
  assessment: {
    required: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['none', 'quiz', 'practical', 'both'],
      default: 'none'
    },
    passingScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    },
    retakesAllowed: { type: Number, default: 1 },
    questions: [{
      question: { type: String, required: true },
      answers: [{ type: String, required: true }],
      correctAnswer: { type: Number, required: true },
      points: { type: Number, default: 1 }
    }]
  },

  // ========================================
  // CERTIFICATION (kept, but simplify IDs)
  // Note: issuingAuthorityId and bodyId will just be strings/names, not ObjectIds,
  // as the exact `CertificationBody` document might not be available or relevant in the pool context.
  // ========================================
  certification: {
    enabled: { type: Boolean, default: true },
    type: {
      type: String,
      enum: ['completion', 'achievement', 'participation'],
      default: 'completion'
    },
    issuingAuthority: {
      type: String,
      default: 'IAAI Training Institute'
    },
    // No issuingAuthorityId as it's a ref to another DB
    certificationBodies: [{
      name: String, // Store just the name
      role: {
        type: String,
        enum: ['co-issuer', 'endorser', 'partner'],
        default: 'co-issuer'
      }
    }],
    requirements: {
      minimumAttendance: { type: Number, default: 80 },
      minimumScore: { type: Number, default: 70 },
      practicalRequired: { type: Boolean, default: false }
    },
    validity: {
      isLifetime: { type: Boolean, default: true },
      years: Number
    },
    features: {
      digitalBadge: { type: Boolean, default: true },
      qrVerification: { type: Boolean, default: true },
      autoGenerate: { type: Boolean, default: true }
    }
  },

  // ========================================
  // INCLUSIONS & SERVICES (kept, except partner hotels if they are venue-specific)
  // For simplicity, let's assume partnerHotels are venue-specific and omit.
  // ========================================
  inclusions: {
    meals: {
      breakfast: { type: Boolean, default: false },
      lunch: { type: Boolean, default: true },
      coffee: { type: Boolean, default: true },
      dietaryOptions: { type: Boolean, default: true }
    },
    accommodation: {
      included: { type: Boolean, default: false },
      assistanceProvided: { type: Boolean, default: true },
      // partnerHotels: [String] // Omitted as too venue-specific
    },
    materials: {
      courseMaterials: { type: Boolean, default: true },
      certificatePrinting: { type: Boolean, default: true },
      practiceSupplies: { type: Boolean, default: false },
      takeHome: { type: Boolean, default: true }
    },
    services: {
      airportTransfer: { type: Boolean, default: false },
      localTransport: { type: Boolean, default: false },
      translation: { type: Boolean, default: false }
    }
  },

  // ========================================
  // FILES & MEDIA (URLs can be kept as they might be generic course media)
  // ========================================
  media: {
    mainImage: {
      url: String,
      alt: String
    },
    documents: [String],
    images: [String],
    videos: [String],
    promotional: {
      brochureUrl: String,
      videoUrl: String,
      catalogUrl: String
    },
    links: [{
      title: String,
      url: String,
      type: {
        type: String,
        enum: ['article', 'video', 'tool', 'website'],
        default: 'website'
      }
    }]
  },

  // ========================================
  // ATTENDANCE & TRACKING (removed, as specific to an instance)
  // ========================================
  // attendance: { ... }, // Omitted

  // ========================================
  // CONTACT & SUPPORT (kept, as general contact info might be useful)
  // ========================================
  contact: {
    email: { type: String, default: 'info@iaa-i.com' },
    phone: String,
    whatsapp: { type: String, default: '+90 536 745 86 66' },
    registrationUrl: String, // Might be generic for template
    supportHours: { type: String, default: '9 AM - 6 PM (Monday-Friday)' }
  },

  // ========================================
  // NOTIFICATION SETTINGS (kept, as part of template behavior)
  // ========================================
  notificationSettings: {
    courseUpdates: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false }
  },

  // ========================================
  // METADATA (updated for pool context)
  // ========================================
  metadata: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
    tags: [String], // Important for keywords!
    notes: String,
    // isTemplate, templateName fields are not needed here, as this *is* the template.
    // Instead, add fields for pool-specific keywords.
    poolKeywords: [String], // **BEST KEYWORD OPTION** - flexible for searching
    sourceCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'InPersonAestheticTraining' } // Reference to original course if cloned from one
  },

}, {
  timestamps: true, // `createdAt` and `updatedAt` will be added automatically
  collection: 'coursepoolitems' // Custom collection name for the pool
});

// Add text index for searching pool items
CoursePoolItemSchema.index({
  'basic.title': 'text',
  'basic.description': 'text',
  'basic.category': 'text',
  'metadata.poolKeywords': 'text'
});
CoursePoolItemSchema.index({ 'basic.courseCode': 1 }, { unique: true });

module.exports = mongoose.models.CoursePoolItem ||
  mongoose.model('CoursePoolItem', CoursePoolItemSchema);