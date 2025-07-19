// controllers/admin/selfpacedController.js - COMPLETE UPDATE WITH STREAMLINED CERTIFICATION
const SelfPacedOnlineTraining = require("../../models/selfPacedOnlineTrainingModel");
const User = require("../../models/user");
const Instructor = require("../../models/Instructor");
const mongoose = require("mongoose");
const certificationBody = require("../../models/CertificationBody");
const fs = require("fs").promises;
const path = require("path");

// ADD CLOUDINARY SETUP AT THE TOP
const cloudinary = require("cloudinary").v2;

// Configure cloudinary (make sure these are in your .env file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { ObjectId } = mongoose.Types;

// ========================================
// HELPER FUNCTIONS
// ========================================

const processSingleCertificationBody = async (certificationBodyId) => {
  if (!certificationBodyId) return null;

  try {
    const CertificationBody = require("../../models/CertificationBody");
    const body = await CertificationBody.findOne({
      _id: certificationBodyId,
      isActive: true, // UPDATED: Use isActive instead of status
      isDeleted: { $ne: true },
    }).select("companyName displayName");

    if (body) {
      console.log(`✅ Found certification body: ${body.companyName}`);
      return {
        issuingAuthorityId: body._id,
        issuingAuthority: body.displayName || body.companyName,
      };
    }

    console.log(
      `❌ Certification body not found or inactive: ${certificationBodyId}`
    );
    return null;
  } catch (error) {
    console.error("Error processing certification body:", error);
    return null;
  }
};

// ADD CLOUDINARY HELPER FUNCTIONS (unchanged)
const uploadToCloudinary = async (filePath, folder, resourceType = "auto") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `iaai-platform/selfpaced/${folder}`,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
    });

    console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    console.error(`❌ Cloudinary upload error:`, error);
    throw error;
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error(`❌ Cloudinary delete error:`, error);
    throw error;
  }
};

const extractPublicIdFromUrl = (url) => {
  if (!url || !url.includes("cloudinary.com")) return null;

  try {
    // Extract public ID from Cloudinary URL
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((part) => part === "upload");
    if (uploadIndex === -1) return null;

    // Get everything after 'upload/v{version}/'
    const pathParts = parts.slice(uploadIndex + 2);
    const publicIdWithExt = pathParts.join("/");

    // Remove file extension
    const lastDotIndex = publicIdWithExt.lastIndexOf(".");
    return lastDotIndex !== -1
      ? publicIdWithExt.substring(0, lastDotIndex)
      : publicIdWithExt;
  } catch (error) {
    console.error("Error extracting public ID:", error);
    return null;
  }
};

// ========================================
// STATISTICS (UNCHANGED)
// ========================================

