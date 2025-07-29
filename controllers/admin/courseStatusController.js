// controllers/admin/courseStatusController.js

const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../../models/selfPacedOnlineTrainingModel");

const User = require("../../models/user");

/**
 * Course Status Controller
 * Handles admin course status monitoring across all course types
 */

// Render main course status page
exports.renderCourseStatusPage = async (req, res) => {
  try {
    console.log("📊 Rendering course status page for admin:", req.user.email);

    // Get all courses from all models
    const [inPersonCourses, onlineLiveCourses, selfPacedCourses] =
      await Promise.all([
        InPersonAestheticTraining.find(
          {},
          "basic.courseCode basic.title basic.status enrollment.seatsAvailable enrollment.currentEnrollment schedule.startDate venue.city venue.country"
        ).sort({ "basic.courseCode": 1 }),
        OnlineLiveTraining.find(
          {},
          "basic.courseCode basic.title basic.status enrollment.seatsAvailable enrollment.currentEnrollment schedule.startDate schedule.primaryTimezone platform.name"
        ).sort({ "basic.courseCode": 1 }),
        SelfPacedOnlineTraining.find(
          {},
          "basic.courseCode basic.title basic.status access.totalEnrollments instructor.name"
        ).sort({ "basic.courseCode": 1 }),
      ]);

    // Combine all courses into unified format
    const allCourses = [
      ...inPersonCourses.map((course) => ({
        _id: course._id,
        courseCode: course.basic.courseCode,
        title: course.basic.title,
        status: course.basic.status,
        type: "In-Person",
        typeClass: "in-person",
        seatsAvailable: course.enrollment?.seatsAvailable || 0,
        currentEnrollment: course.enrollment?.currentEnrollment || 0,
        startDate: course.schedule?.startDate,
        location: course.venue
          ? `${course.venue.city}, ${course.venue.country}`
          : "TBD",
        platform: "Physical Location",
      })),
      ...onlineLiveCourses.map((course) => ({
        _id: course._id,
        courseCode: course.basic.courseCode,
        title: course.basic.title,
        status: course.basic.status,
        type: "Online Live",
        typeClass: "online-live",
        seatsAvailable: course.enrollment?.seatsAvailable || 0,
        currentEnrollment: course.enrollment?.currentEnrollment || 0,
        startDate: course.schedule?.startDate,
        location: course.schedule?.primaryTimezone || "UTC",
        platform: course.platform?.name || "Online Platform",
      })),
      ...selfPacedCourses.map((course) => ({
        _id: course._id,
        courseCode: course.basic.courseCode,
        title: course.basic.title,
        status: course.basic.status,
        type: "Self-Paced",
        typeClass: "self-paced",
        seatsAvailable: "Unlimited",
        currentEnrollment: course.access?.totalEnrollments || 0,
        startDate: null,
        location: "Online",
        platform: "Self-Paced Platform",
      })),
    ];

    // Sort by course code
    allCourses.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    // Calculate summary statistics
    const summary = {
      totalCourses: allCourses.length,
      inPersonCount: inPersonCourses.length,
      onlineLiveCount: onlineLiveCourses.length,
      selfPacedCount: selfPacedCourses.length,
      totalEnrollments: allCourses.reduce((sum, course) => {
        return (
          sum +
          (typeof course.currentEnrollment === "number"
            ? course.currentEnrollment
            : 0)
        );
      }, 0),
      activeCourses: allCourses.filter(
        (course) => course.status === "open" || course.status === "published"
      ).length,
    };

    // FIXED: Use the correct template name
    res.render("admin/course-status", {
      title: "Course Status Monitor - IAAI Admin",
      user: req.user,
      courses: allCourses,
      summary: summary,
    });
  } catch (error) {
    console.error("❌ Error rendering course status page:", error);
    req.flash("error_message", "Failed to load course status page");
    res.redirect("/dashboard");
  }
};

