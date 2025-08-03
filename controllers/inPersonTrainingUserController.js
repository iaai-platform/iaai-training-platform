// controllers/inPersonTrainingUserController.js - COMPLETE FINAL VERSION

const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const User = require("../models/user");
const Instructor = require("../models/Instructor");
const CertificationBody = require("../models/CertificationBody");

// Simple currency symbol function
const getCurrencySymbol = (currency) => {
  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    TRY: "₺",
    AED: "د.إ",
    SAR: "ر.س",
  };
  return symbols[currency] || "€"; // Default to Euro if not found
};

// 🔧 FIXED: Controller to display In-Person Aesthetic Training Courses
exports.getInPersonAestheticTraining = async (req, res) => {
  try {
    console.log("📚 Fetching in-person courses...");

    const now = new Date();

    // 🔧 FIXED: Fetch ALL courses including expired ones
    const allCourses = await InPersonAestheticTraining.find();

    console.log(`📊 Found ${allCourses.length} total courses in database`);

    // 🔧 FIXED: Process courses and separate into categories
    const upcomingCourses = [];
    const expiredCourses = [];

    for (let course of allCourses) {
      const startDate = course.schedule?.startDate
        ? new Date(course.schedule.startDate)
        : null;
      const endDate = course.schedule?.endDate
        ? new Date(course.schedule.endDate)
        : null;

      // 🔧 FIXED: Determine if course is expired
      let isExpired = false;
      let currentStatus = course.basic?.status;

      // Update status based on dates (only if not manually cancelled)
      if (course.basic?.status !== "cancelled") {
        if (endDate && now > endDate) {
          currentStatus = "completed";
          isExpired = true;
        } else if (
          !endDate &&
          startDate &&
          now > new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        ) {
          currentStatus = "completed";
          isExpired = true;
        } else if (
          startDate &&
          now >= startDate &&
          (!endDate || now <= endDate)
        ) {
          currentStatus = "in-progress";
        } else if (
          course.enrollment?.currentEnrollment >=
          course.enrollment?.seatsAvailable
        ) {
          currentStatus = "full";
        } else if (startDate && now < startDate) {
          currentStatus = "open";
        }

        // Save the updated status
        if (currentStatus !== course.basic?.status) {
          course.basic.status = currentStatus;
          await course.save();
          console.log(
            `✅ Updated course ${course.basic?.courseCode} status to: ${currentStatus}`
          );
        }
      } else {
        // Cancelled courses are considered expired
        isExpired = true;
      }

      // Transform course for template compatibility
      const transformedCourse = {
        // Keep original course data
        ...course.toObject(),

        // Add flattened properties for template compatibility
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
        currency: course.enrollment?.currency || "EUR",
        seatsAvailable: course.enrollment?.seatsAvailable || 0,
        currentEnrollment: course.enrollment?.currentEnrollment || 0,
        maxEnrollment: course.enrollment?.seatsAvailable || 0,
        status: currentStatus,

        // Computed properties
        availableSeats:
          (course.enrollment?.seatsAvailable || 0) -
          (course.enrollment?.currentEnrollment || 0),
        isUpcoming: startDate && new Date(startDate) > now,
        isExpired: isExpired,

        // Enhanced instructor names
        instructorNames: course.instructorNames || "Expert Instructors",
      };

      // 🔧 FIXED: Categorize courses properly
      if (isExpired) {
        expiredCourses.push(transformedCourse);
        console.log(
          `📚 Added to expired: ${transformedCourse.title} (${transformedCourse.status})`
        );
      } else {
        upcomingCourses.push(transformedCourse);
        console.log(
          `📅 Added to upcoming: ${transformedCourse.title} (${transformedCourse.status})`
        );
      }
    }

    // Sort courses
    upcomingCourses.sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );
    expiredCourses.sort(
      (a, b) => new Date(b.startDate) - new Date(a.startDate)
    ); // Most recent first

    const user = req.user || null;

    console.log(`✅ Final categorization:`);
    console.log(`   📅 Upcoming courses: ${upcomingCourses.length}`);
    console.log(`   📚 Expired courses: ${expiredCourses.length}`);
    console.log(
      `👤 User: ${user ? `${user.firstName} (${user.email})` : "Not logged in"}`
    );

    // 🔧 FIXED: Pass both arrays to template
    res.render("in-person-aesthetic-training", {
      // Pass separate arrays for the two tables
      upcomingCourses: upcomingCourses,
      expiredCourses: expiredCourses,

      // Keep backward compatibility with existing template
      courses: [...upcomingCourses, ...expiredCourses],

      user: user,
      getCurrencySymbol: getCurrencySymbol,

      // Additional stats
      stats: {
        totalCourses: upcomingCourses.length + expiredCourses.length,
        upcomingCount: upcomingCourses.length,
        expiredCount: expiredCourses.length,
        availableCount: upcomingCourses.filter(
          (course) =>
            course.status === "open" && (course.seatsAvailable || 0) > 0
        ).length,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching courses:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).send("Server error");
  }
};

// 🔧 COMPLETE: Enhanced getCourseDetails with ALL features restored

exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log("📋 Fetching course details for ID:", courseId);

    // Step 1: Get the course with all its data
    const course = await InPersonAestheticTraining.findById(courseId).lean();

    if (!course) {
      console.log("❌ Course not found");
      return res.status(404).render("error", {
        message: "Course not found",
        error: { status: 404 },
      });
    }

    // Check if course is expired
    const now = new Date();
    const startDate = course.schedule?.startDate
      ? new Date(course.schedule.startDate)
      : null;
    const endDate = course.schedule?.endDate
      ? new Date(course.schedule.endDate)
      : null;

    let isExpired = false;
    let currentStatus = course.basic?.status;

    // Update status based on current date
    if (course.basic?.status !== "cancelled") {
      if (endDate && now > endDate) {
        currentStatus = "completed";
        isExpired = true;
      } else if (
        !endDate &&
        startDate &&
        now > new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      ) {
        currentStatus = "completed";
        isExpired = true;
      } else if (
        startDate &&
        now >= startDate &&
        (!endDate || now <= endDate)
      ) {
        currentStatus = "in-progress";
      } else if (
        course.enrollment?.currentEnrollment >=
        course.enrollment?.seatsAvailable
      ) {
        currentStatus = "full";
      } else if (startDate && now < startDate) {
        currentStatus = "open";
      }
    } else {
      isExpired = true;
    }

    // If course is expired, show archive page
    if (isExpired) {
      console.log("⚠️ Course has expired:", course.basic?.title);
      return res.render("course-archive", {
        course: course,
        user: req.user || null,
        getCurrencySymbol: getCurrencySymbol,
        isExpired: true,
      });
    }

    console.log("✅ Course found:", course.basic?.title);

    // Step 2: Initialize the enhanced course object
    let courseWithFullDetails = { ...course };
    courseWithFullDetails.basic.status = currentStatus;
    courseWithFullDetails.canEnroll =
      currentStatus === "open" &&
      (course.enrollment?.currentEnrollment || 0) <
        (course.enrollment?.seatsAvailable || 0);

    // ✅ RESTORED: Step 3: Fetch instructor details
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

    // Initialize instructor details
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
          courseWithFullDetails.instructorDetails.primary = {
            ...primaryInstructor,
            role: course.instructors.primary.role || "Lead Instructor",
          };
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
                return {
                  ...instructor,
                  role: add.role || "Co-Instructor",
                };
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

    // ✅ RESTORED: Step 4: Fetch certification body details
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

    // ✅ RESTORED: Step 5: Get related courses
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

    // ✅ FIXED: Step 6: Add computed properties (enhancements) - MUST BE BEFORE linked course fetch
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

    // ✅ NEW: Step 6.5: Fetch linked online course details (AFTER enhancements)
    courseWithFullDetails.linkedCourseDetails = null;

    if (course.linkedCourse?.onlineCourseId) {
      console.log(
        "🔗 Fetching linked online course:",
        course.linkedCourse.onlineCourseId
      );

      try {
        const OnlineLiveTraining = require("../models/OnlineLiveTrainingModel");

        const linkedOnlineCourse = await OnlineLiveTraining.findById(
          course.linkedCourse.onlineCourseId
        )
          .select(
            "basic schedule enrollment venue instructors certification linkedToInPerson"
          )
          .lean();

        if (linkedOnlineCourse) {
          courseWithFullDetails.linkedCourseDetails = {
            ...linkedOnlineCourse,

            // Add computed fields for template compatibility
            title: linkedOnlineCourse.basic?.title || "Linked Online Course",
            courseCode: linkedOnlineCourse.basic?.courseCode || "N/A",
            startDate: linkedOnlineCourse.schedule?.startDate,
            endDate: linkedOnlineCourse.schedule?.endDate,
            duration: linkedOnlineCourse.schedule?.duration || "TBD",
            price: linkedOnlineCourse.enrollment?.price || 0,
            currency: linkedOnlineCourse.enrollment?.currency || "EUR",
            status: linkedOnlineCourse.basic?.status || "draft",

            // Relationship info from in-person course
            relationship: course.linkedCourse.relationship || "prerequisite",
            isRequired: course.linkedCourse.isRequired || false,
            completionRequired: course.linkedCourse.completionRequired || false,
            isFree: course.linkedCourse.isFree || false,
            customPrice: course.linkedCourse.customPrice || 0,
            certificateIssuingRule:
              course.linkedCourse.certificateIssuingRule || "inperson-only",

            // Display properties
            displayRelationship:
              course.linkedCourse.relationship === "prerequisite"
                ? "Required Prerequisite"
                : course.linkedCourse.relationship === "supplementary"
                ? "Supplementary Course"
                : course.linkedCourse.relationship === "follow-up"
                ? "Follow-up Course"
                : "Related Course",

            effectivePrice: course.linkedCourse.isFree
              ? 0
              : course.linkedCourse.customPrice > 0
              ? course.linkedCourse.customPrice
              : linkedOnlineCourse.enrollment?.price || 0,

            priceStatus: course.linkedCourse.isFree
              ? "Included Free"
              : course.linkedCourse.customPrice > 0
              ? "Special Price"
              : "Regular Price",
          };

          console.log(
            "✅ Linked online course found:",
            linkedOnlineCourse.basic?.title
          );
          console.log("🔗 Relationship:", course.linkedCourse.relationship);
          console.log("🆓 Is Free:", course.linkedCourse.isFree);
          console.log(
            "💰 Effective Price:",
            courseWithFullDetails.linkedCourseDetails.effectivePrice
          );
        } else {
          console.log("⚠️ Linked online course not found in database");
        }
      } catch (error) {
        console.error("❌ Error fetching linked online course:", error);
      }
    } else {
      console.log("ℹ️ No linked online course for this in-person course");
    }

    // ✅ RESTORED: Step 7: Generate instructor names for display
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

    // ✅ RESTORED: Step 8: Debug logging
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
    console.log(
      "- Has linked online course:",
      !!courseWithFullDetails.linkedCourseDetails
    );
    console.log("- Current status:", currentStatus);
    console.log("- Can enroll:", courseWithFullDetails.canEnroll);
    console.log(
      "- Available seats:",
      courseWithFullDetails.enhancements.availableSeats
    );
    console.log("- Related courses:", relatedCourses.length);

    // Step 9: Render the view
    res.render("inpersoncourses", {
      course: courseWithFullDetails,
      user: req.user || null,
      getCurrencySymbol: getCurrencySymbol,
    });
  } catch (err) {
    console.error("❌ Error fetching course details:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).render("error", {
      message: "Server error",
      error: { status: 500 },
    });
  }
};

// 🔧 NEW: Archive page for expired courses
exports.getCourseArchive = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log("📚 Fetching archived course for ID:", courseId);

    const course = await InPersonAestheticTraining.findById(courseId).lean();

    if (!course) {
      return res.status(404).render("error", {
        message: "Course not found",
        error: { status: 404 },
      });
    }

    res.render("course-archive", {
      course: course,
      user: req.user || null,
      getCurrencySymbol: getCurrencySymbol,
      isArchive: true,
    });
  } catch (err) {
    console.error("❌ Error fetching archived course:", err);
    res.status(500).render("error", {
      message: "Server error",
      error: { status: 500 },
    });
  }
};
