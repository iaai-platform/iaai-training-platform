// models/CertificationBody.js
const mongoose = require('mongoose');

const certificationBodySchema = new mongoose.Schema({
  // Basic Information
  companyName: { type: String, required: true, unique: true },
  shortName: { type: String }, // e.g., "AAAM" for "American Academy of Aesthetic Medicine"
  registrationNumber: { type: String }, // Business registration number
  logo: { type: String }, // Path to company logo
  
  // Contact Information
  email: { type: String, required: true },
  phone: { type: String },
  website: { type: String },
  
  // Address Information
  address: {
    street: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, required: true },
    zipCode: { type: String }
  },
  
  // Professional Details
  description: { type: String }, // Brief description of the organization
  establishedYear: { type: Number },
  accreditation: [{ type: String }], // Accrediting bodies (e.g., "NCCA", "ANSI")
  
  // Certification Information
  specializations: [{ type: String }], // Areas they certify (e.g., "Botox", "Dermal Fillers", "PDO Threads")
  certificationTypes: [{
    name: { type: String }, // Certificate name
    description: { type: String },
    validityPeriod: { type: Number }, // months
    requirements: [{ type: String }]
  }],
  
  // Industry Standing
  recognizedBy: [{ type: String }], // Organizations that recognize this body
  membershipLevel: { 
    type: String, 
    enum: ['Gold', 'Silver', 'Bronze', 'Standard'], 
    default: 'Standard' 
  },
  
  // Compliance & Legal
  licenses: [{
    type: { type: String }, // License type
    number: { type: String },
    issuingAuthority: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date }
  }],
  
  // Contact Persons
  contactPersons: [{
    name: { type: String },
    position: { type: String },
    email: { type: String },
    phone: { type: String },
    department: { type: String } // e.g., "Certification", "Admin", "Quality"
  }],
  
  // Settings
  isActive: { type: Boolean, default: true },
  isPreferred: { type: Boolean, default: false }, // For highlighting preferred partners
  
  // Certification Statistics
  statistics: {
    totalCertificatesIssued: { type: Number, default: 0 },
    activeCertificates: { type: Number, default: 0 },
    lastCertificateIssued: { type: Date }
  },
  
  // Administrative
  notes: { type: String }, // Internal admin notes
  createdBy: { type: String },
  lastModifiedBy: { type: String },
  isDeleted: { type: Boolean, default: false }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
certificationBodySchema.index({ companyName: 1 });
certificationBodySchema.index({ shortName: 1 });
certificationBodySchema.index({ specializations: 1 });
certificationBodySchema.index({ isActive: 1 });
certificationBodySchema.index({ isDeleted: 1 });
certificationBodySchema.index({ membershipLevel: 1 });

// Virtual for full address
certificationBodySchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
  return parts.join(', ');
});

// Virtual for display name (with short name if available)
certificationBodySchema.virtual('displayName').get(function() {
  return this.shortName ? `${this.companyName} (${this.shortName})` : this.companyName;
});

// Method to add certification statistics
certificationBodySchema.methods.updateCertificationStats = function(increment = 1) {
  this.statistics.totalCertificatesIssued += increment;
  this.statistics.activeCertificates += increment;
  this.statistics.lastCertificateIssued = new Date();
  return this.save();
};

// Method to add contact person
certificationBodySchema.methods.addContactPerson = function(contactData) {
  this.contactPersons.push(contactData);
  return this.save();
};

// Method to check if certification body can issue specific type
certificationBodySchema.methods.canIssueCertification = function(certificationType) {
  return this.isActive && 
         this.certificationTypes.some(cert => 
           cert.name.toLowerCase().includes(certificationType.toLowerCase())
         );
};

// Static method to find active certification bodies
certificationBodySchema.statics.findActive = function() {
  return this.find({ 
    isDeleted: false, 
    isActive: true 
  }).sort({ isPreferred: -1, companyName: 1 });
};

// Static method to find by specialization
certificationBodySchema.statics.findBySpecialization = function(specialization) {
  return this.find({ 
    isDeleted: false,
    isActive: true,
    specializations: { $in: [specialization] }
  });
};

// Static method to search certification bodies
certificationBodySchema.statics.searchBodies = function(searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  
  return this.find({
    isDeleted: false,
    $or: [
      { companyName: searchRegex },
      { shortName: searchRegex },
      { specializations: { $in: [searchRegex] } },
      { 'address.city': searchRegex },
      { 'address.country': searchRegex }
    ]
  });
};

// Pre-save middleware to ensure email is lowercase
certificationBodySchema.pre('save', function(next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  // Ensure contact persons emails are lowercase
  if (this.contactPersons && this.contactPersons.length > 0) {
    this.contactPersons.forEach(contact => {
      if (contact.email) {
        contact.email = contact.email.toLowerCase();
      }
    });
  }
  
  next();
});

// Pre-save middleware to generate short name if not provided
certificationBodySchema.pre('save', function(next) {
  if (!this.shortName && this.companyName) {
    // Generate acronym from company name
    const words = this.companyName.split(' ').filter(word => 
      !['of', 'and', 'for', 'the', 'in', 'on', 'at'].includes(word.toLowerCase())
    );
    this.shortName = words.map(word => word.charAt(0).toUpperCase()).join('');
  }
  next();
});



//middleware to sync when certification body name changes
certificationBodySchema.post('save', async function() {
  if (this.isModified('companyName')) {
    // Update all courses that use this certification body
    const courseModels = ['InPersonAestheticTraining', 'OnlineLiveTraining', 'SelfPacedOnlineTraining'];
    
    for (const modelName of courseModels) {
      await mongoose.model(modelName).updateMany(
        { 'certification.issuingAuthorityId': this._id },
        { $set: { 'certification.issuingAuthority': this.companyName } }
      );
    }
  }
});

// Ensure model is not re-compiled
module.exports = mongoose.models.CertificationBody || mongoose.model('CertificationBody', certificationBodySchema);