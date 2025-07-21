// controllers/inPersonTrainingUserController.js

const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const User = require("../models/user");
const Instructor = require("../models/Instructor");
const CertificationBody = require("../models/CertificationBody");

// 1. Controller to display In-Person Aesthetic Training Courses
exports.getInPersonAestheticTraining = async (req, res) => {
  try {
    console.log("📚 Fetching in-person courses...");
    const courses = await InPersonAestheticTraining.find();
    const user = req.user || null;

    console.log(`📊 Found ${courses.length} courses`);
    console.log(
      "👤 User:",
      user ? `${user.firstName} (${user.email})` : "Not logged in"
    );

    // Update course status based on seats available
    for (let course of courses) {
      if (course.seatsAvailable <= 0) {
        course.status = "Closed";
        await course.save();
      }
    }

    // Transform courses for calendar view compatibility
    const transformedCourses = courses.map((course) => ({
      // Keep original course data
      ...course.toObject(),

      // Add flattened properties for calendar compatibility
      _id: course._id,
      title: course.basic?.title || "Untitled Course",
      courseCode: course.basic?.courseCode || "N/A",
      startDate: course.schedule?.startDate,
      endDate: course.schedule?.endDate,
      duration: course.schedule?.duration || "TBD",
      location: course.venue?.name || "TBD",
      city: course.venue?.city || "TBD",
      country: course.venue?.country || "TBD",
      instructor: course.instructorNames || "Expert Instructors",
      price: course.enrollment?.price || 0,
      earlyBirdPrice: course.enrollment?.earlyBirdPrice || null,
      currency: course.enrollment?.currency || "USD",
      seatsAvailable: course.enrollment?.seatsAvailable || 0,
      currentEnrollment: course.enrollment?.currentEnrollment || 0,
      maxEnrollment: course.enrollment?.seatsAvailable || 0,
      status: course.basic?.status || "draft",

      // Computed properties for calendar
      availableSeats:
        (course.enrollment?.seatsAvailable || 0) -
        (course.enrollment?.currentEnrollment || 0),
      isUpcoming:
        course.schedule?.startDate &&
        new Date(course.schedule.startDate) > new Date(),

      // Enhanced instructor names
      instructorNames: course.instructorNames || "Expert Instructors",
    }));

    console.log("✅ Courses transformed for calendar view");

    res.render("in-person-aesthetic-training", {
      courses: transformedCourses,
      user: user,
    });
  } catch (err) {
    console.error("❌ Error fetching courses:", err);
    res.status(500).send("Server error");
  }
};

