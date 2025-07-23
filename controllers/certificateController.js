// controllers/certificateController.js - UPDATED FOR LINKED COURSES
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const CertificationBody = require("../models/CertificationBody");
const Instructor = require("../models/Instructor");

class CertificateController {
  /**
   * ✅ UPDATED: Enhanced certificate issuance with linked course support
   */
  async issueCertificate(req, res) {
    try {
      const { courseId, courseType } = req.body;
      const userId = req.user._id;

      console.log(
        `🏆 Enhanced certificate issuance with linked course support - User: ${userId}, Course: ${courseId}, Type: ${courseType}`
      );

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      let enrollment = null;
      let course = null;

      // ============================================
      // ✅ STEP 1: Get course with populated data
      // ============================================
      switch (courseType) {
        case "SelfPacedOnlineTraining":
          enrollment = user.mySelfPacedCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );
          if (enrollment) {
            course = await SelfPacedOnlineTraining.findById(courseId).populate([
              {
                path: "instructor.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              },
              {
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website",
              },
              {
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website",
              },
            ]);
          }
          break;

        case "OnlineLiveTraining":
          enrollment = user.myLiveCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );
          if (enrollment) {
            course = await OnlineLiveTraining.findById(courseId).populate([
              "instructors.primary.instructorId",
              "instructors.additional.instructorId",
              "certification.issuingAuthorityId",
              "certification.certificationBodies.bodyId",
              // ✅ NEW: Populate linked course data
              {
                path: "linkedToInPerson.inPersonCourseId",
                select: "basic schedule venue certification",
                populate: {
                  path: "certification.issuingAuthorityId",
                  select: "companyName displayName",
                },
              },
            ]);
          }
          break;

        case "InPersonAestheticTraining":
          enrollment = user.myInPersonCourses.find(
            (c) => c.courseId && c.courseId.toString() === courseId
          );
          if (enrollment) {
            course = await InPersonAestheticTraining.findById(
              courseId
            ).populate([
              "instructors.primary.instructorId",
              "instructors.additional.instructorId",
              "certification.issuingAuthorityId",
              "certification.certificationBodies.bodyId",
              // ✅ NEW: Populate linked course data
              {
                path: "linkedToOnline.onlineCourseId",
                select: "basic schedule platform certification",
                populate: {
                  path: "certification.issuingAuthorityId",
                  select: "companyName displayName",
                },
              },
            ]);
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid course type",
          });
      }

      if (!enrollment || !course) {
        return res.status(404).json({
          success: false,
          message: "Course enrollment not found",
        });
      }

      // ============================================
      // ✅ STEP 2: Use course model's certificate eligibility method
      // ============================================
      let certificateEligibility;

      try {
        if (courseType === "SelfPacedOnlineTraining") {
          // Self-paced courses don't have linked course logic yet
          certificateEligibility = {
            eligible: course.isCertificateEligible
              ? course.isCertificateEligible(userId)
              : true,
          };
        } else {
          // Use the new canIssueCertificate method for live and in-person courses
          certificateEligibility = await course.canIssueCertificate(userId);
        }
      } catch (methodError) {
        console.warn(
          "⚠️ Course method not available, falling back to basic check:",
          methodError.message
        );
        certificateEligibility = { eligible: true };
      }

      // ============================================
      // ✅ STEP 3: Check certificate eligibility with linked course logic
      // ============================================
      if (!certificateEligibility.eligible) {
        return res.status(400).json({
          success: false,
          message:
            certificateEligibility.reason || "Certificate requirements not met",
          linkedCourse: certificateEligibility.linkedInPersonCourseId
            ? {
                courseId: certificateEligibility.linkedInPersonCourseId,
                message:
                  "Complete the linked in-person course to receive your certificate",
              }
            : null,
          eligibilityDetails: certificateEligibility,
        });
      }

      // ============================================
      // ✅ STEP 4: Additional enrollment-specific checks
      // ============================================
      let isCompleted = false;
      let eligibilityErrors = [];

