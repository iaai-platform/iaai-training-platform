const User = require("../../models/user"); // Adjusted path
const Instructor = require("../../models/Instructor"); // Adjusted path
const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining"); // Adjusted path
const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel"); // Adjusted path
const SelfPacedOnlineTraining = require("../../models/selfPacedOnlineTrainingModel"); // Adjusted path

// Middleware to ensure user is authenticated and is an instructor
const ensureInstructor = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === "instructor") {
    return next();
  }
  req.flash(
    "error_message",
    "You are not authorized to view this page. Only instructors can access this profile."
  );
  res.redirect("/dashboard");
};

/**
 * GET /instructor/me
 * Displays the current instructor's complete profile and assigned courses.
 */
exports.getInstructorProfile = async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.user.email });

    if (!instructor) {
      req.flash(
        "error_message",
        "Instructor profile not found for your account. Please contact support."
      );
      return res.redirect("/dashboard");
    }

    // Fetch assigned courses details - for the main profile view, we'll just show a summary
    // For detailed view, we'll use getMyTeachingCourses
    const assignedCoursesSummary = [];
    const now = new Date();
    for (const assigned of instructor.assignedCourses) {
      let course = null;
      let courseModel = null;
      let baseUrl = "";

      switch (assigned.courseType) {
        case "InPersonAestheticTraining":
          courseModel = InPersonAestheticTraining;
          baseUrl = "/in-person/courses"; // Adjust if your URL structure is different
          break;
        case "OnlineLiveTraining":
          courseModel = OnlineLiveTraining;
          baseUrl = "/online-live/courses"; // Adjust if your URL structure is different
          break;
        case "SelfPacedOnlineTraining":
          courseModel = SelfPacedOnlineTraining;
          baseUrl = "/self-paced/courses"; // Adjust if your URL structure is different
          break;
        default:
          console.warn(
            `Unknown course type: ${assigned.courseType} for course ID ${assigned.courseId}`
          );
          continue;
      }

      if (courseModel) {
        // Select only necessary fields for summary display
        course = await courseModel
          .findById(assigned.courseId)
          .select("basic.title schedule.startDate schedule.endDate");
      }

      if (course) {
        assignedCoursesSummary.push({
          courseId: course._id,
          courseType: assigned.courseType,
          courseTitle: course.basic.title,
          startDate: course.schedule.startDate,
          endDate: course.schedule.endDate,
          role: assigned.role,
          status: assigned.status,
          courseUrl: `${baseUrl}/${course._id}`, // Dynamic URL
        });
      }
    }

    res.render("instructor/instructorProfile", {
      title: instructor.fullName + "'s Profile",
      user: req.user,
      instructor: instructor,
      // Pass the summary to the main profile page
      assignedCourses: assignedCoursesSummary,
      success_message: req.flash("success_message"),
      error_message: req.flash("error_message"),
    });
  } catch (error) {
    console.error("Error fetching instructor profile:", error);
    req.flash(
      "error_message",
      "An error occurred while loading your profile. Please try again."
    );
    res.redirect("/dashboard");
  }
};

/**
 * GET /instructor/me/edit
 * Renders the form to edit the current instructor's profile.
 */
exports.getEditInstructorProfile = async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.user.email });

    if (!instructor) {
      req.flash(
        "error_message",
        "Instructor profile not found for your account. Please contact support."
      );
      return res.redirect("/dashboard");
    }

    res.render("instructor/instructorProfileEdit", {
      title: "Edit My Instructor Profile",
      user: req.user,
      instructor: instructor,
      success_message: req.flash("success_message"),
      error_message: req.flash("error_message"),
    });
  } catch (error) {
    console.error("Error rendering edit instructor profile form:", error);
    req.flash(
      "error_message",
      "An error occurred while loading the edit form. Please try again."
    );
    res.redirect("/dashboard");
  }
};

/**
 * POST /instructor/me/edit
 * Handles the submission of the instructor profile edit form.
 */