exports.getStatistics = async (req, res) => {
  try {
    // Get course counts
    const totalCourses = await SelfPacedOnlineTraining.countDocuments();

    // Get all courses to count videos
    const courses = await SelfPacedOnlineTraining.find({});
    const totalVideos = courses.reduce(
      (sum, course) => sum + (course.videos?.length || 0),
      0
    );

    // Get enrollment statistics
    const enrollmentStats = await User.aggregate([
      { $unwind: "$mySelfPacedCourses" },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          totalCertificates: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$mySelfPacedCourses.userCourseStatus.userCourseTotalstatus",
                    "Completed",
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statistics = {
      totalCourses,
      totalVideos,
      totalStudents: enrollmentStats[0]?.totalStudents || 0,
      totalCertificates: enrollmentStats[0]?.totalCertificates || 0,
    };

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error("❌ Error getting statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
    });
  }
};

// ========================================
// COURSE CRUD OPERATIONS - UPDATED WITH STREAMLINED CERTIFICATION
// ========================================

exports.getAllCourses = async (req, res) => {
  try {
    const courses = await SelfPacedOnlineTraining.find({})
      .populate(
        "instructor.instructorId",
        "firstName lastName title designation"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Get enrollment counts
    const enrollmentCounts = await User.aggregate([
      { $unwind: "$mySelfPacedCourses" },
      {
        $group: {
          _id: "$mySelfPacedCourses.courseId",
          count: { $sum: 1 },
        },
      },
    ]);

    const enrollmentMap = {};
    enrollmentCounts.forEach((item) => {
      enrollmentMap[item._id.toString()] = item.count;
    });

    // Enhance courses with enrollment data and handle legacy structure
    const enhancedCourses = courses.map((course) => {
      // Handle both new nested structure and old flat structure
      const enhancedCourse = {
        ...course,
        enrolledStudents: enrollmentMap[course._id.toString()] || 0,
      };

      // If course has old structure, transform it to new structure
      if (!course.basic && course.title) {
        enhancedCourse.basic = {
          courseCode: course.courseCode,
          title: course.title,
          description: course.description,
          aboutThisCourse: course.Aboutthiscourse || course.aboutThisCourse,
          category: course.category || "aesthetic",
          status: course.status || "draft",
        };
      }

      if (!course.access && course.price !== undefined) {
        enhancedCourse.access = {
          price: course.price || 0,
          accessDays: course.accessDays || 365,
          totalEnrollments: enrollmentMap[course._id.toString()] || 0,
        };
      }

      if (!course.content && course.prerequisites) {
        enhancedCourse.content = {
          prerequisites: course.prerequisites,
          experienceLevel: course.experienceLevel || "all-levels",
        };
      }

      if (!course.instructor && course.instructorId) {
        enhancedCourse.instructor = {
          instructorId: course.instructorId,
          name: course.instructorName || "Not Assigned",
        };
      }

      return enhancedCourse;
    });

    res.json({
      success: true,
      courses: enhancedCourses,
    });
  } catch (error) {
    console.error("❌ Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching courses",
      error: error.message,
    });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await SelfPacedOnlineTraining.findById(courseId)
      .populate("instructor.instructorId", "firstName lastName")
      .lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      course,
    });
  } catch (error) {
    console.error("❌ Error fetching course:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching course",
    });
  }
};

