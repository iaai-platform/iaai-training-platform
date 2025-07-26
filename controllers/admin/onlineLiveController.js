/**
 * Online Live Courses Controller - Clean JSON Version
 *
 * This controller is designed to work with JSON payloads from the frontend.
 * File uploads are handled separately via dedicated upload endpoints.
 *
 * @module OnlineLiveCoursesController
 * @version 3.0.0
 */

const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel");
const Instructor = require("../../models/Instructor");
const User = require("../../models/user");
const CertificationBody = require("../../models/CertificationBody");
const path = require("path");
const emailService = require("../../utils/emailService");
const fs = require("fs").promises;
const courseNotificationController = require("./onlinecourseNotificationController");
const cloudinary = require("cloudinary").v2;

class OnlineLiveCoursesController {
  // ==========================================
  // VIEW RENDERING
  // ==========================================

  /**
   * Renders the admin online courses management page.
   * @route GET /admin-courses/onlinelive
   */
  async renderAdminPage(req, res) {
    try {
      res.render("admin/admin-manage-course-onlinelive", {
        title: "Manage Online Live Courses",
        user: req.user,
        layout: "admin/layout",
      });
    } catch (error) {
      console.error("❌ Error rendering admin page:", error);
      res.status(500).send("Error loading admin page");
    }
  }

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Retrieves all online courses with filtering and pagination.
   * @route GET /admin-courses/onlinelive/api
   */
  async getAllCourses(req, res) {
    try {
      console.log("📋 Getting all online courses...");

      const {
        page = 1,
        limit = 10,
        search,
        status,
        category,
        platform,
        sortBy = "schedule.startDate",
        sortOrder = "desc",
      } = req.query;

      const filter = this._buildCoursesFilter(
        search,
        status,
        category,
        platform
      );
      const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [courses, totalCourses] = await Promise.all([
        OnlineLiveTraining.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .populate(
            "instructors.primary.instructorId",
            "firstName lastName title email"
          )
          .populate(
            "instructors.additional.instructorId",
            "firstName lastName title email"
          )
          .lean(),
        OnlineLiveTraining.countDocuments(filter),
      ]);

      const coursesWithEnrollment = await this._addEnrollmentCounts(courses);
      const paginationInfo = this._calculatePagination(
        parseInt(page),
        parseInt(limit),
        totalCourses
      );

      console.log(
        `✅ Found ${courses.length} courses out of ${totalCourses} total.`
      );

      res.json({
        success: true,
        courses: coursesWithEnrollment,
        pagination: paginationInfo,
      });
    } catch (error) {
      console.error("❌ Error fetching courses:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching courses",
        error: error.message,
      });
    }
  }

  /**
   * Retrieves a specific online course by its ID.
   * @route GET /admin-courses/onlinelive/api/:id
   */
  async getCourseById(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🔍 Getting online course by ID:", courseId);

      const course = await OnlineLiveTraining.findById(courseId)
        .populate(
          "instructors.primary.instructorId",
          "firstName lastName title email"
        )
        .populate(
          "instructors.additional.instructorId",
          "firstName lastName title email"
        )
        .populate(
          "certification.issuingAuthorityId",
          "companyName displayName specializations"
        )
        .populate(
          "certification.certificationBodies.bodyId",
          "companyName displayName specializations"
        )
        .lean();

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Format dates for form inputs
      if (course.schedule) {
        course.schedule.startDate = course.schedule.startDate
          ? new Date(course.schedule.startDate).toISOString().slice(0, 16)
          : null;
        course.schedule.endDate = course.schedule.endDate
          ? new Date(course.schedule.endDate).toISOString().slice(0, 16)
          : null;
        course.schedule.registrationDeadline = course.schedule
          .registrationDeadline
          ? new Date(course.schedule.registrationDeadline)
              .toISOString()
              .slice(0, 16)
          : null;
      }

      if (course.technical?.techCheckDate) {
        course.technical.techCheckDate = new Date(
          course.technical.techCheckDate
        )
          .toISOString()
          .slice(0, 16);
      }

      if (course.experience?.onboarding?.orientationDate) {
        course.experience.onboarding.orientationDate = new Date(
          course.experience.onboarding.orientationDate
        )
          .toISOString()
          .slice(0, 16);
      }

      // Process instructor data for frontend
      if (course.instructors?.primary?.instructorId) {
        course.instructors.primary.name =
          course.instructors.primary.instructorId.firstName +
          " " +
          course.instructors.primary.instructorId.lastName;
        course.instructors.primary.instructorId =
          course.instructors.primary.instructorId._id.toString();
      } else {
        course.instructors = course.instructors || {};
        course.instructors.primary = course.instructors.primary || {};
        course.instructors.primary.instructorId = "";
        course.instructors.primary.name = "";
      }

      if (
        course.instructors?.additional &&
        Array.isArray(course.instructors.additional)
      ) {
        course.instructors.additional = course.instructors.additional.map(
          (inst) => {
            if (inst.instructorId) {
              return {
                ...inst,
                instructorId: inst.instructorId._id.toString(),
                name:
                  inst.instructorId.firstName +
                  " " +
                  inst.instructorId.lastName,
                sessions: Array.isArray(inst.sessions)
                  ? inst.sessions.join(", ")
                  : inst.sessions || "",
              };
            }
            return inst;
          }
        );
      }

      // Process media data
      if (
        course.media?.mainImage &&
        typeof course.media.mainImage === "object" &&
        course.media.mainImage.url
      ) {
        course.media.mainImage = course.media.mainImage.url;
      }

      // Convert arrays to comma-separated strings for inputs
      if (
        course.schedule?.displayTimezones &&
        Array.isArray(course.schedule.displayTimezones)
      ) {
        course.schedule.displayTimezones =
          course.schedule.displayTimezones.join(", ");
      }
      if (
        course.technical?.systemRequirements?.os &&
        Array.isArray(course.technical.systemRequirements.os)
      ) {
        course.technical.systemRequirements.os =
          course.technical.systemRequirements.os.join(", ");
      }
      if (
        course.technical?.systemRequirements?.browsers &&
        Array.isArray(course.technical.systemRequirements.browsers)
      ) {
        course.technical.systemRequirements.browsers =
          course.technical.systemRequirements.browsers.join(", ");
      }
      if (course.metadata?.tags && Array.isArray(course.metadata.tags)) {
        course.metadata.tags = course.metadata.tags.join(", ");
      }
      if (
        course.notificationSettings?.reminderSchedule &&
        Array.isArray(course.notificationSettings.reminderSchedule)
      ) {
        course.notificationSettings.reminderSchedule =
          course.notificationSettings.reminderSchedule.join(", ");
      }

      // Convert arrays to object format for dynamic items
      if (
        course.content?.objectives &&
        Array.isArray(course.content.objectives)
      ) {
        course.content.objectives = course.content.objectives.map((obj) => ({
          text: obj,
        }));
      }
      if (
        course.content?.targetAudience &&
        Array.isArray(course.content.targetAudience)
      ) {
        course.content.targetAudience = course.content.targetAudience.map(
          (aud) => ({ text: aud })
        );
      }
      if (
        course.technical?.requiredSoftware &&
        Array.isArray(course.technical.requiredSoftware)
      ) {
        course.technical.requiredSoftware =
          course.technical.requiredSoftware.map((soft) => ({ name: soft }));
      }
      if (
        course.interaction?.engagementTools &&
        Array.isArray(course.interaction.engagementTools)
      ) {
        course.interaction.engagementTools =
          course.interaction.engagementTools.map((tool) => ({ name: tool }));
      }
      if (
        course.postCourse?.continuedLearning?.advancedCourses &&
        Array.isArray(course.postCourse.continuedLearning.advancedCourses)
      ) {
        course.postCourse.continuedLearning.advancedCourses =
          course.postCourse.continuedLearning.advancedCourses.map((code) => ({
            code,
          }));
      }

      // Process certification bodies for frontend
      if (
        course.certification?.certificationBodies &&
        Array.isArray(course.certification.certificationBodies)
      ) {
        course.certification.certificationBodies =
          course.certification.certificationBodies.map((cb) => ({
            bodyId: cb.bodyId ? cb.bodyId._id.toString() : null,
            name: cb.bodyId
              ? cb.bodyId.displayName || cb.bodyId.companyName
              : cb.name,
            role: cb.role,
          }));
      }

      // Get current enrollment count
      const enrollmentCount = await this._getEnrollmentCount(courseId);
      course.enrollment = course.enrollment || {};
      course.enrollment.currentEnrollment = enrollmentCount;

      // Set default values for frontend
      course.assessment = course.assessment || {};
      course.assessment.type = course.assessment.type || "none";
      course.recording = course.recording || {};
      course.recording.type = course.recording.type || "cloud";
      course.technical = course.technical || {};
      course.technical.equipment = course.technical.equipment || {};
      course.technical.equipment.camera =
        course.technical.equipment.camera || "recommended";
      course.technical.equipment.microphone =
        course.technical.equipment.microphone || "required";
      course.technical.equipment.headset =
        course.technical.equipment.headset || "recommended";
      course.attendance = course.attendance || {};
      course.attendance.method = course.attendance.method || "automatic";
      course.content = course.content || {};
      course.content.experienceLevel =
        course.content.experienceLevel || "all-levels";
      course.certification = course.certification || {};
      course.certification.type = course.certification.type || "completion";
      course.platform = course.platform || {};
      course.platform.name = course.platform.name || "Zoom";

      console.log("✅ Found course:", course.basic?.title);

      res.json({
        success: true,
        course: course,
      });
    } catch (error) {
      console.error("❌ Error fetching course:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching course",
        error: error.message,
      });
    }
  }

  /**
   * Retrieves all active instructors for dropdowns.
   * @route GET /admin-courses/onlinelive/api/instructors
   */
  async getAllInstructors(req, res) {
    try {
      console.log("👥 Getting all instructors...");

      const instructors = await Instructor.find({
        isDeleted: { $ne: true },
        status: "Active",
      })
        .select(
          "firstName lastName title email expertise specializations experience"
        )
        .sort({ lastName: 1, firstName: 1 });

      console.log(`✅ Found ${instructors.length} active instructors.`);

      res.json({
        success: true,
        instructors: instructors,
      });
    } catch (error) {
      console.error("❌ Error fetching instructors:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching instructors",
        error: error.message,
      });
    }
  }

  /**
   * Retrieves all active certification bodies for dropdowns.
   * @route GET /admin-courses/onlinelive/api/certification-bodies
   */
  async getAllCertificationBodies(req, res) {
    try {
      console.log("🏢 Getting all certification bodies...");
      const certificationBodies = await CertificationBody.find({
        isActive: true,
        isDeleted: false,
      }).select(
        "companyName displayName description website membershipLevel specializations"
      );

      console.log(
        `✅ Found ${certificationBodies.length} active certification bodies.`
      );
      res.json({
        success: true,
        certificationBodies: certificationBodies,
      });
    } catch (error) {
      console.error("❌ Error fetching certification bodies:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching certification bodies",
        error: error.message,
      });
    }
  }

  // ==========================================
  // CREATE OPERATION - JSON VERSION
  // ==========================================

  /**
   * Creates a new online course using JSON payload - Solution 1: Model Middleware Only
   * @route POST /admin-courses/onlinelive/api
   */
  async createCourse(req, res) {
    console.log(
      "🚀 Creating new online course (JSON) - SOLUTION 1: MODEL MIDDLEWARE ONLY"
    );
    console.log("📥 Request body keys:", Object.keys(req.body));

    try {
      // 1. Parse the JSON payload - SIMPLIFIED
      const { uploadedFiles, ...formData } = req.body;

      console.log("📝 Form data keys:", Object.keys(formData));
      console.log(
        "📁 Uploaded files:",
        uploadedFiles ? Object.keys(uploadedFiles) : "none"
      );

      // 2. Validate the incoming data
      const validationResult = await this._validateCourseData(formData);
      if (!validationResult.isValid) {
        console.log("❌ Validation failed:", validationResult.message);
        return res.status(400).json({
          success: false,
          message: validationResult.message,
          field: validationResult.field,
          errors: validationResult.errors,
        });
      }
      console.log("✅ Validation passed.");

      // 3. Process instructors - FIXED to work with merged data
      const instructorsResult =
        await this._validateAndProcessInstructorsFromMergedData(formData);
      if (!instructorsResult.isValid) {
        return res.status(400).json({
          success: false,
          message: instructorsResult.message,
        });
      }
      console.log("✅ Instructors processed.");

      // 4. Check for duplicate course code
      const courseCode = formData.basic?.courseCode;
      if (!courseCode) {
        return res.status(400).json({
          success: false,
          message: 'Course code is required in the "basic" section.',
        });
      }
      await this._checkDuplicateCourseCode(courseCode);
      console.log(`✅ Course code "${courseCode}" is unique.`);

      // 5. Build the final course data object - INCLUDES ALL COURSE ITEMS
      const courseData = await this._buildCourseDataFromMergedData(
        formData,
        uploadedFiles,
        instructorsResult.instructors,
        req.user
      );
      console.log(
        "✅ Final course data object built - includes ALL course components:"
      );
      console.log("   📋 Basic info, schedule, enrollment, platform");
      console.log("   👥 Instructors (primary + additional)");
      console.log("   📚 Content (objectives, modules, target audience)");
      console.log("   🔧 Technical requirements, interaction settings");
      console.log("   📹 Recording, media files, materials");
      console.log("   📝 Assessment, certification settings");
      console.log("   📊 Attendance, analytics, support info");
      console.log("   🎯 Post-course, experience, notifications");
      console.log("   📄 Metadata and all other course components");

      // 6. Create and save the course - MODEL MIDDLEWARE HANDLES INSTRUCTOR ASSIGNMENTS ONLY
      console.log("💾 Creating and saving new OnlineLiveTraining instance...");
      const newCourse = new OnlineLiveTraining(courseData);

      console.log("🔄 Calling course.save() - this will:");
      console.log(
        "   ✅ Save ALL course data (basic, schedule, content, media, etc.)"
      );
      console.log(
        "   ✅ Trigger model middleware ONLY for instructor assignments"
      );
      console.log("   ✅ Leave all other course data completely untouched");

      const savedCourse = await newCourse.save();

      console.log("✅ Course created successfully with ID:", savedCourse._id);
      console.log(
        "✅ Model middleware automatically handled instructor assignments"
      );
      console.log("✅ ALL other course components saved successfully:");
      console.log(`   📋 Basic: ${savedCourse.basic?.title}`);
      console.log(`   📅 Schedule: ${savedCourse.schedule?.startDate}`);
      console.log(`   💰 Enrollment: $${savedCourse.enrollment?.price}`);
      console.log(`   🖥️ Platform: ${savedCourse.platform?.name}`);
      console.log(
        `   📚 Content modules: ${savedCourse.content?.modules?.length || 0}`
      );
      console.log(
        `   📝 Objectives: ${savedCourse.content?.objectives?.length || 0}`
      );
      console.log(
        `   📁 Media files: ${savedCourse.media ? "configured" : "none"}`
      );
      console.log(
        `   🎓 Certification: ${
          savedCourse.certification?.enabled ? "enabled" : "disabled"
        }`
      );

      // 7. Handle post-creation logic - ALL UNCHANGED
      if (savedCourse.basic.status === "open") {
        console.log("📧 Course is 'open', handling creation notifications...");
        await courseNotificationController.handleCourseCreation(
          savedCourse,
          req.user
        );
      }

      // 8. Send success response - INCLUDES ALL COURSE DATA
      return res.status(201).json({
        success: true,
        message: "Online course created successfully with all components.",
        course: savedCourse,
        components: {
          basic: !!savedCourse.basic,
          schedule: !!savedCourse.schedule,
          enrollment: !!savedCourse.enrollment,
          instructors: !!savedCourse.instructors,
          platform: !!savedCourse.platform,
          content: !!savedCourse.content,
          technical: !!savedCourse.technical,
          interaction: !!savedCourse.interaction,
          recording: !!savedCourse.recording,
          media: !!savedCourse.media,
          materials: !!savedCourse.materials,
          assessment: !!savedCourse.assessment,
          certification: !!savedCourse.certification,
          attendance: !!savedCourse.attendance,
          analytics: !!savedCourse.analytics,
          support: !!savedCourse.support,
          postCourse: !!savedCourse.postCourse,
          experience: !!savedCourse.experience,
          notificationSettings: !!savedCourse.notificationSettings,
          metadata: !!savedCourse.metadata,
        },
      });
    } catch (error) {
      console.error("❌ Error in createCourse (Solution 1):", error);
      return this._handleError(error, res);
    }
  }

  // ==========================================
  // UPDATE OPERATION - JSON VERSION
  // ==========================================

  /**
   * Updates an existing online course using JSON payload
   * @route PUT /admin-courses/onlinelive/api/:id
   */

  /**
   * Updates an existing online course using JSON payload with instructor assignment
   * @route PUT /admin-courses/onlinelive/api/:id
   */
  async updateCourse(req, res) {
    console.log(
      "🚀 Updating online course (JSON) - WITH INSTRUCTOR ASSIGNMENT"
    );
    const courseId = req.params.id;
    console.log("📝 Course ID:", courseId);

    try {
      // 1. Find the existing course
      const existingCourse = await OnlineLiveTraining.findById(courseId);
      if (!existingCourse) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      console.log(`📋 Found existing course: ${existingCourse.basic?.title}`);

      // 2. Parse the JSON payload - SIMPLIFIED
      const { uploadedFiles, ...formData } = req.body;

      console.log("📝 Form data keys:", Object.keys(formData));
      console.log(
        "📁 Uploaded files:",
        uploadedFiles ? Object.keys(uploadedFiles) : "none"
      );

      // 3. Validate the incoming data
      const validationResult = await this._validateCourseData(formData, true);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: validationResult.message,
          field: validationResult.field,
        });
      }

      console.log("✅ Validation passed for course update.");

      // 4. Process instructors - FIXED
      const instructorsResult =
        await this._validateAndProcessInstructorsFromMergedData(formData);
      if (!instructorsResult.isValid) {
        return res.status(400).json({
          success: false,
          message: instructorsResult.message,
        });
      }

      console.log("✅ Instructors processed for update.");

      // *** SECTION 1: REMOVE COURSE ASSIGNMENTS FOR DELETED INSTRUCTORS (BEFORE course update) ***
      console.log(
        "🔍 Checking for instructor changes and removing old assignments..."
      );

      // Get current instructor IDs from the update request
      const currentInstructorIds = [];
      if (instructorsResult.instructors?.primary?.instructorId) {
        currentInstructorIds.push(
          instructorsResult.instructors.primary.instructorId.toString()
        );
        console.log(
          `📝 Primary instructor in update: ${instructorsResult.instructors.primary.instructorId}`
        );
      }
      if (
        instructorsResult.instructors?.additional &&
        Array.isArray(instructorsResult.instructors.additional)
      ) {
        instructorsResult.instructors.additional.forEach((inst) => {
          if (inst.instructorId) {
            currentInstructorIds.push(inst.instructorId.toString());
            console.log(
              `📝 Additional instructor in update: ${inst.instructorId}`
            );
          }
        });
      }

      console.log(
        `📊 Current instructor IDs from update: [${currentInstructorIds.join(
          ", "
        )}]`
      );

      // Find instructors who had this course but are no longer assigned
      const instructorsWithThisCourse = await Instructor.find({
        "assignedCourses.courseId": courseId,
      });

      console.log(
        `🔍 Found ${instructorsWithThisCourse.length} instructors currently assigned to this course`
      );

      for (const instructorDoc of instructorsWithThisCourse) {
        if (!currentInstructorIds.includes(instructorDoc._id.toString())) {
          // Remove course assignment
          const beforeCount = instructorDoc.assignedCourses.length;
          instructorDoc.assignedCourses = instructorDoc.assignedCourses.filter(
            (course) => course.courseId.toString() !== courseId.toString()
          );
          const afterCount = instructorDoc.assignedCourses.length;

          await instructorDoc.save();
          console.log(
            `🗑️ Removed course assignment from instructor: ${instructorDoc.firstName} ${instructorDoc.lastName}`
          );
          console.log(
            `   - Assignments before: ${beforeCount}, after: ${afterCount}`
          );
        } else {
          console.log(
            `✅ Instructor ${instructorDoc.firstName} ${instructorDoc.lastName} still assigned, keeping assignment`
          );
        }
      }

      // 5. Build the update data - FIXED VERSION
      const updateData = await this._buildUpdateDataFromMergedData(
        formData,
        uploadedFiles,
        existingCourse,
        instructorsResult.instructors,
        req.user
      );

      console.log("✅ Update data object built successfully");

      // Clean sessions data before updating
      if (updateData.schedule?.sessions) {
        updateData.schedule.sessions = updateData.schedule.sessions.map(
          (session) => ({
            ...session,
            instructorId:
              session.instructorId === "" ? null : session.instructorId,
          })
        );
        console.log(
          `🧹 Cleaned ${updateData.schedule.sessions.length} sessions data`
        );
      }

      // Clean additional instructors instructorId
      if (updateData.instructors?.additional) {
        updateData.instructors.additional.forEach((inst) => {
          inst.instructorId =
            inst.instructorId === "" ? null : inst.instructorId;
        });
        console.log(
          `🧹 Cleaned ${updateData.instructors.additional.length} additional instructors data`
        );
      }

      console.log("💾 Updating course with ID:", courseId);

      // 6. Update the course
      const updatedCourse = await OnlineLiveTraining.findByIdAndUpdate(
        courseId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedCourse) {
        throw new Error("Failed to update course in database");
      }

      console.log("✅ Course updated successfully in database");

      // *** SECTION 2: ADD/UPDATE ASSIGNMENTS FOR CURRENT INSTRUCTORS (AFTER course update) ***
      console.log("📝 Processing instructor assignments for updated course...");
      const allInstructors = [];

      // Add primary and additional instructors to array
      if (instructorsResult.instructors?.primary) {
        allInstructors.push(instructorsResult.instructors.primary);
        console.log(
          `📝 Added primary instructor: ${instructorsResult.instructors.primary.name}`
        );
      }
      if (
        instructorsResult.instructors?.additional &&
        Array.isArray(instructorsResult.instructors.additional)
      ) {
        allInstructors.push(...instructorsResult.instructors.additional);
        console.log(
          `📝 Added ${instructorsResult.instructors.additional.length} additional instructors`
        );
      }

      console.log(
        `📊 Total instructors to process for assignments: ${allInstructors.length}`
      );

      // Process all instructors
      for (const instructor of allInstructors) {
        try {
          console.log(
            `🔍 Processing instructor assignment: ${instructor.name} (ID: ${instructor.instructorId})`
          );

          const instructorDoc = await Instructor.findById(
            instructor.instructorId
          );

          if (instructorDoc) {
            // Check if course is already assigned
            const existingAssignmentIndex =
              instructorDoc.assignedCourses.findIndex(
                (course) => course.courseId.toString() === courseId.toString()
              );

            if (existingAssignmentIndex !== -1) {
              // Update existing assignment
              const existingAssignment =
                instructorDoc.assignedCourses[existingAssignmentIndex];
              const oldTitle = existingAssignment.courseTitle;
              const oldRole = existingAssignment.role;

              existingAssignment.courseTitle = updatedCourse.basic?.title;
              existingAssignment.startDate = updatedCourse.schedule?.startDate;
              existingAssignment.endDate = updatedCourse.schedule?.endDate;
              existingAssignment.role = instructor.role || "Lead Instructor";

              await instructorDoc.save();
              console.log(
                `✅ Updated existing assignment for instructor: ${instructor.name}`
              );
              console.log(
                `   - Title: "${oldTitle}" → "${existingAssignment.courseTitle}"`
              );
              console.log(
                `   - Role: "${oldRole}" → "${existingAssignment.role}"`
              );
              console.log(`   - Start Date: ${existingAssignment.startDate}`);
            } else {
              // Add new assignment
              const newAssignment = {
                courseId: updatedCourse._id,
                courseType: "OnlineLiveTraining",
                courseTitle: updatedCourse.basic?.title,
                startDate: updatedCourse.schedule?.startDate,
                endDate: updatedCourse.schedule?.endDate,
                role: instructor.role || "Lead Instructor",
                status: "Upcoming",
              };

              instructorDoc.assignedCourses.push(newAssignment);
              await instructorDoc.save();
              console.log(
                `✅ Added new assignment for instructor: ${instructor.name}`
              );
              console.log(`   - Course: ${newAssignment.courseTitle}`);
              console.log(`   - Role: ${newAssignment.role}`);
              console.log(`   - Start Date: ${newAssignment.startDate}`);
            }
          } else {
            console.warn(
              `⚠️ WARNING: Instructor not found with ID: ${instructor.instructorId}`
            );
          }
        } catch (assignError) {
          console.error(
            `❌ ERROR updating course assignment for ${instructor.name}:`,
            assignError
          );
          // Don't fail the entire operation for individual assignment errors
        }
      }

      console.log("✅ Instructor assignment processing completed");

      // 7. Handle update notifications
      const changes = this._detectChanges(existingCourse, updateData);
      if (changes.hasChanges) {
        console.log("📧 Changes detected, handling notifications...");
        console.log(`📋 Changes detected: ${changes.details.join(", ")}`);
        // Implement change notification logic here if needed
      }

      // 8. Send success response
      return res.status(200).json({
        success: true,
        message: "Online course updated successfully.",
        course: updatedCourse,
        changes: changes,
        instructorsProcessed: allInstructors.length,
      });
    } catch (error) {
      console.error(`❌ Error in updateCourse for ID ${courseId}:`, error);
      return this._handleError(error, res);
    }
  }

  //new : merge
  // NEW: Fixed instructor processing method
  // In onlineLiveController.js, replace the existing _validateAndProcessInstructorsFromMergedData method with this fixed version:

  async _validateAndProcessInstructorsFromMergedData(formData) {
    console.log("🔍 Processing instructors from merged data...");

    const instructors = {
      primary: {
        instructorId: undefined,
        name: undefined,
        role: undefined,
      },
      additional: [],
    };

    const instructorEmails = [];

    // Process primary instructor
    const primaryInstructorId = formData.instructors?.primary?.instructorId;
    if (primaryInstructorId && primaryInstructorId.trim() !== "") {
      try {
        const primaryInstructorDoc = await Instructor.findById(
          primaryInstructorId
        );
        if (primaryInstructorDoc) {
          instructors.primary = {
            instructorId: primaryInstructorDoc._id,
            name: `${primaryInstructorDoc.firstName} ${primaryInstructorDoc.lastName}`,
            role: formData.instructors?.primary?.role || "Lead Instructor",
          };

          if (primaryInstructorDoc.email) {
            instructorEmails.push({
              email: primaryInstructorDoc.email,
              name: instructors.primary.name,
              role: "Lead Instructor",
            });
          }
          console.log(
            "✅ Primary instructor processed:",
            instructors.primary.name
          );
        }
      } catch (error) {
        console.error("❌ Error processing primary instructor:", error);
      }
    }

    // FIXED: Process additional instructors from the correct location
    // The merged data structure places additional instructors in formData.instructors.additional
    let additionalInstructorsData = [];

    // Check both possible locations for additional instructors
    if (
      formData.instructors?.additional &&
      Array.isArray(formData.instructors.additional)
    ) {
      additionalInstructorsData = formData.instructors.additional;
      console.log(
        `📝 Found ${additionalInstructorsData.length} additional instructors in formData.instructors.additional`
      );
    } else {
      console.log(
        "📝 No additional instructors found in formData.instructors.additional"
      );
    }

    // Process each additional instructor
    for (const instData of additionalInstructorsData) {
      if (
        instData.instructorId &&
        instData.instructorId !== instructors.primary?.instructorId?.toString()
      ) {
        try {
          const instructor = await Instructor.findById(instData.instructorId);
          if (instructor) {
            const additionalInstructor = {
              instructorId: instructor._id,
              name: `${instructor.firstName} ${instructor.lastName}`,
              role: instData.role || "Co-Instructor",
              sessions: Array.isArray(instData.sessions)
                ? instData.sessions
                : [],
            };

            instructors.additional.push(additionalInstructor);

            if (instructor.email) {
              instructorEmails.push({
                email: instructor.email,
                name: additionalInstructor.name,
                role: additionalInstructor.role,
              });
            }

            console.log(
              `✅ Added additional instructor: ${additionalInstructor.name}`
            );
          }
        } catch (error) {
          console.error(
            `❌ Error processing additional instructor ${instData.instructorId}:`,
            error
          );
        }
      }
    }

    console.log(`✅ Instructor processing complete:`);
    console.log(`   Primary: ${instructors.primary.name || "None"}`);
    console.log(`   Additional: ${instructors.additional.length}`);

    return {
      isValid: true,
      instructors: instructors,
      instructorEmails: instructorEmails,
    };
  }

  // NEW: Fixed course data building method
  async _buildCourseDataFromMergedData(
    formData,
    uploadedFiles,
    instructors,
    user
  ) {
    console.log("🔨 Building complete course data object from merged data...");

    const courseData = {
      basic: this._processBasicData(formData),
      schedule: this._processScheduleDataFromMerged(formData),
      enrollment: this._processEnrollmentData(formData),
      instructors: instructors,
      platform: this._processPlatformData(formData),
      content: this._processContentDataFromMerged(formData),
      technical: this._processTechnicalDataFromMerged(formData),
      interaction: this._processInteractionDataFromMerged(formData),
      recording: this._processRecordingData(formData),
      media: this._processMediaDataFromMerged(formData, uploadedFiles),
      materials: this._processMaterialsDataFromMerged(formData),
      assessment: this._processAssessmentDataFromMerged(formData),
      certification: this._processCertificationDataFromMerged(formData),
      attendance: this._processAttendanceData(formData),
      analytics: this._processAnalyticsData(formData),
      support: this._processSupportData(formData),
      postCourse: this._processPostCourseDataFromMerged(formData),
      experience: this._processExperienceData(formData),
      notificationSettings: this._processNotificationSettingsData(formData),
      metadata: this._processMetadataData(formData, user),
    };

    console.log("✅ Course data object built successfully from merged data");
    return courseData;
  }

  // ==========================================
  // DELETE OPERATIONS
  // ==========================================

  /**
   * Deletes an online course.
   * @route DELETE /admin-courses/onlinelive/api/:id
   */
  async deleteCourse(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🗑️ Deleting online course:", courseId);

      const course = await OnlineLiveTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      const enrollmentCount = await this._getEnrollmentCount(courseId);
      if (enrollmentCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete course with ${enrollmentCount} registered users. Please cancel the course instead.`,
        });
      }

      await courseNotificationController.handleCourseCancellation(
        courseId,
        course
      );
      await this._cleanupCourseFiles(course);
      await OnlineLiveTraining.findByIdAndDelete(courseId);

      console.log("✅ Online course deleted successfully:", courseId);

      res.json({
        success: true,
        message: "Course deleted successfully.",
      });
    } catch (error) {
      console.error("❌ Error deleting course:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting course",
        error: error.message,
      });
    }
  }

  async deleteCloudinaryFile(req, res) {
    try {
      const courseId = req.params.id;
      const { fileType, fileUrl } = req.body;

      console.log(
        `🗑️ Deleting Cloudinary file: Type=${fileType}, URL=${fileUrl} for Course ID=${courseId}`
      );

      const course = await OnlineLiveTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      // Extract Cloudinary public_id from URL
      const publicId = this._extractCloudinaryPublicId(fileUrl);
      if (!publicId) {
        return res.status(400).json({
          success: false,
          message: "Invalid Cloudinary URL format.",
        });
      }

      // Remove file reference from course document
      const updated = await course.removeFile(fileType, fileUrl);

      if (updated) {
        await course.save();

        // Delete from Cloudinary
        try {
          let deleteResult;
          // Determine resource type based on file type
          if (fileType === "documents") {
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "raw",
            });
          } else if (fileType === "videos") {
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "video",
            });
          } else {
            // mainImage and images
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "image",
            });
          }

          console.log("🗑️ Cloudinary delete result:", deleteResult);

          if (
            deleteResult.result === "ok" ||
            deleteResult.result === "not found"
          ) {
            console.log("✅ File deleted from Cloudinary successfully");
          }
        } catch (cloudinaryError) {
          console.error("❌ Cloudinary deletion error:", cloudinaryError);
          // Don't fail the request if Cloudinary deletion fails
          // The file reference is already removed from the database
        }

        res.json({
          success: true,
          message: "File deleted successfully.",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "File not found in course or could not be removed.",
        });
      }
    } catch (error) {
      console.error("❌ Error deleting Cloudinary file:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting file",
        error: error.message,
      });
    }
  }
  /**
   * Cancels a course.
   * @route POST /admin-courses/onlinelive/api/:id/cancel
   */
  async cancelCourse(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🚫 Cancelling online course:", courseId);

      const course = await OnlineLiveTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      course.basic.status = "cancelled";
      await course.save();

      const notificationResult =
        await courseNotificationController.handleCourseCancellation(
          courseId,
          course
        );

      console.log("✅ Course cancelled and notifications sent.");

      res.json({
        success: true,
        message: "Course cancelled successfully.",
        notificationResult,
      });
    } catch (error) {
      console.error("❌ Error cancelling course:", error);
      res.status(500).json({
        success: false,
        message: "Error cancelling course",
        error: error.message,
      });
    }
  }

  /**
   * Clones an existing online course.
   * @route POST /admin-courses/onlinelive/api/:id/clone
   */
  async cloneCourse(req, res) {
    try {
      const courseId = req.params.id;
      const cloneOptions = req.body;

      console.log("🔄 Cloning online course:", courseId);
      console.log("🔧 Clone options:", cloneOptions);

      const originalCourse = await OnlineLiveTraining.findById(courseId).lean();
      if (!originalCourse) {
        return res.status(404).json({
          success: false,
          message: "Original course not found.",
        });
      }

      // Check for duplicate course code
      const existingCourse = await OnlineLiveTraining.findOne({
        "basic.courseCode": cloneOptions.courseCode.trim().toUpperCase(),
      });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message:
            "Course code already exists. Please choose a different course code.",
        });
      }

      const clonedData = this._createClonedCourseData(
        originalCourse,
        cloneOptions,
        req.user
      );

      const clonedCourse = new OnlineLiveTraining(clonedData);
      await clonedCourse.save();

      console.log("✅ Online course cloned successfully:", clonedCourse._id);

      if (
        clonedCourse.basic.status === "open" ||
        clonedCourse.basic.status === "Open to Register"
      ) {
        try {
          await courseNotificationController.handleCourseCreation(
            clonedCourse,
            req.user
          );
          console.log("📧 Clone course notifications scheduled.");
        } catch (emailError) {
          console.error("❌ Error scheduling clone notifications:", emailError);
        }
      }

      res.json({
        success: true,
        message: `Course "${clonedData.basic.title}" cloned successfully.`,
        course: clonedCourse,
        originalCourse: {
          id: originalCourse._id,
          title: originalCourse.basic?.title,
        },
        cloneOptions: cloneOptions,
      });
    } catch (error) {
      console.error("❌ Error cloning course:", error);
      res.status(500).json({
        success: false,
        message: "Error cloning course: " + error.message,
        error: error.message,
      });
    }
  }

  /**
   * Checks if a course code is available.
   * @route GET /admin-courses/onlinelive/api/check-course-code
   */
  async checkCourseCode(req, res) {
    try {
      const { code, excludeId } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Course code is required.",
        });
      }

      const filter = { "basic.courseCode": code.trim().toUpperCase() };
      if (excludeId) {
        filter._id = { $ne: excludeId };
      }

      const existingCourse = await OnlineLiveTraining.findOne(filter);

      res.json({
        success: true,
        exists: !!existingCourse,
        available: !existingCourse,
      });
    } catch (error) {
      console.error("❌ Error checking course code:", error);
      res.status(500).json({
        success: false,
        message: "Error checking course code",
        error: error.message,
      });
    }
  }

  /**
   * Generates a unique course code.
   * @route POST /admin-courses/onlinelive/api/generate-course-code
   */
  async generateCourseCode(req, res) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required for code generation.",
        });
      }

      const baseCode = title
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 5);
      const year = new Date().getFullYear();
      let counter = 1;
      let newCode = `ONLINE-${year}-${baseCode}-${String(counter).padStart(
        3,
        "0"
      )}`;

      while (
        await OnlineLiveTraining.findOne({ "basic.courseCode": newCode })
      ) {
        counter++;
        newCode = `ONLINE-${year}-${baseCode}-${String(counter).padStart(
          3,
          "0"
        )}`;
      }

      res.json({ success: true, courseCode: newCode });
    } catch (error) {
      console.error("Error generating course code:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to generate course code." });
    }
  }

  /**
   * Exports courses data.
   * @route GET /admin-courses/onlinelive/api/export
   */
  async exportData(req, res) {
    try {
      console.log("📊 Exporting online courses...");

      const courses = await OnlineLiveTraining.find({})
        .populate("instructors.primary.instructorId", "firstName lastName")
        .lean();

      const exportData = courses.map((course) => ({
        courseCode: course.basic?.courseCode,
        title: course.basic?.title,
        status: course.basic?.status,
        category: course.basic?.category,
        startDate: course.schedule?.startDate,
        endDate: course.schedule?.endDate,
        duration: course.schedule?.duration,
        price: course.enrollment?.price,
        currency: course.enrollment?.currency,
        seatsAvailable: course.enrollment?.seatsAvailable,
        currentEnrollment: course.enrollment?.currentEnrollment,
        platform: course.platform?.name,
        timezone: course.schedule?.primaryTimezone,
        instructor: course.instructors?.primary?.name,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      }));

      res.json({
        success: true,
        message: "Online courses exported successfully.",
        data: exportData,
        count: exportData.length,
      });
    } catch (error) {
      console.error("❌ Error exporting courses:", error);
      res.status(500).json({
        success: false,
        message: "Error exporting courses",
        error: error.message,
      });
    }
  }

  // ==========================================
  // NOTIFICATION OPERATIONS
  // ==========================================

  async getNotificationStatus(req, res) {
    try {
      console.log("📊 Getting notification system status...");

      const notificationStatus =
        courseNotificationController.getNotificationStatus();
      const totalPendingNotifications = notificationStatus.scheduledJobs.length;
      const trackedCoursesCount = notificationStatus.trackedCourses.length;

      const recentCourses = await OnlineLiveTraining.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      })
        .select("basic.title createdAt basic.status basic.courseCode")
        .sort({ createdAt: -1 })
        .limit(10);

      const notificationRecipients = await User.countDocuments({
        isConfirmed: true,
        "accountStatus.isLocked": { $ne: true },
        "notificationSettings.email": true,
        "notificationSettings.courseUpdates": true,
      });

      const totalCourses = await OnlineLiveTraining.countDocuments();
      const activeCourses = await OnlineLiveTraining.countDocuments({
        "basic.status": { $in: ["open", "in-progress", "full"] },
      });

      res.json({
        success: true,
        notificationSystem: {
          status: "active",
          scheduledJobs: notificationStatus.scheduledJobs,
          trackedCourses: notificationStatus.trackedCourses,
          activeJobs: notificationStatus.activeJobs || 0,
          totalPendingNotifications,
          trackedCoursesCount,
        },
        statistics: {
          notificationRecipients,
          totalCourses,
          activeCourses,
          recentCoursesCount: recentCourses.length,
          recentCourses: recentCourses.map((course) => ({
            id: course._id,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            status: course.basic?.status,
            createdAt: course.createdAt,
          })),
        },
        systemHealth: {
          emailServiceStatus: "active",
          schedulerStatus: "active",
          lastChecked: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ Error getting notification status:", error);
      res.status(500).json({
        success: false,
        message: "Error getting notification status",
        error: error.message,
      });
    }
  }

  async sendImmediateNotification(req, res) {
    try {
      const courseId = req.params.id;
      console.log(
        "📧 Sending immediate notification for online course:",
        courseId
      );

      const result =
        await courseNotificationController.sendImmediateNotification(courseId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          recipientCount: result.recipientCount,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error,
        });
      }
    } catch (error) {
      console.error("❌ Error sending immediate notification:", error);
      res.status(500).json({
        success: false,
        message: "Error sending immediate notification",
        error: error.message,
      });
    }
  }

  async sendTestNotification(req, res) {
    try {
      const courseId = req.params.id;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email address is required.",
        });
      }

      console.log("🧪 Sending test notification...");

      const result = await courseNotificationController.sendTestNotification(
        courseId,
        email
      );

      if (result.success) {
        res.json({
          success: true,
          message: `Test notification sent to ${email}.`,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error,
        });
      }
    } catch (error) {
      console.error("❌ Error sending test notification:", error);
      res.status(500).json({
        success: false,
        message: "Error sending test notification",
        error: error.message,
      });
    }
  }

  async cancelScheduledNotification(req, res) {
    try {
      const courseId = req.params.id;
      console.log("❌ Cancelling scheduled notification for course:", courseId);

      const cancelled =
        courseNotificationController.cancelScheduledNotification(courseId);

      res.json({
        success: true,
        message: cancelled
          ? "Scheduled notification cancelled."
          : "No scheduled notification found.",
        cancelled: cancelled,
      });
    } catch (error) {
      console.error("❌ Error cancelling scheduled notification:", error);
      res.status(500).json({
        success: false,
        message: "Error cancelling scheduled notification",
        error: error.message,
      });
    }
  }

  async postponeCourse(req, res) {
    try {
      const courseId = req.params.id;
      const { newStartDate, newEndDate, reason } = req.body;

      console.log("📅 Postponing online course:", courseId);

      const course = await OnlineLiveTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      const oldStartDate = course.schedule?.startDate;
      const oldEndDate = course.schedule?.endDate;

      course.schedule.startDate = new Date(newStartDate);
      if (newEndDate) {
        course.schedule.endDate = new Date(newEndDate);
      }
      course.postponementReason = reason || "Schedule change";
      course.postponementDate = new Date();
      course.metadata.lastModified = new Date();
      course.metadata.lastModifiedBy = req.user?._id || null;

      await course.save();

      const registeredUsers = await User.find(
        {
          "myOnlineLiveCourses.courseId": courseId,
          "myOnlineLiveCourses.status": {
            $in: ["Paid and Registered", "Registered (promo code)"],
          },
        },
        "email firstName lastName"
      );

      if (registeredUsers.length > 0) {
        try {
          const courseData = {
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            platform: course.platform?.name,
            oldStartDate: oldStartDate,
            newStartDate: course.schedule.startDate,
            oldEndDate: oldEndDate,
            newEndDate: course.schedule.endDate,
            _id: course._id,
            postponementReason: reason || "Schedule adjustment",
          };

          await emailService.sendCoursePostponementEmail(
            courseData,
            registeredUsers
          );
        } catch (emailError) {
          console.error("❌ Error sending postponement emails:", emailError);
        }
      }

      res.json({
        success: true,
        message: `Course postponed successfully${
          registeredUsers.length > 0 ? " and users notified." : "."
        }`,
        course: course,
        notificationsSent: registeredUsers.length,
      });
    } catch (error) {
      console.error("❌ Error postponing course:", error);
      res.status(500).json({
        success: false,
        message: "Error postponing course",
        error: error.message,
      });
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Build filter for courses query
   */
  _buildCoursesFilter(search, status, category, platform) {
    const filter = {};

    if (search) {
      filter.$or = [
        { "basic.title": { $regex: search, $options: "i" } },
        { "basic.courseCode": { $regex: search, $options: "i" } },
        { "basic.description": { $regex: search, $options: "i" } },
        { "instructors.primary.name": { $regex: search, $options: "i" } },
        { "platform.name": { $regex: search, $options: "i" } },
      ];
    }

    if (status) filter["basic.status"] = status;
    if (category) filter["basic.category"] = category;
    if (platform) filter["platform.name"] = platform;

    return filter;
  }

  /**
   * Calculate pagination information
   */
  _calculatePagination(page, limit, total) {
    const totalPages = Math.ceil(total / limit);

    return {
      currentPage: page,
      totalPages: totalPages,
      totalCourses: total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      limit: limit,
    };
  }

  /**
   * Add enrollment counts to courses
   */
  async _addEnrollmentCounts(courses) {
    return await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await this._getEnrollmentCount(course._id);
        if (!course.enrollment) course.enrollment = {};
        course.enrollment.currentEnrollment = enrollmentCount;
        return course;
      })
    );
  }

  /**
   * Get enrollment count for a course
   */
  async _getEnrollmentCount(courseId) {
    return await User.countDocuments({
      "myOnlineLiveCourses.courseId": courseId,
      "myOnlineLiveCourses.status": {
        $in: ["Paid and Registered", "Registered (promo code)"],
      },
    });
  }

  //new
  /**
   * SINGLE standardized method to get instructor names from course
   * Based on the actual model structure
   */
  _getStandardizedInstructorNames(course) {
    const names = [];

    // Primary instructor - use cached name first, fallback to populated object
    if (course.instructors?.primary?.name) {
      names.push(course.instructors.primary.name);
    } else if (course.instructors?.primary?.instructorId?.fullName) {
      names.push(course.instructors.primary.instructorId.fullName);
    } else if (course.instructors?.primary?.instructorId?.firstName) {
      const inst = course.instructors.primary.instructorId;
      names.push(`${inst.firstName} ${inst.lastName}`.trim());
    }

    // Additional instructors - use cached name first, fallback to populated object
    if (course.instructors?.additional?.length > 0) {
      course.instructors.additional.forEach((inst) => {
        if (inst.name) {
          names.push(inst.name);
        } else if (inst.instructorId?.fullName) {
          names.push(inst.instructorId.fullName);
        } else if (inst.instructorId?.firstName) {
          names.push(
            `${inst.instructorId.firstName} ${inst.instructorId.lastName}`.trim()
          );
        }
      });
    }

    return names.length > 0 ? names.join(", ") : "TBD";
  }

  /**
   * Get instructor emails for notifications (simplified)
   */
  async _getStandardizedInstructorEmails(course) {
    const emails = [];

    // Primary instructor
    if (course.instructors?.primary?.instructorId) {
      let email = null;

      // If already populated
      if (course.instructors.primary.instructorId.email) {
        email = course.instructors.primary.instructorId.email;
      }
      // If just an ID, fetch it
      else if (typeof course.instructors.primary.instructorId === "string") {
        try {
          const instructor = await Instructor.findById(
            course.instructors.primary.instructorId
          ).select("email firstName lastName");
          email = instructor?.email;
        } catch (error) {
          console.error("Error fetching primary instructor email:", error);
        }
      }

      if (email) {
        emails.push(email);
      }
    }

    // Additional instructors
    if (course.instructors?.additional?.length > 0) {
      for (const inst of course.instructors.additional) {
        if (inst.instructorId) {
          let email = null;

          if (inst.instructorId.email) {
            email = inst.instructorId.email;
          } else if (typeof inst.instructorId === "string") {
            try {
              const instructor = await Instructor.findById(
                inst.instructorId
              ).select("email");
              email = instructor?.email;
            } catch (error) {
              console.error(
                "Error fetching additional instructor email:",
                error
              );
            }
          }

          if (email && !emails.includes(email)) {
            emails.push(email);
          }
        }
      }
    }

    return emails;
  }

  /**
   * Validate course data
   * @param {Object} formData - Request form data
   * @param {boolean} isUpdate - Whether this is an update operation
   */
  async _validateCourseData(formData, isUpdate = false) {
    console.log("🔍 Validating course data...");
    const errors = [];

    // Core required fields
    const coreRequiredFields = [
      {
        value: formData.basic?.courseCode,
        field: "basic.courseCode",
        name: "Course code",
      },
      {
        value: formData.basic?.title,
        field: "basic.title",
        name: "Course title",
      },
      {
        value: formData.basic?.description,
        field: "basic.description",
        name: "Course description",
      },
      {
        value: formData.basic?.category,
        field: "basic.category",
        name: "Category",
      },
    ];

    // Schedule required fields
    const scheduleRequiredFields = [
      {
        value: formData.schedule?.startDate,
        field: "schedule.startDate",
        name: "Start date",
      },
      {
        value: formData.schedule?.duration,
        field: "schedule.duration",
        name: "Duration",
      },
      {
        value: formData.schedule?.primaryTimezone,
        field: "schedule.primaryTimezone",
        name: "Primary Time Zone",
      },
    ];

    // Check core required fields
    for (const { value, field, name } of coreRequiredFields) {
      const isEmpty = !value || (typeof value === "string" && !value.trim());
      if (isEmpty) {
        errors.push({ field: field, message: `${name} is required.` });
      }
    }

    // Check schedule required fields
    for (const { value, field, name } of scheduleRequiredFields) {
      const isEmpty = !value || (typeof value === "string" && !value.trim());
      if (isEmpty) {
        errors.push({ field: field, message: `${name} is required.` });
      }
    }

    // For new courses, require additional fields
    if (!isUpdate) {
      const createRequiredFields = [
        {
          value: formData.enrollment?.price,
          field: "enrollment.price",
          name: "Price",
        },
        {
          value: formData.enrollment?.seatsAvailable,
          field: "enrollment.seatsAvailable",
          name: "Seats Available",
        },
        {
          value: formData.platform?.name,
          field: "platform.name",
          name: "Platform",
        },
        {
          value: formData.platform?.accessUrl,
          field: "platform.accessUrl",
          name: "Platform access URL",
        },
      ];

      for (const { value, field, name } of createRequiredFields) {
        const isEmpty =
          value === undefined ||
          value === null ||
          (typeof value === "string" && !value.trim());
        if (isEmpty) {
          errors.push({
            field: field,
            message: `${name} is required for new courses.`,
          });
        }
      }
    }

    // Date validations
    if (formData.schedule?.startDate) {
      const startDateTime = new Date(formData.schedule.startDate);
      if (isNaN(startDateTime.getTime())) {
        errors.push({
          field: "schedule.startDate",
          message: "Invalid start date format.",
        });
      } else {
        if (formData.schedule?.endDate) {
          const endDateTime = new Date(formData.schedule.endDate);
          if (isNaN(endDateTime.getTime())) {
            errors.push({
              field: "schedule.endDate",
              message: "Invalid end date format.",
            });
          } else if (endDateTime < startDateTime) {
            errors.push({
              field: "schedule.endDate",
              message: "End date cannot be before start date.",
            });
          }
        }

        if (formData.schedule?.registrationDeadline) {
          const deadlineTime = new Date(formData.schedule.registrationDeadline);
          if (isNaN(deadlineTime.getTime())) {
            errors.push({
              field: "schedule.registrationDeadline",
              message: "Invalid registration deadline format.",
            });
          } else if (deadlineTime > startDateTime) {
            errors.push({
              field: "schedule.registrationDeadline",
              message: "Registration deadline cannot be after course start.",
            });
          }
        }
      }
    }

    // Price validations
    // Price validations
    if (
      formData.enrollment?.price !== undefined &&
      formData.enrollment?.price !== null &&
      formData.enrollment?.price !== ""
    ) {
      const priceValue = parseFloat(formData.enrollment.price);
      if (isNaN(priceValue) || priceValue < 0) {
        errors.push({
          field: "enrollment.price",
          message: "Price must be 0 or greater (0 for free courses).",
        });
      } else if (
        formData.enrollment?.earlyBirdPrice !== undefined &&
        formData.enrollment?.earlyBirdPrice !== null &&
        formData.enrollment?.earlyBirdPrice !== ""
      ) {
        const earlyBirdPrice = parseFloat(formData.enrollment.earlyBirdPrice);
        if (!isNaN(earlyBirdPrice)) {
          if (earlyBirdPrice < 0) {
            errors.push({
              field: "enrollment.earlyBirdPrice",
              message: "Early bird price must be 0 or greater.",
            });
          } else if (earlyBirdPrice > priceValue) {
            errors.push({
              field: "enrollment.earlyBirdPrice",
              message:
                "Early bird price must be less than or equal to regular price.",
            });
          }
        }
      }
    }

    // Enrollment validations
    if (formData.enrollment?.seatsAvailable !== undefined) {
      const seatsValue = parseInt(formData.enrollment.seatsAvailable);
      if (isNaN(seatsValue) || seatsValue < 1) {
        errors.push({
          field: "enrollment.seatsAvailable",
          message: "Valid number of available seats is required.",
        });
      } else if (formData.enrollment?.minEnrollment) {
        const minEnrollValue = parseInt(formData.enrollment.minEnrollment);
        if (!isNaN(minEnrollValue) && minEnrollValue > seatsValue) {
          errors.push({
            field: "enrollment.minEnrollment",
            message: "Minimum enrollment cannot exceed available seats.",
          });
        }
      }
    }

    // Platform validation
    if (formData.platform?.name) {
      const validPlatforms = [
        "Zoom",
        "Microsoft Teams",
        "Google Meet",
        "Webex",
        "GoToWebinar",
        "Custom",
      ];
      if (!validPlatforms.includes(formData.platform.name)) {
        errors.push({
          field: "platform.name",
          message: "Invalid platform selected.",
        });
      }
    }

    // URL validation for platform access
    if (formData.platform?.accessUrl) {
      try {
        if (
          formData.platform.accessUrl.startsWith("http://") ||
          formData.platform.accessUrl.startsWith("https://")
        ) {
          new URL(formData.platform.accessUrl);
        }
      } catch (error) {
        errors.push({
          field: "platform.accessUrl",
          message: "Platform access URL must be a valid URL.",
        });
      }
    }

    console.log(
      `🔍 Validation result: ${errors.length === 0 ? "PASSED" : "FAILED"}`
    );
    if (errors.length > 0) {
      console.log("❌ Validation errors:", errors);
      return {
        isValid: false,
        message: errors[0].message,
        field: errors[0].field,
        errors: errors,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate and process instructors
   */
  async _validateAndProcessInstructors(formData, savedDynamicItems = {}) {
    console.log("🔍 Validating and processing instructors...");

    const instructors = {
      primary: {
        instructorId: undefined,
        name: undefined,
        role: undefined,
      },
      additional: [],
    };

    const instructorEmails = [];

    // Process primary instructor
    const primaryInstructorId = formData.instructors?.primary?.instructorId;
    if (primaryInstructorId && primaryInstructorId.trim() !== "") {
      try {
        const primaryInstructorDoc = await Instructor.findById(
          primaryInstructorId
        );
        if (primaryInstructorDoc) {
          instructors.primary = {
            instructorId: primaryInstructorDoc._id,
            name: `${primaryInstructorDoc.firstName} ${primaryInstructorDoc.lastName}`,
            role: formData.instructors?.primary?.role || "Lead Instructor",
          };

          if (primaryInstructorDoc.email) {
            instructorEmails.push({
              email: primaryInstructorDoc.email,
              name: instructors.primary.name,
              role: "Lead Instructor",
            });
          }
          console.log(
            "✅ Primary instructor processed:",
            instructors.primary.name
          );
        }
      } catch (error) {
        console.error("❌ Error processing primary instructor:", error);
      }
    }

    // Process additional instructors from savedDynamicItems
    if (
      savedDynamicItems.instructors &&
      Array.isArray(savedDynamicItems.instructors)
    ) {
      console.log(
        `📝 Processing ${savedDynamicItems.instructors.length} additional instructors`
      );

      for (const instData of savedDynamicItems.instructors) {
        if (
          instData.saved === true &&
          instData.instructorId &&
          instData.instructorId !==
            instructors.primary?.instructorId?.toString()
        ) {
          try {
            const instructor = await Instructor.findById(instData.instructorId);
            if (instructor) {
              const additionalInstructor = {
                instructorId: instructor._id,
                name: `${instructor.firstName} ${instructor.lastName}`,
                role: instData.role || "Co-Instructor",
                sessions: Array.isArray(instData.sessions)
                  ? instData.sessions
                  : typeof instData.sessions === "string"
                  ? instData.sessions
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [],
              };

              instructors.additional.push(additionalInstructor);

              if (instructor.email) {
                instructorEmails.push({
                  email: instructor.email,
                  name: additionalInstructor.name,
                  role: additionalInstructor.role,
                });
              }

              console.log(
                `✅ Added additional instructor: ${additionalInstructor.name}`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error processing additional instructor ${instData.instructorId}:`,
              error
            );
          }
        }
      }
    }

    console.log(`✅ Instructor processing complete:`);
    console.log(`   Primary: ${instructors.primary.name || "None"}`);
    console.log(`   Additional: ${instructors.additional.length}`);

    return {
      isValid: true,
      instructors: instructors,
      instructorEmails: instructorEmails,
    };
  }

  /**
   * Check for duplicate course code
   */
  async _checkDuplicateCourseCode(courseCode) {
    if (!courseCode) return;

    const code = courseCode.trim().toUpperCase();
    const existingCourse = await OnlineLiveTraining.findOne({
      "basic.courseCode": code,
    });

    if (existingCourse) {
      throw new Error("DUPLICATE_COURSE_CODE");
    }
  }

  /**
   * Build complete course data object
   */
  async _buildCourseData(
    formData,
    savedDynamicItems,
    uploadedFiles,
    instructors,
    user
  ) {
    console.log("🔨 Building complete course data object...");

    const courseData = {
      basic: this._processBasicData(formData),
      schedule: this._processScheduleData(formData, savedDynamicItems),
      enrollment: this._processEnrollmentData(formData),
      instructors: instructors,
      platform: this._processPlatformData(formData),
      content: this._processContentData(formData, savedDynamicItems),
      technical: this._processTechnicalData(formData, savedDynamicItems),
      interaction: this._processInteractionData(formData, savedDynamicItems),
      recording: this._processRecordingData(formData),
      media: this._processMediaData(formData, savedDynamicItems, uploadedFiles),
      materials: this._processMaterialsData(formData, savedDynamicItems),
      assessment: this._processAssessmentData(formData, savedDynamicItems),
      certification: this._processCertificationData(
        formData,
        savedDynamicItems
      ),
      attendance: this._processAttendanceData(formData),
      analytics: this._processAnalyticsData(formData),
      support: this._processSupportData(formData),
      postCourse: this._processPostCourseData(formData, savedDynamicItems),
      experience: this._processExperienceData(formData),
      notificationSettings: this._processNotificationSettingsData(formData),
      metadata: this._processMetadataData(formData, user),
    };

    console.log("✅ Course data object built successfully");
    return courseData;
  }

  /**
   * Build update data object
   */
  async _buildUpdateData(
    formData,
    savedDynamicItems,
    uploadedFiles,
    existingCourse,
    instructors,
    user
  ) {
    console.log("🔨 Building update data object...");

    const currentCourseData = existingCourse.toObject
      ? existingCourse.toObject()
      : { ...existingCourse };

    const updateData = {
      basic: {
        ...(currentCourseData.basic || {}),
        ...this._processBasicData(formData),
      },
      schedule: {
        ...(currentCourseData.schedule || {}),
        ...this._processScheduleData(formData, savedDynamicItems),
      },
      enrollment: {
        ...(currentCourseData.enrollment || {}),
        ...this._processEnrollmentData(formData),
      },
      instructors: instructors,
      platform: {
        ...(currentCourseData.platform || {}),
        ...this._processPlatformData(formData),
      },
      content: {
        ...(currentCourseData.content || {}),
        ...this._processContentData(formData, savedDynamicItems),
      },
      technical: {
        ...(currentCourseData.technical || {}),
        ...this._processTechnicalData(formData, savedDynamicItems),
      },
      interaction: {
        ...(currentCourseData.interaction || {}),
        ...this._processInteractionData(formData, savedDynamicItems),
      },
      recording: {
        ...(currentCourseData.recording || {}),
        ...this._processRecordingData(formData),
      },
      media: this._processMediaData(
        formData,
        savedDynamicItems,
        uploadedFiles,
        currentCourseData.media
      ),
      materials: {
        ...(currentCourseData.materials || {}),
        ...this._processMaterialsData(formData, savedDynamicItems),
      },
      assessment: {
        ...(currentCourseData.assessment || {}),
        ...this._processAssessmentData(formData, savedDynamicItems),
      },
      certification: {
        ...(currentCourseData.certification || {}),
        ...this._processCertificationData(formData, savedDynamicItems),
      },
      attendance: {
        ...(currentCourseData.attendance || {}),
        ...this._processAttendanceData(formData),
      },
      analytics: {
        ...(currentCourseData.analytics || {}),
        ...this._processAnalyticsData(formData),
      },
      support: {
        ...(currentCourseData.support || {}),
        ...this._processSupportData(formData),
      },
      postCourse: {
        ...(currentCourseData.postCourse || {}),
        ...this._processPostCourseData(formData, savedDynamicItems),
      },
      experience: {
        ...(currentCourseData.experience || {}),
        ...this._processExperienceData(formData),
      },
      notificationSettings: {
        ...(currentCourseData.notificationSettings || {}),
        ...this._processNotificationSettingsData(formData),
      },
      metadata: {
        ...(currentCourseData.metadata || {}),
        lastModifiedBy: user?._id || null,
        version: (currentCourseData.metadata?.version || 0) + 1,
        lastModified: new Date(),
      },
    };

    console.log("✅ Update data object built successfully");
    return updateData;
  }

  /**
   * Process basic course data
   */
  _processBasicData(formData) {
    const basicData = formData.basic || {};
    return {
      courseCode: basicData.courseCode?.trim()?.toUpperCase() || "",
      title: basicData.title?.trim() || "",
      description: basicData.description?.trim() || "",
      aboutThisCourse: basicData.aboutThisCourse?.trim() || "",
      category: basicData.category || "aesthetic",
      status: basicData.status || "draft",
      courseType: "online-live",
    };
  }

  /**
   * Process schedule data
   */
  _processScheduleData(formData, savedDynamicItems) {
    const scheduleData = formData.schedule || {};
    return {
      startDate: scheduleData.startDate
        ? new Date(scheduleData.startDate)
        : undefined,
      endDate: scheduleData.endDate
        ? new Date(scheduleData.endDate)
        : undefined,
      registrationDeadline: scheduleData.registrationDeadline
        ? new Date(scheduleData.registrationDeadline)
        : undefined,
      duration: scheduleData.duration || "",
      primaryTimezone: scheduleData.primaryTimezone || "UTC",
      displayTimezones: scheduleData.displayTimezones
        ? scheduleData.displayTimezones
            .split(",")
            .map((tz) => tz.trim())
            .filter(Boolean)
        : [],
      pattern: scheduleData.pattern || "single",
      sessionTime: {
        startTime: scheduleData.sessionTime?.startTime || "",
        endTime: scheduleData.sessionTime?.endTime || "",
        breakDuration: parseInt(scheduleData.sessionTime?.breakDuration) || 15,
      },
      sessions: this._mergeDynamicArray(savedDynamicItems.sessions, "object"),
    };
  }

  /**
   * Process enrollment data
   */
  _processEnrollmentData(formData) {
    const enrollmentData = formData.enrollment || {};

    // Handle price - allow 0 for free courses
    let price = 0;
    if (
      enrollmentData.price !== undefined &&
      enrollmentData.price !== null &&
      enrollmentData.price !== ""
    ) {
      price = parseFloat(enrollmentData.price);
      if (isNaN(price)) price = 0;
    }

    // Handle early bird price - allow 0
    let earlyBirdPrice = undefined;
    if (
      enrollmentData.earlyBirdPrice !== undefined &&
      enrollmentData.earlyBirdPrice !== null &&
      enrollmentData.earlyBirdPrice !== ""
    ) {
      earlyBirdPrice = parseFloat(enrollmentData.earlyBirdPrice);
      if (isNaN(earlyBirdPrice)) earlyBirdPrice = undefined;
    }

    return {
      price: price,
      earlyBirdPrice: earlyBirdPrice,
      currency: enrollmentData.currency?.trim() || "EUR",
      seatsAvailable: parseInt(enrollmentData.seatsAvailable) || 50,
      minEnrollment: parseInt(enrollmentData.minEnrollment) || 10,
      waitlistEnabled:
        enrollmentData.waitlistEnabled === true ||
        enrollmentData.waitlistEnabled === "on",
      registrationUrl: enrollmentData.registrationUrl?.trim() || "",
    };
  }

  /**
   * Process platform data
   */
  _processPlatformData(formData) {
    const platformData = formData.platform || {};
    return {
      name: platformData.name || "Zoom",
      accessUrl: platformData.accessUrl?.trim() || "",
      meetingId: platformData.meetingId?.trim() || "",
      passcode: platformData.passcode?.trim() || "",
      backupPlatform: platformData.backupPlatform?.trim() || "",
      backupUrl: platformData.backupUrl?.trim() || "",
      features: {
        breakoutRooms:
          platformData.features?.breakoutRooms === true ||
          platformData.features?.breakoutRooms === "on",
        polling:
          platformData.features?.polling === true ||
          platformData.features?.polling === "on",
        whiteboard:
          platformData.features?.whiteboard === true ||
          platformData.features?.whiteboard === "on",
        recording:
          platformData.features?.recording === true ||
          platformData.features?.recording === "on",
        chat:
          platformData.features?.chat === true ||
          platformData.features?.chat === "on",
        screenSharing:
          platformData.features?.screenSharing === true ||
          platformData.features?.screenSharing === "on",
      },
    };
  }

  /**
   * Process content data
   */
  _processContentData(formData, savedDynamicItems) {
    const contentData = formData.content || {};
    return {
      objectives: this._mergeDynamicArray(savedDynamicItems.objectives, "text"),
      modules: this._mergeDynamicArray(savedDynamicItems.modules, "object"),
      targetAudience: this._mergeDynamicArray(
        savedDynamicItems.targetAudience,
        "text"
      ),
      experienceLevel: contentData.experienceLevel || "all-levels",
      prerequisites: contentData.prerequisites?.trim() || "",
      detailedSyllabus: contentData.detailedSyllabus?.trim() || "",
    };
  }

  /**
   * Process technical data
   */
  _processTechnicalData(formData, savedDynamicItems) {
    const technicalData = formData.technical || {};
    return {
      systemRequirements: {
        os: technicalData.systemRequirements?.os
          ? technicalData.systemRequirements.os
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        browsers: technicalData.systemRequirements?.browsers
          ? technicalData.systemRequirements.browsers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        minimumRAM: technicalData.systemRequirements?.minimumRAM || "4GB",
        processor:
          technicalData.systemRequirements?.processor || "Dual-core 2GHz",
      },
      internetSpeed: {
        minimum: technicalData.internetSpeed?.minimum || "5 Mbps",
        recommended: technicalData.internetSpeed?.recommended || "25 Mbps",
      },
      requiredSoftware: this._mergeDynamicArray(
        savedDynamicItems.requiredSoftware,
        "name"
      ),
      equipment: {
        camera: technicalData.equipment?.camera || "recommended",
        microphone: technicalData.equipment?.microphone || "required",
        headset: technicalData.equipment?.headset || "recommended",
      },
      techCheckRequired:
        technicalData.techCheckRequired === true ||
        technicalData.techCheckRequired === "on",
      techCheckDate: technicalData.techCheckDate
        ? new Date(technicalData.techCheckDate)
        : undefined,
      techCheckUrl: technicalData.techCheckUrl?.trim() || "",
    };
  }

  /**
   * Process interaction data
   */
  _processInteractionData(formData, savedDynamicItems) {
    const interactionData = formData.interaction || {};
    return {
      participationRequired:
        interactionData.participationRequired === true ||
        interactionData.participationRequired === "on",
      cameraRequired:
        interactionData.cameraRequired === true ||
        interactionData.cameraRequired === "on",
      features: {
        polls:
          interactionData.features?.polls === true ||
          interactionData.features?.polls === "on",
        quizzes:
          interactionData.features?.quizzes === true ||
          interactionData.features?.quizzes === "on",
        breakoutRooms:
          interactionData.features?.breakoutRooms === true ||
          interactionData.features?.breakoutRooms === "on",
        qa:
          interactionData.features?.qa === true ||
          interactionData.features?.qa === "on",
        chat:
          interactionData.features?.chat === true ||
          interactionData.features?.chat === "on",
        reactions:
          interactionData.features?.reactions === true ||
          interactionData.features?.reactions === "on",
      },
      engagementTools: this._mergeDynamicArray(
        savedDynamicItems.engagementTools,
        "name"
      ),
      networkingOptions: {
        virtualCoffeeBreaks:
          interactionData.networkingOptions?.virtualCoffeeBreaks === true ||
          interactionData.networkingOptions?.virtualCoffeeBreaks === "on",
        discussionForum:
          interactionData.networkingOptions?.discussionForum === true ||
          interactionData.networkingOptions?.discussionForum === "on",
        linkedInGroup:
          interactionData.networkingOptions?.linkedInGroup?.trim() || "",
        slackChannel:
          interactionData.networkingOptions?.slackChannel?.trim() || "",
      },
    };
  }

  /**
   * Process recording data
   */
  _processRecordingData(formData) {
    const recordingData = formData.recording || {};
    return {
      enabled: recordingData.enabled === true || recordingData.enabled === "on",
      type: recordingData.type || "cloud",
      availability: {
        forStudents:
          recordingData.availability?.forStudents === true ||
          recordingData.availability?.forStudents === "on",
        duration: parseInt(recordingData.availability?.duration) || 90,
        downloadable:
          recordingData.availability?.downloadable === true ||
          recordingData.availability?.downloadable === "on",
        passwordProtected:
          recordingData.availability?.passwordProtected === true ||
          recordingData.availability?.passwordProtected === "on",
      },
      autoTranscription:
        recordingData.autoTranscription === true ||
        recordingData.autoTranscription === "on",
    };
  }

  /**
   * Process media data
   */
  _processMediaData(
    formData,
    savedDynamicItems,
    uploadedFiles,
    existingMedia = {}
  ) {
    console.log("🎬 Processing media data...");
    console.log("🔍 uploadedFiles received:", uploadedFiles);

    const mediaData = {
      mainImage: existingMedia.mainImage || undefined,
      documents: existingMedia.documents || [],
      images: existingMedia.images || [],
      videos: existingMedia.videos || [],
      promotional: existingMedia.promotional || {},
      links: existingMedia.links || [],
    };

    // Handle main image from uploaded files - FIX: Handle both string and array formats
    if (uploadedFiles?.mainImage) {
      let mainImageUrl;

      // Handle case where mainImage comes as an array (from frontend)
      if (Array.isArray(uploadedFiles.mainImage)) {
        mainImageUrl = uploadedFiles.mainImage[0]; // Take first element
        console.log(`✅ Processing mainImage URL from array: ${mainImageUrl}`);
      } else {
        mainImageUrl = uploadedFiles.mainImage;
        console.log(`✅ Processing mainImage URL as string: ${mainImageUrl}`);
      }

      // Only set if we have a valid URL string
      if (
        mainImageUrl &&
        typeof mainImageUrl === "string" &&
        mainImageUrl.trim()
      ) {
        mediaData.mainImage = {
          url: mainImageUrl.trim(),
          alt: formData.basic?.title || "Course Main Image",
        };
        console.log("✅ Main image object created:", mediaData.mainImage);
      } else {
        console.log("⚠️ Invalid mainImage URL, skipping...");
      }
    }

    // Handle file arrays - merge existing with new uploads
    if (uploadedFiles?.documents && Array.isArray(uploadedFiles.documents)) {
      mediaData.documents = [
        ...new Set([...mediaData.documents, ...uploadedFiles.documents]),
      ];
    }
    if (uploadedFiles?.images && Array.isArray(uploadedFiles.images)) {
      mediaData.images = [
        ...new Set([...mediaData.images, ...uploadedFiles.images]),
      ];
    }

    // Handle videos - combine uploaded files and external links
    const uploadedVideos = uploadedFiles?.videos || [];
    const externalVideoUrls = (savedDynamicItems.videoLinks || [])
      .filter((link) => link.saved === true && link.url)
      .map((link) => link.url);

    mediaData.videos = [
      ...new Set([
        ...mediaData.videos,
        ...uploadedVideos,
        ...externalVideoUrls,
      ]),
    ];

    // Process promotional media
    const promotionalData = formData.media?.promotional || {};
    mediaData.promotional = {
      brochureUrl: promotionalData.brochureUrl?.trim() || "",
      videoUrl: promotionalData.videoUrl?.trim() || "",
      catalogUrl: promotionalData.catalogUrl?.trim() || "",
    };

    // Process external links
    mediaData.links = (savedDynamicItems.links || [])
      .filter((link) => link.saved === true && link.url && link.title)
      .map((link) => ({
        title: link.title,
        url: link.url,
        type: link.type || "website",
      }));

    // Clean up empty arrays
    ["documents", "images", "videos", "links"].forEach((key) => {
      if (mediaData[key] && mediaData[key].length === 0) {
        mediaData[key] = undefined;
      }
    });

    console.log("✅ Media data processed successfully");
    return mediaData;
  }

  //new
  // Add this method to your onlineLiveController.js

  /**
   * Delete file from Cloudinary instead of local filesystem
   * @route POST /admin-courses/onlinelive/api/:id/delete-file
   */
  async deleteCloudinaryFile(req, res) {
    try {
      const courseId = req.params.id;
      const { fileType, fileUrl } = req.body;

      console.log(
        `🗑️ Deleting Cloudinary file: Type=${fileType}, URL=${fileUrl} for Course ID=${courseId}`
      );

      const course = await OnlineLiveTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found.",
        });
      }

      // Extract Cloudinary public_id from URL
      const publicId = this._extractCloudinaryPublicId(fileUrl);
      if (!publicId) {
        return res.status(400).json({
          success: false,
          message: "Invalid Cloudinary URL format.",
        });
      }

      // Remove file reference from course document
      const updated = await course.removeFile(fileType, fileUrl);

      if (updated) {
        await course.save();

        // Delete from Cloudinary
        try {
          let deleteResult;
          // Determine resource type based on file type
          if (fileType === "documents") {
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "raw",
            });
          } else if (fileType === "videos") {
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "video",
            });
          } else {
            // mainImage and images
            deleteResult = await cloudinary.uploader.destroy(publicId, {
              resource_type: "image",
            });
          }

          console.log("🗑️ Cloudinary delete result:", deleteResult);

          if (
            deleteResult.result === "ok" ||
            deleteResult.result === "not found"
          ) {
            console.log("✅ File deleted from Cloudinary successfully");
          }
        } catch (cloudinaryError) {
          console.error("❌ Cloudinary deletion error:", cloudinaryError);
          // Don't fail the request if Cloudinary deletion fails
          // The file reference is already removed from the database
        }

        res.json({
          success: true,
          message: "File deleted successfully.",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "File not found in course or could not be removed.",
        });
      }
    } catch (error) {
      console.error("❌ Error deleting Cloudinary file:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting file",
        error: error.message,
      });
    }
  }

  /**
   * Extract Cloudinary public_id from URL
   * @param {string} cloudinaryUrl - Full Cloudinary URL
   * @returns {string|null} Public ID or null if invalid
   */
  _extractCloudinaryPublicId(cloudinaryUrl) {
    try {
      // Example URL: https://res.cloudinary.com/yourcloud/image/upload/v1234567890/iaai-platform/onlinelive/main-images/main-image-123456-abc.jpg
      const urlParts = cloudinaryUrl.split("/");
      const uploadIndex = urlParts.findIndex((part) => part === "upload");

      if (uploadIndex === -1) return null;

      // Get everything after 'upload/v{version}/' or 'upload/'
      let pathAfterUpload = urlParts.slice(uploadIndex + 1);

      // Remove version if present (starts with 'v' followed by numbers)
      if (pathAfterUpload[0] && /^v\d+$/.test(pathAfterUpload[0])) {
        pathAfterUpload = pathAfterUpload.slice(1);
      }

      // Join the remaining parts and remove file extension
      const publicIdWithExtension = pathAfterUpload.join("/");
      const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");

      console.log("📋 Extracted public_id:", publicId);
      return publicId;
    } catch (error) {
      console.error("❌ Error extracting public_id:", error);
      return null;
    }
  }

  /**
   * Process materials data
   */
  _processMaterialsData(formData, savedDynamicItems) {
    const materialsData = formData.materials || {};
    return {
      handouts: this._mergeDynamicArray(savedDynamicItems.handouts, "object"),
      virtualLabs: this._mergeDynamicArray(
        savedDynamicItems.virtualLabs,
        "object"
      ),
      lms: {
        enabled:
          materialsData.lms?.enabled === true ||
          materialsData.lms?.enabled === "on",
        platform: materialsData.lms?.platform?.trim() || "",
        courseUrl: materialsData.lms?.courseUrl?.trim() || "",
      },
    };
  }

  /**
   * Process assessment data
   */
  _processAssessmentData(formData, savedDynamicItems) {
    const assessmentData = formData.assessment || {};
    return {
      required:
        assessmentData.required === true || assessmentData.required === "on",
      type: assessmentData.type || "none",
      passingScore: parseInt(assessmentData.passingScore) || 70,
      retakesAllowed: parseInt(assessmentData.retakesAllowed) || 1,
      proctoring: {
        enabled:
          assessmentData.proctoring?.enabled === true ||
          assessmentData.proctoring?.enabled === "on",
        type: assessmentData.proctoring?.type || "none",
      },
      platform: assessmentData.platform?.trim() || "",
      timeLimit: assessmentData.timeLimit
        ? parseInt(assessmentData.timeLimit)
        : undefined,
      questions: this._mergeDynamicArray(savedDynamicItems.questions, "object"),
    };
  }

  /**
   * Process certification data
   */
  _processCertificationData(formData, savedDynamicItems) {
    const certificationData = formData.certification || {};
    return {
      enabled:
        certificationData.enabled === true ||
        certificationData.enabled === "on",
      type: certificationData.type || "completion",
      issuingAuthorityId: certificationData.issuingAuthorityId || undefined,
      issuingAuthority:
        certificationData.issuingAuthority?.trim() || "IAAI Training Institute",
      certificationBodies: this._mergeDynamicArray(
        savedDynamicItems.certificationBodies,
        "object"
      ),
      requirements: {
        minimumAttendance:
          parseInt(certificationData.requirements?.minimumAttendance) || 80,
        minimumScore:
          parseInt(certificationData.requirements?.minimumScore) || 70,
        practicalRequired:
          certificationData.requirements?.practicalRequired === true ||
          certificationData.requirements?.practicalRequired === "on",
        projectRequired:
          certificationData.requirements?.projectRequired === true ||
          certificationData.requirements?.projectRequired === "on",
      },
      validity: {
        isLifetime:
          certificationData.validity?.isLifetime === true ||
          certificationData.validity?.isLifetime === "on",
        years: certificationData.validity?.years
          ? parseInt(certificationData.validity.years)
          : undefined,
      },
      features: {
        digitalBadge:
          certificationData.features?.digitalBadge === true ||
          certificationData.features?.digitalBadge === "on",
        qrVerification:
          certificationData.features?.qrVerification === true ||
          certificationData.features?.qrVerification === "on",
        autoGenerate:
          certificationData.features?.autoGenerate === true ||
          certificationData.features?.autoGenerate === "on",
        blockchain:
          certificationData.features?.blockchain === true ||
          certificationData.features?.blockchain === "on",
      },
      template: certificationData.template || "professional_v1",
    };
  }

  /**
   * Process attendance data
   */
  _processAttendanceData(formData) {
    const attendanceData = formData.attendance || {};
    return {
      trackingEnabled:
        attendanceData.trackingEnabled === true ||
        attendanceData.trackingEnabled === "on",
      method: attendanceData.method || "automatic",
      minimumRequired: parseInt(attendanceData.minimumRequired) || 80,
      lateJoinWindow: parseInt(attendanceData.lateJoinWindow) || 15,
      rules: {
        minimumSessionTime:
          parseInt(attendanceData.rules?.minimumSessionTime) || 80,
        breakAttendanceRequired:
          attendanceData.rules?.breakAttendanceRequired === true ||
          attendanceData.rules?.breakAttendanceRequired === "on",
      },
    };
  }

  /**
   * Process analytics data
   */
  _processAnalyticsData(formData) {
    // Analytics are typically system-managed, so we just return default structure
    return {
      engagement: {},
      participation: {
        totalQuestions: 0,
        totalPolls: 0,
        totalChats: 0,
      },
      technical: {
        totalIssues: 0,
      },
    };
  }

  /**
   * Process support data
   */
  _processSupportData(formData) {
    const supportData = formData.support || {};
    return {
      contact: {
        email: supportData.contact?.email?.trim() || "info@iaa-i.com",
        phone: supportData.contact?.phone?.trim() || "",
        whatsapp: supportData.contact?.whatsapp?.trim() || "+90 536 745 86 66",
      },
      hours: {
        available:
          supportData.hours?.available === true ||
          supportData.hours?.available === "on",
        schedule:
          supportData.hours?.schedule?.trim() || "9 AM - 6 PM (Monday-Friday)",
        timezone: supportData.hours?.timezone?.trim() || "",
      },
      channels: {
        email:
          supportData.channels?.email === true ||
          supportData.channels?.email === "on",
        liveChat:
          supportData.channels?.liveChat === true ||
          supportData.channels?.liveChat === "on",
        ticketing:
          supportData.channels?.ticketing === true ||
          supportData.channels?.ticketing === "on",
      },
      emergencyProcedures: {
        platformFailure:
          supportData.emergencyProcedures?.platformFailure?.trim() || "",
        instructorDisconnection:
          supportData.emergencyProcedures?.instructorDisconnection?.trim() ||
          "",
      },
    };
  }

  /**
   * Process post-course data
   */
  _processPostCourseData(formData, savedDynamicItems) {
    const postCourseData = formData.postCourse || {};
    return {
      accessDuration: {
        recordings: parseInt(postCourseData.accessDuration?.recordings) || 90,
        materials: parseInt(postCourseData.accessDuration?.materials) || 180,
        forum: parseInt(postCourseData.accessDuration?.forum) || 365,
      },
      alumni: {
        refresherAccess:
          postCourseData.alumni?.refresherAccess === true ||
          postCourseData.alumni?.refresherAccess === "on",
        updatesIncluded:
          postCourseData.alumni?.updatesIncluded === true ||
          postCourseData.alumni?.updatesIncluded === "on",
        communityAccess:
          postCourseData.alumni?.communityAccess === true ||
          postCourseData.alumni?.communityAccess === "on",
        futureDiscount: postCourseData.alumni?.futureDiscount
          ? parseInt(postCourseData.alumni.futureDiscount)
          : undefined,
      },
      continuedLearning: {
        monthlyWebinars:
          postCourseData.continuedLearning?.monthlyWebinars === true ||
          postCourseData.continuedLearning?.monthlyWebinars === "on",
        newsletter:
          postCourseData.continuedLearning?.newsletter === true ||
          postCourseData.continuedLearning?.newsletter === "on",
        advancedCourses: this._mergeDynamicArray(
          savedDynamicItems.advancedCourses,
          "code"
        ),
      },
    };
  }

  /**
   * Process experience data
   */
  _processExperienceData(formData) {
    const experienceData = formData.experience || {};
    return {
      onboarding: {
        welcomeVideoUrl:
          experienceData.onboarding?.welcomeVideoUrl?.trim() || "",
        platformGuideUrl:
          experienceData.onboarding?.platformGuideUrl?.trim() || "",
        checklistUrl: experienceData.onboarding?.checklistUrl?.trim() || "",
        orientationDate: experienceData.onboarding?.orientationDate
          ? new Date(experienceData.onboarding.orientationDate)
          : undefined,
        orientationRequired:
          experienceData.onboarding?.orientationRequired === true ||
          experienceData.onboarding?.orientationRequired === "on",
      },
      accessibility: {
        closedCaptions:
          experienceData.accessibility?.closedCaptions === true ||
          experienceData.accessibility?.closedCaptions === "on",
        transcripts:
          experienceData.accessibility?.transcripts === true ||
          experienceData.accessibility?.transcripts === "on",
        signLanguage:
          experienceData.accessibility?.signLanguage === true ||
          experienceData.accessibility?.signLanguage === "on",
        audioDescription:
          experienceData.accessibility?.audioDescription === true ||
          experienceData.accessibility?.audioDescription === "on",
      },
      gamification: {
        enabled:
          experienceData.gamification?.enabled === true ||
          experienceData.gamification?.enabled === "on",
        points:
          experienceData.gamification?.points === true ||
          experienceData.gamification?.points === "on",
        badges:
          experienceData.gamification?.badges === true ||
          experienceData.gamification?.badges === "on",
        leaderboard:
          experienceData.gamification?.leaderboard === true ||
          experienceData.gamification?.leaderboard === "on",
      },
    };
  }

  /**
   * Process notification settings data
   */
  _processNotificationSettingsData(formData) {
    const notificationData = formData.notificationSettings || {};
    return {
      courseUpdates:
        notificationData.courseUpdates === true ||
        notificationData.courseUpdates === "on",
      emailNotifications:
        notificationData.emailNotifications === true ||
        notificationData.emailNotifications === "on",
      reminderSchedule: notificationData.reminderSchedule
        ? notificationData.reminderSchedule
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n))
        : [7, 3, 1],
      marketingEmails:
        notificationData.marketingEmails === true ||
        notificationData.marketingEmails === "on",
      weeklyDigest:
        notificationData.weeklyDigest === true ||
        notificationData.weeklyDigest === "on",
    };
  }

  /**
   * Process metadata
   */
  _processMetadataData(formData, user) {
    const metadataData = formData.metadata || {};
    return {
      createdBy: user?._id || null,
      lastModifiedBy: user?._id || null,
      version: parseInt(metadataData.version) || 1,
      tags: metadataData.tags
        ? metadataData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      internalNotes: metadataData.internalNotes?.trim() || "",
      isTemplate:
        metadataData.isTemplate === true || metadataData.isTemplate === "on",
      templateName: metadataData.templateName?.trim() || "",
      lastModified: new Date(),
    };
  }

  /**
   * Merge dynamic array data from savedDynamicItems
   */
  _mergeDynamicArray(savedItems, extractProperty) {
    if (!savedItems || !Array.isArray(savedItems) || savedItems.length === 0) {
      return [];
    }

    const result = [];

    savedItems.forEach((item) => {
      try {
        if (!item || typeof item !== "object" || item.saved !== true) {
          return; // Skip unsaved items
        }

        let processedItem;

        switch (extractProperty) {
          case "text":
            processedItem = item.text || item;
            break;
          case "name":
            processedItem = item.name || item;
            break;
          case "code":
            processedItem = item.code || item;
            break;
          case "url":
            processedItem = item.url || item;
            break;
          case "object":
            processedItem = { ...item };
            // Remove metadata fields
            delete processedItem.id;
            delete processedItem.saved;
            delete processedItem.timestamp;
            break;
          default:
            processedItem = { ...item };
            delete processedItem.id;
            delete processedItem.saved;
            delete processedItem.timestamp;
            break;
        }

        // Only add non-empty items
        if (
          processedItem &&
          (typeof processedItem === "string" ? processedItem.trim() : true)
        ) {
          result.push(processedItem);
        }
      } catch (error) {
        console.error(`❌ Error processing dynamic item:`, error);
      }
    });

    return result;
  }

  /**
   * Detect changes between existing course and update data
   */
  _detectChanges(existingCourse, updateData) {
    const changes = {
      hasChanges: false,
      schedule: false,
      instructors: false,
      platform: false,
      status: false,
      price: false,
      enrollment: false,
      content: false,
      details: [],
    };

    try {
      // Schedule changes
      if (updateData.schedule) {
        if (
          existingCourse.schedule?.startDate?.getTime() !==
          new Date(updateData.schedule.startDate)?.getTime()
        ) {
          changes.schedule = true;
          changes.hasChanges = true;
          changes.details.push("Start date changed");
        }
        if (
          existingCourse.schedule?.endDate?.getTime() !==
          new Date(updateData.schedule.endDate)?.getTime()
        ) {
          changes.schedule = true;
          changes.hasChanges = true;
          changes.details.push("End date changed");
        }
        if (
          existingCourse.schedule?.duration !== updateData.schedule.duration
        ) {
          changes.schedule = true;
          changes.hasChanges = true;
          changes.details.push("Duration changed");
        }
      }

      // Status changes
      if (existingCourse.basic?.status !== updateData.basic?.status) {
        changes.status = true;
        changes.hasChanges = true;
        changes.details.push(
          `Status changed from ${existingCourse.basic?.status} to ${updateData.basic?.status}`
        );
      }

      // Price changes
      if (existingCourse.enrollment?.price !== updateData.enrollment?.price) {
        changes.price = true;
        changes.hasChanges = true;
        changes.details.push("Price changed");
      }

      // Enrollment changes
      if (
        existingCourse.enrollment?.seatsAvailable !==
        updateData.enrollment?.seatsAvailable
      ) {
        changes.enrollment = true;
        changes.hasChanges = true;
        changes.details.push("Available seats changed");
      }

      // Instructor changes
      if (
        existingCourse.instructors?.primary?.instructorId?.toString() !==
        updateData.instructors?.primary?.instructorId?.toString()
      ) {
        changes.instructors = true;
        changes.hasChanges = true;
        changes.details.push("Primary instructor changed");
      }

      // Platform changes
      if (existingCourse.platform?.name !== updateData.platform?.name) {
        changes.platform = true;
        changes.hasChanges = true;
        changes.details.push("Platform changed");
      }
      if (
        existingCourse.platform?.accessUrl !== updateData.platform?.accessUrl
      ) {
        changes.platform = true;
        changes.hasChanges = true;
        changes.details.push("Platform access URL changed");
      }

      // Content changes
      if (existingCourse.basic?.title !== updateData.basic?.title) {
        changes.content = true;
        changes.hasChanges = true;
        changes.details.push("Course title changed");
      }
      if (existingCourse.basic?.description !== updateData.basic?.description) {
        changes.content = true;
        changes.hasChanges = true;
        changes.details.push("Course description changed");
      }

      console.log("🔍 Detected changes:", changes);
      return changes;
    } catch (error) {
      console.error("❌ Error detecting changes:", error);
      return {
        hasChanges: false,
        schedule: false,
        instructors: false,
        platform: false,
        status: false,
        price: false,
        enrollment: false,
        content: false,
        details: ["Error detecting changes"],
      };
    }
  }

  async _cleanupCourseFiles(course) {
    try {
      const cloudinaryFiles = [];

      // Collect all Cloudinary URLs from the course
      if (course.media?.mainImage?.url) {
        cloudinaryFiles.push({
          url: course.media.mainImage.url,
          type: "mainImage",
        });
      }
      if (course.media?.documents) {
        course.media.documents.forEach((url) => {
          cloudinaryFiles.push({ url, type: "documents" });
        });
      }
      if (course.media?.images) {
        course.media.images.forEach((url) => {
          cloudinaryFiles.push({ url, type: "images" });
        });
      }
      if (course.media?.videos) {
        // Only include Cloudinary files, not external links
        course.media.videos.forEach((url) => {
          if (url.includes("cloudinary.com")) {
            cloudinaryFiles.push({ url, type: "videos" });
          }
        });
      }

      // Delete each file from Cloudinary
      for (const file of cloudinaryFiles) {
        await this._deleteCloudinaryFile(file.url, file.type);
      }

      console.log(`✅ Cleaned up ${cloudinaryFiles.length} Cloudinary files`);
    } catch (error) {
      console.error("❌ Error cleaning up Cloudinary files:", error);
    }
  }

  /**
   * Clean session data before saving to database
   * Converts empty string instructorIds to null to prevent Mongoose casting errors
   */
  _cleanSessionData(sessions) {
    if (!Array.isArray(sessions)) return sessions;

    return sessions.map((session) => {
      const cleanedSession = { ...session };

      // Convert empty string instructorId to null
      if (
        cleanedSession.instructorId === "" ||
        cleanedSession.instructorId === undefined
      ) {
        cleanedSession.instructorId = null;
      }

      // Ensure other required fields have proper types
      if (cleanedSession.dayNumber) {
        cleanedSession.dayNumber = parseInt(cleanedSession.dayNumber);
      }

      return cleanedSession;
    });
  }

  /**
   * Delete a physical file from the filesystem
   */
  async _deletePhysicalFile(fileUrl) {
    try {
      // Check if it's a Cloudinary URL
      if (!fileUrl || !fileUrl.includes("cloudinary.com")) {
        console.log("⚠️ Not a Cloudinary URL, skipping:", fileUrl);
        return;
      }

      // For Cloudinary URLs, we handle deletion through the API
      console.log(`🗑️ Cloudinary file deletion handled via API: ${fileUrl}`);
      // The actual deletion is handled by the deleteCloudinaryFile method
    } catch (error) {
      console.error(`❌ Error processing Cloudinary file ${fileUrl}:`, error);
    }
  }

  // 5. ADD THIS HELPER METHOD
  // Add this helper method to extract public_id from Cloudinary URLs:

  _extractCloudinaryPublicId(cloudinaryUrl) {
    try {
      // Example URL: https://res.cloudinary.com/yourcloud/image/upload/v1234567890/iaai-platform/onlinelive/main-images/main-image-123456-abc.jpg
      const urlParts = cloudinaryUrl.split("/");
      const uploadIndex = urlParts.findIndex((part) => part === "upload");

      if (uploadIndex === -1) return null;

      // Get everything after 'upload/v{version}/' or 'upload/'
      let pathAfterUpload = urlParts.slice(uploadIndex + 1);

      // Remove version if present (starts with 'v' followed by numbers)
      if (pathAfterUpload[0] && /^v\d+$/.test(pathAfterUpload[0])) {
        pathAfterUpload = pathAfterUpload.slice(1);
      }

      // Join the remaining parts and remove file extension
      const publicIdWithExtension = pathAfterUpload.join("/");
      const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");

      console.log("📋 Extracted public_id:", publicId);
      return publicId;
    } catch (error) {
      console.error("❌ Error extracting public_id:", error);
      return null;
    }
  }

  // 6. ADD THIS HELPER METHOD FOR CLEANUP
  // Add this helper method for internal cleanup operations:

  async _deleteCloudinaryFile(fileUrl, fileType) {
    try {
      if (!fileUrl || !fileUrl.includes("cloudinary.com")) {
        console.log("⚠️ Not a Cloudinary URL, skipping:", fileUrl);
        return;
      }

      const publicId = this._extractCloudinaryPublicId(fileUrl);
      if (!publicId) {
        console.warn("⚠️ Could not extract public_id from URL:", fileUrl);
        return;
      }

      let deleteResult;
      if (fileType === "documents") {
        deleteResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });
      } else if (fileType === "videos") {
        deleteResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: "video",
        });
      } else {
        // mainImage and images
        deleteResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }

      console.log(`🗑️ Cloudinary delete result for ${publicId}:`, deleteResult);

      if (deleteResult.result === "ok") {
        console.log(`✅ Successfully deleted ${publicId} from Cloudinary`);
      } else if (deleteResult.result === "not found") {
        console.log(
          `⚠️ File ${publicId} not found in Cloudinary (may have been deleted already)`
        );
      }
    } catch (error) {
      console.error(`❌ Error deleting Cloudinary file ${fileUrl}:`, error);
      // Don't throw - we don't want to fail the cleanup process
    }
  }

  /**
   * Create cloned course data
   */
  _createClonedCourseData(originalCourse, cloneOptions, user) {
    const clonedData = {
      // Basic information (always cloned with new values)
      basic: {
        courseCode: cloneOptions.courseCode.trim().toUpperCase(),
        title: cloneOptions.title.trim(),
        description: originalCourse.basic?.description || "",
        aboutThisCourse: originalCourse.basic?.aboutThisCourse || "",
        category: originalCourse.basic?.category || "aesthetic",
        status: cloneOptions.status || "draft",
        courseType: "online-live",
      },

      // Schedule (always updated with new dates)
      schedule: {
        startDate: new Date(cloneOptions.startDate),
        endDate: cloneOptions.newEndDate
          ? new Date(cloneOptions.newEndDate)
          : undefined,
        duration: originalCourse.schedule?.duration || "1 day",
        registrationDeadline: undefined,
        primaryTimezone: originalCourse.schedule?.primaryTimezone || "UTC",
        displayTimezones: originalCourse.schedule?.displayTimezones || [],
        pattern: originalCourse.schedule?.pattern || "single",
        sessionTime: originalCourse.schedule?.sessionTime || {},
        sessions: cloneOptions.options?.cloneContent
          ? originalCourse.schedule?.sessions || []
          : [],
      },

      // Enrollment (reset if specified)
      enrollment: {
        price: originalCourse.enrollment?.price || 0,
        earlyBirdPrice: originalCourse.enrollment?.earlyBirdPrice,
        currency: originalCourse.enrollment?.currency || "EUR",
        seatsAvailable: originalCourse.enrollment?.seatsAvailable || 50,
        minEnrollment: originalCourse.enrollment?.minEnrollment || 10,
        currentEnrollment: cloneOptions.options?.resetEnrollment
          ? 0
          : originalCourse.enrollment?.currentEnrollment || 0,
        waitlistEnabled: originalCourse.enrollment?.waitlistEnabled || true,
        registrationUrl: originalCourse.enrollment?.registrationUrl || "",
      },

      // Conditionally clone other sections based on options
      instructors: cloneOptions.options?.cloneInstructors
        ? {
            primary: originalCourse.instructors?.primary || {},
            additional: originalCourse.instructors?.additional || [],
          }
        : { primary: {}, additional: [] },

      platform: cloneOptions.options?.clonePlatform
        ? {
            ...originalCourse.platform,
            meetingId: "",
            passcode: "",
            accessUrl: originalCourse.platform?.accessUrl || "",
          }
        : {
            name: "Zoom",
            accessUrl: "",
            meetingId: "",
            passcode: "",
            backupPlatform: "",
            backupUrl: "",
            features: {
              breakoutRooms: true,
              polling: true,
              whiteboard: true,
              recording: true,
              chat: true,
              screenSharing: true,
            },
          },

      content: cloneOptions.options?.cloneContent
        ? {
            objectives: originalCourse.content?.objectives || [],
            modules: originalCourse.content?.modules || [],
            targetAudience: originalCourse.content?.targetAudience || [],
            experienceLevel:
              originalCourse.content?.experienceLevel || "all-levels",
            prerequisites: originalCourse.content?.prerequisites || "",
            detailedSyllabus: originalCourse.content?.detailedSyllabus || "",
          }
        : {
            objectives: [],
            modules: [],
            targetAudience: [],
            experienceLevel: "all-levels",
            prerequisites: "",
            detailedSyllabus: "",
          },

      technical: cloneOptions.options?.cloneTechnical
        ? { ...originalCourse.technical }
        : {
            systemRequirements: {
              os: [],
              browsers: [],
              minimumRAM: "4GB",
              processor: "Dual-core 2GHz",
            },
            internetSpeed: {
              minimum: "5 Mbps",
              recommended: "25 Mbps",
            },
            requiredSoftware: [],
            equipment: {
              camera: "recommended",
              microphone: "required",
              headset: "recommended",
            },
            techCheckRequired: true,
            techCheckDate: undefined,
            techCheckUrl: "",
          },

      interaction: cloneOptions.options?.cloneInteraction
        ? { ...originalCourse.interaction }
        : {
            participationRequired: true,
            cameraRequired: false,
            features: {
              polls: true,
              quizzes: true,
              breakoutRooms: true,
              qa: true,
              chat: true,
              reactions: true,
            },
            engagementTools: [],
            networkingOptions: {
              virtualCoffeeBreaks: false,
              discussionForum: true,
              linkedInGroup: "",
              slackChannel: "",
            },
          },

      recording: cloneOptions.options?.cloneRecording
        ? { ...originalCourse.recording, sessions: [] }
        : {
            enabled: true,
            type: "cloud",
            availability: {
              forStudents: true,
              duration: 90,
              downloadable: false,
              passwordProtected: false,
            },
            sessions: [],
            autoTranscription: false,
          },

      media: cloneOptions.options?.cloneMedia
        ? {
            mainImage: undefined,
            documents: [],
            images: [],
            videos:
              originalCourse.media?.videos?.filter(
                (url) => !url.startsWith("/uploads/")
              ) || [],
            promotional: originalCourse.media?.promotional || {},
            links: originalCourse.media?.links || [],
          }
        : {
            mainImage: undefined,
            documents: [],
            images: [],
            videos: [],
            promotional: {},
            links: [],
          },

      materials: cloneOptions.options?.cloneMaterials
        ? {
            ...originalCourse.materials,
            handouts: (originalCourse.materials?.handouts || []).map(
              (handout) => ({ ...handout, url: "" })
            ),
          }
        : {
            handouts: [],
            virtualLabs: [],
            lms: {
              enabled: false,
              platform: "",
              courseUrl: "",
            },
          },

      assessment: cloneOptions.options?.cloneAssessment
        ? { ...originalCourse.assessment }
        : {
            required: false,
            type: "none",
            passingScore: 70,
            retakesAllowed: 1,
            proctoring: {
              enabled: false,
              type: "none",
            },
            platform: "",
            timeLimit: undefined,
            questions: [],
          },

      certification: cloneOptions.options?.cloneAssessment
        ? { ...originalCourse.certification }
        : {
            enabled: true,
            type: "completion",
            issuingAuthorityId: undefined,
            issuingAuthority: "IAAI Training Institute",
            certificationBodies: [],
            requirements: {
              minimumAttendance: 80,
              minimumScore: 70,
              practicalRequired: false,
              projectRequired: false,
            },
            validity: {
              isLifetime: true,
              years: undefined,
            },
            features: {
              digitalBadge: true,
              blockchain: false,
              qrVerification: true,
              autoGenerate: true,
            },
            template: "professional_v1",
          },

      attendance: {
        trackingEnabled: true,
        method: "automatic",
        minimumRequired: 80,
        lateJoinWindow: 15,
        rules: {
          minimumSessionTime: 80,
          breakAttendanceRequired: false,
        },
        records: [],
      },

      analytics: {
        engagement: {},
        participation: {
          totalQuestions: 0,
          totalPolls: 0,
          totalChats: 0,
        },
        technical: {
          totalIssues: 0,
        },
      },

      support: originalCourse.support || {
        contact: {
          email: "info@iaa-i.com",
          phone: "",
          whatsapp: "+90 536 745 86 66",
        },
        hours: {
          available: true,
          schedule: "9 AM - 6 PM (Monday-Friday)",
          timezone: "",
        },
        channels: {
          email: true,
          liveChat: false,
          ticketing: false,
        },
        emergencyProcedures: {
          platformFailure: "",
          instructorDisconnection: "",
        },
      },

      postCourse: cloneOptions.options?.clonePostCourse
        ? { ...originalCourse.postCourse }
        : {
            accessDuration: {
              recordings: 90,
              materials: 180,
              forum: 365,
            },
            alumni: {
              refresherAccess: true,
              updatesIncluded: true,
              communityAccess: true,
              futureDiscount: undefined,
            },
            continuedLearning: {
              monthlyWebinars: false,
              newsletter: true,
              advancedCourses: [],
            },
          },

      experience: cloneOptions.options?.cloneExperience
        ? { ...originalCourse.experience }
        : {
            onboarding: {
              welcomeVideoUrl: "",
              platformGuideUrl: "",
              checklistUrl: "",
              orientationDate: undefined,
              orientationRequired: false,
            },
            accessibility: {
              closedCaptions: true,
              transcripts: true,
              signLanguage: false,
              audioDescription: false,
            },
            gamification: {
              enabled: false,
              points: false,
              badges: false,
              leaderboard: false,
            },
          },

      notificationSettings: originalCourse.notificationSettings || {
        courseUpdates: true,
        emailNotifications: true,
        reminderSchedule: [7, 3, 1],
        marketingEmails: true,
        weeklyDigest: false,
      },

      metadata: {
        createdBy: user?._id || null,
        lastModifiedBy: user?._id || null,
        version: 1,
        tags: originalCourse.metadata?.tags || [],
        internalNotes:
          cloneOptions.notes ||
          `Cloned from: ${originalCourse.basic?.title} (${originalCourse.basic?.courseCode})`,
        isTemplate: false,
        templateName: "",
        lastModified: new Date(),
      },

      cloneInfo: {
        isClone: true,
        originalCourseId: originalCourse._id,
        clonedAt: new Date(),
        clonedBy: user?._id || null,
        cloneOptions: cloneOptions,
      },
    };

    console.log("✅ Clone data created for:", clonedData.basic.title);
    return clonedData;
  }

  /**
   * Handle errors and send appropriate responses
   */
  _handleError(error, res) {
    console.error("❌ Controller error:", error);

    // Handle specific errors
    if (error.message === "DUPLICATE_COURSE_CODE") {
      return res.status(400).json({
        success: false,
        message: "Course code already exists. Please use a unique course code.",
        field: "courseCode",
      });
    }

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed: " + validationErrors.join(", "),
        errors: validationErrors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate key error. Please check your data.",
        field: Object.keys(error.keyPattern)[0],
      });
    }

    // Handle cast errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data format provided",
      });
    }

    // Default error response
    return res.status(500).json({
      success: false,
      message: "Error processing request",
      error: error.message,
    });
  }

  /**
   * Process schedule data from merged form data
   */
  _processScheduleDataFromMerged(formData) {
    const scheduleData = formData.schedule || {};
    return {
      startDate: scheduleData.startDate
        ? new Date(scheduleData.startDate)
        : undefined,
      endDate: scheduleData.endDate
        ? new Date(scheduleData.endDate)
        : undefined,
      registrationDeadline: scheduleData.registrationDeadline
        ? new Date(scheduleData.registrationDeadline)
        : undefined,
      duration: scheduleData.duration || "",
      primaryTimezone: scheduleData.primaryTimezone || "UTC",
      displayTimezones: scheduleData.displayTimezones || [],
      pattern: scheduleData.pattern || "single",
      sessionTime: {
        startTime: scheduleData.sessionTime?.startTime || "",
        endTime: scheduleData.sessionTime?.endTime || "",
        breakDuration: parseInt(scheduleData.sessionTime?.breakDuration) || 15,
      },
      sessions: scheduleData.sessions || [], // Already processed from dynamic items
    };
  }

  /**
   * Process content data from merged form data
   */
  _processContentDataFromMerged(formData) {
    const contentData = formData.content || {};
    return {
      objectives: contentData.objectives || [], // Already processed from dynamic items
      modules: contentData.modules || [], // Already processed from dynamic items
      targetAudience: contentData.targetAudience || [], // Already processed from dynamic items
      experienceLevel: contentData.experienceLevel || "all-levels",
      prerequisites: contentData.prerequisites?.trim() || "",
      detailedSyllabus: contentData.detailedSyllabus?.trim() || "",
    };
  }

  /**
   * Process technical data from merged form data
   */
  _processTechnicalDataFromMerged(formData) {
    const technicalData = formData.technical || {};
    return {
      systemRequirements: {
        os: technicalData.systemRequirements?.os || [],
        browsers: technicalData.systemRequirements?.browsers || [],
        minimumRAM: technicalData.systemRequirements?.minimumRAM || "4GB",
        processor:
          technicalData.systemRequirements?.processor || "Dual-core 2GHz",
      },
      internetSpeed: {
        minimum: technicalData.internetSpeed?.minimum || "5 Mbps",
        recommended: technicalData.internetSpeed?.recommended || "25 Mbps",
      },
      requiredSoftware: technicalData.requiredSoftware || [], // Already processed from dynamic items
      equipment: {
        camera: technicalData.equipment?.camera || "recommended",
        microphone: technicalData.equipment?.microphone || "required",
        headset: technicalData.equipment?.headset || "recommended",
      },
      techCheckRequired:
        technicalData.techCheckRequired === true ||
        technicalData.techCheckRequired === "on",
      techCheckDate: technicalData.techCheckDate
        ? new Date(technicalData.techCheckDate)
        : undefined,
      techCheckUrl: technicalData.techCheckUrl?.trim() || "",
    };
  }

  /**
   * Process interaction data from merged form data
   */
  _processInteractionDataFromMerged(formData) {
    const interactionData = formData.interaction || {};
    return {
      participationRequired:
        interactionData.participationRequired === true ||
        interactionData.participationRequired === "on",
      cameraRequired:
        interactionData.cameraRequired === true ||
        interactionData.cameraRequired === "on",
      features: {
        polls:
          interactionData.features?.polls === true ||
          interactionData.features?.polls === "on",
        quizzes:
          interactionData.features?.quizzes === true ||
          interactionData.features?.quizzes === "on",
        breakoutRooms:
          interactionData.features?.breakoutRooms === true ||
          interactionData.features?.breakoutRooms === "on",
        qa:
          interactionData.features?.qa === true ||
          interactionData.features?.qa === "on",
        chat:
          interactionData.features?.chat === true ||
          interactionData.features?.chat === "on",
        reactions:
          interactionData.features?.reactions === true ||
          interactionData.features?.reactions === "on",
      },
      engagementTools: interactionData.engagementTools || [], // Already processed from dynamic items
      networkingOptions: {
        virtualCoffeeBreaks:
          interactionData.networkingOptions?.virtualCoffeeBreaks === true ||
          interactionData.networkingOptions?.virtualCoffeeBreaks === "on",
        discussionForum:
          interactionData.networkingOptions?.discussionForum === true ||
          interactionData.networkingOptions?.discussionForum === "on",
        linkedInGroup:
          interactionData.networkingOptions?.linkedInGroup?.trim() || "",
        slackChannel:
          interactionData.networkingOptions?.slackChannel?.trim() || "",
      },
    };
  }

  /**
   * Process media data from merged form data
   */
  _processMediaDataFromMerged(formData, uploadedFiles, existingMedia = {}) {
    console.log("🎬 Processing media data from merged form data...");

    const mediaData = {
      mainImage: existingMedia.mainImage || undefined,
      documents: existingMedia.documents || [],
      images: existingMedia.images || [],
      videos: existingMedia.videos || [],
      promotional: existingMedia.promotional || {},
      links: existingMedia.links || [],
    };

    // Handle uploaded files
    if (uploadedFiles?.mainImage) {
      const mainImageUrl = Array.isArray(uploadedFiles.mainImage)
        ? uploadedFiles.mainImage[0]
        : uploadedFiles.mainImage;
      if (
        mainImageUrl &&
        typeof mainImageUrl === "string" &&
        mainImageUrl.trim()
      ) {
        mediaData.mainImage = {
          url: mainImageUrl.trim(),
          alt: formData.basic?.title || "Course Main Image",
        };
      }
    }

    // Handle file arrays
    if (uploadedFiles?.documents && Array.isArray(uploadedFiles.documents)) {
      mediaData.documents = [
        ...new Set([...mediaData.documents, ...uploadedFiles.documents]),
      ];
    }
    if (uploadedFiles?.images && Array.isArray(uploadedFiles.images)) {
      mediaData.images = [
        ...new Set([...mediaData.images, ...uploadedFiles.images]),
      ];
    }
    if (uploadedFiles?.videos && Array.isArray(uploadedFiles.videos)) {
      mediaData.videos = [
        ...new Set([...mediaData.videos, ...uploadedFiles.videos]),
      ];
    }

    // Handle videos from merged form data (includes external links)
    if (formData.media?.videos && Array.isArray(formData.media.videos)) {
      mediaData.videos = [
        ...new Set([...mediaData.videos, ...formData.media.videos]),
      ];
    }

    // Process promotional media
    const promotionalData = formData.media?.promotional || {};
    mediaData.promotional = {
      brochureUrl: promotionalData.brochureUrl?.trim() || "",
      videoUrl: promotionalData.videoUrl?.trim() || "",
      catalogUrl: promotionalData.catalogUrl?.trim() || "",
    };

    // Process external links
    mediaData.links = formData.media?.links || [];

    console.log("✅ Media data processed successfully from merged data");
    return mediaData;
  }

  /**
   * Process materials data from merged form data
   */
  _processMaterialsDataFromMerged(formData) {
    const materialsData = formData.materials || {};
    return {
      handouts: materialsData.handouts || [], // Already processed from dynamic items
      virtualLabs: materialsData.virtualLabs || [], // Already processed from dynamic items
      lms: {
        enabled:
          materialsData.lms?.enabled === true ||
          materialsData.lms?.enabled === "on",
        platform: materialsData.lms?.platform?.trim() || "",
        courseUrl: materialsData.lms?.courseUrl?.trim() || "",
      },
    };
  }

  /**
   * Process assessment data from merged form data
   */
  _processAssessmentDataFromMerged(formData) {
    const assessmentData = formData.assessment || {};
    return {
      required:
        assessmentData.required === true || assessmentData.required === "on",
      type: assessmentData.type || "none",
      passingScore: parseInt(assessmentData.passingScore) || 70,
      retakesAllowed: parseInt(assessmentData.retakesAllowed) || 1,
      proctoring: {
        enabled:
          assessmentData.proctoring?.enabled === true ||
          assessmentData.proctoring?.enabled === "on",
        type: assessmentData.proctoring?.type || "none",
      },
      platform: assessmentData.platform?.trim() || "",
      timeLimit: assessmentData.timeLimit
        ? parseInt(assessmentData.timeLimit)
        : undefined,
      questions: assessmentData.questions || [], // Already processed from dynamic items
    };
  }

  /**
   * Process certification data from merged form data
   */
  _processCertificationDataFromMerged(formData) {
    const certificationData = formData.certification || {};
    return {
      enabled:
        certificationData.enabled === true ||
        certificationData.enabled === "on",
      type: certificationData.type || "completion",
      issuingAuthorityId: certificationData.issuingAuthorityId || undefined,
      issuingAuthority:
        certificationData.issuingAuthority?.trim() || "IAAI Training Institute",
      certificationBodies: certificationData.certificationBodies || [], // Already processed from dynamic items
      requirements: {
        minimumAttendance:
          parseInt(certificationData.requirements?.minimumAttendance) || 80,
        minimumScore:
          parseInt(certificationData.requirements?.minimumScore) || 70,
        practicalRequired:
          certificationData.requirements?.practicalRequired === true ||
          certificationData.requirements?.practicalRequired === "on",
        projectRequired:
          certificationData.requirements?.projectRequired === true ||
          certificationData.requirements?.projectRequired === "on",
      },
      validity: {
        isLifetime:
          certificationData.validity?.isLifetime === true ||
          certificationData.validity?.isLifetime === "on",
        years: certificationData.validity?.years
          ? parseInt(certificationData.validity.years)
          : undefined,
      },
      features: {
        digitalBadge:
          certificationData.features?.digitalBadge === true ||
          certificationData.features?.digitalBadge === "on",
        qrVerification:
          certificationData.features?.qrVerification === true ||
          certificationData.features?.qrVerification === "on",
        autoGenerate:
          certificationData.features?.autoGenerate === true ||
          certificationData.features?.autoGenerate === "on",
        blockchain:
          certificationData.features?.blockchain === true ||
          certificationData.features?.blockchain === "on",
      },
      template: certificationData.template || "professional_v1",
    };
  }

  /**
   * Process post-course data from merged form data
   */
  _processPostCourseDataFromMerged(formData) {
    const postCourseData = formData.postCourse || {};
    return {
      accessDuration: {
        recordings: parseInt(postCourseData.accessDuration?.recordings) || 90,
        materials: parseInt(postCourseData.accessDuration?.materials) || 180,
        forum: parseInt(postCourseData.accessDuration?.forum) || 365,
      },
      alumni: {
        refresherAccess:
          postCourseData.alumni?.refresherAccess === true ||
          postCourseData.alumni?.refresherAccess === "on",
        updatesIncluded:
          postCourseData.alumni?.updatesIncluded === true ||
          postCourseData.alumni?.updatesIncluded === "on",
        communityAccess:
          postCourseData.alumni?.communityAccess === true ||
          postCourseData.alumni?.communityAccess === "on",
        futureDiscount: postCourseData.alumni?.futureDiscount
          ? parseInt(postCourseData.alumni.futureDiscount)
          : undefined,
      },
      continuedLearning: {
        monthlyWebinars:
          postCourseData.continuedLearning?.monthlyWebinars === true ||
          postCourseData.continuedLearning?.monthlyWebinars === "on",
        newsletter:
          postCourseData.continuedLearning?.newsletter === true ||
          postCourseData.continuedLearning?.newsletter === "on",
        advancedCourses:
          postCourseData.continuedLearning?.advancedCourses || [], // Already processed from dynamic items
      },
    };
  }

  /**
   * Build update data from merged form data
   */
  async _buildUpdateDataFromMergedData(
    formData,
    uploadedFiles,
    existingCourse,
    instructors,
    user
  ) {
    console.log("🔨 Building update data object from merged data...");

    const currentCourseData = existingCourse.toObject
      ? existingCourse.toObject()
      : { ...existingCourse };

    const updateData = {
      basic: {
        ...(currentCourseData.basic || {}),
        ...this._processBasicData(formData),
      },
      schedule: {
        ...(currentCourseData.schedule || {}),
        ...this._processScheduleDataFromMerged(formData),
      },
      enrollment: {
        ...(currentCourseData.enrollment || {}),
        ...this._processEnrollmentData(formData),
      },
      instructors: instructors,
      platform: {
        ...(currentCourseData.platform || {}),
        ...this._processPlatformData(formData),
      },
      content: {
        ...(currentCourseData.content || {}),
        ...this._processContentDataFromMerged(formData),
      },
      technical: {
        ...(currentCourseData.technical || {}),
        ...this._processTechnicalDataFromMerged(formData),
      },
      interaction: {
        ...(currentCourseData.interaction || {}),
        ...this._processInteractionDataFromMerged(formData),
      },
      recording: {
        ...(currentCourseData.recording || {}),
        ...this._processRecordingData(formData),
      },
      media: this._processMediaDataFromMerged(
        formData,
        uploadedFiles,
        currentCourseData.media
      ),
      materials: {
        ...(currentCourseData.materials || {}),
        ...this._processMaterialsDataFromMerged(formData),
      },
      assessment: {
        ...(currentCourseData.assessment || {}),
        ...this._processAssessmentDataFromMerged(formData),
      },
      certification: {
        ...(currentCourseData.certification || {}),
        ...this._processCertificationDataFromMerged(formData),
      },
      attendance: {
        ...(currentCourseData.attendance || {}),
        ...this._processAttendanceData(formData),
      },
      analytics: {
        ...(currentCourseData.analytics || {}),
        ...this._processAnalyticsData(formData),
      },
      support: {
        ...(currentCourseData.support || {}),
        ...this._processSupportData(formData),
      },
      postCourse: {
        ...(currentCourseData.postCourse || {}),
        ...this._processPostCourseDataFromMerged(formData),
      },
      experience: {
        ...(currentCourseData.experience || {}),
        ...this._processExperienceData(formData),
      },
      notificationSettings: {
        ...(currentCourseData.notificationSettings || {}),
        ...this._processNotificationSettingsData(formData),
      },
      metadata: {
        ...(currentCourseData.metadata || {}),
        lastModifiedBy: user?._id || null,
        version: (currentCourseData.metadata?.version || 0) + 1,
        lastModified: new Date(),
      },
    };

    // ADD THIS ONE LINE - Clean sessions instructorId
    if (updateData.schedule?.sessions) {
      updateData.schedule.sessions = updateData.schedule.sessions.map(
        (session) => ({
          ...session,
          instructorId:
            session.instructorId === "" ? null : session.instructorId,
        })
      );
    }
    // ADD THIS - Clean additional instructors instructorId
    if (updateData.instructors?.additional) {
      updateData.instructors.additional.forEach((inst) => {
        inst.instructorId = inst.instructorId === "" ? null : inst.instructorId;
      });
    }
    console.log("✅ Update data object built successfully from merged data");
    return updateData;
  }
}

