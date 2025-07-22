//controllers/homepageUpdateController.js - Simplified with Cloudinary
const HomepageUpdate = require("../models/homepageUpdate");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");

// ✅ Cloudinary setup
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dgzj5k8b6",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ======================================================
   ✅ 1. Fetch Homepage Content for User View
====================================================== */
exports.getHomepageContent = async (req, res) => {
  try {
    const homepageContent = await HomepageUpdate.findOne().sort({
      createdAt: -1,
    });

    if (!homepageContent) {
      return res.render("homecontent", {
        homepageContent: {
          latestNewsTitle: "Latest News",
          latestNewsDes: "No news available.",
          latestNewsDetails: "Details will be added soon.",
          latestNewsImage: "/images/image8.jpeg",

          latest1Title: "Latest 1",
          latest1Detail: "Details for latest 1 are not available.",
          latest1Image: "/images/image10.jpeg",

          latest2Title: "Latest 2",
          latest2Detail: "Details for latest 2 are not available.",
          latest2Image: "/images/image11.jpeg",

          latest3Title: "Latest 3",
          latest3Detail: "Details for latest 3 are not available.",
          latest3Image: "/images/image12.jpeg",
        },
      });
    }

    res.render("homecontent", { homepageContent });
  } catch (error) {
    console.error("❌ Error fetching homepage content:", error);
    res.status(500).send("Error loading homepage content.");
  }
};

// Routes for other pages
exports.getAllCoursesPage = (req, res) => {
  res.render("all-courses");
};

exports.getTrainingProgramsPage = (req, res) => {
  res.render("training-programs");
};

/* ======================================================
   ✅ 2. Admin Panel: Fetch All Records
====================================================== */
exports.getHomepageRecords = async (req, res) => {
  try {
    const homepageRecords = await HomepageUpdate.find().sort({ createdAt: -1 });
    res.render("admin-homepage", { homepageRecords });
  } catch (error) {
    console.error("❌ Error fetching homepage records:", error);
    res.status(500).send("Error loading homepage management.");
  }
};

/* ======================================================
   ✅ 3. Fetch Specific Homepage Content for Editing
====================================================== */
exports.getHomepageById = async (req, res) => {
  try {
    const homepageContent = await HomepageUpdate.findById(req.params.id);
    if (!homepageContent) {
      return res.status(404).json({ message: "Content not found" });
    }
    res.json(homepageContent);
  } catch (error) {
    console.error("❌ Error fetching homepage content:", error);
    res.status(500).json({ message: "Failed to fetch homepage content." });
  }
};

