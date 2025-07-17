// routes/instructorsRoutes.js
const express = require("express");
const router = express.Router();
const Instructor = require("../models/Instructor");

// ========================================
// PUBLIC ROUTES - For viewing instructors
// These will be mounted at ROOT level, so routes become:
// /our-instructors and /our-instructors/:id
// ========================================

// GET /our-instructors - Display all instructors page (PUBLIC)
router.get("/our-instructors", async (req, res) => {
  try {
    console.log("📚 Public instructors page accessed");

    // Get search and filter parameters
    const search = req.query.search || "";
    const expertise = req.query.expertise || "";
    const specialization = req.query.specialization || "";
    const courseType = req.query.courseType || "";
    const sortBy = req.query.sortBy || "lastName";

    // Build search query
    let searchQuery = {
      isDeleted: false,
      status: "Active",
    };

    // Add search filters
    if (search) {
      const searchRegex = new RegExp(search, "i");
      searchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { designation: searchRegex },
        { expertise: { $in: [searchRegex] } },
        { specializations: { $in: [searchRegex] } },
      ];
    }

    if (expertise) {
      searchQuery.expertise = { $in: [expertise] };
    }

    if (specialization) {
      searchQuery.specializations = { $in: [specialization] };
    }

    if (courseType) {
      searchQuery.preferredCourseTypes = { $in: [courseType] };
    }

    // Fetch instructors with search and sort
    const instructors = await Instructor.find(searchQuery)
      .sort({ [sortBy]: 1 })
      .lean();

    // Calculate average ratings and format data
    const formattedInstructors = instructors.map((instructor) => {
      const avgRating =
        instructor.ratings && instructor.ratings.courseRatings.length > 0
          ? (
              instructor.ratings.courseRatings.reduce(
                (sum, rating) => sum + rating.rating,
                0
              ) / instructor.ratings.courseRatings.length
            ).toFixed(1)
          : 0;

      return {
        ...instructor,
        averageRating: avgRating,
        totalCourses: instructor.assignedCourses
          ? instructor.assignedCourses.length
          : 0,
        upcomingCourses: instructor.assignedCourses
          ? instructor.assignedCourses.filter(
              (course) =>
                new Date(course.startDate) > new Date() &&
                course.status === "Upcoming"
            ).length
          : 0,
      };
    });

    // Get unique values for filters
    const allInstructors = await Instructor.find({
      isDeleted: false,
      status: "Active",
    }).lean();

    const expertiseOptions = [
      ...new Set(allInstructors.flatMap((i) => i.expertise || [])),
    ].sort();

    const specializationOptions = [
      ...new Set(allInstructors.flatMap((i) => i.specializations || [])),
    ].sort();

    const courseTypeOptions = [
      ...new Set(allInstructors.flatMap((i) => i.preferredCourseTypes || [])),
    ].sort();

    res.render("instructors", {
      title: "Our Expert Instructors - IAAI",
      user: req.user || null,
      instructors: formattedInstructors,
      filters: {
        search,
        expertise,
        specialization,
        courseType,
        sortBy,
      },
      filterOptions: {
        expertise: expertiseOptions,
        specializations: specializationOptions,
        courseTypes: courseTypeOptions,
      },
      totalInstructors: formattedInstructors.length,
    });
  } catch (error) {
    console.error("❌ Error fetching instructors:", error);
    req.flash("error_message", "Error loading instructors page.");
    res.redirect("/");
  }
});

