/**
 * In-Person Courses Controller - COMPLETE FIXED VERSION -this works coreectly
 * Handles all CRUD operations for in-person aesthetic training courses
 *
 * @module InPersonCoursesController
 * @version 2.0.1
 */

const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const Instructor = require("../../models/Instructor");
const certificationBody = require("../../models/CertificationBody");
const User = require("../../models/user");
const path = require("path");
const emailService = require("../../utils/emailService");
const fs = require("fs").promises;
const courseNotificationController = require("./courseNotificationController");
const CoursePoolItem = require("../../models/CoursePoolItem");
const cloudinary = require("cloudinary").v2;

class InPersonCoursesController {
  // ==========================================
  // VIEW RENDERING
  // ==========================================

  /**
   * Render the admin courses management page
   * @route GET /admin-courses/inperson
   */
  async renderAdminPage(req, res) {
    try {
      res.render("admin/admin-manage-course-inperson", {
        title: "Manage In-Person Courses",
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
   * Get all courses with filtering and pagination
   * @route GET /admin-courses/inperson/api
   */
  async getAllCourses(req, res) {
    try {
      console.log("📋 Getting all courses...");

      // Parse query parameters
      const {
        page = 1,
        limit = 50,
        search,
        status,
        category,
        city,
        sortBy = "schedule.startDate",
        sortOrder = "desc",
      } = req.query;

      // Build filter
      const filter = this._buildCoursesFilter(search, status, category, city);

      // Build sort options
      const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute queries
      const [courses, totalCourses] = await Promise.all([
        InPersonAestheticTraining.find(filter)
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
        InPersonAestheticTraining.countDocuments(filter),
      ]);

      // Add enrollment counts
      const coursesWithEnrollment = await this._addEnrollmentCounts(courses);

      // Calculate pagination info
      const paginationInfo = this._calculatePagination(
        parseInt(page),
        parseInt(limit),
        totalCourses
      );

      console.log(
        `✅ Found ${courses.length} courses out of ${totalCourses} total`
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
   * Get course by ID
   * @route GET /admin-courses/inperson/api/:id
   */
  async getCourseById(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🔍 Getting course by ID:", courseId);

      const course = await InPersonAestheticTraining.findById(courseId)
        .populate(
          "instructors.primary.instructorId",
          "firstName lastName title email"
        )
        .populate(
          "instructors.additional.instructorId",
          "firstName lastName title email"
        )
        .lean();

      // Add logging after fetching:
      console.log(
        "Backend - Full instructors structure:",
        JSON.stringify(course.instructors, null, 2)
      );

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Format dates for form inputs
      course.schedule = this._formatDatesForForm(course.schedule);

      // Get enrollment count
      const enrollmentCount = await this._getEnrollmentCount(courseId);
      course.enrollment = course.enrollment || {};
      course.enrollment.currentEnrollment = enrollmentCount;

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
   * Get all instructors
   * @route GET /admin-courses/inperson/api/instructors
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

      console.log(`✅ Found ${instructors.length} active instructors`);

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
   * Get all certification bodies
   * @route GET /admin-courses/inperson/api/certification-bodies
   */
  async getCertificationBodies(req, res) {
    try {
      console.log("🏢 Getting certification bodies...");

      const CertificationBody = require("../../models/CertificationBody");
      const bodies = await CertificationBody.findActive();

      console.log(`✅ Found ${bodies.length} active certification bodies`);

      res.json({
        success: true,
        certificationBodies: bodies,
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

  /**
   * Generate course code from title
   */
  async generateCourseCode(req, res) {
    try {
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required to generate course code",
        });
      }

      // Generate base code from title
      const baseCode = title
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "") // Remove special characters
        .split(" ")
        .filter((word) => word.length > 0)
        .map((word) => word.substring(0, 3)) // Take first 3 letters of each word
        .join("-")
        .substring(0, 15); // Limit length

      // Add year and month
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");

      // Find existing courses with similar codes
      const pattern = new RegExp(`^${baseCode}-${year}-${month}-\\d{3}$`);
      const existingCourses = await InPersonAestheticTraining.find({
        "basic.courseCode": pattern,
      }).select("basic.courseCode");

      // Generate next number
      let nextNumber = 1;
      if (existingCourses.length > 0) {
        const numbers = existingCourses.map((course) => {
          const match = course.basic.courseCode.match(/(\d{3})$/);
          return match ? parseInt(match[1]) : 0;
        });
        nextNumber = Math.max(...numbers) + 1;
      }

      const courseCode = `${baseCode}-${year}-${month}-${String(
        nextNumber
      ).padStart(3, "0")}`;

      res.json({
        success: true,
        courseCode: courseCode,
      });
    } catch (error) {
      console.error("❌ Error generating course code:", error);
      res.status(500).json({
        success: false,
        message: "Error generating course code",
        error: error.message,
      });
    }
  }

  /**
   * Check course code availability
   */
  async checkCourseCode(req, res) {
    try {
      const { code, excludeId } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Course code is required",
        });
      }

      const filter = { "basic.courseCode": code.trim().toUpperCase() };
      if (excludeId) {
        filter._id = { $ne: excludeId };
      }

      const existingCourse = await InPersonAestheticTraining.findOne(filter);

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

  // ==========================================
  // CREATE OPERATION - FIXED VERSION
  // ==========================================

  /**
   * Create new course - FIXED VERSION
   * @route POST /admin-courses/inperson/api
   */
  async createCourse(req, res) {
    try {
      console.log("📝 Creating new course...");
      console.log("📋 Form data received:", Object.keys(req.body));
      console.log(
        "📁 Files received:",
        req.files ? Object.keys(req.files) : "none"
      );

      // Parse saved dynamic items
      let savedDynamicItems = {};
      if (req.body.savedDynamicItems) {
        try {
          savedDynamicItems = JSON.parse(req.body.savedDynamicItems);
          console.log(
            "✅ Parsed savedDynamicItems:",
            Object.keys(savedDynamicItems)
          );
        } catch (error) {
          console.error("⚠️ Error parsing savedDynamicItems:", error);
        }
      }

      // Parse saved uploaded files
      let savedUploadedFiles = {};
      if (req.body.savedUploadedFiles) {
        try {
          savedUploadedFiles = JSON.parse(req.body.savedUploadedFiles);
          console.log("✅ Parsed savedUploadedFiles:", savedUploadedFiles);
        } catch (error) {
          console.error("⚠️ Error parsing savedUploadedFiles:", error);
        }
      }

      // REPLACE with this simpler approach:
      let uploadedFiles = {};
      if (req.body.uploadedFiles) {
        try {
          // Check if it's already an object or needs parsing
          if (typeof req.body.uploadedFiles === "string") {
            uploadedFiles = JSON.parse(req.body.uploadedFiles);
          } else if (typeof req.body.uploadedFiles === "object") {
            uploadedFiles = req.body.uploadedFiles;
          }
          console.log(
            "✅ Parsed uploadedFiles:",
            JSON.stringify(uploadedFiles, null, 2)
          );
        } catch (error) {
          console.error("⚠️ Error parsing uploadedFiles:", error);

          // Fallback: try the field-by-field approach
          for (const key in req.body) {
            if (key.includes("uploadedFiles[")) {
              console.log(`  Found: ${key} = ${req.body[key]}`);
              const matches = key.match(/uploadedFiles\[(\w+)\]\[(\d+)\]/);
              if (matches) {
                const fileType = matches[1];
                const index = parseInt(matches[2]);
                const fileUrl = req.body[key];

                if (!uploadedFiles[fileType]) {
                  uploadedFiles[fileType] = [];
                }
                uploadedFiles[fileType][index] = fileUrl;
              }
            }
          }
        }
      } else {
        console.log("📋 No uploadedFiles field found in req.body");
      }

      console.log(
        "🚀 About to call _buildCourseData with uploadedFiles:",
        uploadedFiles
      );

      console.log(
        "✅ Parsed uploadedFiles:",
        JSON.stringify(uploadedFiles, null, 2)
      );

      // ADD THIS DEBUG LINE:
      console.log(
        "🚀 About to call _buildCourseData with uploadedFiles:",
        uploadedFiles
      );

      // Validate course data
      const validationResult = await this._validateCourseData(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: validationResult.message,
          field: validationResult.field,
        });
      }

      // Validate and process instructors
      const instructorsResult = await this._validateAndProcessInstructors(
        req.body,
        savedDynamicItems
      );
      if (!instructorsResult.isValid) {
        return res.status(400).json({
          success: false,
          message: instructorsResult.message,
        });
      }

      // Check for duplicate course code
      await this._checkDuplicateCourseCode(req.body.basic?.courseCode);

      // Build course data
      const courseData = await this._buildCourseData(
        req.body,
        req.files,
        savedDynamicItems,
        uploadedFiles,
        instructorsResult.instructors,
        req.user,
        false // isEdit = false for new course
      );

      // Log certification data BEFORE creating course
      console.log(
        "📋 Certification data being saved:",
        JSON.stringify(courseData.certification, null, 2)
      );

      // Create and save course
      const course = new InPersonAestheticTraining(courseData);
      const savedCourse = await course.save();

      console.log("✅ Course created successfully with ID:", savedCourse._id);
      console.log(
        "💾 Saved course media:",
        JSON.stringify(savedCourse.media, null, 2)
      );

      // ===========================================
      // EMAIL NOTIFICATION LOGIC
      // ===========================================

      let notificationResults = {
        courseAnnouncement: { scheduled: false, recipientCount: 0 },
        instructorNotification: { sent: false, recipientCount: 0 },
      };

      // 1. COURSE ANNOUNCEMENT TO ALL USERS (if course is open for registration)
      if (
        courseData.basic.status === "Open to Register" ||
        courseData.basic.status === "open"
      ) {
        try {
          console.log("📧 Setting up course announcement notifications...");

          // Import and use the notification controller
          const courseNotificationController = require("./courseNotificationController");

          // Handle course creation (schedules email for 2 hours later)
          const notificationResult =
            await courseNotificationController.handleCourseCreation(
              savedCourse,
              req.user
            );

          if (notificationResult.success) {
            console.log(
              `✅ Course announcement scheduled for ${notificationResult.scheduledTime}`
            );
            console.log(
              `📧 Will notify ${notificationResult.recipientCount} users`
            );

            notificationResults.courseAnnouncement = {
              scheduled: true,
              scheduledTime: notificationResult.scheduledTime,
              recipientCount: notificationResult.recipientCount,
              jobId: notificationResult.jobId,
            };
          } else {
            console.error(
              "❌ Failed to schedule course announcement:",
              notificationResult.error
            );
            notificationResults.courseAnnouncement = {
              scheduled: false,
              error: notificationResult.error,
            };
          }
        } catch (emailError) {
          console.error("❌ Error setting up course announcement:", emailError);
          notificationResults.courseAnnouncement = {
            scheduled: false,
            error: emailError.message,
          };
        }
      } else {
        console.log(
          '📧 Course status is not "Open to Register", skipping public announcement'
        );
      }

      // 2. INSTRUCTOR NOTIFICATIONS (sent immediately)
      if (
        instructorsResult.instructorEmails &&
        instructorsResult.instructorEmails.length > 0
      ) {
        try {
          console.log(
            `📧 Sending instructor notifications to ${instructorsResult.instructorEmails.length} instructors...`
          );

          // Prepare instructor course data
          const instructorCourseData = {
            _id: savedCourse._id,
            title: savedCourse.basic?.title || courseData.basic.title,
            courseCode:
              savedCourse.basic?.courseCode || courseData.basic.courseCode,
            startDate:
              savedCourse.schedule?.startDate || courseData.schedule.startDate,
            endDate:
              savedCourse.schedule?.endDate || courseData.schedule.endDate,
            duration:
              savedCourse.schedule?.duration || courseData.schedule.duration,
            location: `${courseData.venue?.name || "TBD"}, ${
              courseData.venue?.city || "TBD"
            }, ${courseData.venue?.country || "TBD"}`,
            description:
              savedCourse.basic?.description || courseData.basic.description,
            instructorNames:
              savedCourse.instructorNames || courseData.instructorNames, // Assuming this is set during saving or can be derived
            seatsAvailable:
              savedCourse.enrollment?.seatsAvailable ||
              courseData.enrollment.seatsAvailable,
            price: savedCourse.enrollment?.price || courseData.enrollment.price,
            venue: courseData.venue || {},
            category: savedCourse.basic?.category || courseData.basic.category,
            objectives:
              savedCourse.content?.objectives ||
              courseData.content.objectives ||
              [],
          };

          // Send instructor notifications
          const emailService = require("../../utils/emailService");
          await emailService.sendInstructorNotification(
            instructorCourseData,
            instructorsResult.instructorEmails
          );

          console.log(`✅ Instructor notifications sent successfully`);

          notificationResults.instructorNotification = {
            sent: true,
            recipientCount: instructorsResult.instructorEmails.length,
            recipients: instructorsResult.instructorEmails,
          };

          // 3. UPDATE INSTRUCTOR RECORDS
          // 3. UPDATE INSTRUCTOR RECORDS - FIXED VERSION
          console.log("🔍 DEBUG: Processing instructors for course assignment");
          console.log(
            "   - instructorsResult.instructors:",
            instructorsResult.instructors
          );

          const allInstructors = [];

          // Add primary instructor
          if (instructorsResult.instructors?.primary) {
            allInstructors.push(instructorsResult.instructors.primary);
            console.log(
              "✅ Added primary instructor:",
              instructorsResult.instructors.primary.name
            );
          }

          // Add additional instructors
          if (
            instructorsResult.instructors?.additional &&
            Array.isArray(instructorsResult.instructors.additional)
          ) {
            allInstructors.push(...instructorsResult.instructors.additional);
            console.log(
              "✅ Added additional instructors:",
              instructorsResult.instructors.additional.length
            );
          }

          console.log(
            "📋 Total instructors to process:",
            allInstructors.length
          );

          // Now process all instructors
          for (const instructor of allInstructors) {
            try {
              console.log(
                `🔍 Processing instructor: ${instructor.name} (${instructor.instructorId})`
              );

              const instructorDoc = await Instructor.findById(
                instructor.instructorId
              );

              console.log(`   - Found instructor doc: ${!!instructorDoc}`);
              console.log(`   - Instructor email: ${instructorDoc?.email}`);
              console.log(
                `   - Has assignCourse method: ${!!instructorDoc?.assignCourse}`
              );

              if (instructorDoc && instructorDoc.assignCourse) {
                await instructorDoc.assignCourse({
                  courseId: savedCourse._id,
                  courseType: "InPersonAestheticTraining",
                  courseTitle:
                    savedCourse.basic?.title || courseData.basic.title,
                  startDate:
                    savedCourse.schedule?.startDate ||
                    courseData.schedule.startDate,
                  endDate:
                    savedCourse.schedule?.endDate ||
                    courseData.schedule.endDate,
                  role: instructor.role || "Lead Instructor",
                });
                console.log(
                  `✅ SUCCESS: Course assigned to instructor ${instructor.instructorId} (${instructor.name})`
                );
              } else {
                console.log(
                  `❌ SKIPPED: Instructor ${
                    instructor.instructorId
                  } - Doc exists: ${!!instructorDoc}, Has method: ${!!instructorDoc?.assignCourse}`
                );
              }
            } catch (assignError) {
              console.error(
                `❌ ERROR assigning course to instructor ${instructor.instructorId}:`,
                assignError
              );
            }
          }
        } catch (emailError) {
          console.error(
            "❌ Error sending instructor notifications:",
            emailError
          );
          notificationResults.instructorNotification = {
            sent: false,
            error: emailError.message,
          };
        }
      } else {
        console.log(
          "📧 No instructor emails found, skipping instructor notifications"
        );
      }

      // ===========================================
      // SUCCESS RESPONSE
      // ===========================================

      res.status(201).json({
        success: true,
        message: "Course created successfully with complete model data",
        course: {
          _id: savedCourse._id,
          title: savedCourse.basic?.title,
          courseCode: savedCourse.basic?.courseCode,
          status: savedCourse.basic?.status,
          startDate: savedCourse.schedule?.startDate,
          endDate: savedCourse.schedule?.endDate,
          instructorNames: savedCourse.instructorNames,
          seatsAvailable: savedCourse.enrollment?.seatsAvailable,
          price: savedCourse.enrollment?.price,
        },
        notifications: {
          summary: {
            courseAnnouncementScheduled:
              notificationResults.courseAnnouncement.scheduled,
            instructorNotificationsSent:
              notificationResults.instructorNotification.sent,
            totalRecipientsNotified:
              (notificationResults.courseAnnouncement.recipientCount || 0) +
              (notificationResults.instructorNotification.recipientCount || 0),
          },
          details: notificationResults,
        },
      });
    } catch (error) {
      console.error("❌ Error creating course:", error);
      await this._cleanupUploadedFiles(req.files);
      return this._handleError(error, res);
    }
  }

  // ==========================================
  // UPDATE OPERATION
  // ==========================================

  /**
   * Update existing course
   * @route PUT /admin-courses/inperson/api/:id
   */
  async updateCourse(req, res) {
    try {
      const courseId = req.params.id;
      console.log("📝 Updating course:", courseId);

      // Find existing course
      const existingCourse = await InPersonAestheticTraining.findById(courseId);
      if (!existingCourse) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Parse dynamic items and uploaded files
      const { savedDynamicItems, uploadedFiles } = this._parseFormData(
        req.body
      );

      // IMPORTANT: Preserve primary instructor if not provided in update
      if (
        !req.body.instructors?.primary?.instructorId &&
        existingCourse.instructors?.primary
      ) {
        if (!req.body.instructors) req.body.instructors = {};
        req.body.instructors.primary = existingCourse.instructors.primary;
      }
      // Validate course data
      const validationResult = await this._validateCourseData(req.body, true);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: validationResult.message,
          field: validationResult.field,
        });
      }

      // Process instructors if updated
      // Process instructors if updated
      let instructorsData = existingCourse.instructors;
      // CHANGE THIS LINE: Pass savedDynamicItems to the method
      if (
        req.body.instructors?.primary?.instructorId ||
        savedDynamicItems.instructors?.length > 0
      ) {
        // Add condition for additional instructors
        const instructorsResult = await this._validateAndProcessInstructors(
          req.body,
          savedDynamicItems
        );
        if (!instructorsResult.isValid) {
          return res.status(400).json({
            success: false,
            message: instructorsResult.message,
          });
        }
        instructorsData = instructorsResult.instructors;
      }

      // Build update data
      const updateData = await this._buildUpdateData(
        req.body,
        req.files,
        savedDynamicItems,
        uploadedFiles,
        existingCourse,
        instructorsData,
        req.user
      );

      // Detect changes BEFORE updating
      const changes = this._detectChanges(existingCourse, updateData);
      console.log("🔍 Detected changes:", changes);

      // ADD STEP 4 CODE HERE - BEFORE THE UPDATE:
      // ==========================================
      // REMOVE COURSE ASSIGNMENTS FOR DELETED INSTRUCTORS
      // ==========================================
      if (changes.instructors) {
        console.log("🗑️ Checking for removed instructors...");

        // Get current instructor IDs
        const currentInstructorIds = [];
        if (instructorsData?.primary?.instructorId) {
          currentInstructorIds.push(
            instructorsData.primary.instructorId.toString()
          );
        }
        if (instructorsData?.additional) {
          instructorsData.additional.forEach((inst) => {
            if (inst.instructorId) {
              currentInstructorIds.push(inst.instructorId.toString());
            }
          });
        }

        console.log("📋 Current instructor IDs:", currentInstructorIds);

        // Find instructors who had this course but are no longer assigned
        const instructorsWithThisCourse = await Instructor.find({
          "assignedCourses.courseId": courseId,
        });

        console.log(
          "📋 Found instructors with this course:",
          instructorsWithThisCourse.length
        );

        for (const instructorDoc of instructorsWithThisCourse) {
          if (!currentInstructorIds.includes(instructorDoc._id.toString())) {
            // Remove course assignment
            const beforeCount = instructorDoc.assignedCourses.length;
            instructorDoc.assignedCourses =
              instructorDoc.assignedCourses.filter(
                (course) => course.courseId.toString() !== courseId.toString()
              );
            const afterCount = instructorDoc.assignedCourses.length;

            if (beforeCount > afterCount) {
              await instructorDoc.save();
              console.log(
                `🗑️ SUCCESS: Removed course assignment from instructor ${instructorDoc._id} (${instructorDoc.firstName} ${instructorDoc.lastName})`
              );
            }
          } else {
            console.log(
              `✅ KEPT: Instructor ${instructorDoc._id} (${instructorDoc.firstName} ${instructorDoc.lastName}) still assigned to course`
            );
          }
        }
      } else {
        console.log(
          "📋 No instructor changes detected, skipping removal check"
        );
      }

      // Update course
      const updatedCourse = await InPersonAestheticTraining.findByIdAndUpdate(
        courseId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      console.log("✅ Course updated successfully:", courseId);

      // ADD THIS ENTIRE SECTION:
      // ==========================================
      // UPDATE INSTRUCTOR ASSIGNMENTS FOR COURSE UPDATE
      // ==========================================
      console.log(
        "🔍 DEBUG: Processing instructors for course assignment (UPDATE)"
      );
      console.log("   - instructorsData:", instructorsData);

      const allInstructors = [];

      // Add primary instructor
      if (instructorsData?.primary) {
        allInstructors.push(instructorsData.primary);
        console.log(
          "✅ Added primary instructor:",
          instructorsData.primary.name
        );
      }

      // Add additional instructors
      if (
        instructorsData?.additional &&
        Array.isArray(instructorsData.additional)
      ) {
        allInstructors.push(...instructorsData.additional);
        console.log(
          "✅ Added additional instructors:",
          instructorsData.additional.length
        );
      }

      console.log(
        "📋 Total instructors to process for UPDATE:",
        allInstructors.length
      );

      // Process all instructors for course assignment
      for (const instructor of allInstructors) {
        try {
          console.log(
            `🔍 Processing instructor for UPDATE: ${instructor.name} (${instructor.instructorId})`
          );

          const instructorDoc = await Instructor.findById(
            instructor.instructorId
          );

          console.log(`   - Found instructor doc: ${!!instructorDoc}`);
          console.log(`   - Instructor email: ${instructorDoc?.email}`);
          console.log(
            `   - Has assignCourse method: ${!!instructorDoc?.assignCourse}`
          );

          if (instructorDoc && instructorDoc.assignCourse) {
            // Check if course is already assigned
            const existingAssignment = instructorDoc.assignedCourses.find(
              (course) => course.courseId.toString() === courseId.toString()
            );

            if (existingAssignment) {
              // Update existing assignment
              existingAssignment.courseTitle = updatedCourse.basic?.title;
              existingAssignment.startDate = updatedCourse.schedule?.startDate;
              existingAssignment.endDate = updatedCourse.schedule?.endDate;
              existingAssignment.role = instructor.role || "Lead Instructor";

              await instructorDoc.save();
              console.log(
                `✅ SUCCESS: Updated existing course assignment for instructor ${instructor.instructorId} (${instructor.name})`
              );
            } else {
              // Add new assignment
              await instructorDoc.assignCourse({
                courseId: updatedCourse._id,
                courseType: "InPersonAestheticTraining",
                courseTitle: updatedCourse.basic?.title,
                startDate: updatedCourse.schedule?.startDate,
                endDate: updatedCourse.schedule?.endDate,
                role: instructor.role || "Lead Instructor",
              });
              console.log(
                `✅ SUCCESS: Added new course assignment for instructor ${instructor.instructorId} (${instructor.name})`
              );
            }
          } else {
            console.log(
              `❌ SKIPPED: Instructor ${
                instructor.instructorId
              } - Doc exists: ${!!instructorDoc}, Has method: ${!!instructorDoc?.assignCourse}`
            );
          }
        } catch (assignError) {
          console.error(
            `❌ ERROR updating course assignment for instructor ${instructor.instructorId}:`,
            assignError
          );
        }
      }

      // CONTINUE WITH EXISTING CODE (notification handling, etc.)

      // NOTIFICATION INTEGRATION
      const notificationResult =
        await courseNotificationController.handleCourseUpdate(
          courseId,
          updatedCourse,
          req.user,
          changes
        );

      console.log("📧 Update notification result:", notificationResult);

      res.json({
        success: true,
        message: "Course updated successfully",
        course: updatedCourse,
        notifications: notificationResult,
      });
    } catch (error) {
      console.error("❌ Error updating course:", error);
      await this._cleanupUploadedFiles(req.files);
      return this._handleError(error, res);
    }
  }

  // ==========================================
  // DELETE OPERATIONS
  // ==========================================

  /**
   * Delete course
   * @route DELETE /admin-courses/inperson/api/:id
   */
  async deleteCourse(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🗑️ Deleting course:", courseId);

      const course = await InPersonAestheticTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Check for registered users
      const enrollmentCount = await this._getEnrollmentCount(courseId);
      if (enrollmentCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete course with ${enrollmentCount} registered users. Please cancel the course instead.`,
        });
      }

      // Cancel any scheduled notifications
      await courseNotificationController.handleCourseCancellation(
        courseId,
        course
      );

      // Delete associated files
      await this._cleanupCourseFiles(course);

      // Delete course
      await InPersonAestheticTraining.findByIdAndDelete(courseId);

      console.log("✅ Course deleted successfully:", courseId);

      res.json({
        success: true,
        message: "Course deleted successfully",
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

  /**
   * Delete file from course
   * @route POST /admin-courses/inperson/api/:id/delete-file
   */
  async deleteFile(req, res) {
    try {
      const courseId = req.params.id;
      const { fileType, fileUrl } = req.body;

      console.log("🗑️ Deleting file:", fileType, fileUrl);

      const course = await InPersonAestheticTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Remove file from course
      const updated = await this._removeFileFromCourse(
        course,
        fileType,
        fileUrl
      );

      if (updated) {
        await course.save();

        // Delete physical file
        await this._deletePhysicalFile(fileUrl);

        console.log("✅ File deleted successfully");

        res.json({
          success: true,
          message: "File deleted successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "File not found in course",
        });
      }
    } catch (error) {
      console.error("❌ Error deleting file:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting file",
        error: error.message,
      });
    }
  }

  /**
   * Cancel course
   * @route POST /admin-courses/inperson/api/:id/cancel
   */
  async cancelCourse(req, res) {
    try {
      const courseId = req.params.id;
      console.log("🚫 Cancelling course:", courseId);

      const course = await InPersonAestheticTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Update status to cancelled
      course.basic.status = "cancelled";
      await course.save();

      // Handle cancellation notifications
      const notificationResult =
        await courseNotificationController.handleCourseCancellation(
          courseId,
          course
        );

      console.log("✅ Course cancelled and notifications sent");

      res.json({
        success: true,
        message: "Course cancelled successfully",
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

  // ==========================================
  // NOTIFICATION OPERATIONS
  // ==========================================

  /**
   * Get notification system status
   */
  async getNotificationStatus(req, res) {
    try {
      console.log("📊 Getting notification system status...");

      const courseNotificationController = require("./courseNotificationController");
      const notificationStatus =
        courseNotificationController.getNotificationStatus();

      const totalPendingNotifications = notificationStatus.scheduledJobs.length;
      const trackedCoursesCount = notificationStatus.trackedCourses.length;

      const recentCourses = await InPersonAestheticTraining.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      })
        .select("title createdAt status courseCode")
        .sort({ createdAt: -1 })
        .limit(10);

      const notificationRecipients = await User.countDocuments({
        isConfirmed: true,
        "accountStatus.isLocked": { $ne: true },
        "notificationSettings.email": true,
        "notificationSettings.courseUpdates": true,
      });

      const totalCourses = await InPersonAestheticTraining.countDocuments();
      const activeCourses = await InPersonAestheticTraining.countDocuments({
        status: { $in: ["Open to Register", "In Progress", "Full"] },
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
            title: course.title,
            courseCode: course.courseCode,
            status: course.status,
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

  /**
   * Send immediate course notification
   */
  async sendImmediateNotification(req, res) {
    try {
      const courseId = req.params.id;
      console.log("📧 Sending immediate notification for course:", courseId);

      const courseNotificationController = require("./courseNotificationController");
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

  /**
   * Send test notification
   */
  async sendTestNotification(req, res) {
    try {
      const courseId = req.params.id;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email address is required",
        });
      }

      console.log("🧪 Sending test notification...");

      const courseNotificationController = require("./courseNotificationController");
      const result = await courseNotificationController.sendTestNotification(
        courseId,
        email
      );

      if (result.success) {
        res.json({
          success: true,
          message: `Test notification sent to ${email}`,
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

  /**
   * Cancel scheduled notification
   */
  async cancelScheduledNotification(req, res) {
    try {
      const courseId = req.params.id;
      console.log("❌ Cancelling scheduled notification for course:", courseId);

      const courseNotificationController = require("./courseNotificationController");
      const cancelled =
        courseNotificationController.cancelScheduledNotification(courseId);

      res.json({
        success: true,
        message: cancelled
          ? "Scheduled notification cancelled"
          : "No scheduled notification found",
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

  /**
   * Postpone course with notifications
   */
  async postponeCourse(req, res) {
    try {
      const courseId = req.params.id;
      const { newStartDate, newEndDate, reason } = req.body;

      console.log("📅 Postponing course:", courseId);

      const course = await InPersonAestheticTraining.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      const oldStartDate = course.startDate;
      const oldEndDate = course.endDate;

      course.startDate = new Date(newStartDate);
      if (newEndDate) {
        course.endDate = new Date(newEndDate);
      }
      course.postponementReason = reason || "Schedule change";
      course.postponementDate = new Date();
      course.lastModified = new Date();
      course.modifiedBy = req.user ? req.user._id : null;

      await course.save();

      // Get registered users and send notifications
      const registeredUsers = await User.find(
        {
          "myInPersonCourses.courseId": courseId,
          "myInPersonCourses.status": {
            $in: ["Paid and Registered", "Registered (promo code)"],
          },
        },
        "email firstName lastName"
      );

      if (registeredUsers.length > 0) {
        try {
          const emailService = require("../../utils/emailService");
          const courseData = {
            title: course.title,
            courseCode: course.courseCode,
            oldStartDate: oldStartDate,
            newStartDate: course.startDate,
            oldEndDate: oldEndDate,
            newEndDate: course.endDate,
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
          registeredUsers.length > 0 ? " and users notified" : ""
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
  // UTILITY OPERATIONS
  // ==========================================

  /**
   * Clone course
   * @route POST /admin-courses/inperson/api/:id/clone
   */
  async cloneCourse(req, res) {
    try {
      const courseId = req.params.id;
      const cloneOptions = req.body;

      console.log("📋 Cloning course:", courseId);
      console.log("🔧 Clone options:", cloneOptions);

      const originalCourse = await InPersonAestheticTraining.findById(courseId);
      if (!originalCourse) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Check if new course code is unique for the main courses collection
      const existingCourse = await InPersonAestheticTraining.findOne({
        "basic.courseCode": cloneOptions.courseCode,
      });

      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message:
            "Course code already exists in main courses. Please choose a different course code.",
        });
      }

      // Create cloned course data for the main collection
      const clonedData = this._createEnhancedClonedCourseData(
        originalCourse,
        cloneOptions,
        req.user
      );

      const clonedCourse = new InPersonAestheticTraining(clonedData);
      await clonedCourse.save();

      console.log("✅ Course cloned successfully:", clonedCourse._id);

      // NEW: Handle saving to the pool if option is selected
      let poolSaveResult = { success: false, message: "Not saved to pool." };
      if (cloneOptions.saveToPool) {
        // You might want to get keywords from cloneOptions.poolKeywords or generate them
        const poolKeywords = [
          originalCourse.basic?.title,
          originalCourse.basic?.category,
          originalCourse.basic?.courseCode,
          ...(cloneOptions.poolKeywords || []), // Allow user to provide more keywords
        ].filter(Boolean);
        poolSaveResult = await this._saveCourseToPool(
          originalCourse,
          req.user,
          poolKeywords
        );
      }

      // Optional: Send notification if course is open
      if (
        clonedData.basic.status === "open" ||
        clonedData.basic.status === "Open to Register"
      ) {
        try {
          const courseNotificationController = require("./courseNotificationController");
          await courseNotificationController.handleCourseCreation(
            clonedCourse,
            req.user
          );
          console.log("📧 Clone course notifications scheduled");
        } catch (emailError) {
          console.error("❌ Error scheduling clone notifications:", emailError);
        }
      }

      res.json({
        success: true,
        message: `Course "${clonedData.basic.title}" cloned successfully. ${poolSaveResult.message}`,
        course: clonedCourse,
        originalCourse: {
          id: originalCourse._id,
          title: originalCourse.basic?.title,
        },
        cloneOptions: cloneOptions,
        poolSaveResult: poolSaveResult,
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
   * Export courses data
   * @route GET /admin-courses/inperson/api/export
   */
  async exportData(req, res) {
    try {
      console.log("📊 Exporting courses...");

      const courses = await InPersonAestheticTraining.find({})
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
        venue: course.venue?.name,
        city: course.venue?.city,
        country: course.venue?.country,
        instructor: course.instructors?.primary?.name,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      }));

      res.json({
        success: true,
        message: "Courses exported successfully",
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
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Parse form data for dynamic items and uploaded files
   */
  _parseFormData(body) {
    // Parse saved dynamic items
    let savedDynamicItems = {};
    if (body.savedDynamicItems) {
      try {
        savedDynamicItems = JSON.parse(body.savedDynamicItems);
        console.log(
          "✅ Parsed savedDynamicItems:",
          Object.keys(savedDynamicItems)
        );
      } catch (error) {
        console.error("⚠️ Error parsing savedDynamicItems:", error);
      }
    }

    // FIXED: Parse uploadedFiles (same logic as createCourse)
    let uploadedFiles = {};
    if (body.uploadedFiles) {
      try {
        // Check if it's already an object or needs parsing
        if (typeof body.uploadedFiles === "string") {
          uploadedFiles = JSON.parse(body.uploadedFiles);
        } else if (typeof body.uploadedFiles === "object") {
          uploadedFiles = body.uploadedFiles;
        }
        console.log(
          "✅ Parsed uploadedFiles:",
          JSON.stringify(uploadedFiles, null, 2)
        );
      } catch (error) {
        console.error("⚠️ Error parsing uploadedFiles:", error);

        // Fallback: try the field-by-field approach
        for (const key in body) {
          if (key.includes("uploadedFiles[")) {
            console.log(`  Found: ${key} = ${body[key]}`);
            const matches = key.match(/uploadedFiles\[(\w+)\]\[(\d+)\]/);
            if (matches) {
              const fileType = matches[1];
              const index = parseInt(matches[2]);
              const fileUrl = body[key];

              if (!uploadedFiles[fileType]) {
                uploadedFiles[fileType] = [];
              }
              uploadedFiles[fileType][index] = fileUrl;
            }
          }
        }
      }
    } else {
      console.log("📋 No uploadedFiles field found in req.body for update");
    }

    console.log("🚀 UpdateCourse: uploadedFiles parsed:", uploadedFiles);

    return { savedDynamicItems, uploadedFiles };
  }

  /**
   * Build filter for courses query
   */
  _buildCoursesFilter(search, status, category, city) {
    const filter = {};

    if (search) {
      filter.$or = [
        { "basic.title": { $regex: search, $options: "i" } },
        { "basic.courseCode": { $regex: search, $options: "i" } },
        { "basic.description": { $regex: search, $options: "i" } },
        { "instructors.primary.name": { $regex: search, $options: "i" } },
        { "venue.city": { $regex: search, $options: "i" } },
      ];
    }

    if (status) filter["basic.status"] = status;
    if (category) filter["basic.category"] = category;
    if (city) filter["venue.city"] = city;

    return filter;
  }

  /**
   * Calculate pagination info
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
      "myInPersonCourses.courseId": courseId,
      "myInPersonCourses.status": {
        $in: ["Paid and Registered", "Registered (promo code)"],
      },
    });
  }

  /**
   * Format dates for form inputs
   */
  _formatDatesForForm(schedule) {
    if (!schedule) return schedule;

    const formatted = { ...schedule };

    if (schedule.startDate) {
      formatted.startDateFormatted = new Date(schedule.startDate)
        .toISOString()
        .slice(0, 16);
    }
    if (schedule.endDate) {
      formatted.endDateFormatted = new Date(schedule.endDate)
        .toISOString()
        .slice(0, 16);
    }
    if (schedule.registrationDeadline) {
      formatted.registrationDeadlineFormatted = new Date(
        schedule.registrationDeadline
      )
        .toISOString()
        .slice(0, 16);
    }

    return formatted;
  }

  /**
   * Validate course data
   */
  async _validateCourseData(body, isUpdate = false) {
    const errors = [];

    // Required fields validation
    const requiredFields = [
      { field: "basic.courseCode", name: "Course code" },
      { field: "basic.title", name: "Course title" },
      { field: "basic.description", name: "Course description" },
      { field: "schedule.startDate", name: "Start date" },
      { field: "enrollment.price", name: "Price" },
      { field: "venue.name", name: "Venue name" },
      { field: "venue.address", name: "Venue address" },
      { field: "venue.city", name: "Venue city" },
      { field: "venue.country", name: "Venue country" },
    ];

    for (const { field, name } of requiredFields) {
      const value = this._getNestedValue(body, field);
      if (!value || (typeof value === "string" && !value.trim())) {
        errors.push({
          field: field.split(".").pop(),
          message: `${name} is required`,
        });
      }
    }

    // Date validations
    if (body.schedule?.startDate) {
      const startDate = new Date(body.schedule.startDate);

      if (body.schedule.endDate) {
        const endDate = new Date(body.schedule.endDate);
        if (endDate < startDate) {
          errors.push({
            field: "endDate",
            message: "End date cannot be before start date",
          });
        }
      }

      if (body.schedule.registrationDeadline) {
        const deadline = new Date(body.schedule.registrationDeadline);
        if (deadline > startDate) {
          errors.push({
            field: "registrationDeadline",
            message: "Registration deadline cannot be after course start",
          });
        }
      }
    }

    // Price validations
    const price = parseFloat(body.enrollment?.price);
    if (isNaN(price) || price < 0) {
      errors.push({ field: "price", message: "Valid price is required" });
    }

    if (body.enrollment?.earlyBirdPrice) {
      const earlyBirdPrice = parseFloat(body.enrollment.earlyBirdPrice);
      if (earlyBirdPrice >= price) {
        errors.push({
          field: "earlyBirdPrice",
          message: "Early bird price must be less than regular price",
        });
      }
    }

    // Enrollment validations
    const seatsAvailable = parseInt(body.enrollment?.seatsAvailable);
    const minEnrollment = parseInt(body.enrollment?.minEnrollment);

    if (seatsAvailable && minEnrollment && minEnrollment > seatsAvailable) {
      errors.push({
        field: "minEnrollment",
        message: "Minimum enrollment cannot exceed available seats",
      });
    }

    if (errors.length > 0) {
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
   * Get nested value from object
   */
  _getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  // In your InPersonCoursesController class

  /**
   * Validate and process instructors - FIXED to collect emails and handle saved dynamic items
   */
  /**
   * FIXED: Validate and process instructors with deletion support
   */
  async _validateAndProcessInstructors(body, savedDynamicItems = {}) {
    // IMPORTANT: Ensure body.instructors.primary is correctly parsed if it's sent as a flat field
    const primaryInstructorId =
      body["instructors[primary][instructorId]"] ||
      body.instructors?.primary?.instructorId;
    const primaryInstructorRole =
      body["instructors[primary][role]"] ||
      body.instructors?.primary?.role ||
      "Lead Instructor";

    if (!primaryInstructorId) {
      return {
        isValid: false,
        message: "Primary instructor is required",
      };
    }

    try {
      const primaryInstructor = await Instructor.findById(primaryInstructorId);
      if (!primaryInstructor) {
        return {
          isValid: false,
          message: "Primary instructor not found",
        };
      }

      const instructors = {
        primary: {
          instructorId: primaryInstructor._id,
          name: `${primaryInstructor.firstName} ${primaryInstructor.lastName}`,
          role: primaryInstructorRole,
        },
        additional: [],
      };

      const instructorEmails = [];

      // Add primary instructor email
      if (primaryInstructor.email) {
        instructorEmails.push({
          email: primaryInstructor.email,
          name: `${primaryInstructor.firstName} ${primaryInstructor.lastName}`,
          role: "Lead Instructor",
        });
      }

      // FIXED: Process deletions first
      const deletedInstructorIds = [];
      if (body.deletedInstructors) {
        // Handle both array and single value cases
        const deletions = Array.isArray(body.deletedInstructors)
          ? body.deletedInstructors
          : [body.deletedInstructors];

        deletions.forEach((id) => {
          if (id && id.trim()) {
            deletedInstructorIds.push(id.trim());
          }
        });

        console.log(
          `🗑️ Found ${deletedInstructorIds.length} instructors marked for deletion:`,
          deletedInstructorIds
        );
      }

      // Process additional instructors from savedDynamicItems
      if (
        savedDynamicItems.instructors &&
        Array.isArray(savedDynamicItems.instructors)
      ) {
        console.log(
          `🔍 Processing ${savedDynamicItems.instructors.length} additional instructors from savedDynamicItems`
        );

        for (const instData of savedDynamicItems.instructors) {
          // FIXED: Skip if this instructor is marked for deletion
          if (deletedInstructorIds.includes(instData.instructorId)) {
            console.log(
              `🗑️ Skipping deleted instructor: ${instData.instructorId}`
            );
            continue;
          }

          // Ensure the instructorId is present and it's not the primary instructor
          if (
            instData.instructorId &&
            instData.instructorId !== primaryInstructor._id.toString()
          ) {
            const instructor = await Instructor.findById(instData.instructorId);
            if (instructor) {
              instructors.additional.push({
                instructorId: instructor._id,
                name: `${instructor.firstName} ${instructor.lastName}`,
                role: instData.role || "Co-Instructor",
              });

              // Add to email list
              if (instructor.email) {
                instructorEmails.push({
                  email: instructor.email,
                  name: `${instructor.firstName} ${instructor.lastName}`,
                  role: instData.role || "Co-Instructor",
                });
              }
            } else {
              console.warn(
                `⚠️ Additional instructor with ID ${instData.instructorId} not found. Skipping.`
              );
            }
          } else if (
            instData.instructorId === primaryInstructor._id.toString()
          ) {
            console.warn(
              `⚠️ Skipped adding primary instructor as additional: ${instData.instructorId}`
            );
          }
        }
      }

      console.log(
        `✅ Processed ${instructorEmails.length} instructor emails for notifications`
      );
      console.log(
        `✅ Final instructors object for database:`,
        JSON.stringify(instructors, null, 2)
      );

      return {
        isValid: true,
        instructors: instructors,
        instructorEmails: instructorEmails,
        deletedInstructorIds: deletedInstructorIds, // Return this for logging
      };
      console.log("   - Primary instructor details:", {
        id: primaryInstructor._id,
        email: primaryInstructor.email,
        name: `${primaryInstructor.firstName} ${primaryInstructor.lastName}`,
      });
    } catch (error) {
      console.error("❌ Error processing instructors:", error);
      return {
        isValid: false,
        message:
          "Invalid instructor ID or error fetching instructor data: " +
          error.message,
      };
    }
  }
  /**
   * Check for duplicate course code
   */
  async _checkDuplicateCourseCode(courseCode) {
    if (!courseCode) return;

    const code = courseCode.trim().toUpperCase();
    const existingCourse = await InPersonAestheticTraining.findOne({
      "basic.courseCode": code,
    });

    if (existingCourse) {
      throw new Error("DUPLICATE_COURSE_CODE");
    }
  }

  /**
   * Build complete course data - FIXED with proper isEdit parameter
   */
  async _buildCourseData(
    body,
    files,
    savedDynamicItems,
    uploadedFiles,
    instructors,
    user,
    isEdit = false
  ) {
    const enrollmentData = this._processEnrollmentData(body);

    // ADD THIS DEBUG LINE:
    console.log(
      "💰 Final enrollment data for database:",
      JSON.stringify(enrollmentData, null, 2)
    );
    return {
      basic: this._processBasicData(body, isEdit),
      schedule: this._processScheduleData(body),
      enrollment: enrollmentData,
      instructors: instructors,
      venue: this._processVenueData(body),
      content: this._processContentData(body, savedDynamicItems),
      practical: this._processPracticalData(body, savedDynamicItems),
      assessment: this._processAssessmentData(body, savedDynamicItems),
      certification: this._processCertificationData(body, savedDynamicItems),
      inclusions: this._processInclusionsData(body, savedDynamicItems),
      media: this._processMediaData(
        body,
        files,
        savedDynamicItems,
        uploadedFiles
      ),
      attendance: this._processAttendanceData(body),
      contact: this._processContactData(body),
      metadata: this._processMetadataData(body, user),
    };
  }

  /**
   * Build update data
   */
  async _buildUpdateData(
    body,
    files,
    savedDynamicItems,
    uploadedFiles,
    existingCourse,
    instructors,
    user
  ) {
    return {
      basic: { ...existingCourse.basic, ...this._processBasicData(body, true) },
      schedule: {
        ...existingCourse.schedule,
        ...this._processScheduleData(body),
      },
      enrollment: {
        ...existingCourse.enrollment,
        ...this._processEnrollmentData(body),
      },
      instructors: instructors,
      venue: { ...existingCourse.venue, ...this._processVenueData(body) },
      content: this._processContentData(
        body,
        savedDynamicItems,
        existingCourse.content
      ),
      practical: this._processPracticalData(
        body,
        savedDynamicItems,
        existingCourse.practical
      ),
      assessment: this._processAssessmentData(
        body,
        savedDynamicItems,
        existingCourse.assessment
      ),
      certification: {
        ...existingCourse.certification,
        ...this._processCertificationData(body, savedDynamicItems),
      },
      inclusions: this._processInclusionsData(
        body,
        savedDynamicItems,
        existingCourse.inclusions
      ),
      media: this._processMediaData(
        body,
        files,
        savedDynamicItems,
        uploadedFiles,
        existingCourse.media
      ),
      attendance: {
        ...existingCourse.attendance,
        ...this._processAttendanceData(body),
      },
      contact: { ...existingCourse.contact, ...this._processContactData(body) },
      metadata: {
        ...existingCourse.metadata,
        lastModifiedBy: user?._id || null,
        version: (existingCourse.metadata?.version || 1) + 1,
      },
    };
  }

  /**
   * Detect changes between existing and new data
   */
  _detectChanges(existingCourse, newData) {
    const changes = {};

    // Check schedule changes
    if (newData.schedule) {
      const existingSchedule = JSON.stringify(existingCourse.schedule);
      const newSchedule = JSON.stringify(newData.schedule);
      if (existingSchedule !== newSchedule) {
        changes.schedule = true;
      }
    }

    // Check venue changes
    if (newData.venue) {
      const existingVenue = JSON.stringify(existingCourse.venue);
      const newVenue = JSON.stringify(newData.venue);
      if (existingVenue !== newVenue) {
        changes.venue = true;
      }
    }

    // Check instructor changes
    if (newData.instructors) {
      const existingInstructors = JSON.stringify(existingCourse.instructors);
      const newInstructors = JSON.stringify(newData.instructors);
      if (existingInstructors !== newInstructors) {
        changes.instructors = true;
      }
    }

    // Check enrollment changes
    if (newData.enrollment) {
      if (
        existingCourse.enrollment.price !== newData.enrollment.price ||
        existingCourse.enrollment.seatsAvailable !==
          newData.enrollment.seatsAvailable
      ) {
        changes.enrollment = true;
      }
    }

    // Check content changes
    if (newData.content) {
      const existingContent = JSON.stringify(existingCourse.content);
      const newContent = JSON.stringify(newData.content);
      if (existingContent !== newContent) {
        changes.content = true;
      }
    }

    return changes;
  }

  // ==========================================
  // DATA PROCESSING METHODS - FIXED VERSIONS
  // ==========================================

  /**
   * Process basic data - FIXED to handle status properly
   */
  _processBasicData(body, isEdit = false) {
    const data = {
      courseCode: body.basic?.courseCode?.trim().toUpperCase() || "",
      title: body.basic?.title?.trim() || "",
      description: body.basic?.description?.trim() || "",
      category: body.basic?.category || "aesthetic",
    };

    // For new courses, status is either draft or open
    if (!isEdit) {
      data.status = body.basic?.status === "draft" ? "draft" : "open";
    } else {
      // For edits, preserve existing status unless explicitly changed
      data.status = body.basic?.status;
    }

    return data;
  }

  _processScheduleData(body) {
    return {
      startDate: body.schedule?.startDate
        ? new Date(body.schedule.startDate)
        : null,
      endDate: body.schedule?.endDate ? new Date(body.schedule.endDate) : null,
      duration: body.schedule?.duration || "1 day",
      registrationDeadline: body.schedule?.registrationDeadline
        ? new Date(body.schedule.registrationDeadline)
        : null,
      timeSlots: {
        startTime: body.schedule?.timeSlots?.startTime || "09:00",
        endTime: body.schedule?.timeSlots?.endTime || "17:00",
        lunchBreak: body.schedule?.timeSlots?.lunchBreak || "12:30-13:30",
      },
    };
  }

  _processEnrollmentData(body) {
    console.log("💰 Processing enrollment data:", {
      price: body.enrollment?.price,
      earlyBirdPrice: body.enrollment?.earlyBirdPrice,
      earlyBirdDays: body.enrollment?.earlyBirdDays, // Add this debug line
    });

    return {
      price: parseFloat(body.enrollment?.price) || 0,
      earlyBirdPrice: body.enrollment?.earlyBirdPrice
        ? parseFloat(body.enrollment.earlyBirdPrice)
        : null,
      // ADD THIS LINE - Process early bird days
      earlyBirdDays: body.enrollment?.earlyBirdDays
        ? parseInt(body.enrollment.earlyBirdDays)
        : null,
      currency: body.enrollment?.currency || "USD",
      seatsAvailable: parseInt(body.enrollment?.seatsAvailable) || 10,
      minEnrollment: parseInt(body.enrollment?.minEnrollment) || 5,
      currentEnrollment: parseInt(body.enrollment?.currentEnrollment) || 0,
    };
  }

  _processVenueData(body) {
    const venue = {
      name: body.venue?.name?.trim() || "",
      address: body.venue?.address?.trim() || "",
      city: body.venue?.city?.trim() || "",
      country: body.venue?.country?.trim() || "",
      type: body.venue?.type || "training-center",
      mapUrl: body.venue?.mapUrl || "",
      parkingAvailable:
        body.venue?.parkingAvailable === "on" ||
        body.venue?.parkingAvailable === "true" ||
        body.venue?.parkingAvailable === true,
    };

    // Process facilities
    if (body.venue?.facilities) {
      venue.facilities = Array.isArray(body.venue.facilities)
        ? body.venue.facilities
        : [body.venue.facilities];
    }

    return venue;
  }

  _processContentData(body, savedDynamicItems, existing = {}) {
    return {
      objectives: this._mergeArrayField(
        body,
        savedDynamicItems,
        "objectives",
        existing.objectives
      ),
      modules: this._mergeModules(body, savedDynamicItems, existing.modules),
      targetAudience: this._mergeArrayField(
        body,
        savedDynamicItems,
        "targetAudience",
        existing.targetAudience
      ),
      experienceLevel:
        body.content?.experienceLevel ||
        existing.experienceLevel ||
        "intermediate",
      prerequisites:
        body.content?.prerequisites || existing.prerequisites || "",
      technicalRequirements:
        body.content?.technicalRequirements ||
        existing.technicalRequirements ||
        "",
    };
  }

  _processPracticalData(body, savedDynamicItems, existing = {}) {
    const practical = {
      hasHandsOn:
        body.practical?.hasHandsOn === "on" ||
        body.practical?.hasHandsOn === "true",
      studentRatio:
        body.practical?.studentRatio || existing.studentRatio || "1:1",
      procedures: this._mergeArrayField(
        body,
        savedDynamicItems,
        "procedures",
        existing.procedures
      ),
      equipment: this._mergeArrayField(
        body,
        savedDynamicItems,
        "equipment",
        existing.equipment
      ),
      safetyRequirements: {
        ppeRequired:
          body.practical?.safetyRequirements?.ppeRequired === "on" ||
          body.practical?.safetyRequirements?.ppeRequired === "true",
        healthClearance:
          body.practical?.safetyRequirements?.healthClearance === "on" ||
          body.practical?.safetyRequirements?.healthClearance === "true",
        insuranceRequired:
          body.practical?.safetyRequirements?.insuranceRequired === "on" ||
          body.practical?.safetyRequirements?.insuranceRequired === "true",
      },
    };

    // Process training types
    if (body.practical?.trainingType) {
      practical.trainingType = Array.isArray(body.practical.trainingType)
        ? body.practical.trainingType
        : [body.practical.trainingType];
    }

    return practical;
  }

  _processAssessmentData(body, savedDynamicItems, existing = {}) {
    return {
      required:
        body.assessment?.required === "on" ||
        body.assessment?.required === "true",
      type: body.assessment?.type || existing.type || "none",
      passingScore:
        parseInt(body.assessment?.passingScore) || existing.passingScore || 70,
      retakesAllowed:
        parseInt(body.assessment?.retakesAllowed) ||
        existing.retakesAllowed ||
        1,
      questions: this._mergeQuestions(
        body,
        savedDynamicItems,
        existing.questions
      ),
    };
  }

  /**
   * Process certification data - FIXED VERSION
   */
  _processCertificationData(body, savedDynamicItems) {
    const certData = {
      enabled:
        body.certification?.enabled === "on" ||
        body.certification?.enabled === "true",
      type: body.certification?.type || "completion",

      // Handle primary certification body
      issuingAuthorityId: body.certification?.issuingAuthorityId || null,
      issuingAuthority:
        body.certification?.issuingAuthority || "IAAI Training Institute",

      // Process ONLY additional certification bodies (not the primary)
      certificationBodies: this._processCertificationBodies(
        body,
        savedDynamicItems
      ),

      requirements: {
        minimumAttendance:
          parseInt(body.certification?.requirements?.minimumAttendance) || 80,
        minimumScore:
          parseInt(body.certification?.requirements?.minimumScore) || 70,
        practicalRequired:
          body.certification?.requirements?.practicalRequired === "on" ||
          body.certification?.requirements?.practicalRequired === "true",
      },
      validity: {
        isLifetime:
          body.certification?.validity?.isLifetime === "on" ||
          body.certification?.validity?.isLifetime === "true",
        years: body.certification?.validity?.years
          ? parseInt(body.certification.validity.years)
          : null,
      },
      features: {
        digitalBadge:
          body.certification?.features?.digitalBadge === "on" ||
          body.certification?.features?.digitalBadge === "true",
        qrVerification:
          body.certification?.features?.qrVerification === "on" ||
          body.certification?.features?.qrVerification === "true",
        autoGenerate:
          body.certification?.features?.autoGenerate === "on" ||
          body.certification?.features?.autoGenerate === "true",
      },
    };

    console.log("🔍 Processing certification data:", {
      enabled: certData.enabled,
      type: certData.type,
      issuingAuthorityId: certData.issuingAuthorityId,
      certificationBodiesCount: certData.certificationBodies.length,
    });

    return certData;
  }

  /**
   * Process certification bodies helper - FIXED VERSION
   */
  _processCertificationBodies(body, savedDynamicItems) {
    let bodies = [];

    console.log("🔍 Processing certification bodies...");
    console.log(
      "📋 Saved dynamic items certificationBodies:",
      savedDynamicItems.certificationBodies
    );

    // Process form data - but skip if it's marked as 'primary'
    if (body.certification?.certificationBodies) {
      let index = 0;
      // Iterate using `while` loop as array might have holes due to client-side deletions
      while (body.certification.certificationBodies[index] !== undefined) {
        const bodyData = body.certification.certificationBodies[index];
        console.log(`📋 Form body ${index}:`, bodyData);

        // Skip if this is the primary issuer (it's handled separately)
        if (bodyData.bodyId && bodyData.role !== "primary") {
          bodies.push({
            bodyId: bodyData.bodyId,
            name: bodyData.name || "",
            role: bodyData.role || "co-issuer",
          });
          console.log(`✅ Added form certification body: ${bodyData.name}`);
        }
        index++;
      }
    }

    // Add saved certification bodies (these should all be additional, not primary)
    if (
      savedDynamicItems.certificationBodies &&
      Array.isArray(savedDynamicItems.certificationBodies)
    ) {
      console.log(
        `📋 Processing ${savedDynamicItems.certificationBodies.length} saved certification bodies`
      );

      const additionalBodies = savedDynamicItems.certificationBodies
        .filter((body) => body.role !== "primary" && body.saved === true) // Ensure it's marked as saved and not primary
        .map((body) => ({
          bodyId: body.bodyId,
          name: body.name || "",
          role: body.role || "co-issuer",
        }));

      bodies.push(...additionalBodies);
      console.log(
        `✅ Added ${additionalBodies.length} saved certification bodies`
      );
    }

    // Remove duplicates based on bodyId
    const uniqueBodies = bodies.reduce((acc, current) => {
      const exists = acc.find((item) => item.bodyId === current.bodyId);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    console.log(`✅ Final certification bodies count: ${uniqueBodies.length}`);

    return uniqueBodies;
  }

  _processInclusionsData(body, savedDynamicItems, existing = {}) {
    return {
      meals: {
        breakfast: body.inclusions?.meals?.breakfast === "on",
        lunch: body.inclusions?.meals?.lunch === "on",
        coffee: body.inclusions?.meals?.coffee === "on",
        dietaryOptions: body.inclusions?.meals?.dietaryOptions === "on",
      },
      accommodation: {
        included: body.inclusions?.accommodation?.included === "on",
        assistanceProvided:
          body.inclusions?.accommodation?.assistanceProvided === "on",
        partnerHotels: this._mergeArrayField(
          body,
          savedDynamicItems,
          "partnerHotels",
          existing.accommodation?.partnerHotels
        ),
      },
      materials: {
        courseMaterials: body.inclusions?.materials?.courseMaterials === "on",
        certificatePrinting:
          body.inclusions?.materials?.certificatePrinting === "on",
        practiceSupplies: body.inclusions?.materials?.practiceSupplies === "on",
        takeHome: body.inclusions?.materials?.takeHome === "on",
      },
      services: {
        airportTransfer: body.inclusions?.services?.airportTransfer === "on",
        localTransport: body.inclusions?.services?.localTransport === "on",
        translation: body.inclusions?.services?.translation === "on",
      },
    };
  }

  /**
   * Process media data - FIXED VERSION with correct folder handling
   */
  _processMediaData(
    body,
    files,
    savedDynamicItems,
    uploadedFiles,
    existing = {}
  ) {
    console.log("🎨 Processing media data...");

    const media = {
      mainImage: existing?.mainImage || null,
      documents: [...(existing?.documents || [])],
      images: [...(existing?.images || [])],
      videos: [...(existing?.videos || [])],
      promotional: {
        brochureUrl:
          body.media?.promotional?.brochureUrl ||
          existing?.promotional?.brochureUrl ||
          "",
        videoUrl:
          body.media?.promotional?.videoUrl ||
          existing?.promotional?.videoUrl ||
          "",
        catalogUrl:
          body.media?.promotional?.catalogUrl ||
          existing?.promotional?.catalogUrl ||
          "",
      },
      links: this._mergeLinks(body, savedDynamicItems, existing?.links),
    };

    // ✅ FIXED: Process uploaded files with proper URL handling
    if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
      console.log("📁 Processing uploadedFiles...");

      // Handle documents with proper viewing URLs
      if (uploadedFiles.documents && uploadedFiles.documents.length > 0) {
        const validDocuments = uploadedFiles.documents
          .filter((doc) => doc && typeof doc === "string" && doc.trim())
          .map((docUrl) => {
            // ✅ CRITICAL: Convert storage URL to viewable URL if needed
            if (
              docUrl.includes("cloudinary.com") &&
              docUrl.includes("/raw/upload/") &&
              !docUrl.includes("fl_attachment")
            ) {
              // Extract filename from URL and add attachment parameter
              const fileName =
                this._extractFilenameFromUrl(docUrl) || "document.pdf";
              return docUrl.replace(
                "/upload/",
                `/upload/fl_attachment:${fileName}/`
              );
            }
            return docUrl;
          });

        media.documents.push(...validDocuments);
        console.log(
          "✅ Added documents with proper viewing URLs:",
          validDocuments.length
        );
      }

      // Handle other media types (images, videos) - unchanged
      if (uploadedFiles.mainImage && uploadedFiles.mainImage.length > 0) {
        const mainImageUrl = uploadedFiles.mainImage[0];
        if (
          mainImageUrl &&
          mainImageUrl.includes("iaai-platform/inperson/main-images/")
        ) {
          media.mainImage = {
            url: mainImageUrl.trim(),
            alt:
              body.media?.mainImage?.alt || body.basic?.title || "Course Image",
          };
        }
      }

      if (uploadedFiles.images && uploadedFiles.images.length > 0) {
        const validImages = uploadedFiles.images.filter(
          (img) => img && img.includes("iaai-platform/inperson/gallery-images/")
        );
        media.images.push(...validImages);
      }

      if (uploadedFiles.videos && uploadedFiles.videos.length > 0) {
        const validVideos = uploadedFiles.videos.filter(
          (vid) => vid && vid.includes("iaai-platform/inperson/course-videos/")
        );
        media.videos.push(...validVideos);
      }
    }

    // Remove duplicates
    media.documents = [...new Set(media.documents.filter(Boolean))];
    media.images = [...new Set(media.images.filter(Boolean))];
    media.videos = [...new Set(media.videos.filter(Boolean))];

    return media;
  }

  // ✅ ADD THIS HELPER METHOD to your controller:
  _extractFilenameFromUrl(url) {
    try {
      // Extract filename from Cloudinary URL
      const urlParts = url.split("/");
      const lastPart = urlParts[urlParts.length - 1];

      // If it has an extension, return as is, otherwise add .pdf
      if (lastPart.includes(".")) {
        return lastPart;
      } else {
        return lastPart + ".pdf";
      }
    } catch (error) {
      console.warn("Could not extract filename from URL:", url);
      return "document.pdf";
    }
  }
  /**
   * Validate that media files are in correct Cloudinary folders
   */
  _validateMediaFolderStructure(media) {
    const expectedFolders = {
      mainImage: "iaai-platform/inperson/main-images/",
      documents: "iaai-platform/inperson/coursedocuments/",
      images: "iaai-platform/inperson/gallery-images/",
      videos: "iaai-platform/inperson/course-videos/",
    };

    // Check main image
    if (
      media.mainImage?.url &&
      !media.mainImage.url.includes(expectedFolders.mainImage)
    ) {
      console.warn(
        "⚠️ Main image not in expected folder:",
        media.mainImage.url
      );
    }

    // Check documents
    media.documents.forEach((doc, index) => {
      if (!doc.includes(expectedFolders.documents)) {
        console.warn(`⚠️ Document ${index + 1} not in expected folder:`, doc);
      }
    });

    // Check gallery images
    media.images.forEach((img, index) => {
      if (!img.includes(expectedFolders.images)) {
        console.warn(
          `⚠️ Gallery image ${index + 1} not in expected folder:`,
          img
        );
      }
    });

    // Check videos (only Cloudinary videos, not external links)
    media.videos.forEach((vid, index) => {
      if (
        vid.includes("cloudinary.com") &&
        !vid.includes(expectedFolders.videos)
      ) {
        console.warn(`⚠️ Video ${index + 1} not in expected folder:`, vid);
      }
    });
  }

  _processAttendanceData(body) {
    return {
      trackingEnabled:
        body.attendance?.trackingEnabled === "on" ||
        body.attendance?.trackingEnabled === "true",
      minimumRequired: parseInt(body.attendance?.minimumRequired) || 80,
      checkInMethod: body.attendance?.checkInMethod || "manual",
      records: [],
    };
  }

  _processContactData(body) {
    return {
      email: body.contact?.email || "info@iaa-i.com",
      phone: body.contact?.phone || "",
      whatsapp: body.contact?.whatsapp || "+90 536 745 86 66",
      registrationUrl: body.contact?.registrationUrl || "",
      supportHours: body.contact?.supportHours || "9 AM - 6 PM (Monday-Friday)",
    };
  }

  _processMetadataData(body, user) {
    return {
      createdBy: user?._id || null,
      lastModifiedBy: user?._id || null,
      version: 1,
      tags: body.metadata?.tags
        ? body.metadata.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      notes: body.metadata?.notes || "",
      isTemplate:
        body.metadata?.isTemplate === "on" ||
        body.metadata?.isTemplate === "true",
      templateName: body.metadata?.templateName || "",
    };
  }

  // ==========================================
  // MERGE HELPER METHODS
  // ==========================================

  _mergeArrayField(body, savedDynamicItems, fieldName, existing = []) {
    let result = [...existing];

    // Add from form data (e.g., content.objectives or practical.procedures)
    let index = 0;
    // Check for specific paths based on the fieldName's typical location in the form
    const fieldPaths = {
      objectives: body.content?.objectives,
      targetAudience: body.content?.targetAudience,
      procedures: body.practical?.procedures,
      equipment: body.practical?.equipment,
      partnerHotels: body.inclusions?.accommodation?.partnerHotels,
    };

    const formArray = fieldPaths[fieldName];

    if (Array.isArray(formArray)) {
      for (const item of formArray) {
        // Handle cases where item is an object with 'text' or 'name' property
        // or just a string value
        const value =
          typeof item === "object" && item !== null
            ? item.text || item.name || item.value
            : item;
        if (value && typeof value === "string" && value.trim()) {
          result.push(value.trim());
        }
      }
    }

    // Add from saved dynamic items
    if (
      savedDynamicItems[fieldName] &&
      Array.isArray(savedDynamicItems[fieldName])
    ) {
      const savedItems = savedDynamicItems[fieldName]
        .map((item) => {
          // Similar handling for saved dynamic items
          return typeof item === "object" && item !== null
            ? item.text || item.name || item.value
            : item;
        })
        .filter(Boolean); // Filter out any null/undefined/empty strings after mapping
      result.push(...savedItems);
    }

    return [...new Set(result.filter(Boolean))]; // Ensure unique non-empty strings
  }

  _mergeModules(body, savedDynamicItems, existing = []) {
    let modules = [...existing];

    // Process form modules
    let index = 0;
    while (body.content?.modules?.[index]?.title !== undefined) {
      // Check for undefined to handle sparse arrays from client
      const module = {
        title: body.content.modules[index].title,
        description: body.content.modules[index].description || "",
        duration: body.content.modules[index].duration || "",
        order: parseInt(body.content.modules[index].order) || index + 1,
      };
      if (module.title.trim()) {
        // Only add if title is not empty
        modules.push(module);
      }
      index++;
    }

    // Add saved modules
    if (savedDynamicItems.modules && Array.isArray(savedDynamicItems.modules)) {
      const savedModules = savedDynamicItems.modules
        .map((mod) => ({
          title: mod.title || "",
          description: mod.description || "",
          duration: mod.duration || "",
          order: mod.order || modules.length + 1,
        }))
        .filter((mod) => mod.title && mod.title.trim()); // Filter out modules with empty titles
      modules.push(...savedModules);
    }

    // Ensure uniqueness based on title (or title and order if preferred)
    const uniqueModules = modules.reduce((acc, current) => {
      const exists = acc.find((item) => item.title === current.title);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    return uniqueModules.sort((a, b) => a.order - b.order); // Sort by order
  }

  _mergeQuestions(body, savedDynamicItems, existing = []) {
    let questions = [...existing];

    // Process form questions
    let index = 0;
    while (body.assessment?.questions?.[index]?.question !== undefined) {
      const formQuestion = body.assessment.questions[index];
      const question = {
        question: formQuestion.question,
        answers: Array.isArray(formQuestion.answers)
          ? formQuestion.answers.filter(Boolean)
          : [],
        correctAnswer: parseInt(formQuestion.correctAnswer) || 1,
        points: parseInt(formQuestion.points) || 1,
      };
      if (question.question.trim()) {
        questions.push(question);
      }
      index++;
    }

    // Add saved questions
    if (
      savedDynamicItems.questions &&
      Array.isArray(savedDynamicItems.questions)
    ) {
      const savedQuestions = savedDynamicItems.questions
        .map((q) => ({
          question: q.question || "",
          answers: Array.isArray(q.answers) ? q.answers.filter(Boolean) : [],
          correctAnswer: q.correctAnswer || 1,
          points: q.points || 1,
        }))
        .filter((q) => q.question && q.question.trim());
      questions.push(...savedQuestions);
    }

    // Remove duplicates if necessary (e.g., based on question text)
    const uniqueQuestions = questions.reduce((acc, current) => {
      const exists = acc.find((item) => item.question === current.question);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    return uniqueQuestions;
  }

  _mergeLinks(body, savedDynamicItems, existing = []) {
    let links = [...existing];

    // Process form links
    let index = 0;
    while (body.media?.links?.[index]?.title !== undefined) {
      const formLink = body.media.links[index];
      const link = {
        title: formLink.title,
        url: formLink.url,
        type: formLink.type || "website",
      };
      if (link.title.trim() && link.url.trim()) {
        links.push(link);
      }
      index++;
    }

    // Add saved links
    if (savedDynamicItems.links && Array.isArray(savedDynamicItems.links)) {
      const savedLinks = savedDynamicItems.links
        .map((link) => ({
          title: link.title || "",
          url: link.url || "",
          type: link.type || "website",
        }))
        .filter(
          (link) =>
            link.title && link.title.trim() && link.url && link.url.trim()
        );
      links.push(...savedLinks);
    }

    // Remove duplicates based on URL
    const uniqueLinks = links.reduce((acc, current) => {
      const exists = acc.find((item) => item.url === current.url);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    return uniqueLinks;
  }

  // ==========================================
  // FILE HANDLING METHODS
  // ==========================================

  _removeFileFromCourse(course, fileType, fileUrl) {
    if (fileType === "mainImage" && course.media.mainImage?.url === fileUrl) {
      course.media.mainImage = null;
      return true;
    } else if (
      ["documents", "images", "videos"].includes(fileType) &&
      Array.isArray(course.media[fileType])
    ) {
      const initialLength = course.media[fileType].length;
      course.media[fileType] = course.media[fileType].filter(
        (item) => item !== fileUrl
      );
      return course.media[fileType].length < initialLength; // True if an item was removed
    }
    return false;
  }

  // Update the _deletePhysicalFile method in your controller
  async _deletePhysicalFile(fileUrl) {
    try {
      if (!fileUrl) return;

      // Check if it's a Cloudinary URL
      if (fileUrl.includes("cloudinary.com")) {
        // Extract public_id from Cloudinary URL
        const urlParts = fileUrl.split("/");
        const versionIndex = urlParts.findIndex((part) => part.startsWith("v"));
        if (versionIndex !== -1) {
          const publicIdWithExt = urlParts.slice(versionIndex + 1).join("/");
          const publicId = publicIdWithExt.split(".")[0];

          const result = await cloudinary.uploader.destroy(publicId);
          console.log("✅ Cloudinary file deleted:", result);
        }
      } else {
        // Handle local files (legacy)
        const filePath = path.join(process.cwd(), "public", fileUrl);
        await fs.unlink(filePath);
        console.log("✅ Local file deleted:", fileUrl);
      }
    } catch (error) {
      console.error("⚠️ Error deleting file:", error);
    }
  }

  async _cleanupCourseFiles(course) {
    try {
      const allUrls = [];
      if (course.media.mainImage?.url) allUrls.push(course.media.mainImage.url);
      if (Array.isArray(course.media.documents))
        allUrls.push(...course.media.documents);
      if (Array.isArray(course.media.images))
        allUrls.push(...course.media.images);
      if (Array.isArray(course.media.videos))
        allUrls.push(...course.media.videos);
      // Also check promotional URLs if they are locally stored
      if (
        course.media.promotional?.brochureUrl &&
        course.media.promotional.brochureUrl.startsWith("/uploads/")
      ) {
        allUrls.push(course.media.promotional.brochureUrl);
      }
      if (
        course.media.promotional?.videoUrl &&
        course.media.promotional.videoUrl.startsWith("/uploads/")
      ) {
        allUrls.push(course.media.promotional.videoUrl);
      }
      if (
        course.media.promotional?.catalogUrl &&
        course.media.promotional.catalogUrl.startsWith("/uploads/")
      ) {
        allUrls.push(course.media.promotional.catalogUrl);
      }

      for (const url of allUrls) {
        if (url) {
          await this._deletePhysicalFile(url);
        }
      }
    } catch (error) {
      console.error("⚠️ Error cleaning up course files:", error);
    }
  }

  async _cleanupUploadedFiles(files) {
    if (!files) return;

    try {
      const allFiles = Object.values(files).flat();
      for (const file of allFiles) {
        // Ensure file.path exists before attempting to unlink
        if (file.path) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error("⚠️ Error cleaning up uploaded files:", error);
    }
  }

  // ==========================================
  // NEW: Save to Pool Functionality
  // ==========================================

  /**
   * Save a course's core data to the Course Pool.
   * This is a helper method, not a direct route handler.
   */
  async _saveCourseToPool(course, user, keywords = []) {
    console.log(
      `🏊 Attempting to save course "${course.basic.title}" to the Pool...`
    );

    const poolData = course.toObject(); // Convert Mongoose document to plain JS object

    // OMITTING/MODIFYING FIELDS FOR THE POOL
    delete poolData._id; // New ID for pool item
    delete poolData.createdAt;
    delete poolData.updatedAt;
    delete poolData.__v;

    // Omit specific fields as requested
    delete poolData.instructors; // Instructor data changes
    delete poolData.venue; // Location data changes
    delete poolData.enrollment.price; // Price changes
    delete poolData.enrollment.earlyBirdPrice;
    delete poolData.enrollment.seatsAvailable;
    delete poolData.enrollment.minEnrollment;
    delete poolData.enrollment.currentEnrollment;
    delete poolData.schedule.startDate; // Dates change
    delete poolData.schedule.endDate;
    delete poolData.schedule.registrationDeadline;
    // Omit attendance records as they are instance-specific
    delete poolData.attendance;

    // Adjust certificationBodies to store names instead of ObjectIds
    if (poolData.certification && poolData.certification.certificationBodies) {
      poolData.certification.certificationBodies =
        poolData.certification.certificationBodies.map((cb) => ({
          name: cb.name || "",
          role: cb.role || "co-issuer",
        }));
    }
    // Also remove the specific ID for the primary issuing authority if it exists
    if (poolData.certification) {
      delete poolData.certification.issuingAuthorityId;
    }

    // Add/Update metadata for the pool item
    poolData.metadata = {
      createdBy: user?._id || null,
      lastModifiedBy: user?._id || null,
      version: 1, // Reset version for pool item
      tags: [], // Tags specific to the course instance, clear for pool
      notes:
        poolData.metadata?.notes ||
        `Added to pool from course "${
          course.basic.title
        }" on ${new Date().toISOString()}`,
      poolKeywords: [
        ...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)),
      ], // Add provided keywords
      sourceCourseId: course._id, // Link back to the original course
    };

    // Ensure basic.courseCode is still unique (add a suffix if needed)
    let finalCourseCode = poolData.basic.courseCode;
    let attempt = 0;
    while (true) {
      const existingPoolItem = await CoursePoolItem.findOne({
        "basic.courseCode": finalCourseCode,
      });
      if (!existingPoolItem) {
        break;
      }
      attempt++;
      finalCourseCode = `${poolData.basic.courseCode}-POOL${attempt}`;
      if (attempt > 5) {
        // Prevent infinite loop
        console.warn(
          `⚠️ Too many attempts to create unique pool course code for ${poolData.basic.courseCode}`
        );
        finalCourseCode = `${poolData.basic.courseCode}-POOL-${Date.now()
          .toString()
          .slice(-6)}`;
        break;
      }
    }
    poolData.basic.courseCode = finalCourseCode;

    try {
      const newPoolItem = new CoursePoolItem(poolData);
      const savedPoolItem = await newPoolItem.save();
      console.log("✅ Course successfully saved to pool:", savedPoolItem._id);
      return { success: true, poolItem: savedPoolItem };
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        console.warn(
          `⚠️ Course with code ${poolData.basic.courseCode} already exists in the pool. Skipping save.`
        );
        return {
          success: false,
          message: "Course with this code already exists in the pool.",
        };
      }
      console.error("❌ Error saving course to pool:", error);
      throw error; // Re-throw to be caught by the calling function
    }
  }

  /**
   * Get all items from the Course Pool
   * @route GET /admin-courses/inperson/api/pool
   * @access Admin
   */
  async getPoolItems(req, res) {
    try {
      console.log("📚 Fetching all course pool items...");
      const poolItems = await CoursePoolItem.find({}).lean(); // Fetch all and convert to plain objects
      console.log(`✅ Found ${poolItems.length} course pool items.`);
      res.json({ success: true, poolItems });
    } catch (error) {
      console.error("❌ Error fetching pool items:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching pool items.",
        error: error.message,
      });
    }
  }

  /**
   * Get a specific item from the Course Pool by ID
   * @route GET /admin-courses/inperson/api/pool/:id
   * @desc  This will allow fetching a pool item to populate a new course form.
   * @access Admin
   */
  async getPoolItemById(req, res) {
    try {
      const poolItemId = req.params.id;
      console.log("🔍 Getting pool item by ID:", poolItemId);
      const poolItem = await CoursePoolItem.findById(poolItemId).lean();
      if (!poolItem) {
        return res
          .status(404)
          .json({ success: false, message: "Pool item not found." });
      }
      console.log("✅ Found pool item:", poolItem.basic?.title);
      res.json({ success: true, poolItem });
    } catch (error) {
      console.error("❌ Error fetching pool item:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching pool item.",
        error: error.message,
      });
    }
  }

  /**
   * Delete a pool item
   * @route DELETE /admin-courses/inperson/api/pool/:id
   * @access Admin
   */
  async deletePoolItem(req, res) {
    try {
      const poolItemId = req.params.id;
      console.log("🗑️ Deleting pool item:", poolItemId);
      const result = await CoursePoolItem.findByIdAndDelete(poolItemId);
      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Pool item not found." });
      }
      console.log("✅ Pool item deleted successfully.");
      res.json({ success: true, message: "Pool item deleted successfully." });
    } catch (error) {
      console.error("❌ Error deleting pool item:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting pool item.",
        error: error.message,
      });
    }
  }

  // ==========================================
  // CLONE HELPER METHODS
  // ==========================================

  /**
   * Enhanced clone data creation with selective cloning
   */
  _createEnhancedClonedCourseData(originalCourse, cloneOptions, user) {
    const clonedData = originalCourse.toObject();
    const options = cloneOptions.options || {};

    // Remove the _id and timestamps
    delete clonedData._id;
    delete clonedData.createdAt;
    delete clonedData.updatedAt;

    // Update basic information
    clonedData.basic = {
      ...clonedData.basic,
      courseCode: cloneOptions.courseCode,
      title: cloneOptions.title,
      status: cloneOptions.status || "draft",
    };

    // Update schedule
    const startDate = new Date(cloneOptions.startDate);
    const originalStartDate = originalCourse.schedule?.startDate;
    const originalEndDate = originalCourse.schedule?.endDate;

    // Calculate duration if original course had end date
    let endDate = null;
    if (originalStartDate && originalEndDate) {
      const durationMs =
        originalEndDate.getTime() - originalStartDate.getTime();
      endDate = new Date(startDate.getTime() + durationMs);
    }

    clonedData.schedule = {
      ...clonedData.schedule,
      startDate: startDate,
      endDate: endDate,
      registrationDeadline: this._calculateRegistrationDeadline(startDate),
    };

    // Handle instructors based on options
    if (!options.cloneInstructors) {
      clonedData.instructors = {
        primary: null,
        additional: [],
      };
    }

    // Handle content based on options
    if (!options.cloneContent) {
      clonedData.content = {
        objectives: [],
        modules: [],
        targetAudience: [],
        experienceLevel: "intermediate",
        prerequisites: "",
        technicalRequirements: "",
      };
    }

    // Handle assessment & certification based on options
    if (!options.cloneAssessmentAndCertification) {
      // New option to group them
      clonedData.assessment = {
        required: false,
        type: "none",
        passingScore: 70,
        retakesAllowed: 1,
        questions: [],
      };

      clonedData.certification = {
        enabled: false,
        type: "completion",
        issuingAuthorityId: null, // Clear out the ID
        issuingAuthority: "IAAI Training Institute",
        certificationBodies: [], // Clear additional bodies
        requirements: {
          minimumAttendance: 80,
          minimumScore: 70,
          practicalRequired: false,
        },
        validity: {
          isLifetime: true,
          years: null,
        },
        features: {
          digitalBadge: true,
          qrVerification: true,
          autoGenerate: true,
        },
      };
    }

    // Handle inclusions based on options
    if (!options.cloneInclusions) {
      clonedData.inclusions = {
        meals: {
          breakfast: false,
          lunch: true,
          coffee: true,
          dietaryOptions: true,
        },
        accommodation: {
          included: false,
          assistanceProvided: true,
          partnerHotels: [],
        },
        materials: {
          courseMaterials: true,
          certificatePrinting: true,
          practiceSupplies: false,
          takeHome: true,
        },
        services: {
          airportTransfer: false,
          localTransport: false,
          translation: false,
        },
      };
    }

    // Handle media based on options
    if (!options.cloneMedia) {
      clonedData.media = {
        mainImage: null,
        documents: [],
        images: [],
        videos: [],
        promotional: {
          brochureUrl: "",
          videoUrl: "",
          catalogUrl: "",
        },
        links: [],
      };
    } else {
      // Keep media references but add clone note
      if (clonedData.media) {
        console.log("📁 Media references cloned (files not duplicated)");
      }
    }

    // Reset enrollment if requested
    if (options.resetEnrollment) {
      clonedData.enrollment = {
        ...clonedData.enrollment,
        currentEnrollment: 0,
      };
    }

    // Reset tracking data
    clonedData.attendance = {
      ...clonedData.attendance,
      records: [],
    };

    // Reset certificates
    if (clonedData.certificateTracking) {
      clonedData.certificateTracking = {
        totalIssued: 0,
        lastIssuedDate: null,
        issuedCertificates: [],
      };
    }

    // Update metadata
    clonedData.metadata = {
      ...clonedData.metadata,
      createdBy: user?._id || null,
      lastModifiedBy: user?._id || null,
      version: 1,
      notes:
        cloneOptions.notes ||
        `Cloned from ${
          originalCourse.basic?.title
        } on ${new Date().toISOString()}`,
      isTemplate: false, // Cloned courses are typically not templates by default
      templateName: "",
    };

    // Add clone tracking
    clonedData.cloneInfo = {
      isClone: true,
      originalCourseId: originalCourse._id,
      clonedAt: new Date(),
      clonedBy: user?._id || null,
      cloneOptions: options,
    };

    return clonedData;
  }

  /**
   * Calculate registration deadline (1 week before start date)
   */
  _calculateRegistrationDeadline(startDate) {
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() - 7);
    return deadline;
  }

  // ==========================================
  // ERROR HANDLING
  // ==========================================

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
}