// UPDATED - Create course with streamlined certification
exports.createCourse = async (req, res) => {
  try {
    const courseData = req.body;

    console.log("📝 Creating course with data:", {
      title: courseData.basic?.title,
      certificateEnabled: courseData.certification?.enabled,
      assessmentRequired:
        courseData.certification?.requirements?.assessmentRequired,
    });

    // Check if course code already exists
    const existingCourse = await SelfPacedOnlineTraining.findOne({
      "basic.courseCode": courseData.basic.courseCode,
    });

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: "Course code already exists",
      });
    }

    // Validate instructor exists
    if (courseData.instructor?.instructorId) {
      const instructor = await Instructor.findById(
        courseData.instructor.instructorId
      );
      if (!instructor) {
        return res.status(400).json({
          success: false,
          message: "Selected instructor not found",
        });
      }

      // Set instructor name for caching
      courseData.instructor.name =
        instructor.fullName || `${instructor.firstName} ${instructor.lastName}`;
      courseData.instructor.title = instructor.designation;
    }

    // UPDATED - Handle streamlined certification processing
    if (courseData.certification) {
      console.log(
        "🏆 Processing certification data:",
        courseData.certification
      );

      // Handle primary certification body
      if (courseData.certification.issuingAuthorityId) {
        const certBodyData = await processSingleCertificationBody(
          courseData.certification.issuingAuthorityId
        );
        if (certBodyData) {
          courseData.certification.issuingAuthorityId =
            certBodyData.issuingAuthorityId;
          courseData.certification.issuingAuthority =
            certBodyData.issuingAuthority;
          console.log(
            "✅ Primary certification body set:",
            certBodyData.issuingAuthority
          );
        } else {
          // If certification body not found, clear the ID but keep default authority
          courseData.certification.issuingAuthorityId = undefined;
          courseData.certification.issuingAuthority = "IAAI Training Institute";
          console.log("⚠️ Primary certification body not found, using default");
        }
      } else {
        // Ensure default values
        courseData.certification.issuingAuthority = "IAAI Training Institute";
        console.log("📋 Using default certification authority");
      }

      // Handle additional certification bodies
      if (
        courseData.certification.certificationBodies &&
        Array.isArray(courseData.certification.certificationBodies)
      ) {
        const validatedCertBodies = [];
        for (const certBody of courseData.certification.certificationBodies) {
          if (certBody.bodyId) {
            const certBodyData = await processSingleCertificationBody(
              certBody.bodyId
            );
            if (certBodyData) {
              validatedCertBodies.push({
                bodyId: certBodyData.issuingAuthorityId,
                name: certBodyData.issuingAuthority,
                role: certBody.role || "co-issuer",
              });
              console.log(
                "✅ Added secondary certification body:",
                certBodyData.issuingAuthority
              );
            }
          }
        }
        courseData.certification.certificationBodies = validatedCertBodies;
        console.log(
          `📝 Total secondary certification bodies: ${validatedCertBodies.length}`
        );
      } else {
        courseData.certification.certificationBodies = [];
      }

      // UPDATED - Handle assessment requirements logic
      if (courseData.certification.requirements) {
        const assessmentRequired =
          courseData.certification.requirements.assessmentRequired === true;

        // If assessment is not required, set minimum score to 0
        if (!assessmentRequired) {
          courseData.certification.requirements.minimumScore = 0;
          console.log("📝 Assessment not required, setting minimum score to 0");
        } else {
          console.log(
            "📝 Assessment required with minimum score:",
            courseData.certification.requirements.minimumScore
          );
        }

        // Ensure all required fields have defaults
        courseData.certification.requirements = {
          minimumAttendance: 100, // Always 100% for self-paced
          minimumScore: assessmentRequired
            ? courseData.certification.requirements.minimumScore || 70
            : 0,
          practicalRequired: false, // Never required for self-paced
          requireAllVideos:
            courseData.certification.requirements.requireAllVideos !== false,
          assessmentRequired: assessmentRequired,
        };
      } else {
        // Set default requirements if none provided
        courseData.certification.requirements = {
          minimumAttendance: 100,
          minimumScore: 0,
          practicalRequired: false,
          requireAllVideos: true,
          assessmentRequired: false,
        };
      }

      // Ensure other certification fields have defaults
      courseData.certification = {
        enabled: courseData.certification.enabled === true,
        type: courseData.certification.type || "completion",
        issuingAuthorityId: courseData.certification.issuingAuthorityId,
        issuingAuthority:
          courseData.certification.issuingAuthority ||
          "IAAI Training Institute",
        certificationBodies: courseData.certification.certificationBodies || [],
        requirements: courseData.certification.requirements,
        validity: courseData.certification.validity || { isLifetime: true },
        features: courseData.certification.features || {
          digitalBadge: true,
          qrVerification: true,
          autoGenerate: true,
          blockchain: false,
        },
        template: courseData.certification.template || "professional_v1",
      };

      console.log("🏆 Final certification config:", {
        enabled: courseData.certification.enabled,
        primary: courseData.certification.issuingAuthority,
        secondary: courseData.certification.certificationBodies.length,
        assessmentRequired:
          courseData.certification.requirements.assessmentRequired,
        minimumScore: courseData.certification.requirements.minimumScore,
      });
    }

    // Create new course
    const newCourse = new SelfPacedOnlineTraining(courseData);
    await newCourse.save();

    // Assign course to instructor if specified
    if (courseData.instructor?.instructorId) {
      try {
        const instructor = await Instructor.findById(
          courseData.instructor.instructorId
        );
        if (instructor) {
          await instructor.assignCourse({
            courseId: newCourse._id,
            courseType: "SelfPacedOnlineTraining",
            courseTitle: newCourse.basic.title,
            startDate: new Date(),
            role: "Lead Instructor",
          });
          console.log(
            `✅ Course assigned to instructor ${instructor.fullName}`
          );
        }
      } catch (error) {
        console.error("Error assigning course to instructor:", error);
        // Don't fail the course creation if instructor assignment fails
      }
    }

    // Populate instructor info for response
    await newCourse.populate(
      "instructor.instructorId",
      "firstName lastName title designation"
    );

    console.log(
      "✅ Course created successfully with streamlined certification:",
      {
        courseId: newCourse._id,
        title: newCourse.basic.title,
        certificateEnabled: newCourse.certification.enabled,
        primaryAuthority: newCourse.certification.issuingAuthority,
        additionalBodies: newCourse.certification.certificationBodies.length,
        assessmentRequired:
          newCourse.certification.requirements.assessmentRequired,
      }
    );

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: newCourse,
    });
  } catch (error) {
    console.error("❌ Error creating course:", error);
    res.status(500).json({
      success: false,
      message: "Error creating course",
      error: error.message,
    });
  }
};

