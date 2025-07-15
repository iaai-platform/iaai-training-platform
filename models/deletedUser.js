// models/deletedUser.js
const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema({
  // Store the original user data
  originalUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userData: { type: Object, required: true }, // Complete user data before deletion
  
  // Deletion metadata
  deletedBy: { 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    name: { type: String }
  },
  deletedAt: { type: Date, default: Date.now },
  deletionReason: { type: String },
  
  // Recovery information
  isRecovered: { type: Boolean, default: false },
  recoveredBy: { 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    name: { type: String }
  },
  recoveredAt: { type: Date },
  
  // Auto-delete after 30 days
  expiresAt: { 
    type: Date, 
    default: Date.now, 
    index: { expireAfterSeconds: 2592000 } // 30 days
  }
});

// Index for quick searches
deletedUserSchema.index({ 'userData.email': 1 });
deletedUserSchema.index({ deletedAt: -1 });

module.exports = mongoose.model('DeletedUser', deletedUserSchema);