exports.postEditInstructorProfile = async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.user.email });

    if (!instructor) {
      req.flash(
        "error_message",
        "Instructor profile not found for your account."
      );
      return res.redirect("/instructor/me/edit");
    }

    const {
      firstName,
      lastName,
      phoneNumber,
      bio,
      designation,
      experience,
      expertise,
      specializations,
      teachingStyle,
      socialMedia,
    } = req.body;

    instructor.firstName = firstName;
    instructor.lastName = lastName;
    instructor.phoneNumber = phoneNumber;
    instructor.bio = bio;
    instructor.designation = designation;
    instructor.experience = experience;
    instructor.teachingStyle = teachingStyle;

    instructor.expertise = expertise
      ? expertise
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    instructor.specializations = specializations
      ? specializations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (!instructor.socialMedia) {
      instructor.socialMedia = {};
    }
    instructor.socialMedia.linkedin = socialMedia?.linkedin || "";
    instructor.socialMedia.twitter = socialMedia?.twitter || "";
    instructor.socialMedia.website = socialMedia?.website || "";

    await instructor.save();
    req.flash(
      "success_message",
      "Your instructor profile has been updated successfully!"
    );
    res.redirect("/instructor/me");
  } catch (error) {
    console.error("Error updating instructor profile:", error);
    req.flash(
      "error_message",
      "An error occurred while updating your profile: " + error.message
    );
    res.redirect("/instructor/me/edit");
  }
};

/**
 * GET /instructor/me/courses
 * Displays all courses the current instructor is assigned to teach.
 */
exports.getMyTeachingCourses = async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.user.email });

    if (!instructor) {
      req.flash(
        "error_message",
        "Instructor profile not found for your account."
      );
      return res.redirect("/dashboard");
    }

    const teachingCourses = [];
    const now = new Date();

    for (const assigned of instructor.assignedCourses) {
      let course = null;
      let courseModel = null;
      let baseUrl = "";

      switch (assigned.courseType) {
        case "InPersonAestheticTraining":
          courseModel = InPersonAestheticTraining;
          baseUrl = "/in-person/courses";
          break;
        case "OnlineLiveTraining":
          courseModel = OnlineLiveTraining;
          baseUrl = "/online-live/courses";
          break;
        case "SelfPacedOnlineTraining":
          courseModel = SelfPacedOnlineTraining;
          baseUrl = "/self-paced/courses";
          break;
        default:
          console.warn(
            `Unknown course type: ${assigned.courseType} for course ID ${assigned.courseId}`
          );
          continue;
      }

      if (courseModel) {
        // Populate all relevant details for the course details page
        course = await courseModel
          .findById(assigned.courseId)
          .select(
            "basic.title basic.courseCode basic.description schedule.startDate schedule.endDate"
          );
      }

      if (course) {
        // Determine if the course is upcoming
        const isUpcoming = new Date(course.schedule.startDate) > now;

        teachingCourses.push({
          courseId: course._id,
          courseType: assigned.courseType,
          courseCode: course.basic.courseCode,
          courseTitle: course.basic.title,
          description: course.basic.description,
          startDate: course.schedule.startDate,
          endDate: course.schedule.endDate,
          role: assigned.role,
          status: assigned.status, // Status from the assignment, not course.basic.status
          courseUrl: `${baseUrl}/${course._id}`, // Dynamic URL
          isUpcoming: isUpcoming,
        });
      }
    }

    // You might want to sort these courses (e.g., by start date, then status)
    teachingCourses.sort((a, b) => {
      // Upcoming first, then in-progress, then completed/others
      const statusOrder = {
        upcoming: 1,
        "in progress": 2,
        completed: 3,
        "on leave": 4,
        active: 5,
        inactive: 6,
      };
      const statusA = (a.status || "").toLowerCase();
      const statusB = (b.status || "").toLowerCase();

      if (statusOrder[statusA] !== statusOrder[statusB]) {
        return statusOrder[statusA] - statusOrder[statusB];
      }

      return new Date(a.startDate) - new Date(b.startDate); // Then by date
    });

    res.render("instructor/myTeachingCourses", {
      title: "My Teaching Courses",
      user: req.user,
      teachingCourses: teachingCourses,
      success_message: req.flash("success_message"),
      error_message: req.flash("error_message"),
    });
  } catch (error) {
    console.error("Error fetching teaching courses:", error);
    req.flash(
      "error_message",
      "An error occurred while loading your teaching courses. Please try again."
    );
    res.redirect("/dashboard");
  }
};