// Rest of your getCourseDetails function remains the same...
exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log("📋 Fetching course details for ID:", courseId);

    // Step 1: Get the course with all its data
    const course = await InPersonAestheticTraining.findById(courseId).lean();

    if (!course) {
      console.log("❌ Course not found");
      return res.status(404).send("Course not found");
    }

    console.log("✅ Course found:", course.basic?.title);

    // Step 2: Initialize the enhanced course object
    let courseWithFullDetails = { ...course };

    // Step 3: Fetch instructor details
    const instructorIds = [];

    // Collect primary instructor ID
    if (course.instructors?.primary?.instructorId) {
      instructorIds.push(course.instructors.primary.instructorId);
      console.log(
        "📌 Primary instructor ID:",
        course.instructors.primary.instructorId
      );
    }

    // Collect additional instructor IDs
    if (
      course.instructors?.additional &&
      course.instructors.additional.length > 0
    ) {
      course.instructors.additional.forEach((inst) => {
        if (inst.instructorId) {
          instructorIds.push(inst.instructorId);
        }
      });
      console.log("📌 Additional instructor IDs:", instructorIds.length - 1);
    }

    // Fetch instructor details if we have IDs
    courseWithFullDetails.instructorDetails = {
      primary: null,
      additional: [],
    };

    if (instructorIds.length > 0) {
      console.log(
        "🔍 Fetching instructor details for",
        instructorIds.length,
        "instructors"
      );

      const instructors = await Instructor.find({
        _id: { $in: instructorIds },
      }).lean();

      console.log("✅ Found", instructors.length, "instructors");

      // Map primary instructor
      if (course.instructors?.primary?.instructorId) {
        const primaryInstructor = instructors.find(
          (inst) =>
            inst._id.toString() ===
            course.instructors.primary.instructorId.toString()
        );

        if (primaryInstructor) {
          courseWithFullDetails.instructorDetails.primary = primaryInstructor;
          console.log(
            "✅ Primary instructor found:",
            primaryInstructor.firstName,
            primaryInstructor.lastName
          );
        } else {
          console.log("⚠️ Primary instructor not found in database");
        }
      }

      // Map additional instructors
      if (
        course.instructors?.additional &&
        course.instructors.additional.length > 0
      ) {
        courseWithFullDetails.instructorDetails.additional =
          course.instructors.additional
            .map((add) => {
              const instructor = instructors.find(
                (inst) => inst._id.toString() === add.instructorId.toString()
              );
              if (instructor) {
                return { ...instructor, role: add.role };
              }
              return null;
            })
            .filter(Boolean);

        console.log(
          "✅ Additional instructors mapped:",
          courseWithFullDetails.instructorDetails.additional.length
        );
      }
    } else {
      console.log("⚠️ No instructor IDs found in course");
    }

    // Step 4: Fetch certification body details
    courseWithFullDetails.certificationBodyDetails = null;

    if (course.certification?.issuingAuthorityId) {
      console.log(
        "📌 Certification body ID:",
        course.certification.issuingAuthorityId
      );

      try {
        const certBody = await CertificationBody.findById(
          course.certification.issuingAuthorityId
        ).lean();

        if (certBody) {
          courseWithFullDetails.certificationBodyDetails = certBody;
          console.log("✅ Certification body found:", certBody.companyName);
        } else {
          console.log("⚠️ Certification body not found in database");
        }
      } catch (error) {
        console.error("❌ Error fetching certification body:", error);
      }
    } else {
      console.log("ℹ️ No certification body linked to this course");
    }

    // Step 5: Get related courses
    const relatedCourses = await InPersonAestheticTraining.find({
      _id: { $ne: courseId },
      "basic.status": "open",
      "schedule.startDate": { $gte: new Date() },
      $or: [
        { "basic.category": course.basic?.category },
        { "venue.city": course.venue?.city },
      ],
    })
      .limit(4)
      .select("basic schedule enrollment venue")
      .sort({ "schedule.startDate": 1 })
      .lean();

    courseWithFullDetails.relatedCourses = relatedCourses;
    console.log("✅ Found", relatedCourses.length, "related courses");

    // Step 6: Add computed properties
    courseWithFullDetails.enhancements = {
      availableSeats:
        (course.enrollment?.seatsAvailable || 0) -
        (course.enrollment?.currentEnrollment || 0),
      enrollmentPercentage:
        course.enrollment?.seatsAvailable > 0
          ? Math.round(
              ((course.enrollment?.currentEnrollment || 0) /
                course.enrollment.seatsAvailable) *
                100
            )
          : 0,
      daysUntilStart: course.schedule?.startDate
        ? Math.ceil(
            (new Date(course.schedule.startDate) - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      isUpcoming:
        course.schedule?.startDate &&
        new Date(course.schedule.startDate) > new Date(),
      hasEarlyBird: !!(
        course.enrollment?.earlyBirdPrice &&
        course.schedule?.registrationDeadline &&
        new Date() < new Date(course.schedule.registrationDeadline)
      ),
    };

    // Step 7: Generate instructor names for display
    courseWithFullDetails.instructorNames = (() => {
      const names = [];

      if (courseWithFullDetails.instructorDetails.primary) {
        const primary = courseWithFullDetails.instructorDetails.primary;
        names.push(
          primary.fullName || `${primary.firstName} ${primary.lastName}`
        );
      }

      if (
        courseWithFullDetails.instructorDetails.additional &&
        courseWithFullDetails.instructorDetails.additional.length > 0
      ) {
        courseWithFullDetails.instructorDetails.additional.forEach((inst) => {
          names.push(inst.fullName || `${inst.firstName} ${inst.lastName}`);
        });
      }

      return names.length > 0 ? names.join(", ") : "Expert Instructors";
    })();

    console.log("✅ Instructor names:", courseWithFullDetails.instructorNames);

    // Step 8: Debug logging
    console.log("📊 Final data check:");
    console.log(
      "- Has primary instructor details:",
      !!courseWithFullDetails.instructorDetails.primary
    );
    console.log(
      "- Additional instructors count:",
      courseWithFullDetails.instructorDetails.additional.length
    );
    console.log(
      "- Has certification body details:",
      !!courseWithFullDetails.certificationBodyDetails
    );

    // Step 9: Render the view
    res.render("inpersoncourses", {
      course: courseWithFullDetails,
      user: req.user || null,
    });
  } catch (err) {
    console.error("❌ Error fetching course details:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).send("Server error");
  }
};