      if (courseType === "SelfPacedOnlineTraining") {
        isCompleted = enrollment.courseProgress?.status === "completed";
        if (!isCompleted) {
          eligibilityErrors.push(
            "All course videos and exams must be completed"
          );
        }
      } else if (courseType === "OnlineLiveTraining") {
        // Use the enhanced eligibility checking
        const courseEnded =
          new Date(course.schedule.endDate || course.schedule.startDate) <
          new Date();
        if (!courseEnded) {
          eligibilityErrors.push(
            "Course must be completed before certificate can be issued"
          );
        }

        const attendanceConfirmed =
          enrollment.userProgress?.sessionsAttended?.length > 0 ||
          enrollment.userProgress?.courseStatus === "completed";
        if (!attendanceConfirmed) {
          eligibilityErrors.push("Attendance must be confirmed");
        }

        // Assessment checks
        if (course.assessment?.required && course.assessment?.type !== "none") {
          const assessmentCompleted = enrollment.assessmentCompleted || false;
          const assessmentScore =
            enrollment.assessmentScore || enrollment.bestAssessmentScore || 0;
          const passingScore = course.assessment?.passingScore || 70;
          const assessmentPassed = assessmentScore >= passingScore;

          if (!assessmentCompleted) {
            eligibilityErrors.push("Assessment must be completed");
          } else if (!assessmentPassed) {
            eligibilityErrors.push(
              `Assessment score must be ${passingScore}% or higher (current: ${assessmentScore}%)`
            );
          }
        }

        isCompleted =
          courseEnded &&
          attendanceConfirmed &&
          (!course.assessment?.required ||
            (enrollment.assessmentCompleted &&
              (enrollment.assessmentScore ||
                enrollment.bestAssessmentScore ||
                0) >= (course.assessment?.passingScore || 70)));
      } else if (courseType === "InPersonAestheticTraining") {
        const courseEnded =
          new Date(course.schedule.endDate || course.schedule.startDate) <
          new Date();
        if (!courseEnded) {
          eligibilityErrors.push(
            "Course must be completed before certificate can be issued"
          );
        }

        const attendanceConfirmed =
          enrollment.userProgress?.attendanceRecords?.length > 0 ||
          enrollment.userProgress?.courseStatus === "completed";
        if (!attendanceConfirmed) {
          eligibilityErrors.push("Attendance must be confirmed");
        }

        // Assessment checks for in-person
        if (course.assessment?.required && course.assessment?.type !== "none") {
          const assessmentCompleted =
            enrollment.userProgress?.assessmentCompleted || false;
          const assessmentScore = enrollment.userProgress?.assessmentScore || 0;
          const passingScore = course.assessment?.passingScore || 70;
          const assessmentPassed = assessmentScore >= passingScore;

          if (!assessmentCompleted) {
            eligibilityErrors.push("Assessment must be completed");
          } else if (!assessmentPassed) {
            eligibilityErrors.push(
              `Assessment score must be ${passingScore}% or higher (current: ${assessmentScore}%)`
            );
          }
        }

        isCompleted =
          courseEnded &&
          attendanceConfirmed &&
          (!course.assessment?.required ||
            (enrollment.userProgress?.assessmentCompleted &&
              (enrollment.userProgress?.assessmentScore || 0) >=
                (course.assessment?.passingScore || 70)));
      }

