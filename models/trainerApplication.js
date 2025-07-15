//trainerApplication.js

const mongoose = require('mongoose');

const trainerApplicationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phoneNumber: { type: String, required: true },
    experience: { type: String, required: true },
    expertise: { type: String, required: true },
    cvUrl: { type: String, required: true }, // ✅ Link to uploaded CV
    status: { type: String, enum: ['Pending', 'Reviewed', 'Accepted', 'Rejected'], default: 'Pending' }, // ✅ Application Status
    appliedAt: { type: Date, default: Date.now } // ✅ Timestamp
});

module.exports = mongoose.model('TrainerApplication', trainerApplicationSchema);