// GET /our-instructors/:id - Display individual instructor profile (PUBLIC)
router.get("/our-instructors/:id", async (req, res) => {
  try {
    const instructorId = req.params.id;
    console.log(`👤 Instructor profile requested: ${instructorId}`);

    // Validate ObjectId format
    if (!instructorId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log("❌ Invalid instructor ID format:", instructorId);
      req.flash("error_message", "Invalid instructor ID.");
      return res.redirect("/our-instructors");
    }

    const instructor = await Instructor.findOne({
      _id: instructorId,
      isDeleted: false,
      status: "Active",
    }).lean();

    if (!instructor) {
      console.log("❌ Instructor not found:", instructorId);
      req.flash("error_message", "Instructor not found.");
      return res.redirect("/our-instructors");
    }

    // Calculate additional metrics
    const avgRating =
      instructor.ratings && instructor.ratings.courseRatings.length > 0
        ? (
            instructor.ratings.courseRatings.reduce(
              (sum, rating) => sum + rating.rating,
              0
            ) / instructor.ratings.courseRatings.length
          ).toFixed(1)
        : 0;

    const upcomingCourses = instructor.assignedCourses
      ? instructor.assignedCourses.filter(
          (course) =>
            new Date(course.startDate) > new Date() &&
            course.status === "Upcoming"
        )
      : [];

    const completedCourses = instructor.assignedCourses
      ? instructor.assignedCourses.filter(
          (course) => course.status === "Completed"
        )
      : [];

    const formattedInstructor = {
      ...instructor,
      averageRating: avgRating,
      totalCourses: instructor.assignedCourses
        ? instructor.assignedCourses.length
        : 0,
      upcomingCourses,
      completedCourses: completedCourses.length,
      yearsExperience: instructor.experience
        ? parseInt(instructor.experience)
        : 0,
    };

    // Get related instructors (same expertise area) - optional
    let relatedInstructors = [];
    if (instructor.expertise && instructor.expertise.length > 0) {
      try {
        relatedInstructors = await Instructor.find({
          _id: { $ne: instructor._id },
          isDeleted: false,
          status: "Active",
          expertise: { $in: instructor.expertise },
        })
          .limit(4)
          .select("firstName lastName profileImage expertise designation")
          .lean();

        relatedInstructors = relatedInstructors.map((inst) => ({
          ...inst,
          fullName: `${inst.firstName} ${inst.lastName}`,
          primaryExpertise: inst.expertise?.[0] || "",
          profileUrl: `/our-instructors/${inst._id}`,
        }));
      } catch (relatedError) {
        console.log(
          "⚠️ Could not fetch related instructors:",
          relatedError.message
        );
        relatedInstructors = [];
      }
    }

    console.log(
      "✅ Instructor profile loaded successfully:",
      instructor.firstName,
      instructor.lastName
    );

    res.render("instructor-profile", {
      title: `${instructor.firstName} ${instructor.lastName} - IAAI Instructor`,
      user: req.user || null,
      instructor: formattedInstructor,
      relatedInstructors: relatedInstructors,
    });
  } catch (error) {
    console.error("❌ Error fetching instructor profile:", error);
    req.flash("error_message", "Error loading instructor profile.");
    res.redirect("/our-instructors");
  }
});

// ========================================
// API ROUTES for public instructor search
// ========================================

// API endpoint for instructor search (AJAX)
router.get("/api/instructors/search", async (req, res) => {
  try {
    const { term } = req.query;

    if (!term || term.length < 2) {
      return res.json([]);
    }

    const searchRegex = new RegExp(term, "i");
    const instructors = await Instructor.find({
      isDeleted: false,
      status: "Active",
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { expertise: { $in: [searchRegex] } },
        { specializations: { $in: [searchRegex] } },
      ],
    })
      .limit(10)
      .select("firstName lastName profileImage expertise specializations")
      .lean();

    const results = instructors.map((instructor) => ({
      id: instructor._id,
      name: `${instructor.firstName} ${instructor.lastName}`,
      image: instructor.profileImage,
      expertise: instructor.expertise?.[0] || "",
      url: `/our-instructors/${instructor._id}`,
    }));

    res.json(results);
  } catch (error) {
    console.error("❌ Error in instructor search API:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Add at the top of instructorsRoutes.js
console.log("🔧 instructorsRoutes.js loaded successfully");

// Add these test routes
router.get("/test-instructor-routes", (req, res) => {
  res.json({
    message: "Instructor routes are working!",
    timestamp: new Date().toISOString(),
  });
});

router.get("/debug-instructors", (req, res) => {
  res.json({
    message: "Public instructor routes are working!",
    availableRoutes: [
      "GET /our-instructors - List all instructors",
      "GET /our-instructors/:id - View instructor profile",
      "GET /api/instructors/search - Search instructors",
    ],
  });
});

module.exports = router;
