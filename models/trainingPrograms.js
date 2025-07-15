const mongoose = require('mongoose');

// Define schema for training programs
const trainingProgramSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String, // URL or file path for the image
  link: String // Link to the detailed page for each training program
});

// Export the model to be used by the controller
module.exports = mongoose.model('TrainingPrograms', trainingProgramSchema);