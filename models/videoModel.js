const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'SelfPacedOnlineTraining', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  transcript: { type: String },
  videoUrl: { type: String, required: true },
  sequence: { type: Number, required: true }, // Order for Type 1 courses

  // ✅ Store course type (Type 1 or Type 2)
  courseType: { type: String, enum: ['Type1', 'Type2'], required: true },

  // ✅ Store exam questions inside Video Model (only for Type 1)
  exam: [
    {
      questionText: { type: String },
      options: [{ type: String }],
      correctAnswer: { type: String }
    }
  ]
});

// ✅ Prevent Overwriting Model
module.exports = mongoose.models.Video || mongoose.model('Video', videoSchema);