// Get course details and registered users
exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId, courseType } = req.params;
    console.log(
      `📋 Getting details for course: ${courseId}, type: ${courseType}`
    );

    let course;
    let courseModel;
    let courseData = {};

    // Get course based on type
    switch (courseType) {
      case "in-person":
        courseModel = InPersonAestheticTraining;
        course = await InPersonAestheticTraining.findById(courseId)
          .populate(
            "instructors.primary.instructorId",
            "firstName lastName fullName"
          )
          .populate(
            "instructors.additional.instructorId",
            "firstName lastName fullName"
          );

        if (course) {
          courseData = {
            _id: course._id,
            courseCode: course.basic.courseCode,
            title: course.basic.title,
            status: course.basic.status,
            type: "In-Person",
            typeClass: "in-person",
            seatsAvailable: course.enrollment?.seatsAvailable || 0,
            currentEnrollment: course.enrollment?.currentEnrollment || 0,
            price: course.enrollment?.price || 0,
            currency: course.enrollment?.currency || "EUR",
            startDate: course.schedule?.startDate,
            endDate: course.schedule?.endDate,
            location: course.venue
              ? `${course.venue.name}, ${course.venue.city}, ${course.venue.country}`
              : "TBD",
            instructors: [
              ...(course.instructors?.primary?.name
                ? [course.instructors.primary.name]
                : []),
              ...(course.instructors?.additional?.map((inst) => inst.name) ||
                []),
            ].join(", "),
            registrationDeadline: course.schedule?.registrationDeadline,
          };
        }
        break;

      case "online-live":
        courseModel = OnlineLiveTraining;
        course = await OnlineLiveTraining.findById(courseId)
          .populate(
            "instructors.primary.instructorId",
            "firstName lastName fullName"
          )
          .populate(
            "instructors.additional.instructorId",
            "firstName lastName fullName"
          );

        if (course) {
          courseData = {
            _id: course._id,
            courseCode: course.basic.courseCode,
            title: course.basic.title,
            status: course.basic.status,
            type: "Online Live",
            typeClass: "online-live",
            seatsAvailable: course.enrollment?.seatsAvailable || 0,
            currentEnrollment: course.enrollment?.currentEnrollment || 0,
            price: course.enrollment?.price || 0,
            currency: course.enrollment?.currency || "EUR",
            startDate: course.schedule?.startDate,
            endDate: course.schedule?.endDate,
            location: `${course.schedule?.primaryTimezone || "UTC"} (${
              course.platform?.name || "Online"
            })`,
            instructors: [
              ...(course.instructors?.primary?.name
                ? [course.instructors.primary.name]
                : []),
              ...(course.instructors?.additional?.map((inst) => inst.name) ||
                []),
            ].join(", "),
            registrationDeadline: course.schedule?.registrationDeadline,
            platform: course.platform?.name,
            accessUrl: course.platform?.accessUrl,
          };
        }
        break;

      case "self-paced":
        courseModel = SelfPacedOnlineTraining;
        course = await SelfPacedOnlineTraining.findById(courseId).populate(
          "instructor.instructorId",
          "firstName lastName fullName"
        );

        if (course) {
          courseData = {
            _id: course._id,
            courseCode: course.basic.courseCode,
            title: course.basic.title,
            status: course.basic.status,
            type: "Self-Paced",
            typeClass: "self-paced",
            seatsAvailable: "Unlimited",
            currentEnrollment: course.access?.totalEnrollments || 0,
            price: course.access?.price || 0,
            currency: course.access?.currency || "USD",
            startDate: null,
            endDate: null,
            location: "Online",
            instructors: course.instructor?.name || "TBD",
            accessDays: course.access?.accessDays || 365,
            totalVideos: course.content?.totalVideos || 0,
            estimatedMinutes: course.content?.estimatedMinutes || 0,
          };
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid course type",
        });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // FIXED: Query users based on course type and correct field names
    let userQuery = {};
    let courseArrayField = "";

    switch (courseType) {
      case "in-person":
        userQuery = { "myInPersonCourses.courseId": courseId };
        courseArrayField = "myInPersonCourses";
        break;
      case "online-live":
        userQuery = { "myLiveCourses.courseId": courseId };
        courseArrayField = "myLiveCourses";
        break;
      case "self-paced":
        userQuery = { "mySelfPacedCourses.courseId": courseId };
        courseArrayField = "mySelfPacedCourses";
        break;
      default:
        // Fallback: search in all course arrays
        userQuery = {
          $or: [
            { "myInPersonCourses.courseId": courseId },
            { "myLiveCourses.courseId": courseId },
            { "mySelfPacedCourses.courseId": courseId },
          ],
        };
        break;
    }

    console.log(`🔍 Searching for users with query:`, userQuery);

    const registeredUsers = await User.find(userQuery)
      .select(
        "firstName lastName email phoneNumber country profession registrationDate totalSpent paymentTransactions myInPersonCourses myLiveCourses mySelfPacedCourses myWishlist isConfirmed"
      )
      .sort({ firstName: 1 });

    console.log(
      `🔍 Found ${registeredUsers.length} users for course ${courseId} (${courseType})`
    );

    // FIXED: Process user data with correct field mapping
    const processedUsers = registeredUsers.map((user) => {
      let userCourse = null;

      // Find the course enrollment in the appropriate array
      switch (courseType) {
        case "in-person":
          userCourse = user.myInPersonCourses?.find(
            (c) => c.courseId.toString() === courseId
          );
          break;
        case "online-live":
          userCourse = user.myLiveCourses?.find(
            (c) => c.courseId.toString() === courseId
          );
          break;
        case "self-paced":
          userCourse = user.mySelfPacedCourses?.find(
            (c) => c.courseId.toString() === courseId
          );
          break;
        default:
          // Search all arrays
          userCourse =
            user.myInPersonCourses?.find(
              (c) => c.courseId.toString() === courseId
            ) ||
            user.myLiveCourses?.find(
              (c) => c.courseId.toString() === courseId
            ) ||
            user.mySelfPacedCourses?.find(
              (c) => c.courseId.toString() === courseId
            );
          break;
      }

      // Find payment for this course
      const coursePayment = user.paymentTransactions?.find((payment) =>
        payment.items?.some((item) => item.courseId.toString() === courseId)
      );

      return {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phoneNumber || "Not provided",
        country: user.country || "Not specified",
        profession: user.profession || "Not specified",
        registrationDate:
          userCourse?.enrollmentData?.registrationDate || user.registrationDate,
        courseStatus:
          userCourse?.enrollmentData?.status ||
          userCourse?.courseProgress?.status ||
          "enrolled",
        completionDate:
          userCourse?.courseProgress?.completedDate ||
          userCourse?.userProgress?.completionDate,
        paymentStatus: coursePayment
          ? "Paid"
          : userCourse?.enrollmentData?.paidAmount === 0
          ? "Free"
          : "Pending",
        paymentMethod: coursePayment?.paymentMethod || "N/A",
        amountPaid: coursePayment
          ? coursePayment.financial?.finalAmount ||
            coursePayment.totalAmount ||
            0
          : userCourse?.enrollmentData?.paidAmount || 0,
        promoCodeUsed:
          coursePayment?.discounts?.promoCode ||
          userCourse?.enrollmentData?.promoCodeUsed ||
          "None",
        discountApplied:
          coursePayment?.financial?.discountAmount ||
          coursePayment?.discountAmount ||
          0,
        isConfirmed: user.isConfirmed,
        totalSpent: user.totalSpent || 0,
        wishlistCount: user.myWishlist?.length || 0,
        paymentDate:
          coursePayment?.transactionDate || coursePayment?.paymentDate,
        originalPrice: userCourse?.enrollmentData?.originalPrice || 0,
        currency: userCourse?.enrollmentData?.currency || "EUR",
      };
    });

    // Calculate statistics
    const stats = {
      totalRegistered: processedUsers.length,
      confirmedUsers: processedUsers.filter((u) => u.isConfirmed).length,
      paidUsers: processedUsers.filter((u) => u.paymentStatus === "Paid")
        .length,
      freeUsers: processedUsers.filter(
        (u) => u.paymentStatus === "Free" || u.amountPaid === 0
      ).length,
      completedUsers: processedUsers.filter(
        (u) => u.courseStatus === "completed" || u.courseStatus === "finished"
      ).length,
      totalRevenue: processedUsers.reduce(
        (sum, u) => sum + (u.amountPaid || 0),
        0
      ),
      promoCodeUsers: processedUsers.filter(
        (u) =>
          u.promoCodeUsed &&
          u.promoCodeUsed !== "None" &&
          u.promoCodeUsed !== ""
      ).length,
      totalDiscount: processedUsers.reduce(
        (sum, u) => sum + (u.discountApplied || 0),
        0
      ),
      seatsRemaining:
        courseData.seatsAvailable === "Unlimited"
          ? "Unlimited"
          : Math.max(
              0,
              courseData.seatsAvailable - courseData.currentEnrollment
            ),
    };

    res.json({
      success: true,
      course: courseData,
      users: processedUsers,
      stats: stats,
    });
  } catch (error) {
    console.error("❌ Error getting course details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load course details",
    });
  }
};

