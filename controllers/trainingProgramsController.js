const TrainingPrograms = require('../models/TrainingPrograms'); // Assuming you have a model for the training programs

// Use async/await to fetch data
exports.getTrainingPrograms = async (req, res) => {
  try {
    // Fetch training programs from the database
    const trainingPrograms = await TrainingPrograms.find(); // This returns a Promise, no callback needed

    // Render the page with the training programs data
    res.render('training-programs/training-programs', { trainingPrograms }); // Adjust the template path if necessary
  } catch (err) {
    console.error('Error fetching training programs:', err);
    res.status(500).send('Server error'); // Handle any errors
  }
};