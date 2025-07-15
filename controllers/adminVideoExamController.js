// adminVideoExamController.js
const mongoose = require('mongoose');
const SelfPacedOnlineTraining = require('../models/selfPacedOnlineTrainingModel');
const fs = require('fs').promises;
const path = require('path');

// ✅ Fetch All Courses for Admin Panel
exports.getAdminPage = async (req, res) => {
  try {
    const courses = await SelfPacedOnlineTraining.find().lean();
    res.render('admin-video-exam', { 
      courses,
      user: req.user // Add user for header
    });
  } catch (err) {
    console.error('❌ Error fetching courses:', err);
    req.flash('error', 'Error fetching courses');
    res.redirect('/dashboard');
  }
};

// ✅ Upload Video with Exam
// Add this enhanced logging to your adminVideoExamController.js
exports.uploadVideoWithExam = async (req, res) => {
  try {
      console.log("🔄 Starting video processing...");
      
      const {
          editMode,
          editVideoId,
          editCourseId,
          courseId,
          title,
          description,
          transcript,
          sequence,
          questions
      } = req.body;

      console.log("📋 Form data extracted successfully");

      // Determine which course ID to use
      const targetCourseId = editMode === "true" ? editCourseId : courseId;
      console.log("🎯 Target course ID:", targetCourseId);

      // Validate courseId
      if (!targetCourseId || !mongoose.Types.ObjectId.isValid(targetCourseId)) {
          console.error("❌ Invalid courseId:", targetCourseId);
          return res.status(400).json({ 
              success: false, 
              message: "Invalid courseId. Please select a valid course." 
          });
      }

      console.log("🔍 Looking for course in database...");
      // Check if the course exists
      const course = await SelfPacedOnlineTraining.findById(targetCourseId);
      if (!course) {
          console.error(`❌ Course not found: ${targetCourseId}`);
          return res.status(404).json({ 
              success: false, 
              message: "Course not found." 
          });
      }
      console.log("✅ Course found:", course.title);

      // Validate sequence
      const videoSequence = parseInt(sequence, 10);
      if (isNaN(videoSequence)) {
          console.error("❌ Invalid sequence:", sequence);
          return res.status(400).json({ 
              success: false, 
              message: "Sequence must be a valid number." 
          });
      }
      console.log("📊 Video sequence:", videoSequence);

      // Process exam questions
      let examQuestions = [];
      if (questions) {
          try {
              let parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
              examQuestions = parsedQuestions.filter(q =>
                  q.questionText && 
                  q.correctAnswer && 
                  Array.isArray(q.options) && 
                  q.options.length >= 2
              );
              console.log(`✅ Processed ${examQuestions.length} valid exam questions`);
          } catch (err) {
              console.error("❌ Error parsing exam questions:", err);
              return res.status(400).json({ 
                  success: false, 
                  message: "Invalid exam questions format." 
              });
          }
      }

      console.log("🔧 Processing mode:", editMode === "true" ? "EDIT" : "CREATE");

      // Handle Edit Mode
      if (editMode === "true" && editVideoId) {
          console.log("✏️ Edit mode - finding video:", editVideoId);
          
          const video = course.videos.find(v => v._id.toString() === editVideoId);
          if (!video) {
              console.error("❌ Video not found for editing");
              return res.status(404).json({ 
                  success: false, 
                  message: "Video not found." 
              });
          }

          // Check for duplicate sequence
          const duplicateSequence = course.videos.some(v => 
              v.sequence === videoSequence && v._id.toString() !== editVideoId
          );
          
          if (duplicateSequence) {
              console.error(`❌ Duplicate sequence ${videoSequence}`);
              return res.status(400).json({ 
                  success: false, 
                  message: `Sequence number ${videoSequence} is already used.` 
              });
          }

          console.log("📝 Updating video details...");
          // Update video details
          video.title = title;
          video.description = description;
          video.transcript = transcript || '';
          video.sequence = videoSequence;
          video.exam = examQuestions;

          // Update video file if new one is uploaded
          if (req.file) {
              console.log("📁 Updating video file:", req.file.filename);
              video.videoUrl = `/uploads/videos/${req.file.filename}`;
          }

          console.log("💾 Saving course to database...");
          await course.save();
          console.log("✅ Course saved successfully");

          console.log("📤 Sending edit success response...");
          return res.json({ 
              success: true, 
              message: "Video updated successfully!",
              video: {
                  _id: video._id,
                  title: video.title,
                  sequence: video.sequence
              }
          });
      }

      // Create New Video Mode
      console.log("🆕 Create mode - checking file...");
      
      if (!req.file) {
          console.error("❌ No video file uploaded for new video");
          return res.status(400).json({ 
              success: false, 
              message: "Video file is required for new uploads." 
          });
      }

      // Check for duplicate sequence
      if (course.videos.some(v => v.sequence === videoSequence)) {
          console.error(`❌ Duplicate sequence ${videoSequence}`);
          return res.status(400).json({ 
              success: false, 
              message: `Sequence number ${videoSequence} is already used.` 
          });
      }

      console.log("🎬 Creating new video object...");
      // Create new video object
      const newVideo = {
          _id: new mongoose.Types.ObjectId(),
          title,
          description,
          transcript: transcript || '',
          videoUrl: `/uploads/videos/${req.file.filename}`,
          dateUploaded: new Date(),
          sequence: videoSequence,
          exam: examQuestions
      };

      console.log("📋 Adding video to course...");
      course.videos.push(newVideo);
      
      console.log("💾 Saving course to database...");
      await course.save();
      console.log("✅ Course saved successfully");

      console.log("📤 Sending create success response...");
      return res.json({ 
          success: true, 
          message: "Video uploaded successfully!",
          video: {
              _id: newVideo._id,
              title: newVideo.title,
              sequence: newVideo.sequence
          }
      });

  } catch (err) {
      console.error("❌ Error in uploadVideoWithExam:", err);
      console.error("Stack trace:", err.stack);
      return res.status(500).json({ 
          success: false, 
          message: "Error processing video", 
          error: err.message 
      });
  }
};


