//controllers/homepageUpdateController.js - Using your existing local storage middleware
const HomepageUpdate = require("../models/homepageUpdate");
const fs = require("fs");
const path = require("path");

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
          latestNewsImage: "/uploads/placeholder.jpg", // Local fallback

          latest1Title: "Latest 1",
          latest1Detail: "Details for latest 1 are not available.",
          latest1Image: "/uploads/placeholder.jpg",

          latest2Title: "Latest 2",
          latest2Detail: "Details for latest 2 are not available.",
          latest2Image: "/uploads/placeholder.jpg",

          latest3Title: "Latest 3",
          latest3Detail: "Details for latest 3 are not available.",
          latest3Image: "/uploads/placeholder.jpg",
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
   ✅ 4. Update/Create Homepage Content - Using Local Storage
====================================================== */
exports.updateHomepageContent = async (req, res) => {
  try {
    const data = req.body;
    const files = req.files; // From your existing uploadImages middleware

    console.log("📝 Homepage update request received");
    console.log("📁 Files:", files ? Object.keys(files) : "No files");

    // Find existing content if updating
    let existingContent = null;
    if (data.id && data.id !== "") {
      existingContent = await HomepageUpdate.findById(data.id);
      console.log("🔍 Existing content found:", existingContent ? "Yes" : "No");
    }

    const updateData = {
      latestNewsTitle: data.latestNewsTitle,
      latestNewsDes: data.latestNewsDes,
      latestNewsDetails: data.latestNewsDetails,
      updatedAt: new Date(),
    };

    // Handle Latest News Image
    if (files && files.latestNewsImage && files.latestNewsImage[0]) {
      console.log("📸 Processing news image...");

      // Delete old image file if exists
      if (existingContent && existingContent.latestNewsImage) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          "public",
          existingContent.latestNewsImage
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log("🗑️ Deleted old news image");
        }
      }

      updateData.latestNewsImage = `/uploads/${files.latestNewsImage[0].filename}`;
    }

    // Handle Latest 1 Section
    if (data.latest1Title) {
      updateData.latest1Title = data.latest1Title;
      updateData.latest1Detail = data.latest1Detail;

      if (files && files.latest1Image && files.latest1Image[0]) {
        console.log("📸 Processing latest1 image...");

        // Delete old image if exists
        if (existingContent && existingContent.latest1Image) {
          const oldImagePath = path.join(
            __dirname,
            "..",
            "public",
            existingContent.latest1Image
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Deleted old latest1 image");
          }
        }

        updateData.latest1Image = `/uploads/${files.latest1Image[0].filename}`;
      }
    }

    // Handle Latest 2 Section
    if (data.latest2Title) {
      updateData.latest2Title = data.latest2Title;
      updateData.latest2Detail = data.latest2Detail;

      if (files && files.latest2Image && files.latest2Image[0]) {
        console.log("📸 Processing latest2 image...");

        // Delete old image if exists
        if (existingContent && existingContent.latest2Image) {
          const oldImagePath = path.join(
            __dirname,
            "..",
            "public",
            existingContent.latest2Image
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Deleted old latest2 image");
          }
        }

        updateData.latest2Image = `/uploads/${files.latest2Image[0].filename}`;
      }
    }

    // Handle Latest 3 Section
    if (data.latest3Title) {
      updateData.latest3Title = data.latest3Title;
      updateData.latest3Detail = data.latest3Detail;

      if (files && files.latest3Image && files.latest3Image[0]) {
        console.log("📸 Processing latest3 image...");

        // Delete old image if exists
        if (existingContent && existingContent.latest3Image) {
          const oldImagePath = path.join(
            __dirname,
            "..",
            "public",
            existingContent.latest3Image
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Deleted old latest3 image");
          }
        }

        updateData.latest3Image = `/uploads/${files.latest3Image[0].filename}`;
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
   ✅ 5. Delete Homepage Content with Local File Cleanup
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

    // Delete all local image files
    const imagesToDelete = [
      content.latestNewsImage,
      content.latest1Image,
      content.latest2Image,
      content.latest3Image,
    ].filter(Boolean);

    console.log(`🗑️ Deleting ${imagesToDelete.length} local image files...`);

    for (const imagePath of imagesToDelete) {
      try {
        const fullPath = path.join(__dirname, "..", "public", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✅ Deleted: ${imagePath}`);
        }
      } catch (deleteError) {
        console.error(`❌ Error deleting ${imagePath}:`, deleteError);
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
