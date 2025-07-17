// controllers/instructorviewuser.js
const Instructor = require("../models/Instructor");

/**
 * Controller for handling instructor profile views (public-facing)
 * Provides detailed instructor information for students/visitors
 */
class InstructorViewController {
  /**
   * Get all active instructors with filtering and search
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllInstructors(req, res) {
    try {
      console.log("📚 Public instructors page accessed");

      // Get search and filter parameters
      const search = req.query.search || "";
      const expertise = req.query.expertise || "";
      const specialization = req.query.specialization || "";
      const courseType = req.query.courseType || "";
      const sortBy = req.query.sortBy || "lastName";
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const skip = (page - 1) * limit;

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
          { bio: searchRegex },
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

      // Get total count for pagination
      const totalInstructors = await Instructor.countDocuments(searchQuery);

      // Fetch instructors with search, sort, and pagination
      const instructors = await Instructor.find(searchQuery)
        .sort({ [sortBy]: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Calculate average ratings and format data
      const formattedInstructors = instructors.map((instructor) => {
        const avgRating = this.calculateAverageRating(instructor);
        const upcomingCourses = this.getUpcomingCourses(instructor);
        const totalCourses = instructor.assignedCourses
          ? instructor.assignedCourses.length
          : 0;

        return {
          ...instructor,
          averageRating: avgRating,
          totalCourses: totalCourses,
          upcomingCourses: upcomingCourses.length,
          yearsExperience: instructor.experience
            ? parseInt(instructor.experience)
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

      // Calculate pagination info
      const totalPages = Math.ceil(totalInstructors / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

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
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalInstructors: totalInstructors,
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
          limit: limit,
        },
        totalInstructors: formattedInstructors.length,
      });
    } catch (error) {
      console.error("❌ Error fetching instructors:", error);
      req.flash("error_message", "Error loading instructors page.");
      res.redirect("/");
    }
  }

  /**
   * Get individual instructor profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getInstructorProfile(req, res) {
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

      // Calculate additional metrics - using same logic as routes
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

      // Format instructor data to match what the view expects
      const formattedInstructor = {
        ...instructor,
        averageRating: avgRating,
        totalCourses: instructor.assignedCourses
          ? instructor.assignedCourses.length
          : 0,
        upcomingCourses: upcomingCourses,
        completedCourses: completedCourses.length,
        yearsExperience: instructor.experience
          ? parseInt(instructor.experience)
          : 0,
      };

      // Get related instructors (same expertise area) - optional, only if we have expertise
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
  }

  /**
   * Search instructors (AJAX endpoint)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchInstructors(req, res) {
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
          { designation: searchRegex },
        ],
      })
        .limit(10)
        .select(
          "firstName lastName profileImage expertise specializations designation"
        )
        .lean();

      const results = instructors.map((instructor) => ({
        id: instructor._id,
        name: `${instructor.firstName} ${instructor.lastName}`,
        image: instructor.profileImage || "/images/default-instructor.jpg",
        expertise: instructor.expertise?.[0] || instructor.designation || "",
        url: `/our-instructors/${instructor._id}`,
      }));

      res.json(results);
    } catch (error) {
      console.error("❌ Error in instructor search API:", error);
      res.status(500).json({ error: "Search failed" });
    }
  }

  /**
   * Get instructor availability (for course scheduling)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getInstructorAvailability(req, res) {
    try {
      const { instructorId } = req.params;
      const { startDate, endDate } = req.query;

      if (!instructorId || !startDate) {
        return res
          .status(400)
          .json({ error: "Instructor ID and start date are required" });
      }

      const instructor = await Instructor.findById(instructorId);
      if (!instructor) {
        return res.status(404).json({ error: "Instructor not found" });
      }

      const isAvailable = instructor.isAvailable(startDate, endDate);
      const conflictingCourses = instructor.assignedCourses.filter((course) => {
        const courseStart = new Date(course.startDate);
        const courseEnd = new Date(course.endDate || course.startDate);
        const checkStart = new Date(startDate);
        const checkEnd = new Date(endDate || startDate);

        return (
          (checkStart >= courseStart && checkStart <= courseEnd) ||
          (checkEnd >= courseStart && checkEnd <= courseEnd) ||
          (checkStart <= courseStart && checkEnd >= courseEnd)
        );
      });

      res.json({
        instructorId: instructorId,
        isAvailable: isAvailable,
        conflictingCourses: conflictingCourses,
        availableDays: instructor.availableDays || [],
        preferredCourseTypes: instructor.preferredCourseTypes || [],
      });
    } catch (error) {
      console.error("❌ Error checking instructor availability:", error);
      res.status(500).json({ error: "Failed to check availability" });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate average rating for an instructor
   * @param {Object} instructor - Instructor document
   * @returns {number} Average rating
   */
  static calculateAverageRating(instructor) {
    if (
      !instructor.ratings ||
      !instructor.ratings.courseRatings ||
      instructor.ratings.courseRatings.length === 0
    ) {
      return 0;
    }

    const sum = instructor.ratings.courseRatings.reduce(
      (acc, rating) => acc + rating.rating,
      0
    );
    return (sum / instructor.ratings.courseRatings.length).toFixed(1);
  }

