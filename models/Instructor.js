// models/Instructor.js
const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
  // Basic Information
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String },
  profileImage: { type: String }, // Path to profile image
  
  // Professional Information
  title: { type: String }, // Dr., Prof., etc.
  designation: { type: String }, // Job title/position
  experience: { type: String, required: true }, // Years of experience
  expertise: [{ type: String }], // Areas of expertise
  specializations: [{ type: String }],
  certifications: [{
    name: { type: String },
    issuingOrganization: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date }
  }],
  
  // Professional Details
  bio: { type: String }, // Detailed biography
  qualifications: [{ type: String }], // Educational qualifications
  achievements: [{ type: String }],
  publications: [{
    title: { type: String },
    type: { type: String }, // Article, Book, Research Paper
    publishedIn: { type: String },
    year: { type: Number },
    link: { type: String }
  }],
  
  // Teaching Information
  teachingStyle: { type: String },
  languages: [{ type: String }],
  availableDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  preferredCourseTypes: [{
    type: String,
    enum: ['InPersonAestheticTraining', 'OnlineLiveTraining', 'SelfPacedOnlineTraining']
  }],
  
  // Course Assignment History
  assignedCourses: [{
    courseId: { type: mongoose.Schema.Types.ObjectId },
    courseType: { type: String },
    courseTitle: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    role: { type: String, enum: ['Lead Instructor', 'Co-Instructor', 'Assistant'], default: 'Lead Instructor' },
    status: { type: String, enum: ['Upcoming', 'In Progress', 'Completed'], default: 'Upcoming' }
  }],
  
  // Performance Metrics
  ratings: {
    overall: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    courseRatings: [{
      courseId: { type: mongoose.Schema.Types.ObjectId },
      rating: { type: Number },
      feedback: { type: String },
      date: { type: Date }
    }]
  },
  
  // Contact & Availability
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String }
  },
  socialMedia: {
    linkedin: { type: String },
    twitter: { type: String },
    website: { type: String }
  },
  
// Notification Preferences
notificationSettings: {
  email: { type: Boolean, default: true },
  courseAssignments: { type: Boolean, default: true },
  courseUpdates: { type: Boolean, default: true },
  courseReminders: { type: Boolean, default: true },
  studentMessages: { type: Boolean, default: true },
  systemNotifications: { type: Boolean, default: true }
},

// Email Notification History
emailNotifications: [{
  type: { type: String }, // 'course_assignment', 'course_update', 'reminder', etc.
  courseId: { type: mongoose.Schema.Types.ObjectId },
  subject: { type: String },
  sentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'failed', 'pending'], default: 'sent' },
  emailId: { type: String } // For tracking email service responses
}],


  // Administrative
  status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' },
  contractType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Guest'], default: 'Contract' },
  hourlyRate: { type: Number },
  notes: { type: String }, // Admin notes
  
  // Documents
  documents: [{
    type: { type: String }, // CV, Certificate, ID, etc.
    filename: { type: String },
    url: { type: String },
    uploadDate: { type: Date, default: Date.now }
  }],
  
  // System Fields
  createdBy: { type: String },
  lastModifiedBy: { type: String },
  isDeleted: { type: Boolean, default: false }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
instructorSchema.index({ email: 1 });
instructorSchema.index({ lastName: 1, firstName: 1 });
instructorSchema.index({ expertise: 1 });
instructorSchema.index({ status: 1 });
instructorSchema.index({ isDeleted: 1 });




// Virtual for full name
instructorSchema.virtual('fullName').get(function() {
  return `${this.title ? this.title + ' ' : ''}${this.firstName} ${this.lastName}`;
});




// Virtual for display name (without title)
instructorSchema.virtual('displayName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for initials
instructorSchema.virtual('initials').get(function() {
  return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase();
});

// Method to check availability for a date range
instructorSchema.methods.isAvailable = function(startDate, endDate) {
  return !this.assignedCourses.some(course => {
    const courseStart = new Date(course.startDate);
    const courseEnd = new Date(course.endDate || course.startDate);
    const checkStart = new Date(startDate);
    const checkEnd = new Date(endDate || startDate);
    
    return (
      (checkStart >= courseStart && checkStart <= courseEnd) ||
      (checkEnd >= courseStart && checkEnd <= courseEnd) ||
      (checkStart <= courseStart && checkEnd >= courseEnd)
    );
  });
};

// Method to add course assignment
instructorSchema.methods.assignCourse = function(courseData) {
  this.assignedCourses.push({
    courseId: courseData.courseId,
    courseType: courseData.courseType,
    courseTitle: courseData.courseTitle,
    startDate: courseData.startDate,
    endDate: courseData.endDate,
    role: courseData.role || 'Lead Instructor',
    status: 'Upcoming'
  });
  
  return this.save();
};

// Method to update course status
instructorSchema.methods.updateCourseStatus = function(courseId, newStatus) {
  const course = this.assignedCourses.find(c => 
    c.courseId.toString() === courseId.toString()
  );
  
  if (course) {
    course.status = newStatus;
    return this.save();
  }
  
  return Promise.reject(new Error('Course not found in assignments'));
};

// Method to calculate average rating
instructorSchema.methods.calculateAverageRating = function() {
  if (this.ratings.courseRatings.length === 0) return 0;
  
  const sum = this.ratings.courseRatings.reduce((acc, rating) => 
    acc + rating.rating, 0
  );
  
  return (sum / this.ratings.courseRatings.length).toFixed(1);
};

// Method to add rating
instructorSchema.methods.addRating = function(courseId, rating, feedback) {
  this.ratings.courseRatings.push({
    courseId,
    rating,
    feedback,
    date: new Date()
  });
  
  this.ratings.totalRatings = this.ratings.courseRatings.length;
  this.ratings.overall = this.calculateAverageRating();
  
  return this.save();
};

// Method to get upcoming courses
instructorSchema.methods.getUpcomingCourses = function() {
  const now = new Date();
  return this.assignedCourses.filter(course => 
    new Date(course.startDate) > now && course.status === 'Upcoming'
  );
};

// Method to get current courses
instructorSchema.methods.getCurrentCourses = function() {
  const now = new Date();
  return this.assignedCourses.filter(course => {
    const start = new Date(course.startDate);
    const end = new Date(course.endDate || course.startDate);
    return start <= now && end >= now && course.status === 'In Progress';
  });
};

// Static method to find active instructors
instructorSchema.statics.findActive = function() {
  return this.find({ 
    isDeleted: false, 
    status: 'Active' 
  });
};

// Static method to find by expertise
instructorSchema.statics.findByExpertise = function(expertiseArea) {
  return this.find({ 
    isDeleted: false,
    expertise: { $in: [expertiseArea] }
  });
};

// Static method to search instructors
instructorSchema.statics.searchInstructors = function(searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  
  return this.find({
    isDeleted: false,
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { expertise: { $in: [searchRegex] } }
    ]
  });
};

// Pre-save middleware to ensure email is lowercase
instructorSchema.pre('save', function(next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Pre-save middleware to update timestamps for assigned courses
instructorSchema.pre('save', function(next) {
  const now = new Date();
  
  this.assignedCourses.forEach(course => {
    if (new Date(course.startDate) <= now && 
        (!course.endDate || new Date(course.endDate) >= now)) {
      course.status = 'In Progress';
    } else if (course.endDate && new Date(course.endDate) < now) {
      course.status = 'Completed';
    }
  });
  
  next();
});


// Ensure model is not re-compiled
module.exports = mongoose.models.Instructor || mongoose.model('Instructor', instructorSchema);