      if (!isCompleted || eligibilityErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Certificate eligibility requirements not met",
          errors: eligibilityErrors,
        });
      }

      // ============================================
      // ✅ STEP 5: Check if certificate already exists
      // ============================================
      const existingCertificate = user.myCertificates?.find(
        (cert) =>
          cert.courseId.toString() === courseId &&
          cert.courseType === courseType
      );

      if (existingCertificate) {
        return res.status(200).json({
          success: true,
          message: "Certificate already exists",
          certificate: {
            certificateId: existingCertificate.certificateId,
            verificationCode:
              existingCertificate.certificateData.verificationCode,
          },
        });
      }

      // ============================================
      // ✅ STEP 6: Generate certificate with linked course awareness
      // ============================================
      const verificationCode = this.generateVerificationCode();
      const certificateId = this.generateCertificateId();

      const instructorsForCert = await this.buildInstructorsDataForCertificate(
        course,
        courseType
      );
      const certificationBodiesForCert =
        await this.buildCertificationBodiesForCertificate(course.certification);

      // ✅ NEW: Enhanced certificate data with linked course info
      const certificateData = {
        certificateId: certificateId,
        courseId: courseId,
        courseType: courseType,
        certificateData: {
          recipientName: `${user.firstName} ${user.lastName}`,
          courseTitle: course.basic?.title || "Professional Course",
          courseCode: course.basic?.courseCode || "N/A",
          instructors: instructorsForCert,
          primaryInstructorName:
            instructorsForCert.find((i) => i.isPrimary)?.name ||
            "IAAI Training Team",
          certificationBodies: certificationBodiesForCert,
          primaryIssuingAuthority:
            certificationBodiesForCert.find((cb) => cb.isPrimary)?.name ||
            "IAAI Training Institute",
          completionDate:
            enrollment.courseProgress?.completionDate ||
            enrollment.userProgress?.completionDate ||
            new Date(),
          issueDate: new Date(),
          expiryDate: null,
          achievement: this.buildEnhancedAchievementData(
            enrollment,
            course,
            courseType
          ),
          deliveryMethod: this.getDeliveryMethodDisplay(courseType, course),
          verificationCode: verificationCode,

          // ✅ NEW: Linked course information in certificate
          linkedCourseInfo: this.buildLinkedCourseInfo(course, courseType),

          digitalSignature: "",
          qrCodeUrl: `/qr/certificate/${verificationCode}`,
          pdfUrl: `/certificates/${userId}/${certificateId}.pdf`,
          imageUrl: `/certificates/${userId}/${certificateId}.png`,
        },
        downloadCount: 0,
        lastDownloaded: null,
        isPublic: false,
        shareUrl: `${
          process.env.BASE_URL || "http://localhost:3000"
        }/certificates/verify/${verificationCode}`,
      };

      certificateData.certificateData.digitalSignature =
        this.generateDigitalSignature(certificateData.certificateData);

      if (!user.myCertificates) user.myCertificates = [];
      user.myCertificates.push(certificateData);

      enrollment.certificateId = certificateId;
      this.updateUserAchievementSummary(user);

      await user.save();

      console.log(
        `✅ Enhanced certificate issued with linked course support: ${certificateId}`
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
        linkedCourseInfo: certificateData.certificateData.linkedCourseInfo,
      });
    } catch (error) {
      console.error("❌ Error in enhanced certificate issuance:", error);
      res.status(500).json({
        success: false,
        message: "Error issuing certificate",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * ✅ NEW: Build linked course information for certificate
   */
  buildLinkedCourseInfo(course, courseType) {
    const linkedInfo = {
      hasLinkedCourse: false,
      linkedCourseType: null,
      linkedCourseTitle: null,
      linkedCourseCode: null,
      combinedTraining: false,
    };

    try {
      if (
        courseType === "OnlineLiveTraining" &&
        course.linkedToInPerson?.isLinked
      ) {
        const linkedCourse = course.linkedToInPerson.inPersonCourseId;
        linkedInfo.hasLinkedCourse = true;
        linkedInfo.linkedCourseType = "In-Person Training";
        linkedInfo.linkedCourseTitle =
          linkedCourse?.basic?.title || "In-Person Component";
        linkedInfo.linkedCourseCode = linkedCourse?.basic?.courseCode || "N/A";
        linkedInfo.combinedTraining = true;
        linkedInfo.description =
          "This certificate represents completion of the online component of a comprehensive training program.";
      } else if (
        courseType === "InPersonAestheticTraining" &&
        course.linkedToOnline?.isLinked
      ) {
        const linkedCourse = course.linkedToOnline.onlineCourseId;
        linkedInfo.hasLinkedCourse = true;
        linkedInfo.linkedCourseType = "Online Training";
        linkedInfo.linkedCourseTitle =
          linkedCourse?.basic?.title || "Online Component";
        linkedInfo.linkedCourseCode = linkedCourse?.basic?.courseCode || "N/A";
        linkedInfo.combinedTraining = true;
        linkedInfo.description =
          "This certificate represents completion of both online and in-person components of a comprehensive training program.";
      }
    } catch (error) {
      console.warn("⚠️ Error building linked course info:", error.message);
    }

    return linkedInfo;
  }

  /**
   * ✅ UPDATED: Enhanced certificate view with linked course information
   */
  async viewCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const userId = req.user._id;

      console.log(
        `🔍 Enhanced certificate view with linked course support: ${certificateId}`
      );

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
          (cert) => cert._id.toString() === certificateId
        );
      }

      if (!certificate) {
        return res.status(404).render("error", {
          message: "Certificate not found",
          user: req.user,
        });
      }

      console.log(`📋 Certificate found with linked course support:`, {
        certificateId: certificate.certificateId,
        courseId: certificate.courseId,
        courseType: certificate.courseType,
        hasLinkedInfo: !!certificate.certificateData?.linkedCourseInfo,
      });

      // ✅ Fetch course data with linked course information
      let enhancedCourseData = {};
      const courseId = certificate.courseId;
      const courseType = certificate.courseType;

      try {
        let courseModel;
        let course = null;

        switch (courseType) {
          case "SelfPacedOnlineTraining":
            courseModel = SelfPacedOnlineTraining;
            course = await courseModel
              .findById(courseId)
              .populate({
                path: "instructor.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              })
              .populate({
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              })
              .populate({
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              });
            break;

          case "OnlineLiveTraining":
            courseModel = OnlineLiveTraining;
            course = await courseModel
              .findById(courseId)
              .populate({
                path: "instructors.primary.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              })
              .populate({
                path: "instructors.additional.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              })
              .populate({
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              })
              .populate({
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              })
              // ✅ NEW: Populate linked course for display
              .populate({
                path: "linkedToInPerson.inPersonCourseId",
                select: "basic schedule venue",
              });
            break;

          case "InPersonAestheticTraining":
            courseModel = InPersonAestheticTraining;
            course = await courseModel
              .findById(courseId)
              .populate({
                path: "instructors.primary.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              })
              .populate({
                path: "instructors.additional.instructorId",
                select:
                  "firstName lastName fullName title bio profileImage credentials",
              })
              .populate({
                path: "certification.issuingAuthorityId",
                select: "companyName displayName logo website contactInfo",
              })
              .populate({
                path: "certification.certificationBodies.bodyId",
                select: "companyName displayName logo website contactInfo",
              })
              // ✅ NEW: Populate linked course for display
              .populate({
                path: "linkedToOnline.onlineCourseId",
                select: "basic schedule platform",
              });
            break;

          default:
            throw new Error(`Unknown course type: ${courseType}`);
        }

        if (course) {
          console.log(`✅ Course found with linked course data:`, {
            title: course.basic?.title,
            hasLinkedCourse: !!(
              course.linkedToInPerson?.inPersonCourseId ||
              course.linkedToOnline?.onlineCourseId
            ),
          });

          enhancedCourseData = {
            basic: course.basic,
            certification: course.certification,
            instructors: course.instructors || course.instructor,
            venue: course.venue,
            platform: course.platform,
            schedule: course.schedule,
            // ✅ NEW: Include linked course data
            linkedCourse:
              course.linkedToInPerson?.inPersonCourseId ||
              course.linkedToOnline?.onlineCourseId,
          };
        }
      } catch (courseError) {
        console.error(`❌ Error fetching course data:`, courseError);
      }

      // Build certification bodies and instructors data
      const certificationBodies = await this.buildCertificationBodiesData(
        enhancedCourseData.certification
      );
      const instructors = await this.buildInstructorsData(
        enhancedCourseData.instructors,
        courseType
      );

      // Build comprehensive certificate data
      const enhancedCertificate = {
        ...certificate.toObject(),
        courseDetails: {
          ...enhancedCourseData,
          certificationBodies: certificationBodies,
          instructors: instructors,
          deliveryMethod: this.getDeliveryMethodDisplay(
            courseType,
            enhancedCourseData
          ),
        },
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

      console.log(`✅ Rendering certificate with linked course support`);

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
  // Keep all existing methods unchanged
  // ========================================

  async buildCertificationBodiesData(certification) {
    const certificationBodies = [];

    try {
      console.log("🏆 Building certification bodies from:", {
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
          const bodyId =
            typeof certification.issuingAuthorityId === "object"
              ? certification.issuingAuthorityId._id
              : certification.issuingAuthorityId;

          primaryBody = await CertificationBody.findById(bodyId).select(
            "companyName displayName logo website contactInfo"
          );
        }

        if (primaryBody) {
          certificationBodies.push({
            name: primaryBody.displayName || primaryBody.companyName,
            role: "Primary Issuer",
            logo: primaryBody.logo,
            website: primaryBody.website,
            contactInfo: primaryBody.contactInfo,
            isPrimary: true,
          });
        }
      }

      // Additional certification bodies
      if (
        certification?.certificationBodies &&
        Array.isArray(certification.certificationBodies)
      ) {
        for (const [
          index,
          bodyRef,
        ] of certification.certificationBodies.entries()) {
          if (bodyRef.bodyId) {
            let body;

            if (
              typeof bodyRef.bodyId === "object" &&
              bodyRef.bodyId.companyName
            ) {
              body = bodyRef.bodyId;
            } else {
              const bodyId =
                typeof bodyRef.bodyId === "object"
                  ? bodyRef.bodyId._id
                  : bodyRef.bodyId;

              body = await CertificationBody.findById(bodyId).select(
                "companyName displayName logo website contactInfo"
              );
            }

            if (body) {
              certificationBodies.push({
                name: body.displayName || body.companyName,
                role: this.formatCertificationRole(bodyRef.role),
                logo: body.logo,
                website: body.website,
                contactInfo: body.contactInfo,
                isPrimary: false,
              });
            }
          }
        }
      }

      // Fallback only if no bodies found
      if (certificationBodies.length === 0) {
        certificationBodies.push({
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          logo: "/images/iaai-logo.png",
          website: "https://iaai.com",
          isPrimary: true,
        });
      }
    } catch (error) {
      console.error("❌ Error building certification bodies:", error);
      return [
        {
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          logo: "/images/iaai-logo.png",
          website: "https://iaai.com",
          isPrimary: true,
        },
      ];
    }

    return certificationBodies;
  }

  async buildInstructorsData(instructors, courseType) {
    const instructorsList = [];

    try {
      if (courseType === "SelfPacedOnlineTraining") {
        if (instructors?.instructorId) {
          let instructor;

          if (
            typeof instructors.instructorId === "object" &&
            instructors.instructorId.firstName
          ) {
            instructor = instructors.instructorId;
          } else {
            const instructorId =
              typeof instructors.instructorId === "object"
                ? instructors.instructorId._id
                : instructors.instructorId;

            instructor = await Instructor.findById(instructorId).select(
              "firstName lastName fullName title bio profileImage credentials"
            );
          }

          if (instructor) {
            instructorsList.push({
              name:
                instructor.fullName ||
                `${instructor.firstName} ${instructor.lastName}`,
              title:
                instructor.title || instructors.title || "Course Instructor",
              role: "Lead Instructor",
              bio: instructor.bio,
              profileImage: instructor.profileImage,
              credentials: instructor.credentials,
              isPrimary: true,
            });
          }
        }
      } else {
        // Primary instructor
        if (instructors?.primary?.instructorId) {
          let primaryInstructor;

          if (
            typeof instructors.primary.instructorId === "object" &&
            instructors.primary.instructorId.firstName
          ) {
            primaryInstructor = instructors.primary.instructorId;
          } else {
            const instructorId =
              typeof instructors.primary.instructorId === "object"
                ? instructors.primary.instructorId._id
                : instructors.primary.instructorId;

            primaryInstructor = await Instructor.findById(instructorId).select(
              "firstName lastName fullName title bio profileImage credentials"
            );
          }

          if (primaryInstructor) {
            instructorsList.push({
              name:
                primaryInstructor.fullName ||
                `${primaryInstructor.firstName} ${primaryInstructor.lastName}`,
              title: primaryInstructor.title,
              role: instructors.primary.role || "Lead Instructor",
              bio: primaryInstructor.bio,
              profileImage: primaryInstructor.profileImage,
              credentials: primaryInstructor.credentials,
              isPrimary: true,
            });
          }
        }

        // Additional instructors
        if (instructors?.additional && Array.isArray(instructors.additional)) {
          for (const [
            index,
            additionalInstr,
          ] of instructors.additional.entries()) {
            if (additionalInstr.instructorId) {
              let instructor;

              if (
                typeof additionalInstr.instructorId === "object" &&
                additionalInstr.instructorId.firstName
              ) {
                instructor = additionalInstr.instructorId;
              } else {
                const instructorId =
                  typeof additionalInstr.instructorId === "object"
                    ? additionalInstr.instructorId._id
                    : additionalInstr.instructorId;

                instructor = await Instructor.findById(instructorId).select(
                  "firstName lastName fullName title bio profileImage credentials"
                );
              }

              if (instructor) {
                instructorsList.push({
                  name:
                    instructor.fullName ||
                    `${instructor.firstName} ${instructor.lastName}`,
                  title: instructor.title,
                  role: additionalInstr.role || "Co-Instructor",
                  bio: instructor.bio,
                  profileImage: instructor.profileImage,
                  credentials: instructor.credentials,
                  isPrimary: false,
                });
              }
            }
          }
        }
      }

      // Fallback only if no instructors found
      if (instructorsList.length === 0) {
        instructorsList.push({
          name: "IAAI Training Team",
          title: "Professional Instructor",
          role: "Lead Instructor",
          isPrimary: true,
        });
      }
    } catch (error) {
      console.error("❌ Error building instructors data:", error);
      return [
        {
          name: "IAAI Training Team",
          title: "Professional Instructor",
          role: "Lead Instructor",
          isPrimary: true,
        },
      ];
    }

    return instructorsList;
  }

  getDeliveryMethodDisplay(courseType, courseData) {
    switch (courseType) {
      case "OnlineLiveTraining":
        const platform = courseData?.platform?.name || "Online Platform";
        return `Live Online Training via ${platform}`;

      case "InPersonAestheticTraining":
        const location = courseData?.venue
          ? `${courseData.venue.city}, ${courseData.venue.country}`
          : "Training Center";
        return `In-Person Training at ${location}`;

      case "SelfPacedOnlineTraining":
        return "Self-Paced Online Learning";

      default:
        return "Professional Training";
    }
  }

  formatCertificationRole(role) {
    const roleMap = {
      "co-issuer": "Co-Issuer",
      endorser: "Endorsing Body",
      partner: "Partner Organization",
    };

    return roleMap[role] || "Supporting Organization";
  }

  // Keep all other existing methods...
  async downloadCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const userId = req.user._id;

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const certificate = user.myCertificates?.find(
        (cert) => cert.certificateId === certificateId
      );

      if (!certificate) {
        return res
          .status(404)
          .json({ success: false, message: "Certificate not found" });
      }

      certificate.downloadCount += 1;
      certificate.lastDownloaded = new Date();
      await user.save();

      res.json({
        success: true,
        message: "PDF generation coming soon! Certificate data saved.",
        certificate: certificate,
      });
    } catch (error) {
      console.error("❌ Error downloading certificate:", error);
      res
        .status(500)
        .json({ success: false, message: "Error downloading certificate" });
    }
  }

  async getUserCertificates(req, res) {
    try {
      const userId = req.user._id;

      const user = await User.findById(userId).select(
        "myCertificates achievementSummary firstName lastName"
      );
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
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
          // ✅ NEW: Include linked course info
          linkedCourseInfo: cert.certificateData.linkedCourseInfo || null,
        })),
        achievementSummary: user.achievementSummary || {
          totalCertificates: 0,
          activeCertificates: 0,
          achievementLevel: "Beginner",
        },
      });
    } catch (error) {
      console.error("❌ Error getting user certificates:", error);
      res
        .status(500)
        .json({ success: false, message: "Error retrieving certificates" });
    }
  }

  async getCertificatesPage(req, res) {
    try {
      const userId = req.user._id;

      const user = await User.findById(userId).select(
        "myCertificates achievementSummary firstName lastName"
      );
      if (!user) {
        return res.status(404).render("error", { message: "User not found" });
      }

      const certificates = user.myCertificates || [];
      const achievementSummary = user.achievementSummary || {
        totalCertificates: 0,
        activeCertificates: 0,
        achievementLevel: "Beginner",
        totalLearningHours: 0,
        specializations: [],
      };

      res.render("myCertificates", {
        user: req.user,
        certificates,
        achievementSummary,
        title: "My Certificates - Professional Achievements",
      });
    } catch (error) {
      console.error("❌ Error loading certificates page:", error);
      res
        .status(500)
        .render("error", { message: "Error loading certificates" });
    }
  }

  async shareCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const { platform } = req.body;
      const userId = req.user._id;

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const certificate = user.myCertificates?.find(
        (cert) => cert.certificateId === certificateId
      );

      if (!certificate) {
        return res
          .status(404)
          .json({ success: false, message: "Certificate not found" });
      }

      const shareData = {
        title: `I just completed ${certificate.certificateData.courseTitle}!`,
        description: `Proud to have earned my certificate in ${certificate.certificateData.courseTitle} from IAAI Training Institute.`,
        url: certificate.shareUrl,
        hashtags: [
          "IAAI",
          "AestheticTraining",
          "ProfessionalDevelopment",
          "Certificate",
        ],
      };

      res.json({
        success: true,
        shareData,
        message: "Certificate sharing data prepared",
      });
    } catch (error) {
      console.error("❌ Error sharing certificate:", error);
      res
        .status(500)
        .json({ success: false, message: "Error sharing certificate" });
    }
  }

  async buildInstructorsDataForCertificate(course, courseType) {
    const instructors = [];

    if (courseType === "SelfPacedOnlineTraining") {
      if (course.instructor?.instructorId) {
        instructors.push({
          name:
            course.instructor.instructorId.fullName || course.instructor.name,
          title:
            course.instructor.instructorId.title || course.instructor.title,
          role: "Lead Instructor",
          isPrimary: true,
        });
      }
    } else {
      if (course.instructors?.primary?.instructorId) {
        instructors.push({
          name:
            course.instructors.primary.instructorId.fullName ||
            course.instructors.primary.name,
          title: course.instructors.primary.instructorId.title,
          role: course.instructors.primary.role || "Lead Instructor",
          isPrimary: true,
        });
      }

      if (course.instructors?.additional) {
        course.instructors.additional.forEach((additional) => {
          if (additional.instructorId) {
            instructors.push({
              name: additional.instructorId.fullName || additional.name,
              title: additional.instructorId.title,
              role: additional.role || "Co-Instructor",
              isPrimary: false,
            });
          }
        });
      }
    }

    return instructors;
  }

  async buildCertificationBodiesForCertificate(certification) {
    const bodies = [];

    try {
      if (certification?.issuingAuthorityId) {
        let primaryBody;
        if (typeof certification.issuingAuthorityId === "object") {
          primaryBody = certification.issuingAuthorityId;
        } else {
          primaryBody = await CertificationBody.findById(
            certification.issuingAuthorityId
          ).select("companyName displayName");
        }

        if (primaryBody) {
          bodies.push({
            name: primaryBody.displayName || primaryBody.companyName,
            role: "Primary Issuer",
            isPrimary: true,
          });
        }
      }

      if (
        certification?.certificationBodies &&
        Array.isArray(certification.certificationBodies)
      ) {
        for (const bodyRef of certification.certificationBodies) {
          if (bodyRef.bodyId) {
            let body;
            if (typeof bodyRef.bodyId === "object") {
              body = bodyRef.bodyId;
            } else {
              body = await CertificationBody.findById(bodyRef.bodyId).select(
                "companyName displayName"
              );
            }

            if (body) {
              bodies.push({
                name: body.displayName || body.companyName,
                role: this.formatCertificationRole(bodyRef.role),
                isPrimary: false,
              });
            }
          }
        }
      }

      if (bodies.length === 0) {
        bodies.push({
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          isPrimary: true,
        });
      }
    } catch (error) {
      console.error(
        "❌ Error building certification bodies for storage:",
        error
      );
      return [
        {
          name: "IAAI Training Institute",
          role: "Primary Issuer",
          isPrimary: true,
        },
      ];
    }

    return bodies;
  }

  buildEnhancedAchievementData(enrollment, course, courseType) {
    if (courseType === "SelfPacedOnlineTraining") {
      const totalVideos = course.videos?.length || 0;
      const completedVideos =
        enrollment.courseProgress?.completedVideos?.length || 0;
      const totalExams =
        course.videos?.filter((v) => v.exam && v.exam.length > 0).length || 0;
      const completedExams =
        enrollment.courseProgress?.completedExams?.length || 0;

      let averageScore = 0;
      if (enrollment.examProgress?.length > 0) {
        const totalScore = enrollment.examProgress.reduce(
          (sum, ep) => sum + (ep.bestScore || 0),
          0
        );
        averageScore = Math.round(totalScore / enrollment.examProgress.length);
      }

      return {
        attendancePercentage: 100,
        examScore: averageScore,
        totalHours:
          Math.round((enrollment.courseProgress?.totalWatchTime || 0) / 3600) ||
          8,
        grade: this.calculateGrade(averageScore),
        courseSpecificData: {
          totalVideos: totalVideos,
          completedVideos: completedVideos,
          totalExams: totalExams,
          completedExams: completedExams,
          selfDirectedLearning: true,
        },
      };
    } else if (courseType === "OnlineLiveTraining") {
      const totalSessions = course.schedule.sessions?.length || 1;
      const attendedSessions =
        enrollment.userProgress?.sessionsAttended?.length || 0;
      const attendancePercentage =
        totalSessions > 0
          ? Math.round((attendedSessions / totalSessions) * 100)
          : 100;

      let totalHours = 8;
      if (course.schedule.sessions && course.schedule.sessions.length > 0) {
        totalHours = course.schedule.sessions.reduce((sum, session) => {
          if (session.startTime && session.endTime) {
            const start = new Date(`2000-01-01T${session.startTime}`);
            const end = new Date(`2000-01-01T${session.endTime}`);
            return sum + (end - start) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
      }

      const assessmentScore =
        enrollment.assessmentScore || enrollment.bestAssessmentScore || null;

      return {
        attendancePercentage: attendancePercentage,
        examScore: assessmentScore,
        totalHours: Math.round(totalHours),
        grade: this.calculateGrade(assessmentScore || 100),
        courseSpecificData: {
          totalSessions: totalSessions,
          attendedSessions: attendedSessions,
          platform: course.platform?.name,
          interactionLevel:
            Object.keys(course.interaction || {}).length > 3
              ? "High"
              : "Standard",
        },
      };
    } else if (courseType === "InPersonAestheticTraining") {
      const attendanceRecords =
        enrollment.userProgress?.attendanceRecords?.length || 0;
      const totalHoursAttended =
        enrollment.userProgress?.attendanceRecords?.reduce(
          (sum, record) => sum + (record.hoursAttended || 0),
          0
        ) || 8;
      const attendancePercentage =
        enrollment.userProgress?.overallAttendancePercentage || 100;
      const assessmentScore = enrollment.userProgress?.assessmentScore || null;

      return {
        attendancePercentage: attendancePercentage,
        examScore: assessmentScore,
        totalHours: totalHoursAttended,
        grade: this.calculateGrade(assessmentScore || 100),
        courseSpecificData: {
          totalHoursAttended: totalHoursAttended,
          location: course.venue
            ? `${course.venue.city}, ${course.venue.country}`
            : "Training Center",
          venue: course.venue?.name || "IAAI Training Center",
          practicalComponent: true,
          materialsProvided: course.inclusions?.materials?.length || 0,
        },
      };
    }

    return {
      attendancePercentage: 100,
      examScore: null,
      totalHours: 8,
      grade: "Pass",
      courseSpecificData: {
        deliveryMethod: this.getDeliveryMethodDisplay(courseType, course),
      },
    };
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

  updateUserAchievementSummary(user) {
    const certificates = user.myCertificates || [];
    const totalLearningHours = certificates.reduce((sum, cert) => {
      return sum + (cert.certificateData?.achievement?.totalHours || 0);
    }, 0);

    const specializations = [
      ...new Set(
        certificates.map((cert) => {
          switch (cert.courseType) {
            case "OnlineLiveTraining":
              return "Live Online Training";
            case "InPersonAestheticTraining":
              return "In-Person Aesthetic Training";
            case "SelfPacedOnlineTraining":
              return "Self-Paced Learning";
            default:
              return "General Training";
          }
        })
      ),
    ];

    let achievementLevel = "Beginner";
    if (certificates.length >= 15) achievementLevel = "Master";
    else if (certificates.length >= 10) achievementLevel = "Expert";
    else if (certificates.length >= 7) achievementLevel = "Advanced";
    else if (certificates.length >= 3) achievementLevel = "Intermediate";

    const scoresWithValues = certificates
      .map((cert) => cert.certificateData?.achievement?.examScore)
      .filter((score) => score !== null && score !== undefined && score > 0);

    const averageScore =
      scoresWithValues.length > 0
        ? Math.round(
            scoresWithValues.reduce((sum, score) => sum + score, 0) /
              scoresWithValues.length
          )
        : null;

    user.achievementSummary = {
      totalCertificates: certificates.length,
      activeCertificates: certificates.length,
      specializations: specializations,
      totalLearningHours: totalLearningHours,
      achievementLevel: achievementLevel,
      averageScore: averageScore,
      courseTypeBreakdown: {
        selfPaced: certificates.filter(
          (c) => c.courseType === "SelfPacedOnlineTraining"
        ).length,
        liveOnline: certificates.filter(
          (c) => c.courseType === "OnlineLiveTraining"
        ).length,
        inPerson: certificates.filter(
          (c) => c.courseType === "InPersonAestheticTraining"
        ).length,
      },
      recentAchievements: certificates
        .sort(
          (a, b) =>
            new Date(b.certificateData.issueDate) -
            new Date(a.certificateData.issueDate)
        )
        .slice(0, 3)
        .map((cert) => ({
          certificateId: cert.certificateId,
          courseTitle: cert.certificateData.courseTitle,
          issueDate: cert.certificateData.issueDate,
          courseType: cert.courseType,
        })),
      lastUpdated: new Date(),
    };

    return user.achievementSummary;
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
}

module.exports = new CertificateController();
