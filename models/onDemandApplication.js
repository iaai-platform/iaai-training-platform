//onDemandApplication.js
const mongoose = require('mongoose');

const onDemandApplicationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    courseInterest: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('OnDemandApplication', onDemandApplicationSchema);