// Create controller instance
const controller = new InPersonCoursesController();

// Export controller methods
module.exports = {
  renderAdminPage: controller.renderAdminPage.bind(controller),
  getAllCourses: controller.getAllCourses.bind(controller),
  getAllInstructors: controller.getAllInstructors.bind(controller),
  getCourseById: controller.getCourseById.bind(controller),
  createCourse: controller.createCourse.bind(controller),
  updateCourse: controller.updateCourse.bind(controller),
  deleteCourse: controller.deleteCourse.bind(controller),
  cloneCourse: controller.cloneCourse.bind(controller),
  deleteFile: controller.deleteFile.bind(controller),
  exportData: controller.exportData.bind(controller),

  // Email notification methods
  cancelCourse: controller.cancelCourse.bind(controller),
  postponeCourse: controller.postponeCourse.bind(controller),
  getNotificationStatus: controller.getNotificationStatus.bind(controller),
  sendImmediateNotification:
    controller.sendImmediateNotification.bind(controller),
  sendTestNotification: controller.sendTestNotification.bind(controller),
  cancelScheduledNotification:
    controller.cancelScheduledNotification.bind(controller),

  // Course code and certification body methods
  checkCourseCode: controller.checkCourseCode.bind(controller),
  generateCourseCode: controller.generateCourseCode.bind(controller),
  getCertificationBodies: controller.getCertificationBodies.bind(controller),

  //
  getPoolItems: controller.getPoolItems.bind(controller), // <<< NEW EXPORT
  getPoolItemById: controller.getPoolItemById.bind(controller), // <<< NEW EXPORT
  deletePoolItem: controller.deletePoolItem.bind(controller), // <<< NEW EXPORT
};
