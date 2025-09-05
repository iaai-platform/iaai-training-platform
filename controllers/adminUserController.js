// adminUserController.js
const User = require("../models/user");
const DeletedUser = require("../models/deletedUser");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const crypto = require("crypto");

const adminUserController = {
  // ==========================================
  // USER LIST PAGE - admin-users-manage.ejs
  // ==========================================
  getAllUsersManage: async (req, res) => {
    try {
      const {
        search,
        status,
        role,
        country,
        sortBy = "createdAt",
        order = "desc",
        page = 1,
        limit = 20,
      } = req.query;

      // Build query
      let query = {};

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ];
      }

      if (status) {
        if (status === "confirmed") query.isConfirmed = true;
        else if (status === "pending") query.isConfirmed = false;
        else if (status === "active") query["accountStatus.isActive"] = true;
        else if (status === "locked") query["accountStatus.isLocked"] = true;
      }

      if (role && role !== "all") {
        query.role = role;
      }

      if (country && country !== "all") {
        query.$or = [{ country: country }, { "addressInfo.country": country }];
      }

      // Get users with pagination
      const skip = (page - 1) * limit;
      const sortOrder = order === "desc" ? -1 : 1;

      const users = await User.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .select("-password")
        .lean();

      const totalUsers = await User.countDocuments(query);
      const totalPages = Math.ceil(totalUsers / limit);

      // Calculate statistics for each user
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          // Count enrolled courses
          const enrolledCourses =
            (user.myInPersonCourses?.filter((c) =>
              ["paid", "registered", "completed"].includes(
                c.enrollmentData?.status
              )
            ).length || 0) +
            (user.myLiveCourses?.filter((c) =>
              ["paid", "registered", "completed"].includes(
                c.enrollmentData?.status
              )
            ).length || 0) +
            (user.mySelfPacedCourses?.filter((c) =>
              ["paid", "registered"].includes(c.enrollmentData?.status)
            ).length || 0);

          // Calculate total spent
          const totalSpent =
            user.paymentTransactions?.reduce((sum, transaction) => {
              if (transaction.paymentStatus === "completed") {
                return sum + (transaction.financial?.finalAmount || 0);
              }
              return sum;
            }, 0) || 0;

          // Get location
          const location =
            user.addressInfo?.city && user.addressInfo?.country
              ? `${user.addressInfo.city}, ${user.addressInfo.country}`
              : user.country || "Not specified";

          return {
            ...user,
            enrolledCourses,
            totalSpent: totalSpent.toFixed(2),
            location,
            fullName: `${user.firstName} ${user.lastName}`,
            profileCompletion: calculateProfileCompletion(user),
            lastActivity:
              user.accountStatus?.lastLoginAt ||
              user.updatedAt ||
              user.createdAt,
          };
        })
      );

      // Get unique countries for filter
      const countries = await User.distinct("country").sort();

      res.render("admin-users-manage", {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          limit: parseInt(limit),
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          search,
          status,
          role,
          country,
          sortBy,
          order,
        },
        countries,
        user: req.user,
        title: "User Management",
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).render("error", {
        message: "Failed to load users",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  },

  // ==========================================
  // USER DETAILS PAGE
  // ==========================================
  getUserDetails: async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .populate("myInPersonCourses.courseId")
        .populate("myLiveCourses.courseId")
        .populate("mySelfPacedCourses.courseId")
        .populate("originatedFromSupport.supportTeamId")
        .select("-password")
        .lean();

      if (!user) {
        return res.status(404).render("error", {
          message: "User not found",
          user: req.user,
        });
      }

      // Process enrolled courses with detailed information
      const processedCourses = {
        inPerson: [],
        onlineLive: [],
        selfPaced: [],
      };

      // Process In-Person Courses
      if (user.myInPersonCourses) {
        processedCourses.inPerson = user.myInPersonCourses
          .filter((enrollment) => enrollment.courseId)
          .map((enrollment) => ({
            enrollmentId: enrollment._id,
            courseId: enrollment.courseId._id,
            title:
              enrollment.courseId.basic?.title ||
              enrollment.enrollmentData?.courseName,
            courseCode:
              enrollment.courseId.basic?.courseCode ||
              enrollment.enrollmentData?.courseCode,
            status: enrollment.enrollmentData?.status,
            registrationDate: enrollment.enrollmentData?.registrationDate,
            paidAmount: enrollment.enrollmentData?.paidAmount || 0,
            originalPrice: enrollment.enrollmentData?.originalPrice || 0,
            startDate: enrollment.courseId.schedule?.startDate,
            endDate: enrollment.courseId.schedule?.endDate,
            location: enrollment.courseId.venue?.city,
            attendancePercentage:
              enrollment.userProgress?.overallAttendancePercentage || 0,
            assessmentScore: enrollment.bestAssessmentScore || 0,
            certificateId: enrollment.certificateId,
            courseType: "InPersonAestheticTraining",
          }));
      }

      // Process Online Live Courses
      if (user.myLiveCourses) {
        processedCourses.onlineLive = user.myLiveCourses
          .filter((enrollment) => enrollment.courseId)
          .map((enrollment) => ({
            enrollmentId: enrollment._id,
            courseId: enrollment.courseId._id,
            title:
              enrollment.courseId.basic?.title ||
              enrollment.enrollmentData?.courseName,
            courseCode:
              enrollment.courseId.basic?.courseCode ||
              enrollment.enrollmentData?.courseCode,
            status: enrollment.enrollmentData?.status,
            registrationDate: enrollment.enrollmentData?.registrationDate,
            paidAmount: enrollment.enrollmentData?.paidAmount || 0,
            originalPrice: enrollment.enrollmentData?.originalPrice || 0,
            startDate: enrollment.courseId.schedule?.startDate,
            endDate: enrollment.courseId.schedule?.endDate,
            platform: enrollment.courseId.platform?.name,
            attendancePercentage:
              enrollment.userProgress?.overallAttendancePercentage || 0,
            assessmentScore: enrollment.bestAssessmentScore || 0,
            certificateId: enrollment.certificate?.certificateId,
            courseType: "OnlineLiveTraining",
          }));
      }

      // Process Self-Paced Courses
      if (user.mySelfPacedCourses) {
        processedCourses.selfPaced = user.mySelfPacedCourses
          .filter((enrollment) => enrollment.courseId)
          .map((enrollment) => ({
            enrollmentId: enrollment._id,
            courseId: enrollment.courseId._id,
            title:
              enrollment.courseId.basic?.title ||
              enrollment.enrollmentData?.courseName,
            courseCode:
              enrollment.courseId.basic?.courseCode ||
              enrollment.enrollmentData?.courseCode,
            status: enrollment.enrollmentData?.status,
            registrationDate: enrollment.enrollmentData?.registrationDate,
            paidAmount: enrollment.enrollmentData?.paidAmount || 0,
            originalPrice: enrollment.enrollmentData?.originalPrice || 0,
            expiryDate: enrollment.enrollmentData?.expiryDate,
            progressPercentage:
              enrollment.courseProgress?.overallPercentage || 0,
            lastAccessedAt: enrollment.courseProgress?.lastAccessedAt,
            certificateId: enrollment.certificateId,
            courseType: "SelfPacedOnlineTraining",
          }));
      }

      // Process payment transactions
      const transactions =
        user.paymentTransactions?.map((transaction) => ({
          transactionId: transaction.transactionId,
          orderNumber: transaction.orderNumber,
          date: transaction.transactionDate,
          amount: transaction.financial?.finalAmount || 0,
          currency: transaction.financial?.currency || "EUR",
          status: transaction.paymentStatus,
          paymentMethod: transaction.paymentMethod,
          items: transaction.items?.map((item) => ({
            title: item.courseTitle,
            price: item.finalPrice,
            type: item.courseType,
          })),
        })) || [];

      // Calculate statistics
      const stats = {
        totalCourses:
          processedCourses.inPerson.length +
          processedCourses.onlineLive.length +
          processedCourses.selfPaced.length,
        completedCourses:
          processedCourses.inPerson.filter((c) => c.status === "completed")
            .length +
          processedCourses.onlineLive.filter((c) => c.status === "completed")
            .length +
          processedCourses.selfPaced.filter((c) => c.status === "completed")
            .length,
        totalSpent: transactions
          .filter((t) => t.status === "completed")
          .reduce((sum, t) => sum + t.amount, 0),
        totalTransactions: transactions.length,
        successfulTransactions: transactions.filter(
          (t) => t.status === "completed"
        ).length,
        profileCompletion: calculateProfileCompletion(user),
      };

      // Get activity log
      const activityLog = generateActivityLog(user);

      res.render("admin-user-details", {
        targetUser: user,
        processedCourses,
        transactions,
        stats,
        activityLog,
        user: req.user,
        title: `User Details - ${user.firstName} ${user.lastName}`,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).render("error", {
        message: "Failed to load user details",
        error: process.env.NODE_ENV === "development" ? error : {},
        user: req.user,
      });
    }
  },

  // ==========================================
  // USER ACTIONS
  // ==========================================
  approveUser: async (req, res) => {
    try {
      const { userId } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          isConfirmed: true,
          "accountStatus.isActive": true,
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Send approval email (implement email service)
      // await emailService.sendApprovalEmail(user.email, user.firstName);

      res.json({
        success: true,
        message: "User approved successfully",
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve user",
      });
    }
  },

  rejectUser: async (req, res) => {
    try {
      const { userId, reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Move to deleted users collection with reason
      const deletedUser = new DeletedUser({
        originalId: user._id,
        userData: user.toObject(),
        deletedBy: req.user._id,
        deletedReason: reason || "Registration rejected",
        deletedAt: new Date(),
      });

      await deletedUser.save();
      await User.findByIdAndDelete(userId);

      res.json({
        success: true,
        message: "User rejected and moved to recycle bin",
      });
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject user",
      });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Save to deleted users before removing
      const deletedUser = new DeletedUser({
        originalId: user._id,
        userData: user.toObject(),
        deletedBy: req.user._id,
        deletedReason: reason || "Manual deletion by admin",
        deletedAt: new Date(),
      });

      await deletedUser.save();
      await User.findByIdAndDelete(userId);

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
      });
    }
  },

  // ==========================================
  // COURSE MANAGEMENT
  // ==========================================
  removeCourseFromUser: async (req, res) => {
    try {
      const { userId, enrollmentId, courseType } = req.params;
      const { reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      let courseArray;
      let deletedEnrollment;

      // Find and remove the course based on type
      switch (courseType) {
        case "InPersonAestheticTraining":
          courseArray = user.myInPersonCourses;
          break;
        case "OnlineLiveTraining":
          courseArray = user.myLiveCourses;
          break;
        case "SelfPacedOnlineTraining":
          courseArray = user.mySelfPacedCourses;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Invalid course type",
          });
      }

      const enrollmentIndex = courseArray.findIndex(
        (e) => e._id.toString() === enrollmentId
      );

      if (enrollmentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Enrollment not found",
        });
      }

      // Save deleted enrollment for recovery
      deletedEnrollment = courseArray[enrollmentIndex];

      const deletedCourse = new DeletedCourse({
        userId: userId,
        courseType: courseType,
        enrollmentData: deletedEnrollment.toObject(),
        deletedBy: req.user._id,
        deletedReason: reason || "Manual removal by admin",
        deletedAt: new Date(),
      });

      await deletedCourse.save();

      // Remove from user's courses
      courseArray.splice(enrollmentIndex, 1);
      await user.save();

      res.json({
        success: true,
        message: "Course removed successfully",
        deletedCourseId: deletedCourse._id,
      });
    } catch (error) {
      console.error("Error removing course:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove course",
      });
    }
  },

  // ==========================================
  // PAYMENT ANALYTICS
  // ==========================================
  getPaymentAnalytics: async (req, res) => {
    try {
      const { startDate, endDate, courseType, paymentStatus } = req.query;

      // Build query for transactions
      let query = {};

      if (startDate || endDate) {
        query.transactionDate = {};
        if (startDate) query.transactionDate.$gte = new Date(startDate);
        if (endDate) query.transactionDate.$lte = new Date(endDate);
      }

      if (paymentStatus && paymentStatus !== "all") {
        query.paymentStatus = paymentStatus;
      }

      // Get all users with payment data
      const users = await User.find({})
        .select("firstName lastName email paymentTransactions")
        .lean();

      // Process payment data
      let allTransactions = [];
      let totalRevenue = 0;
      let courseTypeRevenue = {
        InPersonAestheticTraining: 0,
        OnlineLiveTraining: 0,
        SelfPacedOnlineTraining: 0,
      };

      users.forEach((user) => {
        if (user.paymentTransactions) {
          user.paymentTransactions.forEach((transaction) => {
            // Apply filters
            if (query.transactionDate) {
              const txDate = new Date(transaction.transactionDate);
              if (
                query.transactionDate.$gte &&
                txDate < query.transactionDate.$gte
              )
                return;
              if (
                query.transactionDate.$lte &&
                txDate > query.transactionDate.$lte
              )
                return;
            }

            if (
              query.paymentStatus &&
              transaction.paymentStatus !== query.paymentStatus
            )
              return;

            // Add user info to transaction
            const enrichedTransaction = {
              ...transaction,
              userName: `${user.firstName} ${user.lastName}`,
              userEmail: user.email,
              userId: user._id,
            };

            allTransactions.push(enrichedTransaction);

            // Calculate revenue
            if (transaction.paymentStatus === "completed") {
              const amount = transaction.financial?.finalAmount || 0;
              totalRevenue += amount;

              // Revenue by course type
              transaction.items?.forEach((item) => {
                if (courseTypeRevenue[item.courseType] !== undefined) {
                  courseTypeRevenue[item.courseType] += item.finalPrice || 0;
                }
              });
            }
          });
        }
      });

      // Sort transactions by date
      allTransactions.sort(
        (a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)
      );

      // Calculate statistics
      const stats = {
        totalTransactions: allTransactions.length,
        successfulTransactions: allTransactions.filter(
          (t) => t.paymentStatus === "completed"
        ).length,
        failedTransactions: allTransactions.filter(
          (t) => t.paymentStatus === "failed"
        ).length,
        pendingTransactions: allTransactions.filter(
          (t) => t.paymentStatus === "pending"
        ).length,
        totalRevenue: totalRevenue.toFixed(2),
        averageTransactionValue:
          allTransactions.length > 0
            ? (
                totalRevenue /
                allTransactions.filter((t) => t.paymentStatus === "completed")
                  .length
              ).toFixed(2)
            : 0,
        courseTypeRevenue: {
          inPerson: courseTypeRevenue.InPersonAestheticTraining.toFixed(2),
          onlineLive: courseTypeRevenue.OnlineLiveTraining.toFixed(2),
          selfPaced: courseTypeRevenue.SelfPacedOnlineTraining.toFixed(2),
        },
      };

      res.render("admin-payment-analytics", {
        transactions: allTransactions.slice(0, 100), // Limit to 100 for display
        stats,
        filters: {
          startDate,
          endDate,
          courseType,
          paymentStatus,
        },
        user: req.user,
        title: "Payment Analytics",
      });
    } catch (error) {
      console.error("Error fetching payment analytics:", error);
      res.status(500).render("error", {
        message: "Failed to load payment analytics",
        error: process.env.NODE_ENV === "development" ? error : {},
        user: req.user,
      });
    }
  },

  // ==========================================
  // EXPORT FUNCTIONS
  // ==========================================
  exportUserData: async (req, res) => {
    try {
      const { format = "excel" } = req.query;

      const users = await User.find({}).select("-password").lean();

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Users");

        // Add headers
        worksheet.columns = [
          { header: "ID", key: "id", width: 25 },
          { header: "Name", key: "name", width: 30 },
          { header: "Email", key: "email", width: 35 },
          { header: "Phone", key: "phone", width: 20 },
          { header: "Country", key: "country", width: 20 },
          { header: "Role", key: "role", width: 15 },
          { header: "Status", key: "status", width: 15 },
          { header: "Registered", key: "registered", width: 20 },
          { header: "Total Spent (EUR)", key: "spent", width: 18 },
          { header: "Courses Enrolled", key: "courses", width: 18 },
        ];

        // Add data
        users.forEach((user) => {
          const totalSpent =
            user.paymentTransactions?.reduce(
              (sum, t) =>
                t.paymentStatus === "completed"
                  ? sum + (t.financial?.finalAmount || 0)
                  : sum,
              0
            ) || 0;

          const coursesEnrolled =
            (user.myInPersonCourses?.length || 0) +
            (user.myLiveCourses?.length || 0) +
            (user.mySelfPacedCourses?.length || 0);

          worksheet.addRow({
            id: user._id.toString(),
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phoneNumber || "",
            country: user.country || user.addressInfo?.country || "",
            role: user.role,
            status: user.isConfirmed ? "Confirmed" : "Pending",
            registered: user.createdAt,
            spent: totalSpent.toFixed(2),
            courses: coursesEnrolled,
          });
        });

        // Style the header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        // Set response headers
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=users_export_${Date.now()}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
      } else if (format === "csv") {
        // CSV export implementation
        let csv =
          "ID,Name,Email,Phone,Country,Role,Status,Registered,Total Spent (EUR),Courses Enrolled\n";

        users.forEach((user) => {
          const totalSpent =
            user.paymentTransactions?.reduce(
              (sum, t) =>
                t.paymentStatus === "completed"
                  ? sum + (t.financial?.finalAmount || 0)
                  : sum,
              0
            ) || 0;

          const coursesEnrolled =
            (user.myInPersonCourses?.length || 0) +
            (user.myLiveCourses?.length || 0) +
            (user.mySelfPacedCourses?.length || 0);

          csv += `"${user._id}","${user.firstName} ${user.lastName}","${
            user.email
          }","${user.phoneNumber || ""}","${user.country || ""}","${
            user.role
          }","${user.isConfirmed ? "Confirmed" : "Pending"}","${
            user.createdAt
          }","${totalSpent.toFixed(2)}","${coursesEnrolled}"\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=users_export_${Date.now()}.csv`
        );
        res.send(csv);
      }
    } catch (error) {
      console.error("Error exporting user data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export user data",
      });
    }
  },
};