  /**
   * Get upcoming courses for an instructor
   * @param {Object} instructor - Instructor document
   * @returns {Array} Array of upcoming courses
   */
  static getUpcomingCourses(instructor) {
    if (!instructor.assignedCourses) return [];

    const now = new Date();
    return instructor.assignedCourses.filter(
      (course) =>
        new Date(course.startDate) > now && course.status === "Upcoming"
    );
  }

  /**
   * Get current courses for an instructor
   * @param {Object} instructor - Instructor document
   * @returns {Array} Array of current courses
   */
  static getCurrentCourses(instructor) {
    if (!instructor.assignedCourses) return [];

    const now = new Date();
    return instructor.assignedCourses.filter((course) => {
      const start = new Date(course.startDate);
      const end = new Date(course.endDate || course.startDate);
      return start <= now && end >= now && course.status === "In Progress";
    });
  }

  /**
   * Get completed courses for an instructor
   * @param {Object} instructor - Instructor document
   * @returns {Array} Array of completed courses
   */
  static getCompletedCourses(instructor) {
    if (!instructor.assignedCourses) return [];

    return instructor.assignedCourses.filter(
      (course) => course.status === "Completed"
    );
  }

  /**
   * Get related instructors (same expertise area)
   * @param {Object} instructor - Current instructor
   * @returns {Array} Array of related instructors
   */
  static async getRelatedInstructors(instructor) {
    try {
      if (!instructor.expertise || instructor.expertise.length === 0) {
        return [];
      }

      const relatedInstructors = await Instructor.find({
        _id: { $ne: instructor._id }, // Exclude current instructor
        isDeleted: false,
        status: "Active",
        expertise: { $in: instructor.expertise },
      })
        .limit(4)
        .select("firstName lastName profileImage expertise designation")
        .lean();

      return relatedInstructors.map((inst) => ({
        ...inst,
        fullName: `${inst.firstName} ${inst.lastName}`,
        primaryExpertise: inst.expertise?.[0] || "",
        profileUrl: `/our-instructors/${inst._id}`,
      }));
    } catch (error) {
      console.error("❌ Error fetching related instructors:", error);
      return [];
    }
  }

  /**
   * Get instructor statistics for admin dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getInstructorStats(req, res) {
    try {
      const stats = await Instructor.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalInstructors: { $sum: 1 },
            activeInstructors: {
              $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] },
            },
            inactiveInstructors: {
              $sum: { $cond: [{ $eq: ["$status", "Inactive"] }, 1, 0] },
            },
            onLeaveInstructors: {
              $sum: { $cond: [{ $eq: ["$status", "On Leave"] }, 1, 0] },
            },
            averageExperience: { $avg: { $toDouble: "$experience" } },
            totalCourses: {
              $sum: { $size: { $ifNull: ["$assignedCourses", []] } },
            },
          },
        },
      ]);

      const expertiseStats = await Instructor.aggregate([
        { $match: { isDeleted: false, status: "Active" } },
        { $unwind: { path: "$expertise", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$expertise", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      res.json({
        success: true,
        stats: stats[0] || {
          totalInstructors: 0,
          activeInstructors: 0,
          inactiveInstructors: 0,
          onLeaveInstructors: 0,
          averageExperience: 0,
          totalCourses: 0,
        },
        expertiseStats: expertiseStats,
      });
    } catch (error) {
      console.error("❌ Error fetching instructor stats:", error);
      res.status(500).json({ error: "Failed to fetch instructor statistics" });
    }
  }
}

module.exports = InstructorViewController;
