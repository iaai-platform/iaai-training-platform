const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'SelfPacedOnlineTraining', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  questions: [
    {
      questionText: { type: String, required: true },
      options: [{ type: String, required: true }],
      correctAnswer: { type: String, required: true },
    }
  ]
});

// ✅ Fix: Prevent Overwriting Model
module.exports = mongoose.models.Exam || mongoose.model('Exam', examSchema);