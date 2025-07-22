//controllers/homepageUpdateController.js - Enhanced with Auto-Populate Feature
const HomepageUpdate = require("../models/homepageUpdate");
const InPersonAestheticTraining = require("../models/inPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
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
          latestNewsImage: "/uploads/placeholder.jpg",

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
   ✅ 4. AUTO-POPULATE FUNCTION - NEW FEATURE
====================================================== */
exports.autoPopulateHomepage = async (req, res) => {
  try {
    console.log("🚀 Auto-populate homepage initiated...");

    // Helper function to get main image URL from course media
    const getMainImageUrl = (course) => {
      if (course.media?.mainImage?.url) {
        return course.media.mainImage.url;
      }
      if (course.media?.images && course.media.images.length > 0) {
        return course.media.images[0];
      }
      if (course.media?.documents && course.media.documents.length > 0) {
        // Check if any document is actually an image
        const imageDoc = course.media.documents.find(
          (doc) =>
            doc.toLowerCase().includes(".jpg") ||
            doc.toLowerCase().includes(".jpeg") ||
            doc.toLowerCase().includes(".png")
        );
        if (imageDoc) return imageDoc;
      }
      return "/uploads/placeholder.jpg"; // Fallback
    };

    // Helper function to get course type display name
    const getCourseTypeName = (courseType, course) => {
      switch (courseType) {
        case "InPersonAestheticTraining":
          return "In-Person Training";
        case "OnlineLiveTraining":
          return "Online Live Training";
        case "SelfPacedOnlineTraining":
          return "Self-Paced Online Training";
        default:
          return "Training Course";
      }
    };

    // Helper function to create course description
    const createCourseDescription = (course, courseType) => {
      let description =
        course.basic?.description || "Course description not available.";

      // Limit description to 150 characters
      if (description.length > 150) {
        description = description.substring(0, 150) + "...";
      }

      const typeName = getCourseTypeName(courseType);
      const location =
        courseType === "InPersonAestheticTraining" && course.venue?.city
          ? ` in ${course.venue.city}`
          : "";

      return `${typeName}${location}: ${description}`;
    };

    // ===============================================
    // STEP 1: Find the latest completed course for NEWS
    // ===============================================
    console.log("🔍 Searching for latest completed course...");

    const completedCourses = [];

    // Search In-Person courses
    const inPersonCompleted = await InPersonAestheticTraining.find({
      "basic.status": "completed",
      "schedule.endDate": { $exists: true },
    })
      .sort({ "schedule.endDate": -1 })
      .limit(5);

    inPersonCompleted.forEach((course) => {
      completedCourses.push({
        course,
        type: "InPersonAestheticTraining",
        completedDate: course.schedule.endDate || course.updatedAt,
        title: course.basic?.title || "Untitled Course",
        location: course.venue?.city || "Location TBD",
      });
    });

    // Search Online Live courses
    const onlineLiveCompleted = await OnlineLiveTraining.find({
      "basic.status": "completed",
      "schedule.endDate": { $exists: true },
    })
      .sort({ "schedule.endDate": -1 })
      .limit(5);

    onlineLiveCompleted.forEach((course) => {
      completedCourses.push({
        course,
        type: "OnlineLiveTraining",
        completedDate: course.schedule.endDate || course.updatedAt,
        title: course.basic?.title || "Untitled Course",
        location: "Online",
      });
    });

    // Self-paced courses don't have completion dates in the same way, so we'll use recently published
    const selfPacedRecent = await SelfPacedOnlineTraining.find({
      "basic.status": "published",
      "metadata.publishedDate": { $exists: true },
    })
      .sort({ "metadata.publishedDate": -1 })
      .limit(3);

    selfPacedRecent.forEach((course) => {
      completedCourses.push({
        course,
        type: "SelfPacedOnlineTraining",
        completedDate: course.metadata.publishedDate || course.updatedAt,
        title: course.basic?.title || "Untitled Course",
        location: "Self-Paced Online",
      });
    });

    // Sort all completed courses by completion date
    completedCourses.sort(
      (a, b) => new Date(b.completedDate) - new Date(a.completedDate)
    );

    console.log(`📊 Found ${completedCourses.length} completed courses`);

    // ===============================================
    // STEP 2: Find three most recently created courses for LATEST sections
    // ===============================================
    console.log("🔍 Searching for recently created courses...");

    const recentCourses = [];

    // Get recently created courses from each model
    const recentInPerson = await InPersonAestheticTraining.find()
      .sort({ createdAt: -1 })
      .limit(5);

    recentInPerson.forEach((course) => {
      recentCourses.push({
        course,
        type: "InPersonAestheticTraining",
        createdDate: course.createdAt,
        title: course.basic?.title || "New Course",
        status: course.basic?.status || "draft",
      });
    });

    const recentOnlineLive = await OnlineLiveTraining.find()
      .sort({ createdAt: -1 })
      .limit(5);

    recentOnlineLive.forEach((course) => {
      recentCourses.push({
        course,
        type: "OnlineLiveTraining",
        createdDate: course.createdAt,
        title: course.basic?.title || "New Course",
        status: course.basic?.status || "draft",
      });
    });

    const recentSelfPaced = await SelfPacedOnlineTraining.find()
      .sort({ createdAt: -1 })
      .limit(5);

    recentSelfPaced.forEach((course) => {
      recentCourses.push({
        course,
        type: "SelfPacedOnlineTraining",
        createdDate: course.createdAt,
        title: course.basic?.title || "New Course",
        status: course.basic?.status || "draft",
      });
    });

    // Sort by creation date and get top 3
    recentCourses.sort(
      (a, b) => new Date(b.createdDate) - new Date(a.createdDate)
    );
    const topThreeRecent = recentCourses.slice(0, 3);

    console.log(`📊 Found ${recentCourses.length} recent courses, using top 3`);

    // ===============================================
    // STEP 3: Prepare data for homepage
    // ===============================================

    const homepageData = {};

    // LATEST NEWS (from completed course)
    if (completedCourses.length > 0) {
      const latestCompleted = completedCourses[0];
      const course = latestCompleted.course;

      homepageData.latestNewsTitle = `${latestCompleted.title} Successfully Completed!`;
      homepageData.latestNewsDes = `Our recent ${getCourseTypeName(
        latestCompleted.type
      )} in ${
        latestCompleted.location
      } has been successfully completed with excellent participant feedback.`;

      // Create detailed news content
      let newsDetails = `We are pleased to announce the successful completion of "${latestCompleted.title}" `;
      newsDetails += `which concluded on ${new Date(
        latestCompleted.completedDate
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}. `;

      if (latestCompleted.type === "InPersonAestheticTraining") {
        newsDetails += `This intensive hands-on training took place in ${
          course.venue?.city || "our training facility"
        } `;
        newsDetails += `and covered ${
          course.practical?.procedures?.length || "multiple"
        } key procedures. `;
        newsDetails += `Participants gained practical experience with ${
          course.practical?.trainingType?.join(", ") || "advanced techniques"
        }.`;
      } else if (latestCompleted.type === "OnlineLiveTraining") {
        newsDetails += `This comprehensive online training was delivered via ${
          course.platform?.name || "our online platform"
        } `;
        newsDetails += `and included ${
          course.content?.modules?.length || "multiple"
        } learning modules. `;
        newsDetails += `The interactive format allowed participants from around the world to engage with expert instructors.`;
      } else {
        newsDetails += `This self-paced online course provided flexible learning opportunities `;
        newsDetails += `with ${
          course.videos?.length || "multiple"
        } video lessons. `;
        newsDetails += `Participants could learn at their own pace while receiving comprehensive training materials.`;
      }

      newsDetails += ` All participants who met the requirements received their certification. `;
      newsDetails += `Thank you to all attendees and instructors who made this training a success!`;

      homepageData.latestNewsDetails = newsDetails;
      homepageData.latestNewsImage = getMainImageUrl(course);

      console.log("✅ Latest news populated from:", latestCompleted.title);
    } else {
      // Fallback if no completed courses found
      homepageData.latestNewsTitle = "IAAI Training Programs Update";
      homepageData.latestNewsDes =
        "Stay updated with our latest training programs and educational opportunities.";
      homepageData.latestNewsDetails =
        "We continue to develop and deliver world-class aesthetic training programs. Our comprehensive curriculum covers the latest techniques and technologies in aesthetic medicine, ensuring our participants receive the highest quality education. Check back regularly for updates on new courses and training opportunities.";
      homepageData.latestNewsImage = "/uploads/placeholder.jpg";
    }

    // LATEST 1, 2, 3 (from recently created courses)
    for (let i = 0; i < 3; i++) {
      const fieldNum = i + 1;

      if (topThreeRecent[i]) {
        const recentCourse = topThreeRecent[i];
        const course = recentCourse.course;

        homepageData[`latest${fieldNum}Title`] = `New: ${recentCourse.title}`;
        homepageData[`latest${fieldNum}Detail`] = createCourseDescription(
          course,
          recentCourse.type
        );
        homepageData[`latest${fieldNum}Image`] = getMainImageUrl(course);

        console.log(
          `✅ Latest ${fieldNum} populated from:`,
          recentCourse.title
        );
      } else {
        // Fallback for missing courses
        homepageData[`latest${fieldNum}Title`] = `Latest Update ${fieldNum}`;
        homepageData[
          `latest${fieldNum}Detail`
        ] = `Stay tuned for more updates on our training programs and educational opportunities.`;
        homepageData[`latest${fieldNum}Image`] = "/uploads/placeholder.jpg";
      }
    }

    // ===============================================
    // STEP 4: Save or update homepage content
    // ===============================================

    // Delete previous auto-generated content (if any exists)
    await HomepageUpdate.deleteMany({});
    console.log("🗑️ Cleared previous homepage content");

    // Create new homepage content
    const newHomepageContent = new HomepageUpdate(homepageData);
    await newHomepageContent.save();

    console.log("✅ Auto-populate completed successfully!");

    res.json({
      success: true,
      message: "Homepage content auto-populated successfully!",
      data: {
        newsSource:
          completedCourses.length > 0
            ? completedCourses[0].title
            : "Default content",
        latest1Source: topThreeRecent[0]?.title || "Default content",
        latest2Source: topThreeRecent[1]?.title || "Default content",
        latest3Source: topThreeRecent[2]?.title || "Default content",
        totalCoursesFound: completedCourses.length + recentCourses.length,
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
   ✅ 5. Update/Create Homepage Content (Existing)
====================================================== */
exports.updateHomepageContent = async (req, res) => {
  try {
    const data = req.body;
    const files = req.files;

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
   ✅ 6. Delete Homepage Content (Existing)
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
