const express = require("express");
const router = express.Router();

// Middleware to check if user is support staff
const requireSupportAccess = (req, res, next) => {
  if (!req.isAuthenticated() || req.user.role !== "support") {
    return res.status(403).json({
      success: false,
      error: "Support staff access required",
    });
  }
  next();
};

// Get all cases assigned to the current support staff member
router.get("/my-cases", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");

    // Find the support team member by linked user ID
    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "supportInfo.supportStatus": "active",
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Support team member not found",
      });
    }

    // Return assigned cases
    res.json({
      success: true,
      data: {
        supportInfo: {
          supportId: supportMember.supportInfo.supportId,
          supportName: supportMember.supportInfo.supportName,
          totalCases: supportMember.assignedCases.length,
        },
        cases: supportMember.assignedCases,
        statistics: {
          total: supportMember.assignedCases.length,
          notStarted: supportMember.assignedCases.filter(
            (c) => c.applicantStatus.currentStatus === "not-started"
          ).length,
          underContact: supportMember.assignedCases.filter(
            (c) => c.applicantStatus.currentStatus === "under-contact"
          ).length,
          interested: supportMember.assignedCases.filter(
            (c) =>
              c.applicantStatus.currentStatus === "interested-not-registered"
          ).length,
          paymentPending: supportMember.assignedCases.filter(
            (c) => c.applicantStatus.currentStatus === "payment-pending"
          ).length,
          registered: supportMember.assignedCases.filter(
            (c) => c.applicantStatus.currentStatus === "registered-course"
          ).length,
          highPriority: supportMember.assignedCases.filter(
            (c) =>
              c.caseInfo.priority === "high" || c.caseInfo.priority === "urgent"
          ).length,
          overdue: supportMember.assignedCases.filter((c) => {
            return (
              c.applicantStatus.nextFollowUpDate &&
              c.applicantStatus.nextFollowUpDate < new Date()
            );
          }).length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching my cases:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get specific case details
router.get("/case/:caseId", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");
    const { caseId } = req.params;

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "assignedCases.caseInfo.caseId": caseId,
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Case not found or not assigned to you",
      });
    }

    const case_ = supportMember.assignedCases.find(
      (c) => c.caseInfo.caseId === caseId
    );

    res.json({
      success: true,
      data: case_,
    });
  } catch (error) {
    console.error("Error fetching case details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add follow-up record to a case
router.post(
  "/case/:caseId/follow-up",
  requireSupportAccess,
  async (req, res) => {
    try {
      const SupportTeam = require("../models/supportTeam");
      const { caseId } = req.params;
      const followUpData = req.body;

      const supportMember = await SupportTeam.findOne({
        "supportInfo.linkedUserId": req.user._id,
        "assignedCases.caseInfo.caseId": caseId,
      });

      if (!supportMember) {
        return res.status(404).json({
          success: false,
          error: "Case not found or not assigned to you",
        });
      }

      // Find the case and add follow-up
      const caseIndex = supportMember.assignedCases.findIndex(
        (c) => c.caseInfo.caseId === caseId
      );
      if (caseIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      const case_ = supportMember.assignedCases[caseIndex];

      // Add follow-up record
      const followUpNumber = case_.followUpRecords.length + 1;
      case_.followUpRecords.push({
        followUpNumber: followUpNumber,
        followUpName: followUpData.name,
        followUpDate: new Date(),
        followUpType: followUpData.type,
        duration: followUpData.duration,
        outcome: followUpData.outcome,
        feedbackAfterFollowUp: followUpData.feedback,
        nextActionRequired: followUpData.nextAction,
        nextActionDate: followUpData.nextActionDate
          ? new Date(followUpData.nextActionDate)
          : null,
        recordedBy: req.user.firstName + " " + req.user.lastName,
      });

      // Update case metrics
      case_.applicantStatus.lastContactDate = new Date();
      if (followUpData.nextActionDate) {
        case_.applicantStatus.nextFollowUpDate = new Date(
          followUpData.nextActionDate
        );
      }

      case_.caseMetrics.totalInteractions++;

      await supportMember.save();

      res.json({
        success: true,
        message: "Follow-up record added successfully",
        data: {
          followUpNumber: followUpNumber,
          totalFollowUps: case_.followUpRecords.length,
        },
      });
    } catch (error) {
      console.error("Error adding follow-up:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Update case status
router.put("/case/:caseId/status", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");
    const { caseId } = req.params;
    const { status, reason } = req.body;

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "assignedCases.caseInfo.caseId": caseId,
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Case not found or not assigned to you",
      });
    }

    // Update case status using the existing method
    await supportMember.updateCaseStatus(caseId, status, reason);

    res.json({
      success: true,
      message: "Case status updated successfully",
    });
  } catch (error) {
    console.error("Error updating case status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Send email communication
router.post("/case/:caseId/email", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");
    const { caseId } = req.params;
    const emailData = req.body;

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "assignedCases.caseInfo.caseId": caseId,
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Case not found or not assigned to you",
      });
    }

    // Add email communication using the existing method
    await supportMember.addEmailCommunication(caseId, {
      emailType: emailData.type,
      subject: emailData.subject,
      sentTo: [emailData.recipientEmail],
      emailContent: emailData.content,
      templateUsed: emailData.template,
    });

    res.json({
      success: true,
      message: "Email communication recorded successfully",
    });
  } catch (error) {
    console.error("Error recording email communication:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add course interest to a case
router.post(
  "/case/:caseId/course-interest",
  requireSupportAccess,
  async (req, res) => {
    try {
      const SupportTeam = require("../models/supportTeam");
      const { caseId } = req.params;
      const courseData = req.body;

      const supportMember = await SupportTeam.findOne({
        "supportInfo.linkedUserId": req.user._id,
        "assignedCases.caseInfo.caseId": caseId,
      });

      if (!supportMember) {
        return res.status(404).json({
          success: false,
          error: "Case not found or not assigned to you",
        });
      }

      // Find the case
      const case_ = supportMember.assignedCases.find(
        (c) => c.caseInfo.caseId === caseId
      );
      if (!case_) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      // Add course interest
      case_.interestedCourses.push({
        courseId: courseData.courseId,
        courseType: courseData.courseType,
        courseSnapshot: courseData.courseSnapshot,
        interestLevel: courseData.interestLevel || "medium",
        quotedPrice: courseData.quotedPrice,
        discountOffered: courseData.discountOffered,
        finalQuotedPrice: courseData.finalQuotedPrice,
        validUntil: courseData.validUntil
          ? new Date(courseData.validUntil)
          : null,
        courseStatus: "interested",
      });

      // Update case metrics
      case_.applicantStatus.totalCoursesInterested =
        case_.interestedCourses.length;
      case_.applicantStatus.estimatedValue = case_.interestedCourses.reduce(
        (sum, course) =>
          sum + (course.finalQuotedPrice || course.quotedPrice || 0),
        0
      );

      await supportMember.save();

      res.json({
        success: true,
        message: "Course interest added successfully",
        data: {
          totalCourses: case_.interestedCourses.length,
          estimatedValue: case_.applicantStatus.estimatedValue,
        },
      });
    } catch (error) {
      console.error("Error adding course interest:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Transfer case to user model
router.post(
  "/case/:caseId/transfer",
  requireSupportAccess,
  async (req, res) => {
    try {
      const SupportTeam = require("../models/supportTeam");
      const { caseId } = req.params;

      const supportMember = await SupportTeam.findOne({
        "supportInfo.linkedUserId": req.user._id,
        "assignedCases.caseInfo.caseId": caseId,
      });

      if (!supportMember) {
        return res.status(404).json({
          success: false,
          error: "Case not found or not assigned to you",
        });
      }

      // Use the existing transfer method
      const transferResult = await supportMember.transferToUser(caseId);

      res.json({
        success: true,
        message: "Case transferred to user model successfully",
        data: transferResult,
      });
    } catch (error) {
      console.error("Error transferring case:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Get performance statistics for current support staff
router.get("/my-performance", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "supportInfo.supportStatus": "active",
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Support team member not found",
      });
    }

    const performance = supportMember.supportInfo.performance;
    const cases = supportMember.assignedCases;

    // Calculate additional metrics
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthCases = cases.filter(
      (c) => c.caseInfo.dateCreated >= thisMonth
    );

    const thisMonthConversions = thisMonthCases.filter(
      (c) => c.applicantStatus.currentStatus === "registered-course"
    );

    res.json({
      success: true,
      data: {
        overall: {
          totalCasesHandled: performance.totalCasesHandled,
          successfulConversions: performance.successfulConversions,
          conversionRate: performance.conversionRate,
          averageResponseTime: performance.averageResponseTime,
        },
        thisMonth: {
          newCases: thisMonthCases.length,
          conversions: thisMonthConversions.length,
          conversionRate:
            thisMonthCases.length > 0
              ? Math.round(
                  (thisMonthConversions.length / thisMonthCases.length) * 100
                )
              : 0,
        },
        caseBreakdown: {
          total: cases.length,
          notStarted: cases.filter(
            (c) => c.applicantStatus.currentStatus === "not-started"
          ).length,
          inProgress: cases.filter((c) =>
            [
              "under-contact",
              "interested-not-registered",
              "payment-pending",
            ].includes(c.applicantStatus.currentStatus)
          ).length,
          completed: cases.filter((c) =>
            ["registered-course", "completed-course"].includes(
              c.applicantStatus.currentStatus
            )
          ).length,
        },
        revenue: {
          totalEstimated: cases.reduce(
            (sum, c) => sum + (c.applicantStatus.estimatedValue || 0),
            0
          ),
          totalActual: cases.reduce(
            (sum, c) => sum + (c.applicantStatus.actualValue || 0),
            0
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching performance data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Upload document for a case
router.post(
  "/case/:caseId/document",
  requireSupportAccess,
  async (req, res) => {
    try {
      const SupportTeam = require("../models/supportTeam");
      const { caseId } = req.params;
      const documentData = req.body;

      const supportMember = await SupportTeam.findOne({
        "supportInfo.linkedUserId": req.user._id,
        "assignedCases.caseInfo.caseId": caseId,
      });

      if (!supportMember) {
        return res.status(404).json({
          success: false,
          error: "Case not found or not assigned to you",
        });
      }

      // Find the case
      const case_ = supportMember.assignedCases.find(
        (c) => c.caseInfo.caseId === caseId
      );
      if (!case_) {
        return res.status(404).json({
          success: false,
          error: "Case not found",
        });
      }

      // Add document to case documents
      case_.caseDocuments.push({
        documentType: documentData.type,
        filename: documentData.filename,
        originalName: documentData.originalName,
        url: documentData.url,
        fileSize: documentData.fileSize,
        mimeType: documentData.mimeType,
        description: documentData.description,
        uploadedBy: req.user.firstName + " " + req.user.lastName,
        relatedCourseId: documentData.relatedCourseId,
      });

      await supportMember.save();

      res.json({
        success: true,
        message: "Document uploaded successfully",
        data: {
          totalDocuments: case_.caseDocuments.length,
        },
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Get available courses for adding to case
router.get("/available-courses", requireSupportAccess, async (req, res) => {
  try {
    // Get courses from all three types
    const InPersonCourse = require("../models/inPersonAestheticTraining");
    const OnlineLiveCourse = require("../models/onlineLiveTraining");
    const SelfPacedCourse = require("../models/selfPacedOnlineTraining");

    const [inPersonCourses, onlineLiveCourses, selfPacedCourses] =
      await Promise.all([
        InPersonCourse.find({ "basic.status": { $in: ["open", "full"] } })
          .select(
            "basic.courseCode basic.title basic.category enrollment.price enrollment.currency schedule.startDate"
          )
          .sort({ "schedule.startDate": 1 }),

        OnlineLiveCourse.find({ "basic.status": { $in: ["open", "full"] } })
          .select(
            "basic.courseCode basic.title basic.category enrollment.price enrollment.currency schedule.startDate"
          )
          .sort({ "schedule.startDate": 1 }),

        SelfPacedCourse.find({ "basic.status": { $in: ["open", "active"] } })
          .select(
            "basic.courseCode basic.title basic.category pricing.price pricing.currency"
          )
          .sort({ "basic.title": 1 }),
      ]);

    // Format courses for frontend
    const formattedCourses = [
      ...inPersonCourses.map((course) => ({
        id: course._id,
        type: "InPersonAestheticTraining",
        code: course.basic.courseCode,
        title: course.basic.title,
        category: course.basic.category,
        price: course.enrollment.price,
        currency: course.enrollment.currency,
        startDate: course.schedule.startDate,
      })),
      ...onlineLiveCourses.map((course) => ({
        id: course._id,
        type: "OnlineLiveTraining",
        code: course.basic.courseCode,
        title: course.basic.title,
        category: course.basic.category,
        price: course.enrollment.price,
        currency: course.enrollment.currency,
        startDate: course.schedule.startDate,
      })),
      ...selfPacedCourses.map((course) => ({
        id: course._id,
        type: "SelfPacedOnlineTraining",
        code: course.basic.courseCode,
        title: course.basic.title,
        category: course.basic.category,
        price: course.pricing.price,
        currency: course.pricing.currency,
        startDate: null, // Self-paced courses don't have start dates
      })),
    ];

    res.json({
      success: true,
      data: formattedCourses,
      count: formattedCourses.length,
    });
  } catch (error) {
    console.error("Error fetching available courses:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create a new case manually
router.post("/create-case", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");
    const caseData = req.body;

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "supportInfo.supportStatus": "active",
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Support team member not found",
      });
    }

    // Create new case using existing method
    const newCase = supportMember.addNewCase({
      name: caseData.name,
      email: caseData.email,
      phone: caseData.phone,
      medicalSpecialty: caseData.medicalSpecialty,
      message: caseData.message,
      source: "manual-entry",
      courseOfInterest: caseData.courseOfInterest,
      experienceLevel: caseData.experienceLevel,
      country: caseData.country,
    });

    await supportMember.save();

    res.json({
      success: true,
      message: "New case created successfully",
      data: {
        caseId: newCase.caseInfo.caseId,
        totalCases: supportMember.assignedCases.length,
      },
    });
  } catch (error) {
    console.error("Error creating new case:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get dashboard summary
router.get("/dashboard-summary", requireSupportAccess, async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");

    const supportMember = await SupportTeam.findOne({
      "supportInfo.linkedUserId": req.user._id,
      "supportInfo.supportStatus": "active",
    });

    if (!supportMember) {
      return res.status(404).json({
        success: false,
        error: "Support team member not found",
      });
    }

    const cases = supportMember.assignedCases;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const summary = {
      supportInfo: {
        supportId: supportMember.supportInfo.supportId,
        supportName: supportMember.supportInfo.supportName,
        email: supportMember.supportInfo.supportEmail,
      },
      caseStats: {
        total: cases.length,
        notStarted: cases.filter(
          (c) => c.applicantStatus.currentStatus === "not-started"
        ).length,
        underContact: cases.filter(
          (c) => c.applicantStatus.currentStatus === "under-contact"
        ).length,
        interested: cases.filter(
          (c) => c.applicantStatus.currentStatus === "interested-not-registered"
        ).length,
        paymentPending: cases.filter(
          (c) => c.applicantStatus.currentStatus === "payment-pending"
        ).length,
        registered: cases.filter(
          (c) => c.applicantStatus.currentStatus === "registered-course"
        ).length,
        highPriority: cases.filter(
          (c) =>
            c.caseInfo.priority === "high" || c.caseInfo.priority === "urgent"
        ).length,
        overdue: cases.filter(
          (c) =>
            c.applicantStatus.nextFollowUpDate &&
            c.applicantStatus.nextFollowUpDate < new Date()
        ).length,
        todayFollowUps: cases.filter((c) => {
          if (!c.applicantStatus.nextFollowUpDate) return false;
          const followUpDate = new Date(c.applicantStatus.nextFollowUpDate);
          return followUpDate >= today && followUpDate < tomorrow;
        }).length,
      },
      performance: supportMember.supportInfo.performance,
      recentActivity: {
        lastLogin: new Date(), // This would come from session data
        casesUpdatedToday: cases.filter((c) => {
          if (
            !c.applicantStatus.statusHistory ||
            c.applicantStatus.statusHistory.length === 0
          )
            return false;
          const lastUpdate =
            c.applicantStatus.statusHistory[
              c.applicantStatus.statusHistory.length - 1
            ].date;
          return lastUpdate >= today;
        }).length,
      },
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
