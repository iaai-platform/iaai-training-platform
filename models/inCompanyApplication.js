
//inCompanyApplication.js
const mongoose = require('mongoose');

const inCompanyApplicationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    companyName: { type: String, default: 'N/A' },
    message: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InCompanyApplication', inCompanyApplicationSchema);