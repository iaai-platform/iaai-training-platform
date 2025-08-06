// ✅ DEBUGGING SCRIPT: Add this to your project to check assessment structure
// File: debug-assessment.js

const mongoose = require("mongoose");
require("dotenv").config();

// Connect to your database
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/your-db-name"
);

const OnlineLiveTraining = require("./models/onlineLiveTrainingModel");

async function debugAssessmentStructure() {
  try {
    console.log("🔍 DEBUGGING: Checking assessment structure in database...");

    // Find a course with assessment
    const courseWithAssessment = await OnlineLiveTraining.findOne({
      "assessment.required": true,
      "assessment.questions.0": { $exists: true },
    }).lean();

    if (!courseWithAssessment) {
      console.log("❌ No courses found with assessments");
      return;
    }

    console.log("✅ Found course with assessment:", {
      courseId: courseWithAssessment._id,
      title: courseWithAssessment.basic?.title,
      questionsCount: courseWithAssessment.assessment?.questions?.length || 0,
    });

    // Debug first question structure
    const firstQuestion = courseWithAssessment.assessment?.questions?.[0];
    if (firstQuestion) {
      console.log("🔍 First question structure:");
      console.log("Fields:", Object.keys(firstQuestion));
      console.log("Sample question:", {
        question: firstQuestion.question,
        answers: firstQuestion.answers,
        // Check all possible correct answer fields
        correctAnswer: firstQuestion.correctAnswer,
        correct_answer: firstQuestion.correct_answer,
        correctAnswerIndex: firstQuestion.correctAnswerIndex,
        answer: firstQuestion.answer,
        points: firstQuestion.points,
      });

      // Check answers structure
      if (firstQuestion.answers && Array.isArray(firstQuestion.answers)) {
        console.log("📝 Answers structure:");
        firstQuestion.answers.forEach((answer, index) => {
          console.log(`  Answer ${index}:`, answer);
        });
      }
    }

    // Check multiple questions
    if (courseWithAssessment.assessment.questions.length > 1) {
      console.log("🔍 Checking consistency across questions...");
      const allFields = new Set();
      courseWithAssessment.assessment.questions.forEach((q, index) => {
        Object.keys(q).forEach((field) => allFields.add(field));
      });
      console.log("All question fields found:", Array.from(allFields));
    }

    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Debug error:", error);
    mongoose.disconnect();
  }
}

// Run the debug script
debugAssessmentStructure();

// Export for use in other files
module.exports = { debugAssessmentStructure };
