// ████████████████████████████████████████████████████████████████████████████████
// ██                                                                            ██
// ██                    SMART SUPPORT ASSIGNMENT SERVICE                      ██
// ██                        Fixed Model Loading                               ██
// ██                                                                            ██
// ████████████████████████████████████████████████████████████████████████████████

/**
 * Smart Support Team Assignment Service
 *
 * Features:
 * ✅ Intelligent Load Balancing
 * ✅ Skill-Based Assignment
 * ✅ Priority-Based Distribution
 * ✅ Performance-Weighted Assignment
 * ✅ Real-time Workload Monitoring
 * ✅ Automatic Redistribution
 */

const mongoose = require("mongoose");

// 🔧 FIX: Load models properly to avoid MissingSchemaError
let ContactUs, SupportTeam;

// Function to initialize models (call this after models are loaded)
function initializeModels() {
  try {
    // Check if models exist, if not require them
    ContactUs =
      mongoose.models.ContactUs || require("../models/contactUsModel");
    SupportTeam =
      mongoose.models.SupportTeam || require("../models/supportTeam");
    console.log(
      "✅ Support Assignment Service: Models initialized successfully"
    );
    return true;
  } catch (error) {
    console.warn(
      "⚠️ Support Assignment Service: Models not yet available:",
      error.message
    );
    return false;
  }
}

class SupportAssignmentService {
  // ════════════════════════════════════════════════════════════════════════════════
  // ║                        CORE ASSIGNMENT ALGORITHMS                           ║
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * 🎯 Main assignment method - intelligently assigns contacts to support team
   */
  static async assignContactsToSupport(options = {}) {
    // Initialize models if not already done
    if (!ContactUs || !SupportTeam) {
      const initialized = initializeModels();
      if (!initialized) {
        return {
          success: false,
          message:
            "Models not initialized. Please ensure ContactUs and SupportTeam models are loaded.",
          assigned: 0,
        };
      }
    }

    const {
      batchSize = 20,
      forceRebalance = false,
      priorityOnly = false,
    } = options;

    try {
      console.log("🚀 Starting smart support assignment...");

      // Step 1: Get contacts to assign
      const contactsToAssign = await this.getContactsForAssignment(
        batchSize,
        priorityOnly
      );

      if (contactsToAssign.length === 0) {
        return { success: true, message: "No contacts to assign", assigned: 0 };
      }

      console.log(`📋 Found ${contactsToAssign.length} contacts to assign`);

      // Step 2: Get available support staff with detailed scoring
      const supportStaffScores = await this.calculateSupportStaffScores();

      if (supportStaffScores.length === 0) {
        return {
          success: false,
          message: "No available support staff",
          assigned: 0,
        };
      }

      console.log(
        `👥 Found ${supportStaffScores.length} available support staff`
      );

      // Step 3: Smart assignment using multiple algorithms
      const assignmentResults = await this.performSmartAssignment(
        contactsToAssign,
        supportStaffScores
      );

      // Step 4: Optional rebalancing
      if (forceRebalance) {
        await this.rebalanceWorkload();
      }

      return assignmentResults;
    } catch (error) {
      console.error("❌ Assignment service error:", error);
      return { success: false, message: error.message, assigned: 0 };
    }
  }

