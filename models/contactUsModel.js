//contactUsModel.js
const mongoose = require('mongoose');

// Define the schema for storing contact form data
const contactUsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

// Export the model
module.exports = mongoose.model('ContactUs', contactUsSchema);