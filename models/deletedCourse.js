const mongoose = require("mongoose");

const deletedCourseSchema = new mongoose.Schema(
  {
    // Original course enrollment data
    originalEnrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Course details (snapshot at deletion)
    courseData: {
      courseId: mongoose.Schema.Types.ObjectId,
      courseType: {
        type: String,
        enum: [
          "InPersonAestheticTraining",
          "OnlineLiveTraining",
          "SelfPacedOnlineTraining",
        ],
        required: true,
      },
      courseName: String,
      courseCode: String,
      enrollmentData: mongoose.Schema.Types.Mixed,
      userProgress: mongoose.Schema.Types.Mixed,
      assessmentData: mongoose.Schema.Types.Mixed,
    },

    // Deletion metadata
    deletedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      adminName: String,
      adminEmail: String,
    },

    deletionReason: {
      type: String,
      default: "Removed by admin",
    },

    // Recovery tracking
    isRecovered: {
      type: Boolean,
      default: false,
    },

    recoveredBy: {
      adminId: mongoose.Schema.Types.ObjectId,
      adminName: String,
      recoveredAt: Date,
    },
  },
  { timestamps: true }
);

// Indexes
deletedCourseSchema.index({ userId: 1 });
deletedCourseSchema.index({ "deletedBy.adminId": 1 });
deletedCourseSchema.index({ isRecovered: 1 });
deletedCourseSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DeletedCourse", deletedCourseSchema);