// Export course data
exports.exportCourseData = async (req, res) => {
  try {
    const { courseId, courseType, format } = req.query;
    console.log(`📤 Exporting course data: ${courseId}, format: ${format}`);

    if (!courseId || !courseType || !format) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // FIXED: Get course details with proper request/response mocking
    const mockReq = { params: { courseId, courseType } };
    const mockRes = {
      json: (data) => data,
      status: () => mockRes,
    };

    const detailsResponse = await this.getCourseDetails(mockReq, mockRes);

    if (!detailsResponse.success) {
      return res.status(404).json(detailsResponse);
    }

    const { course, users, stats } = detailsResponse;

    if (format === "csv") {
      // Generate CSV
      const csvHeader = [
        "Name",
        "Email",
        "Phone",
        "Country",
        "Profession",
        "Registration Date",
        "Course Status",
        "Payment Status",
        "Amount Paid",
        "Promo Code",
        "Discount Applied",
        "Payment Method",
        "Payment Date",
        "Confirmed",
      ].join(",");

      const csvRows = users.map((user) =>
        [
          `"${user.name}"`,
          `"${user.email}"`,
          `"${user.phone}"`,
          `"${user.country}"`,
          `"${user.profession}"`,
          user.registrationDate
            ? new Date(user.registrationDate).toLocaleDateString()
            : "",
          user.courseStatus,
          user.paymentStatus,
          user.amountPaid,
          user.promoCodeUsed,
          user.discountApplied,
          user.paymentMethod,
          user.paymentDate
            ? new Date(user.paymentDate).toLocaleDateString()
            : "",
          user.isConfirmed ? "Yes" : "No",
        ].join(",")
      );

      const csvContent = [csvHeader, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${course.courseCode}_registrations.csv"`
      );
      res.send(csvContent);
    } else if (format === "json") {
      // Generate JSON
      const exportData = {
        course: course,
        statistics: stats,
        registrations: users,
        exportDate: new Date().toISOString(),
        exportedBy: req.user.email,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${course.courseCode}_data.json"`
      );
      res.json(exportData);
    } else {
      res.status(400).json({
        success: false,
        message: "Unsupported export format",
      });
    }
  } catch (error) {
    console.error("❌ Error exporting course data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export course data",
    });
  }
};