// Helper Functions
function calculateProfileCompletion(user) {
  let completion = 0;
  const weights = {
    basicInfo: 20,
    contactInfo: 15,
    addressInfo: 20,
    professionalInfo: 25,
    profilePicture: 10,
    identification: 10,
  };

  if (user.firstName && user.lastName && user.email)
    completion += weights.basicInfo;
  if (user.phoneNumber && (user.country || user.addressInfo?.country))
    completion += weights.contactInfo;
  if (user.addressInfo?.address && user.addressInfo?.city)
    completion += weights.addressInfo;
  if (user.professionalInfo?.fieldOfStudy)
    completion += weights.professionalInfo;
  if (user.profileData?.profilePicture?.url)
    completion += weights.profilePicture;
  if (user.profileData?.identificationDocument?.url)
    completion += weights.identification;

  return completion;
}

function generateActivityLog(user) {
  const activities = [];

  // Registration
  activities.push({
    date: user.createdAt,
    type: "registration",
    description: "User registered",
  });

  // Course enrollments
  user.myInPersonCourses?.forEach((enrollment) => {
    if (enrollment.enrollmentData?.registrationDate) {
      activities.push({
        date: enrollment.enrollmentData.registrationDate,
        type: "enrollment",
        description: `Enrolled in ${
          enrollment.enrollmentData.courseName || "In-Person Course"
        }`,
      });
    }
  });

  user.myLiveCourses?.forEach((enrollment) => {
    if (enrollment.enrollmentData?.registrationDate) {
      activities.push({
        date: enrollment.enrollmentData.registrationDate,
        type: "enrollment",
        description: `Enrolled in ${
          enrollment.enrollmentData.courseName || "Online Live Course"
        }`,
      });
    }
  });

  user.mySelfPacedCourses?.forEach((enrollment) => {
    if (enrollment.enrollmentData?.registrationDate) {
      activities.push({
        date: enrollment.enrollmentData.registrationDate,
        type: "enrollment",
        description: `Enrolled in ${
          enrollment.enrollmentData.courseName || "Self-Paced Course"
        }`,
      });
    }
  });

  // Payments
  user.paymentTransactions?.forEach((transaction) => {
    activities.push({
      date: transaction.transactionDate,
      type: "payment",
      description: `Payment ${transaction.paymentStatus}: €${
        transaction.financial?.finalAmount || 0
      }`,
    });
  });

  // Last login
  if (user.accountStatus?.lastLoginAt) {
    activities.push({
      date: user.accountStatus.lastLoginAt,
      type: "login",
      description: "Last login",
    });
  }

  // Sort by date (newest first)
  activities.sort((a, b) => new Date(b.date) - new Date(a.date));

  return activities.slice(0, 20); // Return last 20 activities
}

module.exports = adminUserController;
