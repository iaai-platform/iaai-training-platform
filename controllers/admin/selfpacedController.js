// controllers/admin/selfpacedController.js
const SelfPacedOnlineTraining = require("../../models/selfPacedOnlineTrainingModel");
const User = require("../../models/user");
const Instructor = require("../../models/Instructor");
const mongoose = require("mongoose");
const certificationBody = require("../../models/CertificationBody");
const fs = require("fs").promises;
const path = require("path");

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
      status: "Active",
    }).select("companyName");

    if (body) {
      console.log(`✅ Found certification body: ${body.companyName}`);
      return {
        issuingAuthorityId: body._id,
        issuingAuthority: body.companyName,
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

// ========================================
// STATISTICS
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
// COURSE CRUD OPERATIONS
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

exports.createCourse = async (req, res) => {
  try {
    const courseData = req.body;

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

    // Handle certification body using helper function
    if (courseData.certification?.issuingAuthorityId) {
      const certBodyData = await processSingleCertificationBody(
        courseData.certification.issuingAuthorityId
      );
      if (certBodyData) {
        courseData.certification.issuingAuthorityId =
          certBodyData.issuingAuthorityId;
        courseData.certification.issuingAuthority =
          certBodyData.issuingAuthority;
      } else {
        // If certification body not found, clear the ID but keep default authority
        courseData.certification.issuingAuthorityId = undefined;
        // Keep the default issuingAuthority value
      }
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

exports.updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

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

    // Handle certification body using helper function
    if (updateData.certification?.issuingAuthorityId) {
      const certBodyData = await processSingleCertificationBody(
        updateData.certification.issuingAuthorityId
      );
      if (certBodyData) {
        updateData.certification.issuingAuthorityId =
          certBodyData.issuingAuthorityId;
        updateData.certification.issuingAuthority =
          certBodyData.issuingAuthority;
      } else {
        // If certification body not found, clear the ID but keep default authority
        updateData.certification.issuingAuthorityId = undefined;
        // Keep the default issuingAuthority value
      }
    } else if (
      updateData.certification &&
      updateData.certification.issuingAuthorityId === ""
    ) {
      // If explicitly clearing the certification body
      updateData.certification.issuingAuthorityId = undefined;
      updateData.certification.issuingAuthority = "IAAI Training Institute";
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

    // Delete video files
    for (const video of course.videos || []) {
      if (video.videoUrl) {
        const filePath = path.join(__dirname, "../..", video.videoUrl);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("Error deleting video file:", err);
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
// VIDEO MANAGEMENT (UNCHANGED)
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

    // Process video file
    if (req.file) {
      videoData.videoUrl = `/uploads/selfpaced/videos/${req.file.filename}`;
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

    // Process new video file if uploaded
    if (req.file) {
      // Delete old video file if it exists and is a local file
      if (video.videoUrl && video.videoUrl.startsWith("/uploads/")) {
        const oldFilePath = path.join(__dirname, "../..", video.videoUrl);
        try {
          await fs.unlink(oldFilePath);
        } catch (err) {
          console.error("Error deleting old video file:", err);
        }
      }
      updateData.videoUrl = `/uploads/selfpaced/videos/${req.file.filename}`;
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

    // Delete video file if it exists and is local
    if (video.videoUrl && video.videoUrl.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, "../..", video.videoUrl);
      try {
        await fs.unlink(filePath);
        console.log("Deleted video file:", filePath);
      } catch (err) {
        console.error("Error deleting video file:", err);
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
// EXPORT/IMPORT (UNCHANGED)
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
// HELPER FUNCTIONS (API ENDPOINTS)
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

// REPLACE your existing getCertificationBodies function in selfpacedController.js with this:

exports.getCertificationBodies = async (req, res) => {
  try {
    const CertificationBody = require("../../models/CertificationBody");

    console.log("🔍 Loading certification bodies...");

    // FIXED: Use the correct field names and don't filter by status if it doesn't exist
    // First, let's check what fields exist in the model
    const sampleDoc = await CertificationBody.findOne().lean();
    console.log("📋 Sample certification body document:", sampleDoc);

    // Try different possible status field names and approaches
    let certificationBodies;

    // Approach 1: Try with 'isActive' field (from your model)
    certificationBodies = await CertificationBody.find({
      isActive: true,
      isDeleted: { $ne: true }, // Also check if not deleted
    })
      .select("companyName email isActive createdAt shortName displayName")
      .sort({ companyName: 1 })
      .lean();

    console.log(
      `📋 Found ${certificationBodies.length} active certification bodies (isActive: true)`
    );

    // If no results with isActive, try without status filter
    if (certificationBodies.length === 0) {
      console.log("⚠️ No active bodies found, trying without status filter...");

      certificationBodies = await CertificationBody.find({
        isDeleted: { $ne: true }, // Only exclude deleted ones
      })
        .select("companyName email isActive createdAt shortName displayName")
        .sort({ companyName: 1 })
        .lean();

      console.log(
        `📋 Found ${certificationBodies.length} total certification bodies (excluding deleted)`
      );
    }

    // If still no results, get all documents
    if (certificationBodies.length === 0) {
      console.log("⚠️ No bodies found with filters, getting all...");

      certificationBodies = await CertificationBody.find({})
        .select("companyName email isActive createdAt shortName displayName")
        .sort({ companyName: 1 })
        .lean();

      console.log(
        `📋 Found ${certificationBodies.length} total certification bodies (no filters)`
      );
    }

    // Log each certification body for debugging
    certificationBodies.forEach((body, index) => {
      console.log(
        `  ${index + 1}. ${body.companyName} (ID: ${body._id}, Active: ${
          body.isActive
        })`
      );
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
