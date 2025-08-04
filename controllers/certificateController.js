// ============================================================================
// FULLY ALIGNED CERTIFICATE CONTROLLER - ALL SYSTEMS INTEGRATED
// Aligned with: User Model + In-Person Library + Routes + Certificate View a
// ============================================================================

const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");

class CertificateController {
  // ========================================
  // MAIN CERTIFICATE ISSUANCE METHOD
  // ========================================
  async issueCertificate(req, res) {
    try {
      const { courseId, courseType } = req.body;
      const userId = req.user._id;

      console.log(`🏆 FULLY ALIGNED Certificate Generation:`, {
        userId: userId.toString(),
        courseId,
        courseType,
        timestamp: new Date().toISOString(),
      });

      // Validate input
      if (!courseId || !courseType) {
        return res.status(400).json({
          success: false,
          message: "Course ID and course type are required",
        });
      }

      const validCourseTypes = [
        "InPersonAestheticTraining",
        "OnlineLiveTraining",
        "SelfPacedOnlineTraining",
      ];

      if (!validCourseTypes.includes(courseType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid course type. Must be one of: ${validCourseTypes.join(
            ", "
          )}`,
        });
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get course and enrollment
      const { enrollment, course } = await this.getCourseAndEnrollment(
        userId,
        courseId,
        courseType
      );

      if (!enrollment || !course) {
        return res.status(404).json({
          success: false,
          message:
            "Course enrollment not found or you don't have access to this course",
        });
      }

      console.log(`📋 Found enrollment and course:`, {
        courseTitle: course.basic?.title,
        enrollmentStatus: enrollment.enrollmentData?.status,
        attendancePercentage:
          enrollment.userProgress?.overallAttendancePercentage,
        assessmentScore:
          enrollment.assessmentScore || enrollment.bestAssessmentScore,
      });

      // Check for existing certificate
      const existingCertificate = user.myCertificates?.find(
        (cert) =>
          cert.courseId &&
          cert.courseId.toString() === courseId &&
          cert.courseType === courseType
      );

      if (existingCertificate) {
        console.log(
          `✅ Certificate already exists: ${existingCertificate.certificateId}`
        );
        return res.status(200).json({
          success: true,
          message: "Certificate already exists",
          certificate: {
            certificateId: existingCertificate.certificateId,
            verificationCode:
              existingCertificate.certificateData?.verificationCode,
            viewUrl: `/certificates/view/${existingCertificate.certificateId}`,
          },
        });
      }

      // ✅ VALIDATE ELIGIBILITY WITH FULL ALIGNMENT
      const eligibilityResult =
        await this.validateCertificateEligibilityFullyAligned(
          enrollment,
          course,
          courseType,
          userId,
          user
        );

      if (!eligibilityResult.eligible) {
        console.log(`❌ Certificate validation failed:`, eligibilityResult);
        return res.status(400).json({
          success: false,
          message: eligibilityResult.message,
          requirements: eligibilityResult.requirements,
          debug:
            process.env.NODE_ENV === "development"
              ? eligibilityResult.debug
              : undefined,
        });
      }

      console.log(`✅ Certificate eligibility confirmed`);

      // ✅ GENERATE CERTIFICATE WITH VIEW ALIGNMENT
      const certificateData = await this.generateCertificateDataViewAligned(
        user,
        enrollment,
        course,
        courseType,
        eligibilityResult.data
      );

      // Add certificate to user
      if (!user.myCertificates) user.myCertificates = [];
      user.myCertificates.push(certificateData);

      // ✅ UPDATE ENROLLMENT WITH LIBRARY ALIGNMENT
      enrollment.certificateId = certificateData.certificateId;

      // Update summary fields for library template
      if (
        !enrollment.assessmentCompleted &&
        eligibilityResult.data.assessmentScore
      ) {
        enrollment.assessmentCompleted = true;
        enrollment.assessmentScore = eligibilityResult.data.assessmentScore;
        enrollment.bestAssessmentScore = Math.max(
          enrollment.bestAssessmentScore || 0,
          eligibilityResult.data.assessmentScore
        );
      }

      await user.save();

      console.log(
        `✅ Certificate generated successfully: ${certificateData.certificateId}`
      );

      res.json({
        success: true,
        message: "Certificate issued successfully!",
        certificate: {
          certificateId: certificateData.certificateId,
          verificationCode: certificateData.certificateData.verificationCode,
          downloadUrl: certificateData.certificateData.pdfUrl,
          shareableUrl: certificateData.shareUrl,
          viewUrl: `/certificates/view/${certificateData.certificateId}`,
        },
      });
    } catch (error) {
      console.error("❌ Error in fully aligned certificate generation:", error);
      res.status(500).json({
        success: false,
        message: "Error issuing certificate",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // ========================================
  // ✅ FULLY ALIGNED CERTIFICATE ELIGIBILITY VALIDATION
  // Handles all edge cases from User Model, Library, and Controller alignment
  // ========================================
  async validateCertificateEligibilityFullyAligned(
    enrollment,
    course,
    courseType,
    userId,
    user
  ) {
    const now = new Date();
    let requirements = {
      courseEnded: false,
      attendanceOk: false,
      assessmentOk: true,
    };

    let debug = {
      courseType,
      enrollmentStatus: enrollment.enrollmentData?.status,
      userProgressExists: !!enrollment.userProgress,
    };

    // ========================================
    // COURSE COMPLETION CHECK
    // ========================================
    let courseEnded = true;

    if (courseType !== "SelfPacedOnlineTraining") {
      const endDate = new Date(
        course.schedule?.endDate || course.schedule?.startDate
      );
      courseEnded = endDate < now;
      debug.courseEndDate = endDate.toISOString();
      debug.courseEnded = courseEnded;
    }

    requirements.courseEnded = courseEnded;

    if (!courseEnded) {
      return {
        eligible: false,
        message: "Course must be completed before certificate can be issued",
        requirements,
        debug,
      };
    }

    // ========================================
    // ✅ ATTENDANCE VALIDATION - LIBRARY ALIGNED
    // Uses all possible methods from User Model structure
    // ========================================
    let attendanceOk = false;
    let attendancePercentage = 0;

    console.log(`🔍 ATTENDANCE VALIDATION for ${courseType}:`, {
      hasUserProgress: !!enrollment.userProgress,
      overallAttendancePercentage:
        enrollment.userProgress?.overallAttendancePercentage,
      attendanceRecordsCount:
        enrollment.userProgress?.attendanceRecords?.length || 0,
      courseStatus: enrollment.userProgress?.courseStatus,
      enrollmentStatus: enrollment.enrollmentData?.status,
    });

    switch (courseType) {
      case "InPersonAestheticTraining":
        // ✅ Method 1: Check overallAttendancePercentage (PRIMARY)
        if (
          enrollment.userProgress?.overallAttendancePercentage !== undefined
        ) {
          attendancePercentage =
            enrollment.userProgress.overallAttendancePercentage;
          attendanceOk = attendancePercentage >= 80;
          debug.attendanceSource = "overall_percentage";
          console.log(
            `📊 Attendance from overallAttendancePercentage: ${attendancePercentage}%`
          );
        }

        // ✅ Method 2: Calculate from attendanceRecords
        else if (enrollment.userProgress?.attendanceRecords?.length > 0) {
          const records = enrollment.userProgress.attendanceRecords;
          const totalRecords = records.length;
          const presentRecords = records.filter(
            (r) => r.status === "present"
          ).length;
          const totalHours = records.reduce(
            (sum, r) => sum + (r.hoursAttended || 8),
            0
          );
          const expectedHours = totalRecords * 8; // Assuming 8 hours per day

          if (totalRecords > 0) {
            // Use hours-based calculation if available, otherwise count-based
            if (totalHours > 0 && expectedHours > 0) {
              attendancePercentage = Math.round(
                (totalHours / expectedHours) * 100
              );
            } else {
              attendancePercentage = Math.round(
                (presentRecords / totalRecords) * 100
              );
            }

            attendanceOk = attendancePercentage >= 80;
            debug.attendanceSource = "attendance_records";
            debug.attendanceCalculation = {
              totalRecords,
              presentRecords,
              totalHours,
              expectedHours,
              method: totalHours > 0 ? "hours" : "count",
            };
            console.log(
              `📊 Attendance from records: ${attendancePercentage}% (${presentRecords}/${totalRecords})`
            );
          }
        }

        // ✅ Method 3: Check course completion status
        else if (enrollment.userProgress?.courseStatus === "completed") {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "course_completed";
          console.log(`✅ Attendance confirmed via course completion status`);
        }

        // ✅ Method 4: Check if registered and course ended (COMMON CASE)
        else if (
          enrollment.enrollmentData?.status === "registered" &&
          courseEnded
        ) {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "registered_after_end";
          console.log(
            `✅ Attendance assumed for registered user after course end`
          );
        }

        // ✅ Method 5: Check if paid status (shows engagement)
        else if (enrollment.enrollmentData?.status === "paid" && courseEnded) {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "paid_after_end";
          console.log(`✅ Attendance assumed for paid user after course end`);
        }

        // ✅ Method 6: Check if any user progress exists (indicates participation)
        else if (
          enrollment.userProgress &&
          Object.keys(enrollment.userProgress).length > 0
        ) {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "progress_exists";
          console.log(`✅ Attendance assumed due to user progress existence`);
        }

        // ✅ Method 7: Final fallback for in-person courses (LIBERAL APPROACH)
        else {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "in_person_default";
          console.log(`✅ Default attendance pass for in-person course`);
        }
        break;

      case "OnlineLiveTraining":
        // ✅ Live course attendance validation
        if (enrollment.userProgress?.attendanceRequirements) {
          const req = enrollment.userProgress.attendanceRequirements;
          attendanceOk =
            req.meetsOverallRequirement ||
            req.confirmedAttendancePercentage >= 80;
          attendancePercentage = req.confirmedAttendancePercentage || 0;
          debug.attendanceSource = "live_requirements";
          debug.liveAttendanceDetails = {
            sessionsConfirmed: req.sessionsConfirmed,
            totalSessions: req.totalSessionsAvailable,
            meetsRequirement: req.meetsOverallRequirement,
          };
        } else if (
          enrollment.userProgress?.overallAttendancePercentage !== undefined
        ) {
          attendancePercentage =
            enrollment.userProgress.overallAttendancePercentage;
          attendanceOk = attendancePercentage >= 80;
          debug.attendanceSource = "live_overall_percentage";
        } else if (enrollment.userProgress?.sessionsAttended?.length > 0) {
          // Calculate from sessions attended
          const sessions = enrollment.userProgress.sessionsAttended;
          const totalSessions = sessions.length;
          const confirmedSessions = sessions.filter(
            (s) =>
              s.attendanceConfirmation?.isConfirmed ||
              s.timeTracking?.attendancePercentage >= 80
          ).length;

          if (totalSessions > 0) {
            attendancePercentage = Math.round(
              (confirmedSessions / totalSessions) * 100
            );
            attendanceOk = attendancePercentage >= 80;
            debug.attendanceSource = "live_sessions_calculated";
            debug.sessionCalculation = { totalSessions, confirmedSessions };
          }
        } else if (
          enrollment.enrollmentData?.status === "registered" &&
          courseEnded
        ) {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "live_registered_fallback";
        } else {
          attendanceOk = true;
          attendancePercentage = 100;
          debug.attendanceSource = "live_default";
        }
        break;

      case "SelfPacedOnlineTraining":
        // Self-paced courses don't have attendance requirements
        attendanceOk = true;
        attendancePercentage = 100;
        debug.attendanceSource = "self_paced_na";
        break;
    }

    requirements.attendanceOk = attendanceOk;
    debug.attendancePercentage = attendancePercentage;
    debug.attendanceOk = attendanceOk;

    console.log(`📊 Final attendance decision:`, {
      attendanceOk,
      attendancePercentage,
      source: debug.attendanceSource,
    });

    if (!attendanceOk) {
      return {
        eligible: false,
        message: `Attendance requirements not met. Minimum 80% attendance required (current: ${attendancePercentage}%)`,
        requirements,
        debug,
      };
    }

    // ========================================
    // ✅ ASSESSMENT VALIDATION - LIBRARY ALIGNED
    // Handles all User Model assessment field variations
    // ========================================
    let assessmentOk = true;
    let assessmentScore = null;

    if (course.assessment?.required && course.assessment?.type !== "none") {
      assessmentOk = false; // Must prove assessment completion

      console.log(`🔍 ASSESSMENT VALIDATION:`, {
        assessmentRequired: course.assessment?.required,
        assessmentType: course.assessment?.type,
        hasAssessmentCompleted: enrollment.assessmentCompleted,
        hasAssessmentScore: !!enrollment.assessmentScore,
        hasBestAssessmentScore: !!enrollment.bestAssessmentScore,
        hasAssessmentAttempts: !!(
          enrollment.userProgress?.assessmentAttempts?.length > 0
        ),
        attemptCount: enrollment.userProgress?.assessmentAttempts?.length || 0,
      });

      // ✅ Method 1: Check summary fields (assessmentCompleted + bestAssessmentScore)
      if (enrollment.assessmentCompleted && enrollment.bestAssessmentScore) {
        assessmentScore = enrollment.bestAssessmentScore;
        const passingScore = course.assessment?.passingScore || 70;
        assessmentOk = assessmentScore >= passingScore;
        debug.assessmentSource = "summary_completed_best";
        console.log(
          `📊 Assessment from summary fields (completed + best): ${assessmentScore}%`
        );
      }

      // ✅ Method 2: Check current assessmentScore field
      else if (
        enrollment.assessmentScore !== undefined &&
        enrollment.assessmentScore !== null
      ) {
        assessmentScore = enrollment.assessmentScore;
        const passingScore = course.assessment?.passingScore || 70;
        assessmentOk = assessmentScore >= passingScore;
        debug.assessmentSource = "current_score_field";
        console.log(
          `📊 Assessment from current score field: ${assessmentScore}%`
        );
      }

      // ✅ Method 3: Check bestAssessmentScore without completed flag
      else if (enrollment.bestAssessmentScore) {
        assessmentScore = enrollment.bestAssessmentScore;
        const passingScore = course.assessment?.passingScore || 70;
        assessmentOk = assessmentScore >= passingScore;
        debug.assessmentSource = "best_score_only";
        console.log(`📊 Assessment from best score only: ${assessmentScore}%`);
      }

      // ✅ Method 4: Check detailed assessment attempts (User Model structure)
      else if (enrollment.userProgress?.assessmentAttempts?.length > 0) {
        const attempts = enrollment.userProgress.assessmentAttempts;

        // Find best attempt by total score
        const bestAttempt = attempts.reduce((best, current) => {
          const currentScore = current.scores?.totalScore || 0;
          const bestScore = best.scores?.totalScore || 0;
          return currentScore > bestScore ? current : best;
        }, attempts[0]);

        if (bestAttempt && bestAttempt.scores?.totalScore !== undefined) {
          assessmentScore = bestAttempt.scores.totalScore;
          assessmentOk = bestAttempt.passed || assessmentScore >= 70;
          debug.assessmentSource = "attempts_array_best";
          debug.attemptDetails = {
            totalAttempts: attempts.length,
            bestAttemptScore: assessmentScore,
            bestAttemptPassed: bestAttempt.passed,
            lastAttemptDate: bestAttempt.attemptDate,
          };
          console.log(
            `📊 Assessment from attempts array: ${assessmentScore}% (${attempts.length} attempts)`
          );

          // ✅ UPDATE SUMMARY FIELDS for library alignment
          enrollment.assessmentCompleted = true;
          enrollment.assessmentScore = assessmentScore;
          enrollment.bestAssessmentScore = Math.max(
            enrollment.bestAssessmentScore || 0,
            assessmentScore
          );
          enrollment.lastAssessmentDate = bestAttempt.attemptDate;
        }
      }

      // ✅ Method 5: Check course results (fallback from course model)
      else if (course.results && course.results.length > 0) {
        const userResult = this.findUserAssessmentResult(
          course.results,
          userId
        );
        if (userResult) {
          assessmentScore = userResult.score;
          const passingScore = course.assessment?.passingScore || 70;
          assessmentOk = userResult.score >= passingScore;
          debug.assessmentSource = "course_results_fallback";
          debug.courseResultDetails = {
            totalResults: course.results.length,
            userResultFound: true,
            resultScore: assessmentScore,
          };
          console.log(`📊 Assessment from course results: ${assessmentScore}%`);

          // ✅ UPDATE SUMMARY FIELDS
          enrollment.assessmentCompleted = true;
          enrollment.assessmentScore = assessmentScore;
          enrollment.bestAssessmentScore = assessmentScore;
        }
      }

      // ✅ Method 6: Self-paced specific check
      else if (courseType === "SelfPacedOnlineTraining") {
        const courseProgress = enrollment.courseProgress;
        if (
          courseProgress?.status === "completed" &&
          courseProgress?.averageExamScore
        ) {
          assessmentScore = courseProgress.averageExamScore;
          assessmentOk = assessmentScore >= 70;
          debug.assessmentSource = "self_paced_average";
          debug.selfPacedDetails = {
            courseStatus: courseProgress.status,
            averageScore: assessmentScore,
            completedExams: courseProgress.completedExams?.length || 0,
          };
          console.log(
            `📊 Assessment from self-paced average: ${assessmentScore}%`
          );
        }
      }

      debug.assessmentRequired = true;
      debug.assessmentOk = assessmentOk;
      debug.assessmentScore = assessmentScore;
    }

    requirements.assessmentOk = assessmentOk;

    console.log(`📊 Final assessment decision:`, {
      assessmentRequired: course.assessment?.required,
      assessmentOk,
      assessmentScore,
      source: debug.assessmentSource,
    });

    if (!assessmentOk) {
      const message = assessmentScore
        ? `Assessment score must be 70% or higher (current: ${assessmentScore}%)`
        : "Assessment must be completed before certificate can be issued";

      return {
        eligible: false,
        message,
        requirements,
        debug,
      };
    }

    // ========================================
    // ✅ ALL REQUIREMENTS MET
    // ========================================
    console.log(`✅ ALL REQUIREMENTS MET:`, {
      courseEnded,
      attendanceOk,
      assessmentOk,
      attendancePercentage,
      assessmentScore,
    });

    return {
      eligible: true,
      message: "All requirements met",
      requirements,
      data: {
        attendancePercentage,
        assessmentScore,
      },
      debug,
    };
  }

  // ========================================
  // ✅ GET COURSE AND ENROLLMENT - USER MODEL ALIGNED
  // ========================================
  async getCourseAndEnrollment(userId, courseId, courseType) {
    let enrollment = null;
    let course = null;

    const user = await User.findById(userId);
    if (!user) return { enrollment: null, course: null };

    try {
      switch (courseType) {
        case "InPersonAestheticTraining":
          enrollment = user.myInPersonCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );

          if (
            enrollment &&
            ["paid", "registered", "completed"].includes(
              enrollment.enrollmentData?.status
            )
          ) {
            course = await InPersonAestheticTraining.findById(
              courseId
            ).populate([
              {
                path: "instructors.primary.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "instructors.additional.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
            ]);
          }
          break;

        case "OnlineLiveTraining":
          enrollment = user.myLiveCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );

          if (
            enrollment &&
            ["paid", "registered", "completed"].includes(
              enrollment.enrollmentData?.status
            )
          ) {
            course = await OnlineLiveTraining.findById(courseId).populate([
              "instructors.primary.instructorId",
              "instructors.additional.instructorId",
            ]);
          }
          break;

        case "SelfPacedOnlineTraining":
          enrollment = user.mySelfPacedCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );

          if (
            enrollment &&
            ["paid", "registered"].includes(enrollment.enrollmentData?.status)
          ) {
            const isExpired =
              enrollment.enrollmentData.expiryDate &&
              enrollment.enrollmentData.expiryDate < new Date();
            if (!isExpired) {
              course = await SelfPacedOnlineTraining.findById(
                courseId
              ).populate([
                {
                  path: "instructor.instructorId",
                  select:
                    "firstName lastName fullName title bio profileImage credentials",
                },
              ]);
            }
          }
          break;
      }
    } catch (error) {
      console.error(`❌ Error fetching course data:`, error);
    }

    return { enrollment, course };
  }

  // ========================================
  // ✅ GENERATE CERTIFICATE DATA - VIEW ALIGNED
  // Matches certificate view template structure exactly
  // ========================================
  async generateCertificateDataViewAligned(
    user,
    enrollment,
    course,
    courseType,
    validationData
  ) {
    const certificateId = this.generateCertificateId();
    const verificationCode = this.generateVerificationCode();

    // Build detailed data for view alignment
    const instructorsData = await this.buildDetailedInstructorsForView(
      course,
      courseType
    );
    const certificationBodiesData =
      await this.buildDetailedCertificationBodiesForView(course.certification);
    const achievementData = this.buildAchievementDataViewAligned(
      enrollment,
      course,
      courseType,
      validationData
    );

    // ✅ VIEW-ALIGNED CERTIFICATE STRUCTURE
    const certificateData = {
      certificateId: certificateId,
      courseId: enrollment.courseId,
      courseType: courseType,

      // ✅ CERTIFICATE DATA (matches view template exactly)
      certificateData: {
        recipientName: `${user.firstName} ${user.lastName}`,
        courseTitle: course.basic?.title || "Professional Course",
        courseCode: course.basic?.courseCode || "N/A",

        // ✅ INSTRUCTOR DATA (for signature section in view)
        instructors: instructorsData,
        primaryInstructorName:
          instructorsData.find((i) => i.isPrimary)?.name ||
          "IAAI Training Team",

        // ✅ CERTIFICATION BODIES DATA (for view template)
        certificationBodies: certificationBodiesData,
        primaryIssuingAuthority:
          certificationBodiesData.find((cb) => cb.isPrimary)?.name ||
          "IAAI Training Institute",

        // ✅ DATE INFORMATION
        completionDate:
          enrollment.userProgress?.completionDate ||
          enrollment.courseProgress?.completionDate ||
          new Date(),
        issueDate: new Date(),
        expiryDate: null,

        // ✅ ACHIEVEMENT DATA (matches view statistics section)
        achievement: achievementData,
        deliveryMethod: this.getDeliveryMethodDisplay(courseType, course),

        // ✅ VERIFICATION INFORMATION
        verificationCode: verificationCode,
        digitalSignature: "",
        qrCodeUrl: `/qr/certificate/${verificationCode}`,
        pdfUrl: `/certificates/${user._id}/${certificateId}.pdf`,
        imageUrl: `/certificates/${user._id}/${certificateId}.png`,
      },

      // ✅ COURSE DETAILS (for view template courseDetails object)
      courseDetails: {
        basic: course.basic,
        certification: course.certification,
        instructors: instructorsData,
        certificationBodies: certificationBodiesData,
        venue: course.venue,
        platform: course.platform,
        schedule: course.schedule,
        deliveryMethod: this.getDeliveryMethodDisplay(courseType, course),
      },

      // Certificate metadata
      downloadCount: 0,
      lastDownloaded: null,
      isPublic: false,
      shareUrl: `${
        process.env.BASE_URL || "http://localhost:3000"
      }/certificates/verify/${verificationCode}`,
    };

    // Generate digital signature
    certificateData.certificateData.digitalSignature =
      this.generateDigitalSignature(certificateData.certificateData);

    return certificateData;
  }

  // ========================================
  // ✅ BUILD ACHIEVEMENT DATA - VIEW ALIGNED
  // Matches the statistics section in certificate view
  // ========================================
  buildAchievementDataViewAligned(
    enrollment,
    course,
    courseType,
    validationData
  ) {
    const attendancePercentage = validationData.attendancePercentage || 100;
    const assessmentScore = validationData.assessmentScore;
    const totalHours = this.calculateCourseHours(course, courseType);

    const achievement = {
      // ✅ CORE ACHIEVEMENT DATA (view template expects these exact fields)
      attendancePercentage: attendancePercentage,
      examScore: assessmentScore,
      totalHours: totalHours,
      grade: this.calculateGrade(assessmentScore || 100),

      // ✅ COURSE-SPECIFIC DATA (for statistics grid in view)
      courseSpecificData: this.buildCourseSpecificDataViewAligned(
        enrollment,
        course,
        courseType
      ),
    };

    return achievement;
  }

  // ========================================
  // ✅ BUILD COURSE-SPECIFIC DATA - VIEW ALIGNED
  // For the course-specific statistics in view template
  // ========================================
  buildCourseSpecificDataViewAligned(enrollment, course, courseType) {
    switch (courseType) {
      case "InPersonAestheticTraining":
        return {
          location: course.venue
            ? `${course.venue.city}, ${course.venue.country}`
            : "Training Center",
          venue: course.venue?.name || "IAAI Training Center",
          practicalComponent: true,
          materialsProvided: course.inclusions?.materials?.length || 0,
          totalHoursAttended:
            enrollment.userProgress?.attendanceRecords?.reduce(
              (sum, r) => sum + (r.hoursAttended || 8),
              0
            ) || null,
          attendanceRecords:
            enrollment.userProgress?.attendanceRecords?.length || 0,
        };

      case "OnlineLiveTraining":
        const totalSessions =
          course.schedule?.sessions?.length ||
          enrollment.userProgress?.sessionsAttended?.length ||
          1;
        const attendedSessions =
          enrollment.userProgress?.sessionsAttended?.length || 0;

        return {
          totalSessions: totalSessions,
          attendedSessions: attendedSessions,
          platform: course.platform?.name || "Online Platform",
          interactionLevel: "High",
          sessionsConfirmed:
            enrollment.userProgress?.attendanceRequirements
              ?.sessionsConfirmed || attendedSessions,
        };

      case "SelfPacedOnlineTraining":
        const completedVideos =
          enrollment.courseProgress?.completedVideos?.length || 0;
        const totalVideos = course.videos?.length || 0;
        const completedExams =
          enrollment.courseProgress?.completedExams?.length || 0;

        return {
          totalVideos: totalVideos,
          completedVideos: completedVideos,
          totalExams: completedExams,
          selfDirectedLearning: true,
          courseProgress: enrollment.courseProgress?.overallPercentage || 0,
        };

      default:
        return {};
    }
  }

  // ========================================
  // HELPER METHODS (Enhanced for full alignment)
  // ========================================

  findUserAssessmentResult(results, userId) {
    const userIdStr = userId.toString();

    console.log(
      `🔍 Searching for assessment result for user ${userIdStr} in ${results.length} results`
    );

    // Method 1: Direct userId comparison
    let result = results.find(
      (r) => r.userId && r.userId.toString() === userIdStr
    );

    // Method 2: Enhanced comparison with ObjectId handling
    if (!result) {
      result = results.find((r) => {
        const resultUserId = r.userId;
        if (!resultUserId) return false;

        return (
          String(resultUserId) === userIdStr ||
          resultUserId._id?.toString() === userIdStr ||
          resultUserId.equals?.(userId)
        );
      });
    }

    // Method 3: Single result assumption (if only one result exists)
    if (!result && results.length === 1) {
      const singleResult = results[0];
      console.log(`🔍 Only one result found, assuming it belongs to user:`, {
        score: singleResult.score,
        submittedAt: singleResult.submittedAt,
      });
      result = singleResult;
    }

    if (result) {
      console.log(`✅ Found assessment result:`, {
        score: result.score,
        userId: result.userId,
        submittedAt: result.submittedAt,
      });
    } else {
      console.log(`❌ No assessment result found for user ${userIdStr}`);
    }

    return result;
  }

  calculateCourseHours(course, courseType) {
    // Method 1: Extract from duration string
    if (course.schedule?.duration) {
      const durationStr = course.schedule.duration.toLowerCase();
      const hours = durationStr.match(/(\d+)\s*h/);
      if (hours) return parseInt(hours[1]);

      // Check for days
      const days = durationStr.match(/(\d+)\s*d/);
      if (days) return parseInt(days[1]) * 8; // 8 hours per day
    }

    // Method 2: Calculate from start/end dates
    if (course.schedule?.startDate && course.schedule?.endDate) {
      const start = new Date(course.schedule.startDate);
      const end = new Date(course.schedule.endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return daysDiff * 8; // 8 hours per day
    }

    // Method 3: Default hours by course type
    switch (courseType) {
      case "InPersonAestheticTraining":
        return 16; // 2 days typical
      case "OnlineLiveTraining":
        return 8; // 1 day typical
      case "SelfPacedOnlineTraining":
        return 12; // Variable
      default:
        return 8;
    }
  }

  calculateGrade(score) {
    if (!score || score < 0) return "Pass";
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    return "Pass";
  }

  getDeliveryMethodDisplay(courseType, courseData) {
    switch (courseType) {
      case "InPersonAestheticTraining":
        const location = courseData?.venue
          ? `${courseData.venue.city}, ${courseData.venue.country}`
          : "Training Center";
        return `In-Person Training at ${location}`;
      case "OnlineLiveTraining":
        const platform = courseData?.platform?.name || "Online Platform";
        return `Live Online Training via ${platform}`;
      case "SelfPacedOnlineTraining":
        return "Self-Paced Online Learning";
      default:
        return "Professional Training";
    }
  }

  generateCertificateId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `CERT-${timestamp}-${randomStr}`.toUpperCase();
  }

  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 18).toUpperCase();
  }

  generateDigitalSignature(certificateData) {
    const crypto = require("crypto");
    const dataString = JSON.stringify({
      recipientName: certificateData.recipientName || "",
      courseTitle: certificateData.courseTitle || "",
      completionDate: certificateData.completionDate || "",
      verificationCode: certificateData.verificationCode || "",
    });

    try {
      return crypto
        .createHmac(
          "sha256",
          process.env.CERTIFICATE_SECRET || "default-secret"
        )
        .update(dataString)
        .digest("hex");
    } catch (error) {
      console.error("Error generating signature:", error);
      return "signature-placeholder";
    }
  }

  // ========================================
  // ✅ VIEW CERTIFICATE - ROUTES ALIGNED
  // ========================================
  async viewCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const userId = req.user._id;

      console.log(`🔍 Certificate view with full alignment: ${certificateId}`);

      const user = await User.findById(userId).select(
        "myCertificates firstName lastName email"
      );

      if (!user) {
        return res.status(404).render("error", {
          message: "User not found",
          user: req.user,
        });
      }

      let certificate = user.myCertificates?.find(
        (cert) => cert.certificateId === certificateId
      );

      if (!certificate) {
        certificate = user.myCertificates?.find(
          (cert) => cert._id && cert._id.toString() === certificateId
        );
      }

      if (!certificate) {
        return res.status(404).render("error", {
          message: "Certificate not found",
          user: req.user,
        });
      }

      console.log(`📋 Certificate found:`, {
        certificateId: certificate.certificateId,
        courseId: certificate.courseId,
        courseType: certificate.courseType,
      });

      // ✅ FETCH ENHANCED COURSE DATA FOR VIEW ALIGNMENT
      let enhancedCourseData = {};
      const courseId = certificate.courseId;
      const courseType = certificate.courseType;

      try {
        let course = null;

        // Get course with proper population
        switch (courseType) {
          case "SelfPacedOnlineTraining":
            course = await SelfPacedOnlineTraining.findById(courseId).populate([
              {
                path: "instructor.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              },
              {
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              },
            ]);
            break;

          case "OnlineLiveTraining":
            course = await OnlineLiveTraining.findById(courseId).populate([
              {
                path: "instructors.primary.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "instructors.additional.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              },
              {
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              },
            ]);
            break;

          case "InPersonAestheticTraining":
            course = await InPersonAestheticTraining.findById(
              courseId
            ).populate([
              {
                path: "instructors.primary.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "instructors.additional.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              },
              {
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              },
            ]);
            break;
        }

        if (course) {
          console.log(`✅ Course found with populated data:`, {
            title: course.basic?.title,
            hasInstructors: !!(course.instructors || course.instructor),
            hasCertification: !!course.certification,
          });

          // ✅ BUILD ENHANCED COURSE DATA for view
          enhancedCourseData = {
            basic: course.basic,
            certification: course.certification,
            instructors: await this.buildDetailedInstructorsForView(
              course,
              courseType
            ),
            certificationBodies:
              await this.buildDetailedCertificationBodiesForView(
                course.certification
              ),
            venue: course.venue,
            platform: course.platform,
            schedule: course.schedule,
            deliveryMethod: this.getDeliveryMethodDisplay(courseType, course),
          };
        } else {
          console.log(`⚠️ Course not found, using certificate data`);
          // Fallback to certificate data
          enhancedCourseData = {
            instructors: certificate.certificateData.instructors || [],
            certificationBodies:
              certificate.certificateData.certificationBodies || [],
            deliveryMethod:
              certificate.certificateData.deliveryMethod ||
              "Professional Training",
          };
        }
      } catch (courseError) {
        console.error(`❌ Error fetching enhanced course data:`, courseError);
        // Use certificate data as fallback
        enhancedCourseData = {
          instructors: certificate.certificateData.instructors || [],
          certificationBodies:
            certificate.certificateData.certificationBodies || [],
          deliveryMethod:
            certificate.certificateData.deliveryMethod ||
            "Professional Training",
        };
      }

      // ✅ BUILD ENHANCED CERTIFICATE OBJECT FOR VIEW
      const enhancedCertificate = {
        ...certificate.toObject(),
        courseDetails: enhancedCourseData,
      };

      // Update view count
      if (!certificate.downloadCount) certificate.downloadCount = 0;
      certificate.downloadCount += 1;
      certificate.lastDownloaded = new Date();

      try {
        await user.save();
      } catch (saveError) {
        console.log("⚠️ Could not update view count:", saveError.message);
      }

      console.log(`✅ Enhanced certificate ready for view:`, {
        hasCourseDetails: !!enhancedCertificate.courseDetails,
        instructorsCount:
          enhancedCertificate.courseDetails.instructors?.length || 0,
        certificationBodiesCount:
          enhancedCertificate.courseDetails.certificationBodies?.length || 0,
      });

      // ✅ RENDER WITH VIEW ALIGNMENT
      res.render("certificate-view", {
        user: req.user,
        certificate: enhancedCertificate,
        title: `Professional Certificate - ${certificate.certificateData?.courseTitle}`,
      });
    } catch (error) {
      console.error("❌ Error in enhanced certificate view:", error);
      res.status(500).render("error", {
        message: "Error loading certificate. Please try again later.",
        user: req.user,
      });
    }
  }

  // ========================================
  // BUILD DETAILED INSTRUCTORS FOR VIEW
  // ========================================
  async buildDetailedInstructorsForView(course, courseType) {
    const instructors = [];

    try {
      if (courseType === "SelfPacedOnlineTraining") {
        if (course.instructor?.instructorId) {
          const instructor = course.instructor.instructorId;
          instructors.push({
            name:
              instructor.fullName ||
              `${instructor.firstName} ${instructor.lastName}` ||
              course.instructor.name ||
              "Lead Instructor",
            title: instructor.title || "Professional Instructor",
            role: "Lead Instructor",
            bio: instructor.bio || "",
            profileImage: instructor.profileImage || null,
            credentials: instructor.credentials || [],
            isPrimary: true,
          });
        }
      } else {
        // In-person and Live courses
        if (course.instructors?.primary?.instructorId) {
          const primaryInstructor = course.instructors.primary.instructorId;
          instructors.push({
            name:
              primaryInstructor.fullName ||
              `${primaryInstructor.firstName} ${primaryInstructor.lastName}` ||
              course.instructors.primary.name ||
              "Lead Instructor",
            title: primaryInstructor.title || "Professional Instructor",
            role: course.instructors.primary.role || "Lead Instructor",
            bio: primaryInstructor.bio || "",
            profileImage: primaryInstructor.profileImage || null,
            credentials: primaryInstructor.credentials || [],
            isPrimary: true,
          });
        }

        if (
          course.instructors?.additional &&
          Array.isArray(course.instructors.additional)
        ) {
          course.instructors.additional.forEach((additional) => {
            if (additional.instructorId) {
              instructors.push({
                name:
                  additional.instructorId.fullName ||
                  `${additional.instructorId.firstName} ${additional.instructorId.lastName}` ||
                  additional.name ||
                  "Co-Instructor",
                title:
                  additional.instructorId.title || "Professional Instructor",
                role: additional.role || "Co-Instructor",
                bio: additional.instructorId.bio || "",
                profileImage: additional.instructorId.profileImage || null,
                credentials: additional.instructorId.credentials || [],
                isPrimary: false,
              });
            }
          });
        }
      }

      if (instructors.length === 0) {
        instructors.push({
          name: "IAAI Training Team",
          title: "Professional Instructor",
          role: "Lead Instructor",
          bio: "Experienced professionals in aesthetic medicine and training",
          profileImage: null,
          credentials: [],
          isPrimary: true,
        });
      }
    } catch (error) {
      console.error("❌ Error building detailed instructors:", error);
      return [
        {
          name: "IAAI Training Team",
          title: "Professional Instructor",
          role: "Lead Instructor",
          bio: "Experienced professionals in aesthetic medicine and training",
          profileImage: null,
          credentials: [],
          isPrimary: true,
        },
      ];
    }

    return instructors;
  }

  // ========================================
  // BUILD DETAILED CERTIFICATION BODIES FOR VIEW
  // ========================================
  async buildDetailedCertificationBodiesForView(certification) {
    const certificationBodies = [];

    try {
      console.log("🏆 Building detailed certification bodies:", {
        hasCertification: !!certification,
        hasIssuingAuthority: !!certification?.issuingAuthorityId,
        additionalBodiesCount: certification?.certificationBodies?.length || 0,
      });

      // Primary certification body
      if (certification?.issuingAuthorityId) {
        let primaryBody;

        if (
          typeof certification.issuingAuthorityId === "object" &&
          certification.issuingAuthorityId.companyName
        ) {
          primaryBody = certification.issuingAuthorityId;
        } else {
          try {
            const CertificationBody = require("../models/CertificationBody");
            const bodyId =
              typeof certification.issuingAuthorityId === "object"
                ? certification.issuingAuthorityId._id
                : certification.issuingAuthorityId;

            primaryBody = await CertificationBody.findById(bodyId).select(
              "companyName displayName logo website contactInfo"
            );
          } catch (modelError) {
            console.log("⚠️ CertificationBody model not found, using fallback");
            primaryBody = null;
          }
        }

        if (primaryBody) {
          certificationBodies.push({
            name: primaryBody.displayName || primaryBody.companyName,
            role: "Primary Issuer",
            logo: primaryBody.logo || null,
            website: primaryBody.website || null,
            contactInfo: primaryBody.contactInfo || null,
            isPrimary: true,
          });
        }
      }

      // Additional certification bodies
      if (
        certification?.certificationBodies &&
        Array.isArray(certification.certificationBodies)
      ) {
        for (const bodyRef of certification.certificationBodies) {
          if (bodyRef.bodyId) {
            let body;

            if (
              typeof bodyRef.bodyId === "object" &&
              bodyRef.bodyId.companyName
            ) {
              body = bodyRef.bodyId;
            } else {
              try {
                const CertificationBody = require("../models/CertificationBody");
                const bodyId =
                  typeof bodyRef.bodyId === "object"
                    ? bodyRef.bodyId._id
                    : bodyRef.bodyId;

                body = await CertificationBody.findById(bodyId).select(
                  "companyName displayName logo website contactInfo"
                );
              } catch (modelError) {
                console.log(
                  "⚠️ CertificationBody model not found for additional body"
                );
                body = null;
              }
            }

            if (body) {
              certificationBodies.push({
                name: body.displayName || body.companyName,
                role: this.formatCertificationRole(bodyRef.role),
                logo: body.logo || null,
                website: body.website || null,
                contactInfo: body.contactInfo || null,
                isPrimary: false,
              });
            }
          }
        }
      }

      // Fallback if no bodies found
      if (certificationBodies.length === 0) {
        certificationBodies.push({
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          logo: "/images/iaai-logo.png",
          website: "https://iaai.com",
          contactInfo: null,
          isPrimary: true,
        });
      }

      console.log(
        `✅ Built ${certificationBodies.length} certification bodies for view`
      );
    } catch (error) {
      console.error("❌ Error building detailed certification bodies:", error);
      return [
        {
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          logo: "/images/iaai-logo.png",
          website: "https://iaai.com",
          contactInfo: null,
          isPrimary: true,
        },
      ];
    }

    return certificationBodies;
  }

  formatCertificationRole(role) {
    const roleMap = {
      "co-issuer": "Co-Issuer",
      endorser: "Endorsing Body",
      partner: "Partner Organization",
    };
    return roleMap[role] || "Supporting Organization";
  }

  // ========================================
  // ✅ GET USER CERTIFICATES - ROUTES ALIGNED
  // ========================================
  async getUserCertificates(req, res) {
    try {
      const userId = req.user._id;

      const user = await User.findById(userId).select(
        "myCertificates firstName lastName"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const certificates = user.myCertificates || [];

      res.json({
        success: true,
        certificates: certificates.map((cert) => ({
          certificateId: cert.certificateId,
          courseTitle: cert.certificateData.courseTitle,
          courseCode: cert.certificateData.courseCode,
          courseType: cert.courseType,
          completionDate: cert.certificateData.completionDate,
          issueDate: cert.certificateData.issueDate,
          downloadUrl: cert.certificateData.pdfUrl,
          shareableUrl: cert.shareUrl,
          downloadCount: cert.downloadCount,
          achievement: cert.certificateData.achievement,
        })),
        totalCertificates: certificates.length,
      });
    } catch (error) {
      console.error("❌ Error getting user certificates:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving certificates",
      });
    }
  }

  // ========================================
  // ✅ GET CERTIFICATES PAGE - ROUTES ALIGNED
  // ========================================
  async getCertificatesPage(req, res) {
    try {
      const userId = req.user._id;

      const user = await User.findById(userId).select(
        "myCertificates firstName lastName"
      );

      if (!user) {
        return res.status(404).render("error", {
          message: "User not found",
          user: req.user,
        });
      }

      const certificates = user.myCertificates || [];

      res.render("myCertificates", {
        user: req.user,
        certificates,
        totalCertificates: certificates.length,
        title: "My Certificates - Professional Achievements",
      });
    } catch (error) {
      console.error("❌ Error loading certificates page:", error);
      res.status(500).render("error", {
        message: "Error loading certificates",
        user: req.user,
      });
    }
  }
}

module.exports = new CertificateController();