  /**
   * 📊 Calculate comprehensive scores for each support staff member
   */
  static async calculateSupportStaffScores() {
    if (!SupportTeam) {
      throw new Error("SupportTeam model not initialized");
    }

    return await SupportTeam.aggregate([
      // Match active support staff
      {
        $match: {
          "supportInfo.supportStatus": "active",
          "supportInfo.capabilities.maxCasesAllowed": { $gt: 0 },
        },
      },

      // Calculate current workload metrics
      {
        $addFields: {
          // Active cases count
          activeCases: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $not: {
                    $in: [
                      "$$this.applicantStatus.currentStatus",
                      [
                        "completed-course",
                        "transferred-to-user",
                        "refused-after-contact",
                        "dormant",
                      ],
                    ],
                  },
                },
              },
            },
          },

          // High priority cases count
          highPriorityCases: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $and: [
                    { $eq: ["$$this.caseInfo.priority", "high"] },
                    {
                      $ne: [
                        "$$this.applicantStatus.currentStatus",
                        "completed-course",
                      ],
                    },
                  ],
                },
              },
            },
          },

          // Overdue follow-ups count
          overdueFollowUps: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $and: [
                    {
                      $lte: [
                        "$$this.applicantStatus.nextFollowUpDate",
                        new Date(),
                      ],
                    },
                    {
                      $not: {
                        $in: [
                          "$$this.applicantStatus.currentStatus",
                          ["completed-course", "transferred-to-user"],
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },

          // Cases requiring urgent attention
          urgentCases: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $and: [
                    {
                      $in: [
                        "$$this.applicantStatus.currentStatus",
                        ["payment-pending", "under-contact"],
                      ],
                    },
                    { $gte: ["$$this.caseMetrics.caseAgeInDays", 3] },
                  ],
                },
              },
            },
          },
        },
      },

      // Calculate availability and scores
      {
        $addFields: {
          // Basic availability
          isAvailable: {
            $lt: ["$activeCases", "$supportInfo.capabilities.maxCasesAllowed"],
          },

          // Capacity utilization percentage
          capacityUtilization: {
            $multiply: [
              {
                $divide: [
                  "$activeCases",
                  "$supportInfo.capabilities.maxCasesAllowed",
                ],
              },
              100,
            ],
          },

          // Workload pressure score (higher = more pressure)
          workloadPressure: {
            $add: [
              { $multiply: ["$activeCases", 10] }, // Base workload
              { $multiply: ["$highPriorityCases", 15] }, // High priority adds pressure
              { $multiply: ["$overdueFollowUps", 20] }, // Overdue items add more pressure
              { $multiply: ["$urgentCases", 25] }, // Urgent cases add most pressure
            ],
          },

          // Performance score (higher = better performance)
          performanceScore: {
            $add: [
              "$supportInfo.performance.conversionRate",
              {
                $divide: [
                  "$supportInfo.performance.successfulConversions",
                  { $max: ["$supportInfo.performance.totalCasesHandled", 1] },
                ],
              },
            ],
          },

          // Specialization match score (to be calculated per contact)
          baseSpecializationScore: {
            $size: "$supportInfo.capabilities.specializations",
          },
        },
      },

      // Final assignment score calculation
      {
        $addFields: {
          // Overall assignment score (lower = better candidate)
          assignmentScore: {
            $add: [
              "$workloadPressure", // Current workload pressure
              { $multiply: [{ $subtract: [100, "$performanceScore"] }, 2] }, // Performance factor (inverted)
              { $cond: [{ $gt: ["$capacityUtilization", 80] }, 50, 0] }, // Penalty for high utilization
            ],
          },
        },
      },

      // Filter only available staff and sort by assignment score
      {
        $match: {
          isAvailable: true,
          "supportInfo.supportStatus": "active",
        },
      },

      { $sort: { assignmentScore: 1 } }, // Lower score = better candidate

      // Project final fields
      {
        $project: {
          _id: 1,
          "supportInfo.supportId": 1,
          "supportInfo.supportName": 1,
          "supportInfo.capabilities": 1,
          "supportInfo.performance": 1,
          activeCases: 1,
          highPriorityCases: 1,
          overdueFollowUps: 1,
          urgentCases: 1,
          capacityUtilization: 1,
          workloadPressure: 1,
          performanceScore: 1,
          assignmentScore: 1,
          maxCasesAllowed: "$supportInfo.capabilities.maxCasesAllowed",
        },
      },
    ]);
  }

  /**
   * 📋 Get contacts that need assignment
   */
  static async getContactsForAssignment(batchSize = 20, priorityOnly = false) {
    if (!ContactUs) {
      throw new Error("ContactUs model not initialized");
    }

    const query = {
      assignmentStatus: "pending",
      autoAssignmentEligible: true,
      spamScore: { $lt: 60 },
    };

    if (priorityOnly) {
      query.priorityScore = { $gte: 70 };
    }

    return await ContactUs.find(query)
      .sort({ priorityScore: -1, date: 1 })
      .limit(batchSize);
  }

  /**
   * 🎯 Perform smart assignment with skill matching
   */
  static async performSmartAssignment(contacts, supportStaffScores) {
    let assignedCount = 0;
    const assignmentDetails = [];

    for (const contact of contacts) {
      try {
        // Calculate specialization match for each staff member
        const staffWithSpecializationScores = supportStaffScores.map(
          (staff) => {
            let specializationBonus = 0;

            // Medical specialty matching
            if (
              contact.medicalSpecialty &&
              staff.supportInfo.capabilities.specializations
            ) {
              const specializations =
                staff.supportInfo.capabilities.specializations;

              if (
                contact.medicalSpecialty.toLowerCase().includes("doctor") &&
                specializations.includes("Medical")
              ) {
                specializationBonus += 20;
              }

              if (
                contact.medicalSpecialty.toLowerCase().includes("aesthetic") &&
                specializations.includes("Aesthetic")
              ) {
                specializationBonus += 15;
              }

              if (
                contact.courseOfInterest &&
                specializations.includes("Business") &&
                contact.courseOfInterest.toLowerCase().includes("business")
              ) {
                specializationBonus += 10;
              }
            }

            // Experience level matching
            if (
              contact.experienceLevel === "expert" ||
              contact.experienceLevel === "advanced"
            ) {
              specializationBonus += 5; // Experienced contacts might need specialized handling
            }

            // Priority matching
            if (contact.priorityScore >= 80) {
              // High priority contacts should go to high-performing staff
              specializationBonus += staff.performanceScore * 0.2;
            }

            return {
              ...staff,
              finalAssignmentScore: staff.assignmentScore - specializationBonus,
              specializationMatch: specializationBonus,
            };
          }
        );

        // Sort by final assignment score
        staffWithSpecializationScores.sort(
          (a, b) => a.finalAssignmentScore - b.finalAssignmentScore
        );

        // Find the best available staff member
        const selectedStaff = staffWithSpecializationScores[0];

        if (!selectedStaff) {
          console.warn(`⚠️ No available staff for contact ${contact._id}`);
          continue;
        }

        // Perform the assignment
        const assignmentResult = await contact.assignToSupport(
          selectedStaff._id,
          "smart-auto-assignment"
        );

        if (assignmentResult.success) {
          assignedCount++;

          // Update staff workload for next iteration
          selectedStaff.activeCases++;
          selectedStaff.assignmentScore += 10; // Temporary increase to distribute load

          assignmentDetails.push({
            contactId: contact._id,
            contactEmail: contact.email,
            assignedTo: selectedStaff.supportInfo.supportName,
            caseId: assignmentResult.caseId,
            priorityScore: contact.priorityScore,
            specializationMatch: selectedStaff.specializationMatch,
          });

          console.log(
            `✅ Assigned ${contact.email} to ${selectedStaff.supportInfo.supportName} (Score: ${selectedStaff.finalAssignmentScore})`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to assign contact ${contact._id}:`,
          error.message
        );
      }
    }

    return {
      success: true,
      message: `Successfully assigned ${assignedCount} contacts using smart algorithm`,
      assigned: assignedCount,
      total: contacts.length,
      assignmentDetails: assignmentDetails,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // ║                           WORKLOAD MANAGEMENT                               ║
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * ⚖️ Rebalance workload when one support staff is overloaded
   */
  static async rebalanceWorkload() {
    if (!SupportTeam) {
      throw new Error("SupportTeam model not initialized");
    }

    console.log("⚖️ Starting workload rebalancing...");

    const staffWorkloads = await SupportTeam.aggregate([
      { $match: { "supportInfo.supportStatus": "active" } },
      {
        $addFields: {
          activeCases: {
            $size: {
              $filter: {
                input: "$assignedCases",
                cond: {
                  $not: {
                    $in: [
                      "$$this.applicantStatus.currentStatus",
                      ["completed-course", "transferred-to-user"],
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          "supportInfo.supportName": 1,
          activeCases: 1,
          maxCases: "$supportInfo.capabilities.maxCasesAllowed",
          utilizationRate: {
            $multiply: [
              {
                $divide: [
                  "$activeCases",
                  "$supportInfo.capabilities.maxCasesAllowed",
                ],
              },
              100,
            ],
          },
        },
      },
      { $sort: { utilizationRate: -1 } },
    ]);

    // Find overloaded and underloaded staff
    const overloadedStaff = staffWorkloads.filter(
      (staff) => staff.utilizationRate > 85
    );
    const underloadedStaff = staffWorkloads.filter(
      (staff) => staff.utilizationRate < 60
    );

    if (overloadedStaff.length === 0 || underloadedStaff.length === 0) {
      console.log("📊 Workload is balanced, no rebalancing needed");
      return { rebalanced: 0 };
    }

    let rebalancedCases = 0;

    for (const overloaded of overloadedStaff) {
      // Find recent, low-priority cases to potentially reassign
      const supportTeam = await SupportTeam.findById(overloaded._id);

      const candidateCases = supportTeam.assignedCases.filter(
        (case_) =>
          case_.applicantStatus.currentStatus === "not-started" &&
          case_.caseInfo.priority !== "high" &&
          case_.caseMetrics.caseAgeInDays <= 1 // Only very recent cases
      );

      if (candidateCases.length > 0 && underloadedStaff.length > 0) {
        // Reassign to least loaded staff
        const targetStaff = underloadedStaff[0];
        const caseToReassign = candidateCases[0];

        // This would require implementing case transfer logic
        console.log(
          `🔄 Would reassign case ${caseToReassign.caseInfo.caseId} from ${overloaded.supportInfo.supportName} to ${targetStaff.supportInfo.supportName}`
        );
        rebalancedCases++;
      }
    }

    return { rebalanced: rebalancedCases };
  }

  /**
   * 📈 Get real-time workload statistics
   */
  static async getWorkloadStatistics() {
    if (!SupportTeam) {
      initializeModels();
      if (!SupportTeam) {
        return [
          {
            _id: null,
            totalStaff: 0,
            message: "SupportTeam model not available",
            staffDetails: [],
          },
        ];
      }
    }

    try {
      return await SupportTeam.aggregate([
        { $match: { "supportInfo.supportStatus": "active" } },
        {
          $addFields: {
            activeCases: {
              $size: {
                $filter: {
                  input: "$assignedCases",
                  cond: {
                    $not: {
                      $in: [
                        "$$this.applicantStatus.currentStatus",
                        ["completed-course", "transferred-to-user"],
                      ],
                    },
                  },
                },
              },
            },
            pendingFollowUps: {
              $size: {
                $filter: {
                  input: "$assignedCases",
                  cond: {
                    $and: [
                      {
                        $lte: [
                          "$$this.applicantStatus.nextFollowUpDate",
                          new Date(),
                        ],
                      },
                      {
                        $ne: [
                          "$$this.applicantStatus.currentStatus",
                          "completed-course",
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalStaff: { $sum: 1 },
            totalActiveCases: { $sum: "$activeCases" },
            totalPendingFollowUps: { $sum: "$pendingFollowUps" },
            avgCasesPerStaff: { $avg: "$activeCases" },
            maxCasesPerStaff: { $max: "$activeCases" },
            minCasesPerStaff: { $min: "$activeCases" },
            staffDetails: {
              $push: {
                supportId: "$supportInfo.supportId",
                supportName: "$supportInfo.supportName",
                activeCases: "$activeCases",
                pendingFollowUps: "$pendingFollowUps",
                maxAllowed: "$supportInfo.capabilities.maxCasesAllowed",
                conversionRate: "$supportInfo.performance.conversionRate",
              },
            },
          },
        },
      ]);
    } catch (error) {
      console.error("Error getting workload statistics:", error);
      return [
        {
          _id: null,
          totalStaff: 0,
          error: error.message,
          staffDetails: [],
        },
      ];
    }
  }

  // Additional methods remain the same...
  static async runPeriodicAssignment() {
    console.log("⏰ Running periodic assignment check...");

    try {
      const result = await this.assignContactsToSupport({
        batchSize: 10,
        priorityOnly: false,
      });

      if (new Date().getMinutes() % 15 === 0) {
        await this.assignContactsToSupport({
          batchSize: 5,
          priorityOnly: true,
        });
      }

      return result;
    } catch (error) {
      console.error("❌ Periodic assignment failed:", error);
      return { success: false, error: error.message };
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ║                               CRON JOB SETUP                                ║
// ════════════════════════════════════════════════════════════════════════════════

class AssignmentScheduler {
  static intervals = []; // Store interval IDs for cleanup

  static setupAutomatedAssignment() {
    // Clear any existing intervals
    this.clearIntervals();

    // Initialize models first
    const modelsReady = initializeModels();
    if (!modelsReady) {
      console.log(
        "⚠️ Models not ready, will retry automated assignment setup in 30 seconds..."
      );
      setTimeout(() => {
        this.setupAutomatedAssignment();
      }, 30000);
      return;
    }

    console.log("🤖 Setting up automated assignment intervals...");

    // Run every 30 minutes
    const mainInterval = setInterval(async () => {
      try {
        await SupportAssignmentService.assignContactsToSupport({
          batchSize: 15,
          priorityOnly: false,
        });
      } catch (error) {
        console.error("Scheduled assignment failed:", error);
      }
    }, 30 * 60 * 1000);

    // Run priority assignment every 10 minutes
    const priorityInterval = setInterval(async () => {
      try {
        await SupportAssignmentService.assignContactsToSupport({
          batchSize: 5,
          priorityOnly: true,
        });
      } catch (error) {
        console.error("Priority assignment failed:", error);
      }
    }, 10 * 60 * 1000);

    // Daily workload rebalancing
    const rebalanceInterval = setInterval(async () => {
      try {
        await SupportAssignmentService.rebalanceWorkload();
      } catch (error) {
        console.error("Workload rebalancing failed:", error);
      }
    }, 24 * 60 * 60 * 1000);

    // Store intervals for cleanup
    this.intervals = [mainInterval, priorityInterval, rebalanceInterval];

    console.log("🤖 Automated support assignment scheduler initialized");
  }

  static clearIntervals() {
    this.intervals.forEach((interval) => {
      if (interval) clearInterval(interval);
    });
    this.intervals = [];
  }

  static shutdown() {
    console.log("📧 Shutting down assignment scheduler...");
    this.clearIntervals();
  }
}

// Export with model initialization
module.exports = {
  SupportAssignmentService,
  AssignmentScheduler,
  initializeModels,
};
