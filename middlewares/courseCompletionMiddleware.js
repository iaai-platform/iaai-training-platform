// middlewares/courseCompletionMiddleware.js
const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");

// Middleware to check if prerequisite courses are completed
const checkCoursePrerequisites = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    // Only check for in-person courses
    const course = await InPersonAestheticTraining.findById(courseId).populate(
      "linkedCourse.onlineCourseId"
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if course has required linked course
    if (
      course.linkedCourse?.onlineCourseId &&
      course.linkedCourse?.completionRequired
    ) {
      const user = await User.findById(userId);
      const linkedCourseId = course.linkedCourse.onlineCourseId._id;

      // Find user's enrollment in the linked online course
      const linkedEnrollment = user.myLiveCourses?.find(
        (enrollment) =>
          enrollment.courseId.toString() === linkedCourseId.toString() &&
          ["paid", "registered", "completed"].includes(
            enrollment.enrollmentData.status
          )
      );

      if (!linkedEnrollment) {
        return res.status(400).json({
          success: false,
          message: `You must first enroll in the prerequisite course: ${course.linkedCourse.onlineCourseId.basic?.title}`,
          prerequisiteCourse: {
            id: linkedCourseId,
            title: course.linkedCourse.onlineCourseId.basic?.title,
            relationship: course.linkedCourse.relationship,
          },
        });
      }

      // Check if linked course is completed
      if (linkedEnrollment.userProgress?.courseStatus !== "completed") {
        return res.status(400).json({
          success: false,
          message: `You must complete the prerequisite course "${course.linkedCourse.onlineCourseId.basic?.title}" before completing this in-person course`,
          prerequisiteCourse: {
            id: linkedCourseId,
            title: course.linkedCourse.onlineCourseId.basic?.title,
            status:
              linkedEnrollment.userProgress?.courseStatus || "not-started",
            relationship: course.linkedCourse.relationship,
          },
        });
      }
    }

    // If we reach here, prerequisites are satisfied
    next();
  } catch (error) {
    console.error("❌ Error checking course prerequisites:", error);
    res.status(500).json({
      success: false,
      message: "Error validating course prerequisites",
    });
  }
};

module.exports = { checkCoursePrerequisites };
