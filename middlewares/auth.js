// middleware/auth.js
const { body, validationResult } = require('express-validator');

/**
 * Course input validation middleware
 * Validates course creation and update data
 */
const validateCourseInput = [
  // Basic course information
  body('courseCode')
    .notEmpty()
    .withMessage('Course code is required')
    .matches(/^[A-Z0-9-]+$/i)
    .withMessage('Course code must contain only letters, numbers, and hyphens')
    .isLength({ min: 5, max: 20 })
    .withMessage('Course code must be between 5 and 20 characters'),

  body('title')
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ min: 10, max: 200 })
    .withMessage('Course title must be between 10 and 200 characters')
    .trim(),

  body('description')
    .notEmpty()
    .withMessage('Course description is required')
    .isLength({ min: 50, max: 2000 })
    .withMessage('Course description must be between 50 and 2000 characters')
    .trim(),

  body('category')
    .optional()
    .isIn(['aesthetic', 'medical', 'business', 'technical', ''])
    .withMessage('Invalid category'),

  body('status')
    .optional()
    .isIn(['Draft', 'Open to Register', 'Full', 'In Progress', 'Completed', 'Cancelled'])
    .withMessage('Invalid status'),

  // Schedule validation
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format')
    .custom((value) => {
      const startDate = new Date(value);
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset time to start of day
      
      if (startDate < now) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Duration must be between 1 and 50 characters'),

  body('registrationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid registration deadline format')
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const deadline = new Date(value);
        const startDate = new Date(req.body.startDate);
        
        if (deadline >= startDate) {
          throw new Error('Registration deadline must be before start date');
        }
      }
      return true;
    }),

  // Venue validation
  body('venue.name')
    .notEmpty()
    .withMessage('Venue name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Venue name must be between 2 and 100 characters')
    .trim(),

  body('venue.address')
    .notEmpty()
    .withMessage('Venue address is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Venue address must be between 10 and 500 characters')
    .trim(),

  body('venue.city')
    .notEmpty()
    .withMessage('Venue city is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters')
    .trim(),

  body('venue.country')
    .notEmpty()
    .withMessage('Venue country is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters')
    .trim(),

  body('venue.venueType')
    .notEmpty()
    .withMessage('Venue type is required')
    .isIn(['Hospital', 'Training Center', 'Clinic', 'University', 'Conference Center', 'Hotel'])
    .withMessage('Invalid venue type'),

  body('venue.mapUrl')
    .optional()
    .isURL()
    .withMessage('Invalid map URL format'),

  // Pricing validation
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('earlyBirdPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Early bird price must be a positive number')
    .custom((value, { req }) => {
      if (value && req.body.price && parseFloat(value) >= parseFloat(req.body.price)) {
        throw new Error('Early bird price must be less than regular price');
      }
      return true;
    }),

  body('seatsAvailable')
    .notEmpty()
    .withMessage('Seats available is required')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Seats available must be between 1 and 1000'),

  body('minEnrollment')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum enrollment must be at least 1')
    .custom((value, { req }) => {
      if (value && req.body.seatsAvailable && parseInt(value) > parseInt(req.body.seatsAvailable)) {
        throw new Error('Minimum enrollment cannot exceed seats available');
      }
      return true;
    }),

  // Assessment validation
  body('assessmentType')
    .optional()
    .isIn(['none', 'quiz', 'practical', 'both'])
    .withMessage('Invalid assessment type'),

  body('passingScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Passing score must be between 0 and 100'),

  // Contact information validation
  body('contactInfo.email')
    .optional()
    .isEmail()
    .withMessage('Invalid contact email format')
    .normalizeEmail(),

  body('contactInfo.whatsapp')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid WhatsApp number format'),

  body('contactInfo.phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('contactInfo.registrationLink')
    .optional()
    .isURL()
    .withMessage('Invalid registration link format'),

  // Custom validation middleware to handle errors
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }

    next();
  }
];

/**
 * File upload validation middleware
 * Validates uploaded files for courses
 */
const validateFileUpload = (req, res, next) => {
  try {
    // Check file types and sizes
    if (req.files) {
      for (const fieldName in req.files) {
        const files = req.files[fieldName];
        
        for (const file of files) {
          // Check file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
              success: false,
              message: `File ${file.originalname} is too large. Maximum size is 10MB.`
            });
          }

          // Check file types based on field
          if (fieldName === 'mainImage') {
            if (!file.mimetype.startsWith('image/')) {
              return res.status(400).json({
                success: false,
                message: `File ${file.originalname} must be an image.`
              });
            }
          } else if (fieldName === 'brochure') {
            const allowedTypes = [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            
            if (!allowedTypes.includes(file.mimetype)) {
              return res.status(400).json({
                success: false,
                message: `File ${file.originalname} must be a PDF or Word document.`
              });
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating files'
    });
  }
};

/**
 * Rate limiting middleware for API endpoints
 */
const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old requests
    if (requests.has(identifier)) {
      const userRequests = requests.get(identifier).filter(time => time > windowStart);
      requests.set(identifier, userRequests);
    }

    // Check rate limit
    const userRequests = requests.get(identifier) || [];
    
    if (userRequests.length >= max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(identifier, userRequests);

    next();
  };
};

/**
 * Input sanitization middleware
 * Sanitizes user input to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Recursively sanitize object properties
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove potentially dangerous characters and scripts
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request'
    });
  }
};

/**
 * CORS middleware for API endpoints
 */
const corsHandler = (req, res, next) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  // Log response time when request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = {
  validateCourseInput,
  validateFileUpload,
  rateLimiter,
  sanitizeInput,
  corsHandler,
  requestLogger,
  errorHandler
};