// UPDATED - Update course with streamlined certification
exports.updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    console.log("📝 Updating course with data:", {
      courseId,
      title: updateData.basic?.title,
      certificateEnabled: updateData.certification?.enabled,
      assessmentRequired:
        updateData.certification?.requirements?.assessmentRequired,
    });

    // Check if course code is being changed
    if (updateData.basic?.courseCode) {
      const existingCourse = await SelfPacedOnlineTraining.findOne({
        "basic.courseCode": updateData.basic.courseCode,
        _id: { $ne: courseId },
      });

      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: "Course code already exists",
        });
      }
    }

    // Validate instructor if being updated
    if (updateData.instructor?.instructorId) {
      const instructor = await Instructor.findById(
        updateData.instructor.instructorId
      );
      if (!instructor) {
        return res.status(400).json({
          success: false,
          message: "Selected instructor not found",
        });
      }

      // Update instructor name for caching
      updateData.instructor.name =
        instructor.fullName || `${instructor.firstName} ${instructor.lastName}`;
      updateData.instructor.title = instructor.designation;
    }

    // UPDATED - Handle streamlined certification processing for updates
    if (updateData.certification) {
      console.log(
        "🏆 Processing certification update:",
        updateData.certification
      );

      // Handle primary certification body
      if (updateData.certification.issuingAuthorityId) {
        const certBodyData = await processSingleCertificationBody(
          updateData.certification.issuingAuthorityId
        );
        if (certBodyData) {
          updateData.certification.issuingAuthorityId =
            certBodyData.issuingAuthorityId;
          updateData.certification.issuingAuthority =
            certBodyData.issuingAuthority;
          console.log(
            "✅ Updated primary certification body:",
            certBodyData.issuingAuthority
          );
        } else {
          // If certification body not found, clear the ID but keep default authority
          updateData.certification.issuingAuthorityId = undefined;
          updateData.certification.issuingAuthority = "IAAI Training Institute";
          console.log("⚠️ Primary certification body not found, using default");
        }
      } else if (updateData.certification.issuingAuthorityId === "") {
        // If explicitly clearing the certification body
        updateData.certification.issuingAuthorityId = undefined;
        updateData.certification.issuingAuthority = "IAAI Training Institute";
        console.log("📋 Cleared primary certification body, using default");
      }

      // Handle additional certification bodies
      if (
        updateData.certification.certificationBodies &&
        Array.isArray(updateData.certification.certificationBodies)
      ) {
        const validatedCertBodies = [];
        for (const certBody of updateData.certification.certificationBodies) {
          if (certBody.bodyId) {
            const certBodyData = await processSingleCertificationBody(
              certBody.bodyId
            );
            if (certBodyData) {
              validatedCertBodies.push({
                bodyId: certBodyData.issuingAuthorityId,
                name: certBodyData.issuingAuthority,
                role: certBody.role || "co-issuer",
              });
              console.log(
                "✅ Updated secondary certification body:",
                certBodyData.issuingAuthority
              );
            }
          }
        }
        updateData.certification.certificationBodies = validatedCertBodies;
        console.log(
          `📝 Total secondary certification bodies: ${validatedCertBodies.length}`
        );
      }

      // UPDATED - Handle assessment requirements logic for updates
      if (updateData.certification.requirements) {
        const assessmentRequired =
          updateData.certification.requirements.assessmentRequired === true;

        // If assessment is not required, set minimum score to 0
        if (!assessmentRequired) {
          updateData.certification.requirements.minimumScore = 0;
          console.log(
            "📝 Assessment not required in update, setting minimum score to 0"
          );
        } else {
          console.log(
            "📝 Assessment required in update with minimum score:",
            updateData.certification.requirements.minimumScore
          );
        }
      }
    }

    const updatedCourse = await SelfPacedOnlineTraining.findByIdAndUpdate(
      courseId,
      updateData,
      { new: true, runValidators: true }
    ).populate(
      "instructor.instructorId",
      "firstName lastName title designation"
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Update instructor assignment if instructor changed
    if (updateData.instructor?.instructorId) {
      try {
        const instructor = await Instructor.findById(
          updateData.instructor.instructorId
        );
        if (instructor) {
          // Check if already assigned
          const existingAssignment = instructor.assignedCourses.find(
            (c) => c.courseId.toString() === courseId
          );

          if (!existingAssignment) {
            await instructor.assignCourse({
              courseId: updatedCourse._id,
              courseType: "SelfPacedOnlineTraining",
              courseTitle: updatedCourse.basic.title,
              startDate: new Date(),
              role: "Lead Instructor",
            });
            console.log(
              `✅ Course assigned to instructor ${instructor.fullName}`
            );
          }
        }
      } catch (error) {
        console.error("Error updating instructor assignment:", error);
      }
    }

    console.log(
      "✅ Course updated successfully with streamlined certification:",
      {
        courseId: updatedCourse._id,
        title: updatedCourse.basic.title,
        certificateEnabled: updatedCourse.certification.enabled,
        primaryAuthority: updatedCourse.certification.issuingAuthority,
        additionalBodies:
          updatedCourse.certification.certificationBodies.length,
        assessmentRequired:
          updatedCourse.certification.requirements.assessmentRequired,
      }
    );

    res.json({
      success: true,
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("❌ Error updating course:", error);
    res.status(500).json({
      success: false,
      message: "Error updating course",
      error: error.message,
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course has enrolled students
    const enrolledUsers = await User.find({
      "mySelfPacedCourses.courseId": courseId,
    });

    if (enrolledUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. ${enrolledUsers.length} students are enrolled.`,
      });
    }

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // UPDATED: Delete video files from Cloudinary
    for (const video of course.videos || []) {
      if (video.videoUrl && video.videoUrl.includes("cloudinary.com")) {
        const publicId = extractPublicIdFromUrl(video.videoUrl);
        if (publicId) {
          try {
            await deleteFromCloudinary(publicId);
          } catch (err) {
            console.error("Error deleting video from Cloudinary:", err);
          }
        }
      }
    }

    // UPDATED: Delete course thumbnail from Cloudinary
    if (
      course.media?.thumbnailUrl &&
      course.media.thumbnailUrl.includes("cloudinary.com")
    ) {
      const publicId = extractPublicIdFromUrl(course.media.thumbnailUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
        } catch (err) {
          console.error("Error deleting thumbnail from Cloudinary:", err);
        }
      }
    }

    // Delete course
    await SelfPacedOnlineTraining.findByIdAndDelete(courseId);

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting course:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting course",
    });
  }
};

// ========================================
// VIDEO MANAGEMENT - UPDATED FOR CLOUDINARY (unchanged from previous version)
// ========================================

exports.getCourseVideos = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await SelfPacedOnlineTraining.findById(courseId)
      .select("videos")
      .lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      videos: course.videos || [],
    });
  } catch (error) {
    console.error("❌ Error fetching videos:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching videos",
    });
  }
};

exports.addVideo = async (req, res) => {
  try {
    const { courseId } = req.params;
    const videoData = req.body;

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // UPDATED: Process video file with Cloudinary
    if (req.file) {
      try {
        console.log("📹 Uploading video to Cloudinary...");
        const uploadResult = await uploadToCloudinary(
          req.file.path,
          "videos",
          "video"
        );
        videoData.videoUrl = uploadResult.secure_url;

        // Clean up local file
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting local file:", err);
        }

        console.log(
          "✅ Video uploaded to Cloudinary:",
          uploadResult.secure_url
        );
      } catch (uploadError) {
        // Clean up local file on error
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting local file:", err);
        }

        return res.status(500).json({
          success: false,
          message: "Error uploading video to cloud storage",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Video file is required",
      });
    }

    // Parse quiz questions if provided
    if (req.body.questions) {
      try {
        videoData.exam = JSON.parse(req.body.questions);
      } catch (e) {
        console.error("Error parsing questions:", e);
        videoData.exam = [];
      }
    }

    // Parse assessment settings if provided
    if (req.body.assessmentSettings) {
      try {
        videoData.assessmentSettings = JSON.parse(req.body.assessmentSettings);
      } catch (e) {
        console.error("Error parsing assessment settings:", e);
        videoData.assessmentSettings = null;
      }
    }

    // Convert string values to appropriate types
    videoData.sequence = parseInt(videoData.sequence) || 1;
    videoData.duration = parseInt(videoData.duration) || null;
    videoData.isPreview =
      videoData.isPreview === "on" || videoData.isPreview === "true";

    // Generate a proper MongoDB ObjectId for the video
    videoData._id = new mongoose.Types.ObjectId();

    console.log("Creating video with ID:", videoData._id);

    // Add video using the model method
    await course.addVideo(videoData);

    console.log("✅ Video added successfully:", videoData.title);

    res.json({
      success: true,
      message: "Video added successfully",
      course: course,
      videoId: videoData._id,
    });
  } catch (error) {
    console.error("❌ Error adding video:", error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Error deleting uploaded file:", err);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error adding video",
      error: error.message,
    });
  }
};

exports.updateVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const updateData = req.body;

    console.log("Updating video:", videoId, "in course:", courseId);

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Handle both ObjectId and index-based video identification
    let video;
    let videoIndex;

    // Check if videoId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      video = course.videos.id(videoId);
      if (video) {
        videoIndex = course.videos.indexOf(video);
      }
    }

    // If not found by ObjectId, try to find by array index
    if (!video && !isNaN(videoId)) {
      videoIndex = parseInt(videoId);
      if (videoIndex >= 0 && videoIndex < course.videos.length) {
        video = course.videos[videoIndex];
        console.log(`Found video by index ${videoIndex}:`, video.title);
      }
    }

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // UPDATED: Process new video file if uploaded with Cloudinary
    if (req.file) {
      try {
        console.log("📹 Uploading new video to Cloudinary...");
        const uploadResult = await uploadToCloudinary(
          req.file.path,
          "videos",
          "video"
        );

        // Delete old video from Cloudinary if it exists
        if (video.videoUrl && video.videoUrl.includes("cloudinary.com")) {
          const oldPublicId = extractPublicIdFromUrl(video.videoUrl);
          if (oldPublicId) {
            try {
              await deleteFromCloudinary(oldPublicId);
            } catch (err) {
              console.error("Error deleting old video from Cloudinary:", err);
            }
          }
        }

        updateData.videoUrl = uploadResult.secure_url;

        // Clean up local file
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting local file:", err);
        }

        console.log(
          "✅ New video uploaded to Cloudinary:",
          uploadResult.secure_url
        );
      } catch (uploadError) {
        // Clean up local file on error
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting local file:", err);
        }

        return res.status(500).json({
          success: false,
          message: "Error uploading video to cloud storage",
        });
      }
    }

    // Parse quiz questions if provided
    if (req.body.questions) {
      try {
        updateData.exam = JSON.parse(req.body.questions);
      } catch (e) {
        console.error("Error parsing questions:", e);
        updateData.exam = video.exam || []; // Keep existing if parse fails
      }
    }

    // Parse assessment settings if provided
    if (req.body.assessmentSettings) {
      try {
        updateData.assessmentSettings = JSON.parse(req.body.assessmentSettings);
      } catch (e) {
        console.error("Error parsing assessment settings:", e);
        updateData.assessmentSettings = video.assessmentSettings || null;
      }
    }

    // Convert string values
    if (updateData.sequence)
      updateData.sequence = parseInt(updateData.sequence);
    if (updateData.duration)
      updateData.duration = parseInt(updateData.duration);
    if (updateData.isPreview !== undefined) {
      updateData.isPreview =
        updateData.isPreview === "on" || updateData.isPreview === "true";
    }

    // Update the video properties directly
    Object.keys(updateData).forEach((key) => {
      if (key !== "courseId" && key !== "videoId") {
        video[key] = updateData[key];
      }
    });

    // Save the course with updated video
    await course.save();

    console.log(`✅ Video updated successfully: ${video.title}`);

    res.json({
      success: true,
      message: "Video updated successfully",
      course: course,
    });
  } catch (error) {
    console.error("❌ Error updating video:", error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Error deleting uploaded file:", err);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error updating video",
      error: error.message,
    });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    console.log("Deleting video:", videoId, "from course:", courseId);

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Find the video to get file path for deletion (handle both ObjectId and index)
    let video;
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      video = course.videos.id(videoId);
    } else if (!isNaN(videoId)) {
      const index = parseInt(videoId);
      if (index >= 0 && index < course.videos.length) {
        video = course.videos[index];
      }
    }

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // UPDATED: Delete video file from Cloudinary
    if (video.videoUrl && video.videoUrl.includes("cloudinary.com")) {
      const publicId = extractPublicIdFromUrl(video.videoUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
          console.log("Deleted video from Cloudinary:", publicId);
        } catch (err) {
          console.error("Error deleting video from Cloudinary:", err);
        }
      }
    }

    // Remove video using enhanced logic
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      // Remove by ObjectId
      course.videos = course.videos.filter((v) => v._id.toString() !== videoId);
    } else {
      // Remove by index
      const index = parseInt(videoId);
      course.videos.splice(index, 1);
    }

    // Resequence remaining videos
    course.videos.forEach((video, index) => {
      video.sequence = index + 1;
    });

    await course.save();

    console.log("✅ Video deleted successfully");

    res.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting video:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting video",
    });
  }
};

exports.reorderVideos = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { videoIds } = req.body;

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    await course.reorderVideos(videoIds);

    res.json({
      success: true,
      message: "Videos reordered successfully",
    });
  } catch (error) {
    console.error("❌ Error reordering videos:", error);
    res.status(500).json({
      success: false,
      message: "Error reordering videos",
    });
  }
};

// ========================================
// THUMBNAIL UPLOAD ENDPOINTS (unchanged)
// ========================================

exports.uploadThumbnail = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No thumbnail file provided",
      });
    }

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    try {
      console.log("🖼️ Uploading thumbnail to Cloudinary...");
      const uploadResult = await uploadToCloudinary(
        req.file.path,
        "thumbnails"
      );

      // Delete old thumbnail from Cloudinary if it exists
      if (
        course.media?.thumbnailUrl &&
        course.media.thumbnailUrl.includes("cloudinary.com")
      ) {
        const oldPublicId = extractPublicIdFromUrl(course.media.thumbnailUrl);
        if (oldPublicId) {
          try {
            await deleteFromCloudinary(oldPublicId);
          } catch (err) {
            console.error("Error deleting old thumbnail from Cloudinary:", err);
          }
        }
      }

      // Update course with new thumbnail URL
      if (!course.media) course.media = {};
      course.media.thumbnailUrl = uploadResult.secure_url;
      await course.save();

      // Clean up local file
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Error deleting local file:", err);
      }

      console.log(
        "✅ Thumbnail uploaded to Cloudinary:",
        uploadResult.secure_url
      );

      res.json({
        success: true,
        message: "Thumbnail uploaded successfully",
        thumbnailUrl: uploadResult.secure_url,
        course: course,
      });
    } catch (uploadError) {
      // Clean up local file on error
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Error deleting local file:", err);
      }

      return res.status(500).json({
        success: false,
        message: "Error uploading thumbnail to cloud storage",
      });
    }
  } catch (error) {
    console.error("❌ Error uploading thumbnail:", error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Error deleting uploaded file:", err);
      }
    }

    res.status(500).json({
      success: false,
      message: "Error uploading thumbnail",
      error: error.message,
    });
  }
};

exports.deleteThumbnail = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await SelfPacedOnlineTraining.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Delete thumbnail from Cloudinary if it exists
    if (
      course.media?.thumbnailUrl &&
      course.media.thumbnailUrl.includes("cloudinary.com")
    ) {
      const publicId = extractPublicIdFromUrl(course.media.thumbnailUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
          console.log("Deleted thumbnail from Cloudinary:", publicId);
        } catch (err) {
          console.error("Error deleting thumbnail from Cloudinary:", err);
        }
      }
    }

    // Remove thumbnail URL from course
    if (course.media) {
      course.media.thumbnailUrl = "";
    }
    await course.save();

    res.json({
      success: true,
      message: "Thumbnail deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting thumbnail:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting thumbnail",
    });
  }
};

// ========================================
// EXPORT/IMPORT (unchanged)
// ========================================

exports.exportCourses = async (req, res) => {
  try {
    const courses = await SelfPacedOnlineTraining.find({})
      .populate("instructor.instructorId", "firstName lastName")
      .lean();

    // Get enrollment counts
    const enrollmentCounts = await User.aggregate([
      { $unwind: "$mySelfPacedCourses" },
      {
        $group: {
          _id: "$mySelfPacedCourses.courseId",
          count: { $sum: 1 },
        },
      },
    ]);

    const enrollmentMap = {};
    enrollmentCounts.forEach((item) => {
      enrollmentMap[item._id.toString()] = item.count;
    });

    // Generate CSV
    const csvHeaders = [
      "Course Code",
      "Title",
      "Description",
      "Category",
      "Instructor",
      "Price",
      "Access Days",
      "Status",
      "Videos",
      "Enrolled Students",
      "Created Date",
    ];

    const csvRows = courses.map((course) => [
      course.basic?.courseCode || "",
      course.basic?.title || "",
      (course.basic?.description || "").replace(/,/g, ";").replace(/\n/g, " "),
      course.basic?.category || "",
      course.instructor?.name || "",
      course.access?.price || 0,
      course.access?.accessDays || 365,
      course.basic?.status || "draft",
      course.videos?.length || 0,
      enrollmentMap[course._id.toString()] || 0,
      course.createdAt ? new Date(course.createdAt).toLocaleDateString() : "",
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="selfpaced-courses-${
        new Date().toISOString().split("T")[0]
      }.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error("❌ Error exporting courses:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting courses",
    });
  }
};

exports.importCourses = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const csv = require("csv-parser");
    const fs = require("fs");
    const courses = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        courses.push({
          basic: {
            courseCode: row["Course Code"],
            title: row["Title"],
            description: row["Description"],
            category: row["Category"] || "aesthetic",
            status: row["Status"] || "draft",
          },
          access: {
            price: parseFloat(row["Price"]) || 0,
            accessDays: parseInt(row["Access Days"]) || 365,
          },
          instructor: {
            // Will need to match instructor by name or add instructor selection later
          },
          videos: [],
        });
      })
      .on("end", async () => {
        try {
          // Insert courses
          const insertedCourses = await SelfPacedOnlineTraining.insertMany(
            courses,
            {
              ordered: false, // Continue on error
            }
          );

          // Clean up uploaded file
          await fs.promises.unlink(req.file.path);

          res.json({
            success: true,
            message: `Successfully imported ${insertedCourses.length} courses`,
            importedCount: insertedCourses.length,
          });
        } catch (error) {
          console.error("Error inserting courses:", error);
          res.status(500).json({
            success: false,
            message: "Error importing courses",
            error: error.message,
          });
        }
      });
  } catch (error) {
    console.error("❌ Error importing courses:", error);
    res.status(500).json({
      success: false,
      message: "Error importing courses",
    });
  }
};

// ========================================
// HELPER FUNCTIONS (API ENDPOINTS) - UNCHANGED
// ========================================

exports.getInstructors = async (req, res) => {
  try {
    const instructors = await Instructor.findActive()
      .select("firstName lastName email title designation expertise")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    console.log(`📋 Found ${instructors.length} active instructors`);

    res.json({
      success: true,
      instructors: instructors.map((instructor) => ({
        _id: instructor._id,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        fullName: `${instructor.title ? instructor.title + " " : ""}${
          instructor.firstName
        } ${instructor.lastName}`,
        email: instructor.email,
        designation: instructor.designation,
        expertise: instructor.expertise,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching instructors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching instructors",
      error: error.message,
    });
  }
};

// UPDATED - Get certification bodies with proper filtering
exports.getCertificationBodies = async (req, res) => {
  try {
    const CertificationBody = require("../../models/CertificationBody");

    console.log("🔍 Loading certification bodies for course creation...");

    // Use the correct field names based on the certification body model
    const certificationBodies = await CertificationBody.find({
      isActive: true,
      isDeleted: { $ne: true },
    })
      .select("companyName shortName displayName email isActive createdAt")
      .sort({ isPreferred: -1, companyName: 1 }) // Preferred first, then alphabetical
      .lean();

    console.log(
      `📋 Found ${certificationBodies.length} active certification bodies`
    );

    // Log each certification body for debugging
    certificationBodies.forEach((body, index) => {
      console.log(`  ${index + 1}. ${body.companyName} (ID: ${body._id})`);
    });

    res.json({
      success: true,
      certificationBodies: certificationBodies.map((body) => ({
        _id: body._id,
        companyName: body.companyName,
        shortName: body.shortName,
        displayName: body.displayName || body.companyName,
        email: body.email,
        isActive: body.isActive,
        createdAt: body.createdAt,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching certification bodies:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching certification bodies",
      error: error.message,
    });
  }
};
