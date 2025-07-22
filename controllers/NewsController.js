//controllers/newsDetailsController.js - Complete controller for news details with upcoming courses
const HomepageUpdate = require("../models/homepageUpdate");
const InPersonAestheticTraining = require("../models/inPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

/* ======================================================
   ✅ Get News Details with Upcoming Course Schedule
====================================================== */
exports.getNewsDetails = async (req, res) => {
  try {
    console.log("📰 Fetching news details with upcoming courses...");

    // Get the latest homepage content for news details
    const homepageContent = await HomepageUpdate.findOne().sort({
      createdAt: -1,
    });

    // Helper function to format course for display
    const formatCourseForDisplay = (course, courseType) => {
      const startDate = new Date(course.schedule?.startDate);
      const endDate = course.schedule?.endDate
        ? new Date(course.schedule.endDate)
        : null;

      // Calculate days until course starts
      const now = new Date();
      const daysUntilStart = Math.ceil(
        (startDate - now) / (1000 * 60 * 60 * 24)
      );

      // Get course type display info
      let typeIcon, typeColor, typeName;
      if (courseType === "InPersonAestheticTraining") {
        typeIcon = "fas fa-user-md";
        typeColor = "#28a745";
        typeName = "In-Person Training";
      } else {
        typeIcon = "fas fa-video";
        typeColor = "#007bff";
        typeName = "Online Live Training";
      }

      return {
        id: course._id,
        title: course.basic?.title || "Course Title",
        description:
          course.basic?.description || "Course description not available.",
        courseType: courseType,
        typeIcon: typeIcon,
        typeColor: typeColor,
        typeName: typeName,
        startDate: startDate,
        endDate: endDate,
        daysUntilStart: daysUntilStart,
        duration: course.schedule?.duration || "Duration TBD",
        status: course.basic?.status || "draft",
        price: course.enrollment?.price || 0,
        currency: course.enrollment?.currency || "USD",
        seatsAvailable: course.enrollment?.seatsAvailable || 0,
        currentEnrollment: course.enrollment?.currentEnrollment || 0,
        availableSeats: Math.max(
          0,
          (course.enrollment?.seatsAvailable || 0) -
            (course.enrollment?.currentEnrollment || 0)
        ),
        instructorName: course.instructors?.primary?.name || "Instructor TBD",

        // Type-specific information
        location:
          courseType === "InPersonAestheticTraining"
            ? `${course.venue?.city || "Location TBD"}, ${
                course.venue?.country || ""
              }`
            : "Online",
        platform:
          courseType === "OnlineLiveTraining"
            ? course.platform?.name || "Online Platform"
            : null,
        venue:
          courseType === "InPersonAestheticTraining"
            ? course.venue?.name || "Venue TBD"
            : null,

        // Formatted dates for display
        formattedStartDate: startDate.toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        formattedStartTime:
          course.schedule?.sessionTime?.startTime ||
          course.schedule?.timeSlots?.startTime ||
          "09:00",
        formattedEndTime:
          course.schedule?.sessionTime?.endTime ||
          course.schedule?.timeSlots?.endTime ||
          "17:00",

        // Registration info
        registrationDeadline: course.schedule?.registrationDeadline || null,
        registrationUrl:
          course.contact?.registrationUrl ||
          course.enrollment?.registrationUrl ||
          "#register",

        // Contact info
        contactEmail:
          course.contact?.email || course.support?.email || "info@iaa-i.com",
        contactPhone:
          course.contact?.phone ||
          course.contact?.whatsapp ||
          "+90 536 745 86 66",

        // Urgency and status classes
        urgencyClass:
          daysUntilStart <= 7
            ? "urgent"
            : daysUntilStart <= 14
            ? "soon"
            : "normal",
        statusClass:
          course.basic?.status === "open"
            ? "open"
            : course.basic?.status === "full"
            ? "full"
            : "draft",
      };
    };

    // Get upcoming courses (next 90 days, starting from today)
    const upcomingCourses = [];
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + 90); // Next 90 days

    // Fetch upcoming In-Person courses
    console.log("🔍 Searching for upcoming In-Person courses...");
    const upcomingInPerson = await InPersonAestheticTraining.find({
      "schedule.startDate": {
        $gte: now,
        $lte: futureLimit,
      },
      "basic.status": { $in: ["open", "draft", "full"] },
    })
      .sort({ "schedule.startDate": 1 })
      .limit(10);

    upcomingInPerson.forEach((course) => {
      upcomingCourses.push(
        formatCourseForDisplay(course, "InPersonAestheticTraining")
      );
    });

    // Fetch upcoming Online Live courses
    console.log("🔍 Searching for upcoming Online Live courses...");
    const upcomingOnlineLive = await OnlineLiveTraining.find({
      "schedule.startDate": {
        $gte: now,
        $lte: futureLimit,
      },
      "basic.status": { $in: ["open", "draft", "full"] },
    })
      .sort({ "schedule.startDate": 1 })
      .limit(10);

    upcomingOnlineLive.forEach((course) => {
      upcomingCourses.push(
        formatCourseForDisplay(course, "OnlineLiveTraining")
      );
    });

    // Sort all upcoming courses by start date and take top 6
    upcomingCourses.sort((a, b) => a.startDate - b.startDate);
    const nextSixCourses = upcomingCourses.slice(0, 6);

    console.log(
      `📊 Found ${upcomingCourses.length} upcoming courses, showing ${nextSixCourses.length}`
    );

    // Prepare news content
    const latestNews = {
      latestNewsTitle:
        homepageContent?.latestNewsTitle || "IAAI Training Programs Update",
      latestNewsDes:
        homepageContent?.latestNewsDes ||
        "Stay updated with our latest training programs",
      latestNewsDetails:
        homepageContent?.latestNewsDetails ||
        "Discover our comprehensive aesthetic training programs designed for medical professionals.",
      latestNewsImage:
        homepageContent?.latestNewsImage || "/images/image8.jpeg",

      latest1Title: homepageContent?.latest1Title || "Latest Update 1",
      latest1Detail:
        homepageContent?.latest1Detail ||
        "Stay tuned for updates on our training programs.",
      latest1Image: homepageContent?.latest1Image || "/images/image10.jpeg",

      latest2Title: homepageContent?.latest2Title || "Latest Update 2",
      latest2Detail:
        homepageContent?.latest2Detail || "More information coming soon.",
      latest2Image: homepageContent?.latest2Image || "/images/image11.jpeg",

      latest3Title: homepageContent?.latest3Title || "Latest Update 3",
      latest3Detail:
        homepageContent?.latest3Detail || "Additional updates available.",
      latest3Image: homepageContent?.latest3Image || "/images/image12.jpeg",
    };

    // Render the news details page
    res.render("news-details", {
      latestNews,
      upcomingCourses: nextSixCourses,
      pageTitle: "Latest News & Upcoming Courses - IAAI",
    });
  } catch (error) {
    console.error("❌ Error fetching news details:", error);

    // Render with empty data on error
    res.render("news-details", {
      latestNews: {
        latestNewsTitle: "IAAI Training Programs",
        latestNewsDes: "Professional aesthetic medicine training",
        latestNewsDetails:
          "We provide world-class training programs for medical professionals.",
        latestNewsImage: "/images/image8.jpeg",
        latest1Title: "Training Programs",
        latest1Detail: "Comprehensive training for medical professionals.",
        latest1Image: "/images/image10.jpeg",
        latest2Title: "Global Reach",
        latest2Detail: "Training available in multiple locations.",
        latest2Image: "/images/image11.jpeg",
        latest3Title: "Expert Instructors",
        latest3Detail: "Learn from industry-leading experts.",
        latest3Image: "/images/image12.jpeg",
      },
      upcomingCourses: [],
      pageTitle: "Latest News - IAAI",
      error: "Unable to load upcoming courses at this time.",
    });
  }
};