// Create and export controller instance
const controller = new OnlineLiveCoursesController();

module.exports = {
  renderAdminPage: controller.renderAdminPage.bind(controller),
  getAllCourses: controller.getAllCourses.bind(controller),
  getAllInstructors: controller.getAllInstructors.bind(controller),
  getAllCertificationBodies:
    controller.getAllCertificationBodies.bind(controller),
  getCourseById: controller.getCourseById.bind(controller),
  createCourse: controller.createCourse.bind(controller),
  updateCourse: controller.updateCourse.bind(controller),
  deleteCourse: controller.deleteCourse.bind(controller),
  cloneCourse: controller.cloneCourse.bind(controller),

  deleteCloudinaryFile: controller.deleteCloudinaryFile.bind(controller),
  exportData: controller.exportData.bind(controller),

  // Notification methods
  cancelCourse: controller.cancelCourse.bind(controller),
  postponeCourse: controller.postponeCourse.bind(controller),
  getNotificationStatus: controller.getNotificationStatus.bind(controller),
  sendImmediateNotification:
    controller.sendImmediateNotification.bind(controller),
  sendTestNotification: controller.sendTestNotification.bind(controller),
  cancelScheduledNotification:
    controller.cancelScheduledNotification.bind(controller),

  // Utility methods
  checkCourseCode: controller.checkCourseCode.bind(controller),
  generateCourseCode: controller.generateCourseCode.bind(controller),
};
