// routes/instructorsRoutes.js
const express = require("express");
const router = express.Router();
const Instructor = require("../models/Instructor");

// GET /instructors - Display all instructors page
router.get("/instructor-profile", async (req, res) => {
  try {
    console.log("📚 Instructors page accessed");

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

// GET /instructors/:id - Display individual instructor profile
router.get("/instructor-profile/:id", async (req, res) => {
  try {
    const instructorId = req.params.id;
    console.log(`👤 Instructor profile requested: ${instructorId}`);

    const instructor = await Instructor.findOne({
      _id: instructorId,
      isDeleted: false,
      status: "Active",
    }).lean();

    if (!instructor) {
      req.flash("error_message", "Instructor not found.");
      return res.redirect("/instructor-profile");
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

    res.render("instructor-profile", {
      title: `${instructor.firstName} ${instructor.lastName} - IAAI Instructor`,
      user: req.user || null,
      instructor: formattedInstructor,
    });
  } catch (error) {
    console.error("❌ Error fetching instructor profile:", error);
    req.flash("error_message", "Error loading instructor profile.");
    res.redirect("/instructor-profile");
  }
});

// API endpoint for instructor search (AJAX)
router.get("/api/instructor-profiles/search", async (req, res) => {
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
      url: `/instructor-profile/${instructor._id}`,
    }));

    res.json(results);
  } catch (error) {
    console.error("❌ Error in instructor search API:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