/* ======================================================
   ✅ 4. SIMPLIFIED AUTO-POPULATE FUNCTION
====================================================== */
exports.autoPopulateHomepage = async (req, res) => {
  try {
    console.log("🚀 Auto-populate homepage initiated...");

    // ✅ SIMPLIFIED: Helper function to get course image
    const getMainImageUrl = async (course, folder) => {
      let imageUrl = null;

      // Get image from course
      if (course.media?.mainImage?.url) {
        imageUrl = course.media.mainImage.url;
      } else if (course.media?.images && course.media.images.length > 0) {
        imageUrl = course.media.images[0];
      }

      // If already Cloudinary URL, return as is
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        return {
          url: imageUrl,
          publicId: null,
        };
      }

      // If external URL, upload to Cloudinary
      if (imageUrl && imageUrl.startsWith("http")) {
        try {
          const result = await cloudinary.uploader.upload(imageUrl, {
            folder: `iaai-platform/homepage/${folder}`,
            use_filename: true,
            unique_filename: true,
          });
          return {
            url: result.secure_url,
            publicId: result.public_id,
          };
        } catch (error) {
          console.error("❌ Error uploading to Cloudinary:", error);
        }
      }

      // Default fallback
      return {
        url: "/images/image8.jpeg",
        publicId: null,
      };
    };

    // ===============================================
    // Find latest completed course for NEWS
    // ===============================================
    console.log("🔍 Searching for latest completed course...");

    let latestCompleted = null;

    try {
      const inPersonCompleted = await InPersonAestheticTraining.findOne({
        "basic.status": "completed",
        "schedule.endDate": { $exists: true },
      }).sort({ "schedule.endDate": -1 });

      if (inPersonCompleted) {
        latestCompleted = {
          course: inPersonCompleted,
          title: inPersonCompleted.basic?.title || "Training Course",
          location: inPersonCompleted.venue?.city || "Location TBD",
          type: "In-Person Training",
          completedDate: inPersonCompleted.schedule.endDate,
        };
      }
    } catch (error) {
      console.warn("⚠️ Error fetching completed courses:", error.message);
    }

    // ===============================================
    // Find 3 recent courses for LATEST section
    // ===============================================
    console.log("🔍 Searching for recent courses...");

    const recentCourses = [];

    try {
      const recent = await InPersonAestheticTraining.find()
        .sort({ createdAt: -1 })
        .limit(3);

      recent.forEach((course) => {
        recentCourses.push({
          course,
          title: course.basic?.title || "New Course",
          description:
            course.basic?.description || "Course description not available.",
        });
      });
    } catch (error) {
      console.warn("⚠️ Error fetching recent courses:", error.message);
    }

    // ===============================================
    // Prepare homepage data
    // ===============================================
    const homepageData = {};

    // LATEST NEWS
    if (latestCompleted) {
      homepageData.latestNewsTitle = `${latestCompleted.title} Successfully Completed!`;
      homepageData.latestNewsDes = `Our recent ${latestCompleted.type} in ${latestCompleted.location} has been successfully completed with excellent participant feedback.`;
      homepageData.latestNewsDetails = `We are pleased to announce the successful completion of "${
        latestCompleted.title
      }" which concluded on ${new Date(
        latestCompleted.completedDate
      ).toLocaleDateString()}. This intensive training provided participants with practical experience and comprehensive education. All participants who met the requirements received their certification. Thank you to all attendees and instructors!`;

      // ✅ Upload news image to iaai-platform/homepage/news
      const newsImage = await getMainImageUrl(latestCompleted.course, "news");
      homepageData.latestNewsImage = newsImage.url;
      homepageData.latestNewsImagePublicId = newsImage.publicId;
    } else {
      homepageData.latestNewsTitle = "IAAI Training Programs Update";
      homepageData.latestNewsDes =
        "Stay updated with our latest training programs and educational opportunities.";
      homepageData.latestNewsDetails =
        "We continue to develop and deliver world-class aesthetic training programs.";
      homepageData.latestNewsImage = "/images/image8.jpeg";
    }

    // LATEST 1, 2, 3
    for (let i = 0; i < 3; i++) {
      const fieldNum = i + 1;

      if (recentCourses[i]) {
        const course = recentCourses[i];
        homepageData[`latest${fieldNum}Title`] = `New: ${course.title}`;
        homepageData[`latest${fieldNum}Detail`] =
          course.description.length > 150
            ? course.description.substring(0, 150) + "..."
            : course.description;

        // ✅ Upload latest image to iaai-platform/homepage/latest
        const latestImage = await getMainImageUrl(course.course, "latest");
        homepageData[`latest${fieldNum}Image`] = latestImage.url;
        homepageData[`latest${fieldNum}ImagePublicId`] = latestImage.publicId;
      } else {
        homepageData[`latest${fieldNum}Title`] = `Latest Update ${fieldNum}`;
        homepageData[`latest${fieldNum}Detail`] =
          "Stay tuned for more updates on our training programs.";
        homepageData[`latest${fieldNum}Image`] = `/images/image${
          10 + fieldNum
        }.jpeg`;
      }
    }

    // Save to database
    await HomepageUpdate.deleteMany({});
    const newHomepageContent = new HomepageUpdate(homepageData);
    await newHomepageContent.save();

    console.log("✅ Auto-populate completed successfully!");

    res.json({
      success: true,
      message: "Homepage content auto-populated successfully!",
      data: {
        newsSource: latestCompleted ? latestCompleted.title : "Default content",
        totalCoursesFound: recentCourses.length,
        imageUrls: {
          latestNews: homepageData.latestNewsImage,
          latest1: homepageData.latest1Image,
          latest2: homepageData.latest2Image,
          latest3: homepageData.latest3Image,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error auto-populating homepage:", error);
    res.status(500).json({
      success: false,
      message: "Failed to auto-populate homepage content.",
      error: error.message,
    });
  }
};

/* ======================================================
   ✅ 5. SIMPLIFIED UPDATE/CREATE HOMEPAGE CONTENT
====================================================== */
exports.updateHomepageContent = async (req, res) => {
  try {
    const data = req.body;
    const files = req.files;

    console.log("📝 Homepage update request received");
    console.log("📁 Files uploaded:", files ? Object.keys(files) : "None");

    // Find existing content if updating
    let existingContent = null;
    if (data.id && data.id !== "") {
      existingContent = await HomepageUpdate.findById(data.id);
    }

    const updateData = {
      latestNewsTitle: data.latestNewsTitle,
      latestNewsDes: data.latestNewsDes,
      latestNewsDetails: data.latestNewsDetails,
      updatedAt: new Date(),
    };

    // ✅ SIMPLIFIED: Handle Latest News Image (goes to iaai-platform/homepage/news)
    if (files && files.latestNewsImage && files.latestNewsImage[0]) {
      console.log("📸 News image uploaded to Cloudinary");
      updateData.latestNewsImage = files.latestNewsImage[0].path; // Cloudinary URL
      updateData.latestNewsImagePublicId = files.latestNewsImage[0].filename; // Cloudinary public_id

      // Delete old image if exists
      if (existingContent && existingContent.latestNewsImagePublicId) {
        try {
          await cloudinary.uploader.destroy(
            existingContent.latestNewsImagePublicId
          );
          console.log("🗑️ Deleted old news image from Cloudinary");
        } catch (deleteError) {
          console.warn(
            "⚠️ Could not delete old news image:",
            deleteError.message
          );
        }
      }
    }

    // ✅ SIMPLIFIED: Handle Latest 1 Image (goes to iaai-platform/homepage/latest)
    if (data.latest1Title) {
      updateData.latest1Title = data.latest1Title;
      updateData.latest1Detail = data.latest1Detail;

      if (files && files.latest1Image && files.latest1Image[0]) {
        console.log("📸 Latest1 image uploaded to Cloudinary");
        updateData.latest1Image = files.latest1Image[0].path;
        updateData.latest1ImagePublicId = files.latest1Image[0].filename;

        if (existingContent && existingContent.latest1ImagePublicId) {
          try {
            await cloudinary.uploader.destroy(
              existingContent.latest1ImagePublicId
            );
            console.log("🗑️ Deleted old latest1 image from Cloudinary");
          } catch (deleteError) {
            console.warn(
              "⚠️ Could not delete old latest1 image:",
              deleteError.message
            );
          }
        }
      }
    }

    // ✅ SIMPLIFIED: Handle Latest 2 Image (goes to iaai-platform/homepage/latest)
    if (data.latest2Title) {
      updateData.latest2Title = data.latest2Title;
      updateData.latest2Detail = data.latest2Detail;

      if (files && files.latest2Image && files.latest2Image[0]) {
        console.log("📸 Latest2 image uploaded to Cloudinary");
        updateData.latest2Image = files.latest2Image[0].path;
        updateData.latest2ImagePublicId = files.latest2Image[0].filename;

        if (existingContent && existingContent.latest2ImagePublicId) {
          try {
            await cloudinary.uploader.destroy(
              existingContent.latest2ImagePublicId
            );
            console.log("🗑️ Deleted old latest2 image from Cloudinary");
          } catch (deleteError) {
            console.warn(
              "⚠️ Could not delete old latest2 image:",
              deleteError.message
            );
          }
        }
      }
    }

    // ✅ SIMPLIFIED: Handle Latest 3 Image (goes to iaai-platform/homepage/latest)
    if (data.latest3Title) {
      updateData.latest3Title = data.latest3Title;
      updateData.latest3Detail = data.latest3Detail;

      if (files && files.latest3Image && files.latest3Image[0]) {
        console.log("📸 Latest3 image uploaded to Cloudinary");
        updateData.latest3Image = files.latest3Image[0].path;
        updateData.latest3ImagePublicId = files.latest3Image[0].filename;

        if (existingContent && existingContent.latest3ImagePublicId) {
          try {
            await cloudinary.uploader.destroy(
              existingContent.latest3ImagePublicId
            );
            console.log("🗑️ Deleted old latest3 image from Cloudinary");
          } catch (deleteError) {
            console.warn(
              "⚠️ Could not delete old latest3 image:",
              deleteError.message
            );
          }
        }
      }
    }

    // Update or Create
    let homepageContent;
    if (data.id && data.id !== "") {
      homepageContent = await HomepageUpdate.findByIdAndUpdate(
        data.id,
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      homepageContent = new HomepageUpdate(updateData);
      await homepageContent.save();
    }

    console.log("✅ Homepage content saved successfully");
    res.json({
      success: true,
      message: "Homepage content updated successfully!",
      homepageContent,
    });
  } catch (error) {
    console.error("❌ Error updating homepage content:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update homepage content.",
      error: error.message,
    });
  }
};

/* ======================================================
   ✅ 6. SIMPLIFIED DELETE HOMEPAGE CONTENT
====================================================== */
exports.deleteHomepageContent = async (req, res) => {
  try {
    const content = await HomepageUpdate.findById(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    // ✅ SIMPLIFIED: Delete Cloudinary images
    const imagesToDelete = [
      content.latestNewsImagePublicId,
      content.latest1ImagePublicId,
      content.latest2ImagePublicId,
      content.latest3ImagePublicId,
    ].filter(Boolean);

    console.log(`🗑️ Deleting ${imagesToDelete.length} Cloudinary images...`);

    for (const publicId of imagesToDelete) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Deleted Cloudinary image: ${publicId}`);
      } catch (deleteError) {
        console.error(
          `❌ Error deleting Cloudinary image ${publicId}:`,
          deleteError
        );
      }
    }

    // Delete from database
    await HomepageUpdate.findByIdAndDelete(req.params.id);

    console.log("✅ Homepage content and images deleted successfully");
    res.json({
      success: true,
      message: "Homepage content deleted successfully!",
    });
  } catch (error) {
    console.error("❌ Error deleting homepage content:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete homepage content.",
    });
  }
};