// ✅ Edit Video (PUT method for proper RESTful API)
exports.editVideo = async (req, res) => {
    // This method is now integrated into uploadVideoWithExam
    // Redirect to uploadVideoWithExam for backward compatibility
    req.body.editMode = "true";
    return exports.uploadVideoWithExam(req, res);
};

// ✅ Delete Video
exports.deleteVideo = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;

        console.log(`🗑️ Attempting to delete video ${videoId} from course ${courseId}`);

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(videoId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid course or video ID." 
            });
        }

        const course = await SelfPacedOnlineTraining.findById(courseId);
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: "Course not found." 
            });
        }

        // Find the video to delete
        const videoIndex = course.videos.findIndex(v => v._id.toString() === videoId);
        if (videoIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "Video not found." 
            });
        }

        const video = course.videos[videoIndex];

        // Delete video file from storage
        if (video.videoUrl) {
            const filePath = path.join(__dirname, '..', video.videoUrl);
            try {
                await fs.unlink(filePath);
                console.log(`✅ Video file deleted: ${filePath}`);
            } catch (err) {
                console.log(`⚠️ Could not delete video file: ${err.message}`);
            }
        }

        // Remove video from course
        course.videos.splice(videoIndex, 1);
        await course.save();

        console.log(`✅ Video "${video.title}" deleted successfully.`);
        res.json({ 
            success: true, 
            message: "Video deleted successfully!" 
        });

    } catch (err) {
        console.error("❌ Error deleting video:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error deleting video",
            error: err.message
        });
    }
};

// ✅ Get video details (for AJAX requests)
exports.getVideoDetails = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;

        const course = await SelfPacedOnlineTraining.findById(courseId);
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: "Course not found." 
            });
        }

        const video = course.videos.find(v => v._id.toString() === videoId);
        if (!video) {
            return res.status(404).json({ 
                success: false, 
                message: "Video not found." 
            });
        }

        res.json({ 
            success: true, 
            video: {
                ...video.toObject(),
                courseTitle: course.title,
                courseId: course._id
            }
        });

    } catch (err) {
        console.error("❌ Error fetching video details:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching video details" 
        });
    }
};