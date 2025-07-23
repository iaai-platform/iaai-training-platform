// controllers/linkedCourseController.js
/**
 * Controller for managing linked courses in in-person training
 * Simple and minimal implementation
 */

const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

const linkedCourseController = {
  // Get list of online courses for selection
  async getOnlineCoursesList(req, res) {
    try {
      const onlineCourses = await OnlineLiveTraining.find(
        { "basic.status": { $in: ["open", "in-progress"] } },
        "basic.courseCode basic.title basic.status schedule.startDate"
      ).sort({ "basic.title": 1 });

      res.json(onlineCourses);
    } catch (error) {
      console.error("Error fetching online courses list:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch online courses",
      });
    }
  },

  // Get linked course information for an in-person course
  async getLinkedCourse(req, res) {
    try {
      const { courseId } = req.params;

      const course = await InPersonAestheticTraining.findById(courseId)
        .populate("linkedCourse.onlineCourseId", "basic.courseCode basic.title")
        .select("linkedCourse");

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Add course title to the response if linked course exists
      let linkedCourse = null;
      if (course.linkedCourse && course.linkedCourse.onlineCourseId) {
        linkedCourse = {
          ...course.linkedCourse.toObject(),
          courseTitle: course.linkedCourse.onlineCourseId
            ? `${course.linkedCourse.onlineCourseId.basic.courseCode} - ${course.linkedCourse.onlineCourseId.basic.title}`
            : "Course not found",
        };
      }

      res.json({
        success: true,
        linkedCourse,
      });
    } catch (error) {
      console.error("Error fetching linked course:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch linked course",
      });
    }
  },

  // Add or update linked course
  async addLinkedCourse(req, res) {
    try {
      const { courseId } = req.params;
      const {
        onlineCourseId,
        relationship,
        isRequired,
        completionRequired,
        isFree,
        customPrice,
      } = req.body;

      // Validate required fields
      if (!onlineCourseId || !relationship) {
        return res.status(400).json({
          success: false,
          message: "Online course ID and relationship are required",
        });
      }

      // Check if online course exists
      const onlineCourse = await OnlineLiveTraining.findById(onlineCourseId);
      if (!onlineCourse) {
        return res.status(404).json({
          success: false,
          message: "Online course not found",
        });
      }

      // Update the in-person course with linked course information
      const course = await InPersonAestheticTraining.findByIdAndUpdate(
        courseId,
        {
          linkedCourse: {
            onlineCourseId,
            isRequired: Boolean(isRequired),
            relationship,
            completionRequired: Boolean(completionRequired),
            isFree: Boolean(isFree),
            customPrice: isFree ? 0 : parseFloat(customPrice) || 0,
          },
        },
        { new: true, runValidators: true }
      );

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "In-person course not found",
        });
      }

      res.json({
        success: true,
        message: "Linked course saved successfully",
        linkedCourse: course.linkedCourse,
      });
    } catch (error) {
      console.error("Error adding linked course:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save linked course",
      });
    }
  },

  // Remove linked course
  async removeLinkedCourse(req, res) {
    try {
      const { courseId } = req.params;

      const course = await InPersonAestheticTraining.findByIdAndUpdate(
        courseId,
        {
          $unset: { linkedCourse: 1 },
        },
        { new: true }
      );

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      res.json({
        success: true,
        message: "Linked course removed successfully",
      });
    } catch (error) {
      console.error("Error removing linked course:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove linked course",
      });
    }
  },
};

module.exports = linkedCourseController;
