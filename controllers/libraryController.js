//libraryController.js - Enhanced with Dual Timezone Support
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const mongoose = require("mongoose");

// ============================================
// ✅ ENHANCED TIMEZONE UTILITY FUNCTIONS
// ============================================

/**
 *
 * Get timezone abbreviation safely
 */
function getTimezoneAbbr(timezone) {
  if (!timezone || timezone === "UTC") return "UTC";

  try {
    const tempDate = new Date();
    return tempDate
      .toLocaleString("en-US", {
        timeZone: timezone,
        timeZoneName: "short",
      })
      .split(" ")
      .pop();
  } catch (error) {
    return timezone;
  }
}

/**
 * Combine course date with session time for accurate display
 */
function combineDateTime(courseDate, sessionTime, timezone) {
  if (!courseDate) return null;

  try {
    // Get the date part
    const date = new Date(courseDate);

    // If we have session time, create a proper datetime
    if (sessionTime) {
      const [hours, minutes] = sessionTime.split(":").map(Number);

      // Create date in the course timezone
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      // Create a date object with the session time
      const combinedDate = new Date();
      combinedDate.setFullYear(year, month, day);
      combinedDate.setHours(hours, minutes || 0, 0, 0);

      return combinedDate;
    }

    return date;
  } catch (error) {
    console.error("DateTime combination error:", error);
    return new Date(courseDate);
  }
}

/**
 * Enhanced date formatter that handles session times
 */
function formatCourseScheduleWithTime(courseDate, sessionTime, timezone) {
  if (!courseDate) return "Schedule TBD";

  try {
    // Combine date and session time
    const combinedDateTime = combineDateTime(courseDate, sessionTime, timezone);

    if (sessionTime && timezone) {
      // Show date + session time in timezone
      const dateStr = combinedDateTime.toLocaleDateString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const timeStr = sessionTime;

      // Add timezone abbreviation
      const tzAbbr = getTimezoneAbbr(timezone);

      return `${dateStr} at ${timeStr} ${tzAbbr}`;
    }

    // Fallback to date only
    return combinedDateTime.toLocaleDateString("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Schedule formatting error:", error);
    return new Date(courseDate).toLocaleDateString();
  }
}

/**
 * ✅ ENHANCED: Format with dual timezone display
 */
function formatWithDualTimezone(
  courseDate,
  sessionTime,
  courseTimezone,
  showDual = true
) {
  if (!courseDate) return "Schedule TBD";

  try {
    const date = new Date(courseDate);

    if (sessionTime && courseTimezone) {
      // Parse session time
      const [hours, minutes] = sessionTime.split(":").map(Number);

      // Create combined datetime
      const combinedDate = new Date(date);
      combinedDate.setHours(hours, minutes || 0, 0, 0);

      // Format in course timezone
      const courseTime = combinedDate.toLocaleString("en-US", {
        timeZone: courseTimezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const courseTzAbbr = getTimezoneAbbr(courseTimezone);

      if (showDual) {
        return {
          primary: `${courseTime} ${courseTzAbbr}`,
          courseTimezone: courseTimezone,
          sessionTime: sessionTime,
          utcTimestamp: combinedDate.getTime(),
          // For JavaScript timezone conversion on frontend
          displayData: {
            year: combinedDate.getFullYear(),
            month: combinedDate.getMonth(),
            day: combinedDate.getDate(),
            hour: hours,
            minute: minutes,
            courseTimezone: courseTimezone,
          },
        };
      }

      return `${courseTime} ${courseTzAbbr}`;
    }

    return date.toLocaleDateString("en-US", {
      timeZone: courseTimezone || "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Dual timezone formatting error:", error);
    return new Date(courseDate).toLocaleDateString();
  }
}

/**
 * Helper: Combine date and time to UTC timestamp
 */
function combineDateTimeToUTC(dateString, timeString, timezone) {
  if (!dateString || !timeString || !timezone) return null;

  try {
    const date = new Date(dateString);
    const [hours, minutes] = timeString.split(":").map(Number);

    // Create date string in format that can be parsed with timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:00`;

    const dateTimeString = `${year}-${month}-${day}T${time}`;

    // Parse as if it's in the course timezone (this is approximate)
    const localDate = new Date(dateTimeString);

    return localDate.getTime();
  } catch (error) {
    console.error("UTC combination error:", error);
    return null;
  }
}

/**
 * Format course date with timezone awareness
 */
function formatCourseDate(dateString, timezone) {
  if (!dateString) return "TBD";

  try {
    const date = new Date(dateString);
    const options = {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };

    return date.toLocaleString("en-US", options);
  } catch (error) {
    console.error("Date formatting error:", error);
    return new Date(dateString).toLocaleString();
  }
}

/**
 * Format course date (date only) with timezone awareness
 */
function formatCourseDateOnly(dateString, timezone) {
  if (!dateString) return "TBD";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return new Date(dateString).toLocaleDateString();
  }
}

// ============================================
// ✅ MAIN CONTROLLER METHODS
// ============================================

/**
 * ✅ COMPLETE: Get Self-Paced Library with Linked Course Support
 * Displays user's self-paced courses with comprehensive progress tracking and linked course awareness
 * ALL DATA FROM USER MODEL: user.mySelfPacedCourses[]
 */
exports.getSelfPacedLibrary = async (req, res) => {
  try {
    console.log(
      "📚 Loading self-paced library (safe mode) for user:",
      req.user.email
    );

    // ✅ SAFE: Basic population without linked course fields
    const user = await User.findById(req.user._id)
      .populate({
        path: "mySelfPacedCourses.courseId",
        model: "SelfPacedOnlineTraining",
        select: "basic content videos instructor media certification", // Removed linked fields
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.redirect("/login");
    }

    console.log(`👤 User: ${user.email}`);
    console.log(
      `📚 Total self-paced enrollments: ${user.mySelfPacedCourses?.length || 0}`
    );

    const selfPacedCourses = [];

    // Process Self-Paced Courses
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      for (const enrollment of user.mySelfPacedCourses) {
        try {
          console.log(`🔄 Processing enrollment:`, {
            courseId: enrollment.courseId?._id?.toString() || "NO ID",
            status: enrollment.enrollmentData?.status,
            hasPopulatedData: !!enrollment.courseId?.basic,
          });

          // Check if user has access
          if (
            enrollment.enrollmentData?.status === "paid" ||
            enrollment.enrollmentData?.status === "registered" ||
            enrollment.enrollmentData?.status === "completed"
          ) {
            const course = enrollment.courseId; // Already populated

            if (course && course.basic) {
              console.log(`✅ Processing course: ${course.basic.title}`);

              // Get user's progress data from USER MODEL
              const userProgress = enrollment.courseProgress || {
                completedVideos: [],
                completedExams: [],
                overallPercentage: 0,
                status: "not-started",
                totalWatchTime: 0,
                averageExamScore: 0,
                lastAccessedAt: new Date(),
              };

              // Create progress maps for efficient lookup
              const videoProgressMap = new Map(
                (enrollment.videoProgress || []).map((vp) => [
                  vp.videoId.toString(),
                  vp,
                ])
              );

              const examProgressMap = new Map(
                (enrollment.examProgress || []).map((ep) => [
                  ep.videoId.toString(),
                  ep,
                ])
              );

              const videoNotesMap = new Map(
                (enrollment.videoNotes || []).map((vn) => [
                  vn.videoId.toString(),
                  vn,
                ])
              );

              // Calculate comprehensive statistics
              const totalVideos = course.videos?.length || 0;
              const completedVideos = userProgress.completedVideos?.length || 0;

              // Count exams
              const videosWithExams =
                course.videos?.filter(
                  (video) => video.exam && video.exam.length > 0
                ) || [];
              const totalExamsAvailable = videosWithExams.length;
              const completedExams = userProgress.completedExams?.length || 0;

              // Calculate total questions across all exams
              const totalQuestions =
                course.videos?.reduce((sum, video) => {
                  return sum + (video.exam ? video.exam.length : 0);
                }, 0) || 0;

              // Comprehensive completion check
              const allVideosWatched =
                totalVideos > 0 && completedVideos === totalVideos;
              const allExamsCompleted =
                totalExamsAvailable === 0 ||
                completedExams === totalExamsAvailable;
              const isCompleted =
                userProgress.status === "completed" &&
                allVideosWatched &&
                allExamsCompleted;

              // Calculate accurate completion percentage
              let overallCompletion = 0;
              if (totalVideos > 0) {
                const videoWeight = totalExamsAvailable > 0 ? 0.7 : 1.0;
                const examWeight = totalExamsAvailable > 0 ? 0.3 : 0.0;

                const videoCompletion =
                  (completedVideos / totalVideos) * videoWeight;
                const examCompletion =
                  totalExamsAvailable > 0
                    ? (completedExams / totalExamsAvailable) * examWeight
                    : 0;

                overallCompletion = Math.round(
                  (videoCompletion + examCompletion) * 100
                );
              }

              // Basic certificate eligibility (no linked course logic for now)
              const certificateEligible =
                isCompleted && allVideosWatched && allExamsCompleted;

              // Process videos with user progress
              const videosWithProgress = course.videos
                ? course.videos
                    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
                    .map((video) => {
                      const videoIdStr = video._id.toString();

                      // Get video progress from USER MODEL
                      const videoProgress = videoProgressMap.get(videoIdStr);
                      const isVideoCompleted =
                        videoProgress?.watchProgress?.isCompleted ||
                        userProgress.completedVideos.includes(videoIdStr);
                      const currentTime =
                        videoProgress?.watchProgress?.currentTime || 0;
                      const watchedPercentage =
                        videoProgress?.watchProgress?.percentageWatched || 0;

                      // Get exam progress from USER MODEL
                      const examProgress = examProgressMap.get(videoIdStr);
                      const hasExam = video.exam && video.exam.length > 0;
                      const examCompleted =
                        examProgress?.isPassed ||
                        userProgress.completedExams.includes(videoIdStr);
                      const examScore = examProgress?.bestScore || null;

                      // Get notes from USER MODEL
                      const videoNotes = videoNotesMap.get(videoIdStr);

                      return {
                        ...video,
                        userProgress: {
                          currentTime: currentTime,
                          isCompleted: isVideoCompleted,
                          hasExam: hasExam,
                          examCompleted: examCompleted,
                          examScore: examScore,
                          canWatch: true,
                          watchedPercentage: watchedPercentage,
                          hasNotes: !!videoNotes?.notes,
                          lastWatched:
                            videoProgress?.watchProgress?.lastWatchedAt,
                          watchCount:
                            videoProgress?.watchProgress?.watchCount || 0,
                        },
                      };
                    })
                : [];

              // Find next video/exam to complete
              const nextVideo = videosWithProgress.find((video) => {
                if (!video.userProgress.isCompleted) return true;
                if (
                  video.userProgress.hasExam &&
                  !video.userProgress.examCompleted
                )
                  return true;
                return false;
              });

              // Calculate additional metrics
              const totalWatchTime = userProgress.totalWatchTime || 0;
              const averageExamScore = userProgress.averageExamScore || null;

              // Check expiry status
              const now = new Date();
              const isExpired =
                enrollment.enrollmentData?.expiryDate &&
                new Date(enrollment.enrollmentData.expiryDate) < now;

              // Calculate days until expiry
              let daysUntilExpiry = null;
              if (enrollment.enrollmentData?.expiryDate) {
                const expiryDate = new Date(
                  enrollment.enrollmentData.expiryDate
                );
                const timeDiff = expiryDate.getTime() - now.getTime();
                daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
              }

              console.log(`✅ Course processed - ${course.basic.title}:`, {
                totalVideos,
                completedVideos,
                totalExams: totalExamsAvailable,
                completedExams,
                completion: overallCompletion,
                status: userProgress.status,
              });

              // Build comprehensive course object
              selfPacedCourses.push({
                // Course details from populated data
                courseId: course._id,
                title: course.basic?.title || "Untitled Course",
                description: course.basic?.description || "",
                courseCode: course.basic?.courseCode || "N/A",
                instructor: course.instructor?.name || "IAAI Team",
                courseType: "SelfPacedOnlineTraining",
                thumbnailUrl:
                  course.media?.thumbnailUrl ||
                  "/images/default-course-thumbnail.jpg",
                difficulty: course.basic?.difficulty || "Beginner",
                estimatedDuration: course.content?.estimatedMinutes || 0,

                // User-specific enrollment data
                dateOfRegistration:
                  enrollment.enrollmentData?.registrationDate || new Date(),
                status: enrollment.enrollmentData?.status || "unknown",
                accessExpiryDate: enrollment.enrollmentData?.expiryDate,
                isExpired: isExpired,
                daysUntilExpiry: daysUntilExpiry,
                paidAmount: enrollment.enrollmentData?.paidAmount || 0,

                // Progress data
                userCourseStatus: {
                  userCourseTotalstatus: isCompleted
                    ? "Completed"
                    : completedVideos > 0 || completedExams > 0
                    ? "In Progress"
                    : "Not Started",
                  completedVideos: userProgress.completedVideos || [],
                  completedExams: userProgress.completedExams || [],
                  completionDate: userProgress.completionDate,
                  overallCompletion: overallCompletion,
                  lastAccessedAt: userProgress.lastAccessedAt,
                },

                // Certificate information (basic for now)
                certificate: {
                  isEligible: certificateEligible,
                  hasBeenIssued: !!enrollment.certificateId,
                  certificateId: enrollment.certificateId || null,
                  canView: certificateEligible && !!enrollment.certificateId,
                  requiresAction:
                    certificateEligible && !enrollment.certificateId,
                },

                // ✅ SAFE: Minimal linked course object (no population)
                linkedCourse: {
                  isLinked: false,
                  linkedToInPerson: false,
                  linkedToOnline: false,
                  inPersonCourse: null,
                  onlineCourse: null,
                },

                // Comprehensive statistics
                stats: {
                  totalVideos: totalVideos,
                  completedVideos: completedVideos,
                  totalExamsAvailable: totalExamsAvailable,
                  completedExams: completedExams,
                  progressPercentage: overallCompletion,
                  videoCompletionRate:
                    totalVideos > 0
                      ? Math.round((completedVideos / totalVideos) * 100)
                      : 0,
                  examCompletionRate:
                    totalExamsAvailable > 0
                      ? Math.round((completedExams / totalExamsAvailable) * 100)
                      : 100,
                  totalQuestions: totalQuestions,
                  totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
                  totalWatchTimeHours: Math.round(totalWatchTime / 3600),
                  averageExamScore: averageExamScore
                    ? Math.round(averageExamScore)
                    : null,
                  estimatedTimeRemaining: Math.max(
                    0,
                    (totalVideos - completedVideos) * 15
                  ),
                },

                // Enhanced video data with user progress
                videos: videosWithProgress,
                nextVideo: nextVideo,
                isCompleted: isCompleted,
                hasVideos: totalVideos > 0,

                // Detailed status information
                statusInfo: {
                  canStartCourse: totalVideos > 0 && !isExpired,
                  canViewCertificate:
                    certificateEligible && !!enrollment.certificateId,
                  canGetCertificate:
                    certificateEligible && !enrollment.certificateId,
                  hasActiveProgress:
                    completedVideos > 0 ||
                    completedExams > 0 ||
                    (enrollment.videoProgress &&
                      enrollment.videoProgress.length > 0),
                  needsAttention:
                    !isCompleted && totalExamsAvailable > completedExams,
                  completionRate: overallCompletion,
                  examCompletionRate:
                    totalExamsAvailable > 0
                      ? Math.round((completedExams / totalExamsAvailable) * 100)
                      : 100,
                  isFullyCompleted: isCompleted,
                  requiresExams: totalExamsAvailable > 0,
                  allVideosWatched: allVideosWatched,
                  allExamsCompleted: allExamsCompleted,
                  isExpiringSoon:
                    daysUntilExpiry !== null &&
                    daysUntilExpiry <= 7 &&
                    daysUntilExpiry > 0,
                  hasRecentActivity:
                    userProgress.lastAccessedAt &&
                    new Date() - new Date(userProgress.lastAccessedAt) <
                      7 * 24 * 60 * 60 * 1000,
                },

                // Quick access information
                quickAccess: {
                  continueUrl: nextVideo
                    ? `/watch-exam/${course._id}/${nextVideo._id}`
                    : `/watch-exam/${course._id}`,
                  examUrl:
                    nextVideo &&
                    nextVideo.userProgress.hasExam &&
                    !nextVideo.userProgress.examCompleted
                      ? `/watch-exam/${course._id}/${nextVideo._id}?exam=true`
                      : null,
                  certificateUrl:
                    certificateEligible && enrollment.certificateId
                      ? `/certificates/view/${enrollment.certificateId}`
                      : null,
                  lastVideoWatched: videosWithProgress.find(
                    (v) => v.userProgress.lastWatched
                  ),
                  totalNotesCount: (enrollment.videoNotes || []).filter(
                    (vn) => vn.notes && vn.notes.trim()
                  ).length,
                },

                // Course metadata
                metadata: {
                  enrollmentId: enrollment._id,
                  lastUpdated: new Date(),
                  dataSource: "USER_MODEL",
                  version: "3.0-safe",
                },
              });
            } else {
              console.log(
                `⚠️ Course data missing or not populated for enrollment`
              );
            }
          } else {
            console.log(
              `⚠️ Skipping course - invalid status: ${enrollment.enrollmentData?.status}`
            );
          }
        } catch (courseError) {
          console.error(`❌ Error processing self-paced course:`, {
            error: courseError.message,
            courseId: enrollment.courseId?._id || "Unknown",
            userId: user._id,
          });
          continue;
        }
      }
    } else {
      console.log("📭 No self-paced course enrollments found");
    }

    // Sort courses by priority and activity
    selfPacedCourses.sort((a, b) => {
      if (a.statusInfo.hasActiveProgress && !b.statusInfo.hasActiveProgress)
        return -1;
      if (!a.statusInfo.hasActiveProgress && b.statusInfo.hasActiveProgress)
        return 1;

      if (a.statusInfo.isExpiringSoon && !b.statusInfo.isExpiringSoon)
        return -1;
      if (!a.statusInfo.isExpiringSoon && b.statusInfo.isExpiringSoon) return 1;

      if (a.statusInfo.hasRecentActivity && !b.statusInfo.hasRecentActivity)
        return -1;
      if (!a.statusInfo.hasRecentActivity && b.statusInfo.hasRecentActivity)
        return 1;

      if (!a.isCompleted && b.isCompleted) return -1;
      if (a.isCompleted && !b.isCompleted) return 1;

      return new Date(b.dateOfRegistration) - new Date(a.dateOfRegistration);
    });

    // Calculate comprehensive library statistics
    const totalCourses = selfPacedCourses.length;
    const completedCourses = selfPacedCourses.filter(
      (course) => course.isCompleted
    ).length;
    const inProgressCourses = selfPacedCourses.filter(
      (course) => course.statusInfo.hasActiveProgress && !course.isCompleted
    ).length;
    const notStartedCourses = selfPacedCourses.filter(
      (course) => !course.statusInfo.hasActiveProgress && !course.isCompleted
    ).length;
    const expiringSoonCourses = selfPacedCourses.filter(
      (course) => course.statusInfo.isExpiringSoon
    ).length;

    const totalVideosInLibrary = selfPacedCourses.reduce(
      (sum, course) => sum + course.stats.totalVideos,
      0
    );
    const totalCompletedVideos = selfPacedCourses.reduce(
      (sum, course) => sum + course.stats.completedVideos,
      0
    );
    const totalExamsInLibrary = selfPacedCourses.reduce(
      (sum, course) => sum + course.stats.totalExamsAvailable,
      0
    );
    const totalCompletedExams = selfPacedCourses.reduce(
      (sum, course) => sum + course.stats.completedExams,
      0
    );
    const totalWatchTimeMinutes = selfPacedCourses.reduce(
      (sum, course) => sum + course.stats.totalWatchTimeMinutes,
      0
    );

    const libraryProgressPercentage =
      totalVideosInLibrary > 0
        ? Math.round((totalCompletedVideos / totalVideosInLibrary) * 100)
        : 0;

    const examProgressPercentage =
      totalExamsInLibrary > 0
        ? Math.round((totalCompletedExams / totalExamsInLibrary) * 100)
        : 100;

    // Enhanced library statistics object
    const libraryStats = {
      totalVideosInLibrary: totalVideosInLibrary,
      totalCompletedVideos: totalCompletedVideos,
      totalExamsInLibrary: totalExamsInLibrary,
      totalCompletedExams: totalCompletedExams,
      libraryProgressPercentage: libraryProgressPercentage,
      examProgressPercentage: examProgressPercentage,
      totalWatchTimeMinutes: totalWatchTimeMinutes,
      totalWatchTimeHours: Math.round(totalWatchTimeMinutes / 60),
      averageTimePerCourse:
        totalCourses > 0 ? Math.round(totalWatchTimeMinutes / totalCourses) : 0,
      courseDistribution: {
        completed: completedCourses,
        inProgress: inProgressCourses,
        notStarted: notStartedCourses,
        expiringSoon: expiringSoonCourses,
      },
      certificatesEarned: completedCourses,
      averageCompletionRate:
        totalCourses > 0
          ? Math.round(
              selfPacedCourses.reduce(
                (sum, course) => sum + course.stats.progressPercentage,
                0
              ) / totalCourses
            )
          : 0,
      hasRecentActivity: selfPacedCourses.some(
        (course) => course.statusInfo.hasRecentActivity
      ),
      coursesNeedingAttention: selfPacedCourses.filter(
        (course) => course.statusInfo.needsAttention
      ).length,
      linkedCourses: 0, // Safe value for now
      coursesWithSuppressedCertificates: 0, // Safe value for now
      libraryHealthScore: Math.round(
        libraryProgressPercentage * 0.4 +
          examProgressPercentage * 0.3 +
          (completedCourses / Math.max(totalCourses, 1)) * 100 * 0.3
      ),
    };

    console.log(`📊 Self-Paced Library Statistics (Safe Mode):`, {
      totalCourses,
      completed: completedCourses,
      inProgress: inProgressCourses,
      libraryProgress: libraryProgressPercentage,
      healthScore: libraryStats.libraryHealthScore,
    });

    // Render the library page
    res.render("library-online", {
      user: req.user,
      myCourses: selfPacedCourses,
      totalCourses: totalCourses,
      completedCourses: completedCourses,
      inProgressCourses: inProgressCourses,
      notStartedCourses: notStartedCourses,
      expiringSoonCourses: expiringSoonCourses,
      libraryStats: libraryStats,
      linkedCourses: 0, // Safe value
      coursesWithSuppressedCertificates: 0, // Safe value
      title: "Your Library - Self-Paced Courses",
      pageType: "self-paced-library",
      lastUpdated: new Date(),
      features: {
        showExpiryWarnings: expiringSoonCourses > 0,
        showProgressCharts: totalCourses > 0,
        showRecommendations: completedCourses > 0,
        enableNotifications: true,
        showLinkedCourseInfo: false, // Disabled for now
      },
    });
  } catch (error) {
    console.error("❌ Error in getSelfPacedLibrary:", error);
    req.flash("error_message", "Error loading your library. Please try again.");
    res.redirect("/dashboard");
  }
};

/**
 * ✅ COMPLETE: Get Live Library with Enhanced Dual Timezone Support
 */
exports.getLiveLibrary = async (req, res) => {
  try {
    console.log(
      "📚 Loading live course library (enhanced timezone) for user:",
      req.user.email
    );

    // ✅ SAFE: Basic population, try linked course population but handle errors
    const user = await User.findById(req.user._id)
      .populate({
        path: "myLiveCourses.courseId",
        model: "OnlineLiveTraining",
        select:
          "basic schedule platform instructors media recording materials assessment certification technical interaction attendance",
        // Note: Removed nested population to avoid errors
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.redirect("/login");
    }

    const liveCourses = [];

    // Process Online Live Training Courses
    if (user.myLiveCourses && user.myLiveCourses.length > 0) {
      for (const enrollment of user.myLiveCourses) {
        try {
          if (
            enrollment.enrollmentData.status === "paid" ||
            enrollment.enrollmentData.status === "registered"
          ) {
            const course = enrollment.courseId;

            if (course) {
              // ✅ SAFE: Assume no linked courses for now
              const isLinkedToInPerson = false;

              // Check if course has ended
              const courseEnded =
                new Date(course.schedule.endDate || course.schedule.startDate) <
                new Date();

              // Calculate attendance percentage
              const totalSessions = course.schedule.sessions?.length || 1;
              const attendedSessions =
                enrollment.userProgress?.sessionsAttended?.length || 0;
              const attendancePercentage =
                totalSessions > 0
                  ? Math.round((attendedSessions / totalSessions) * 100)
                  : 0;

              // Check if meets minimum attendance requirement
              const meetsAttendanceRequirement =
                attendancePercentage >=
                (course.attendance?.minimumRequired || 80);

              // Check attendance confirmation status
              const attendanceConfirmed =
                enrollment.userProgress?.sessionsAttended?.length > 0 ||
                enrollment.userProgress?.courseStatus === "completed";

              // Assessment fields (OUTSIDE userProgress)
              const assessmentRequired =
                course.assessment?.required &&
                course.assessment?.type !== "none";

              const assessmentAttempts = enrollment.assessmentAttempts || [];
              const currentAttempts = assessmentAttempts.length;
              const maxAttempts = (course.assessment?.retakesAllowed || 0) + 1;

              const assessmentCompleted =
                enrollment.assessmentCompleted || false;
              const assessmentScore =
                enrollment.assessmentScore ||
                enrollment.bestAssessmentScore ||
                null;
              const assessmentPassed =
                assessmentScore &&
                assessmentScore >= (course.assessment?.passingScore || 70);

              // ✅ SAFE: Basic certificate eligibility (no linked course logic)
              const canGetCertificate =
                courseEnded &&
                meetsAttendanceRequirement &&
                attendanceConfirmed &&
                (!assessmentRequired ||
                  (assessmentCompleted && assessmentPassed));

              // Check if user already has a certificate for this course
              const existingCertificate = user.myCertificates?.find(
                (cert) =>
                  cert.courseId.toString() === course._id.toString() &&
                  cert.courseType === "OnlineLiveTraining"
              );

              const hasCertificate = !!existingCertificate;
              const certificateId = existingCertificate?.certificateId || null;
              const canViewCertificate = canGetCertificate || hasCertificate;

              console.log(`📊 Live Course: ${course.basic.title}`, {
                courseEnded,
                attendanceConfirmed,
                assessmentRequired,
                assessmentPassed,
                canGetCertificate,
                hasCertificate,
                canViewCertificate,
              });

              // ✅ ENHANCED: Build course object with dual timezone support
              liveCourses.push({
                courseId: course._id,
                title: course.basic?.title || "Untitled Course",
                description: course.basic?.description || "",
                courseCode: course.basic?.courseCode || "N/A",
                instructor: course.instructors?.primary?.name || "IAAI Team",
                courseType: "OnlineLiveTraining",
                dateOfRegistration: enrollment.enrollmentData.registrationDate,
                status: enrollment.enrollmentData.status,

                // ✅ ENHANCED: Raw dates and timezone with dual support
                startDate: course.schedule?.startDate,
                endDate: course.schedule?.endDate,
                timezone: course.schedule?.primaryTimezone || "UTC",

                // ✅ ENHANCED: Session time with dual timezone data
                sessionTime: {
                  startTime: course.schedule?.sessionTime?.startTime || null,
                  endTime: course.schedule?.sessionTime?.endTime || null,
                  breakDuration:
                    course.schedule?.sessionTime?.breakDuration || 15,
                },

                // ✅ ENHANCED: Display info with dual timezone support
                displayInfo: {
                  // Standard displays
                  startDateOnly: formatCourseDateOnly(
                    course.schedule?.startDate,
                    course.schedule?.primaryTimezone
                  ),
                  endDateOnly: formatCourseDateOnly(
                    course.schedule?.endDate,
                    course.schedule?.primaryTimezone
                  ),

                  // ✅ ENHANCED: Dual timezone objects for frontend
                  fullScheduleWithDual: formatWithDualTimezone(
                    course.schedule?.startDate,
                    course.schedule?.sessionTime?.startTime,
                    course.schedule?.primaryTimezone,
                    true
                  ),

                  sessionTimeWithDual:
                    course.schedule?.sessionTime?.startTime &&
                    course.schedule?.sessionTime?.endTime
                      ? {
                          primary: `${
                            course.schedule.sessionTime.startTime
                          } - ${
                            course.schedule.sessionTime.endTime
                          } ${getTimezoneAbbr(
                            course.schedule?.primaryTimezone
                          )}`,
                          courseTimezone: course.schedule?.primaryTimezone,
                          startTime: course.schedule.sessionTime.startTime,
                          endTime: course.schedule.sessionTime.endTime,
                          // For frontend conversion
                          startUtc: combineDateTimeToUTC(
                            course.schedule?.startDate,
                            course.schedule.sessionTime.startTime,
                            course.schedule?.primaryTimezone
                          ),
                          endUtc: combineDateTimeToUTC(
                            course.schedule?.startDate,
                            course.schedule.sessionTime.endTime,
                            course.schedule?.primaryTimezone
                          ),
                        }
                      : { primary: "Time TBD" },

                  // Backward compatibility
                  sessionTimeRange:
                    course.schedule?.sessionTime?.startTime &&
                    course.schedule?.sessionTime?.endTime
                      ? `${course.schedule.sessionTime.startTime} - ${
                          course.schedule.sessionTime.endTime
                        } ${getTimezoneAbbr(course.schedule?.primaryTimezone)}`
                      : "Time TBD",

                  startsAt: formatCourseScheduleWithTime(
                    course.schedule?.startDate,
                    course.schedule?.sessionTime?.startTime,
                    course.schedule?.primaryTimezone
                  ),
                },

                // ✅ FIXED: Enhanced date handling with timezone info
                displayDates: {
                  startDate: formatCourseDate(
                    course.schedule?.startDate,
                    course.schedule?.primaryTimezone
                  ),
                  endDate: formatCourseDate(
                    course.schedule?.endDate,
                    course.schedule?.primaryTimezone
                  ),
                  startDateOnly: formatCourseDateOnly(
                    course.schedule?.startDate,
                    course.schedule?.primaryTimezone
                  ),
                  endDateOnly: formatCourseDateOnly(
                    course.schedule?.endDate,
                    course.schedule?.primaryTimezone
                  ),
                },

                schedule: course.schedule?.duration || "TBD",
                platform: course.platform?.name || "Zoom",
                platformFeatures: course.platform?.features || {},
                courseUrl: course.platform?.accessUrl,
                meetingId: course.platform?.meetingId,
                passcode: course.platform?.passcode,

                // Course materials and resources
                materials: course.materials || {},
                media: course.media || {},
                resources: course.media?.links || [],
                recordings: course.recording?.sessions || [],

                // Course status flags
                courseEnded: courseEnded,
                attendanceConfirmed: attendanceConfirmed,
                attendanceDate: enrollment.userProgress?.completionDate,
                attendancePercentage: attendancePercentage,
                meetsAttendanceRequirement: meetsAttendanceRequirement,
                totalSessions: totalSessions,
                attendedSessions: attendedSessions,

                // Assessment information
                assessmentRequired: assessmentRequired,
                assessmentType: course.assessment?.type,
                assessmentCompleted: assessmentCompleted,
                assessmentScore: assessmentScore,
                assessmentPassed: assessmentPassed,
                passingScore: course.assessment?.passingScore || 70,
                maxAttempts: maxAttempts,
                currentAttempts: currentAttempts,
                assessmentHistory: enrollment.assessmentHistory || [],

                // ✅ SAFE: Basic linked course object (no population)
                linkedCourse: {
                  isLinked: false,
                  linkedCourseType: null,
                  linkedCourseId: null,
                  linkedCourseTitle: null,
                  linkedCourseCode: null,
                  linkType: null,
                  suppressCertificate: false,
                  linkedCourseVenue: null,
                  linkedCourseStartDate: null,
                },

                // Certificate information
                canViewCertificate: canViewCertificate,
                canGetCertificate: canGetCertificate,
                hasCertificate: hasCertificate,
                certificateId: certificateId,
                certificateMessage: null,

                // Certificate requirements status
                certificateRequirements: {
                  courseEnded: courseEnded,
                  attendanceConfirmed: attendanceConfirmed,
                  meetsAttendance: meetsAttendanceRequirement,
                  assessmentRequired: assessmentRequired,
                  assessmentPassed: assessmentPassed || !assessmentRequired,
                  allRequirementsMet: canGetCertificate,
                  isLinkedToInPerson: false,
                  certificateSuppressionReason: null,
                },

                // Course features
                recordingAvailable:
                  course.recording?.enabled &&
                  course.recording?.availability?.forStudents,
                recordingDuration:
                  course.recording?.availability?.duration || 90,
                technical: course.technical || {},
                techCheckRequired: course.technical?.techCheckRequired,
                techCheckDate: course.technical?.techCheckDate,
                techCheckUrl: course.technical?.techCheckUrl,
                interaction: course.interaction || {},
                attendance: course.attendance || {},
              });
            }
          }
        } catch (courseError) {
          console.error(`❌ Error loading live course:`, {
            error: courseError.message,
            courseId: enrollment.courseId?._id || "Unknown",
            userId: user._id,
          });
          continue;
        }
      }
    }

    // Sort by start date
    liveCourses.sort((a, b) => {
      const aDate = new Date(a.startDate);
      const bDate = new Date(b.startDate);
      const now = new Date();

      const aUpcoming = aDate > now;
      const bUpcoming = bDate > now;

      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;

      return aDate - bDate;
    });

    // Calculate statistics
    const totalCourses = liveCourses.length;
    const attendedCourses = liveCourses.filter(
      (course) => course.attendanceConfirmed
    ).length;
    const completedCourses = liveCourses.filter(
      (course) => course.canViewCertificate
    ).length;
    const upcomingCourses = liveCourses.filter(
      (course) => new Date(course.startDate) > new Date()
    ).length;
    const ongoingCourses = liveCourses.filter(
      (course) =>
        new Date(course.startDate) <= new Date() &&
        new Date(course.endDate || course.startDate) >= new Date()
    ).length;

    // Certificate statistics
    const certificatesAvailable = liveCourses.filter(
      (course) => course.hasCertificate
    ).length;
    const certificatesReady = liveCourses.filter(
      (course) => course.canGetCertificate && !course.hasCertificate
    ).length;

    console.log(`📊 Live Library Statistics (Enhanced Timezone Mode):`, {
      totalCourses,
      attendedCourses,
      completedCourses,
      certificatesAvailable,
      certificatesReady,
    });

    res.render("library-live", {
      user: req.user,
      myCourses: liveCourses,
      totalCourses: totalCourses,
      attendedCourses: attendedCourses,
      completedCourses: completedCourses,
      upcomingCourses: upcomingCourses,
      ongoingCourses: ongoingCourses,
      certificatesAvailable: certificatesAvailable,
      certificatesReady: certificatesReady,
      linkedCourses: 0, // Safe value
      coursesWithSuppressedCertificates: 0, // Safe value
      title: "Your Library - Live Online Courses",
    });
  } catch (error) {
    console.error("❌ Error in getLiveLibrary:", error);
    req.flash(
      "error_message",
      "Error loading your live courses. Please try again."
    );
    res.redirect("/dashboard");
  }
};

//new
/**
 * ✅ ENHANCED: Helper method to calculate course timing status
 */
const getCourseTimingStatus = (course) => {
  const now = new Date();
  const startDate = new Date(course.schedule?.startDate);
  const endDate = new Date(
    course.schedule?.endDate || course.schedule?.startDate
  );

  // Add grace period for attendance confirmation
  const gracePeriodEnd = new Date(endDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 days grace period

  return {
    courseStarted: startDate <= now,
    courseEnded: endDate < now,
    courseInProgress: startDate <= now && now <= endDate,
    courseNotStarted: startDate > now,
    withinGracePeriod: now <= gracePeriodEnd,
    daysUntilStart: Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)),
    daysUntilEnd: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
    gracePeriodEnd: gracePeriodEnd,
  };
};
/**
 * ✅ COMPLETE: Get In-Person Library with Fixed Assessment Integration
 * Updated to properly read assessment results from course model
 */
exports.getInPersonLibrary = async (req, res) => {
  try {
    console.log(
      "📚 Loading in-person course library (FIXED assessment reading) for user:",
      req.user.email
    );

    // ✅ ENHANCED: Include assessment results in population
    const user = await User.findById(req.user._id)
      .populate({
        path: "myInPersonCourses.courseId",
        model: "InPersonAestheticTraining",
        select:
          "basic schedule venue instructors media materials assessment certification linkedCourse",
        // ✅ CRITICAL: Ensure assessment results are populated
        options: { lean: false }, // Don't use lean to ensure we get full objects
      })
      .exec();

    if (!user) {
      console.error("❌ User not found");
      return res.redirect("/login");
    }

    console.log(`👤 User: ${user.email}`);
    console.log(
      `📚 Total in-person enrollments: ${user.myInPersonCourses?.length || 0}`
    );

    const inPersonCourses = [];

    // Process In-Person Aesthetic Training Courses
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      for (const enrollment of user.myInPersonCourses) {
        try {
          console.log(`🔄 Processing enrollment:`, {
            courseId: enrollment.courseId?._id?.toString() || "NO ID",
            status: enrollment.enrollmentData?.status,
            hasUserProgress: !!enrollment.userProgress,
          });

          if (
            enrollment.enrollmentData.status === "paid" ||
            enrollment.enrollmentData.status === "registered"
          ) {
            const course = enrollment.courseId;

            if (course) {
              console.log(`✅ Processing course: ${course.basic.title}`);

              // ✅ DEBUGGING: Log course assessment structure
              console.log("🔍 Course assessment structure:", {
                hasAssessment: !!course.assessment,
                assessmentRequired: course.assessment?.required,
                assessmentType: course.assessment?.type,
                hasResults: !!course.assessment?.results,
                resultsCount: course.assessment?.results?.length || 0,
              });

              // Check if course has ended
              const now = new Date();
              const courseEndDate = new Date(
                course.schedule.endDate || course.schedule.startDate
              );
              const courseStartDate = new Date(course.schedule.startDate);

              // Course has ended if current date is after the end date
              const courseEnded = courseEndDate < now;

              // Course is currently running (started but not ended)
              const courseInProgress =
                courseStartDate <= now && courseEndDate >= now;

              // Course hasn't started yet
              const courseNotStarted = courseStartDate > now;

              // ✅ ADD THIS RIGHT HERE
              const timingStatus = getCourseTimingStatus(course);

              console.log("📅 Course Date Status:", {
                now: now.toISOString(),
                startDate: courseStartDate.toISOString(),
                endDate: courseEndDate.toISOString(),
                courseEnded,
                courseInProgress,
                courseNotStarted,
              });

              // Check attendance status
              const attendanceConfirmed =
                enrollment.userProgress?.attendanceRecords?.length > 0 ||
                enrollment.userProgress?.courseStatus === "completed";

              // ✅ NEW: Grace period logic
              const gracePeriodDays = 7;
              const gracePeriodEnd = new Date(
                courseEndDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000
              );
              const canConfirmAttendance =
                !attendanceConfirmed &&
                (courseInProgress || (courseEnded && now <= gracePeriodEnd));

              // ✅ COMPLETELY FIXED: Assessment logic using populated course data
              const assessmentRequired =
                course.assessment?.required &&
                course.assessment?.type !== "none";

              let assessmentCompleted = false;
              let assessmentScore = null;
              let assessmentPassed = false;
              let lastAssessmentDate = null;
              let currentAttempts = 0;
              let hasAttempted = false;

              if (assessmentRequired) {
                console.log(
                  "🔍 Reading assessment results from POPULATED course data for:",
                  course.basic.title
                );

                // ✅ FIXED: Use populated course data directly (no additional DB query needed)
                if (
                  course.assessment?.results &&
                  Array.isArray(course.assessment.results)
                ) {
                  const userResults = course.assessment.results.filter(
                    (result) =>
                      result.userId.toString() === req.user._id.toString()
                  );

                  console.log(
                    `📊 Found ${userResults.length} assessment attempts in course results`
                  );

                  currentAttempts = userResults.length;
                  hasAttempted = currentAttempts > 0;

                  if (userResults.length > 0) {
                    // Sort by attempt number to get latest
                    const sortedResults = userResults.sort(
                      (a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0)
                    );
                    const latestResult = sortedResults[0];

                    assessmentCompleted = true;
                    assessmentScore = latestResult.percentage;
                    assessmentPassed = latestResult.passed;
                    // ✅ FIXED: Use correct field name from your database
                    lastAssessmentDate =
                      latestResult.submittedAt || latestResult.completedAt;

                    console.log(
                      "✅ Assessment result from populated course data:",
                      {
                        score: assessmentScore,
                        passed: assessmentPassed,
                        attemptNumber: latestResult.attemptNumber,
                        submittedAt: lastAssessmentDate,
                        totalResults: userResults.length,
                      }
                    );
                  } else {
                    console.log(
                      "📊 No assessment results found for this user in course model"
                    );
                  }
                } else {
                  console.log(
                    "⚠️ No assessment.results array found in populated course data"
                  );
                  console.log(
                    "🔍 Course assessment object:",
                    course.assessment
                  );
                }

                // ✅ FALLBACK: If no results found in course model, try user model
                if (!hasAttempted) {
                  console.log(
                    "🔄 No results in course model - checking user model fallbacks"
                  );

                  // Fallback 1: User assessment history
                  const userAssessmentHistory =
                    enrollment.userProgress?.assessmentHistory || [];
                  if (userAssessmentHistory.length > 0) {
                    console.log(
                      "📊 Using user model assessmentHistory fallback"
                    );
                    const latestUserAttempt =
                      userAssessmentHistory[userAssessmentHistory.length - 1];

                    assessmentCompleted = true;
                    assessmentScore = latestUserAttempt.score;
                    assessmentPassed = latestUserAttempt.passed;
                    lastAssessmentDate = latestUserAttempt.date;
                    currentAttempts = userAssessmentHistory.length;
                    hasAttempted = true;
                  }
                  // Fallback 2: Legacy fields
                  else if (
                    enrollment.userProgress?.assessmentCompleted ||
                    enrollment.userProgress?.assessmentScore
                  ) {
                    console.log("📊 Using legacy user model fields fallback");
                    const legacyCompleted =
                      enrollment.userProgress.assessmentCompleted || false;
                    const legacyScore =
                      enrollment.userProgress.assessmentScore || null;

                    assessmentCompleted = legacyCompleted;
                    assessmentScore = legacyScore;
                    assessmentPassed =
                      legacyScore &&
                      legacyScore >= (course.assessment?.passingScore || 70);
                    lastAssessmentDate =
                      enrollment.userProgress.lastAssessmentDate;
                    currentAttempts = legacyCompleted ? 1 : 0;
                    hasAttempted = legacyCompleted;
                  }
                }
              }

              const maxAttempts = (course.assessment?.retakesAllowed || 0) + 1;
              const canRetake =
                assessmentRequired &&
                !assessmentPassed &&
                currentAttempts < maxAttempts;

              console.log("🎯 FINAL Assessment Status:", {
                assessmentRequired,
                assessmentCompleted,
                assessmentScore,
                assessmentPassed,
                currentAttempts,
                maxAttempts,
                canRetake,
                hasAttempted,
                lastAssessmentDate,
              });

              // ✅ ENHANCED: Certificate eligibility with detailed reasoning
              let canGetCertificate = false;
              let certificateEligibilityReason = "";

              if (!course.certification?.enabled) {
                certificateEligibilityReason =
                  "Certification not enabled for this course";
              } else if (!courseEnded) {
                certificateEligibilityReason = "Course must be completed first";
              } else if (!attendanceConfirmed) {
                certificateEligibilityReason = "Attendance must be confirmed";
              } else if (
                assessmentRequired &&
                (!assessmentCompleted || !assessmentPassed)
              ) {
                if (!assessmentCompleted) {
                  certificateEligibilityReason = "Assessment must be completed";
                } else {
                  certificateEligibilityReason = `Assessment must be passed (current score: ${assessmentScore}%, required: ${
                    course.assessment?.passingScore || 70
                  }%)`;
                }
              } else {
                canGetCertificate = true;
                certificateEligibilityReason = "All requirements met";
              }

              console.log("🎓 Certificate eligibility:", {
                canGetCertificate,
                reason: certificateEligibilityReason,
                certificationEnabled: course.certification?.enabled,
                courseEnded,
                attendanceConfirmed,
                assessmentRequired,
                assessmentPassed,
              });

              // Check if user already has a certificate for this course
              const existingCertificate = user.myCertificates?.find(
                (cert) =>
                  cert.courseId.toString() === course._id.toString() &&
                  cert.courseType === "InPersonAestheticTraining"
              );

              const hasCertificate = !!existingCertificate;
              const certificateId = existingCertificate?.certificateId || null;
              const canViewCertificate = canGetCertificate || hasCertificate;

              console.log(`📊 In-Person Course: ${course.basic.title}`, {
                courseEnded,
                attendanceConfirmed,
                assessmentRequired,
                assessmentCompleted,
                assessmentPassed,
                assessmentScore,
                currentAttempts,
                hasAttempted,
                certificationEnabled: course.certification?.enabled,
                canGetCertificate,
                hasCertificate,
                canViewCertificate,
                certificateEligibilityReason,
              });

              // ✅ ENHANCED: Build comprehensive course object
              inPersonCourses.push({
                courseId: course._id,
                title: course.basic?.title || "Untitled Course",
                description: course.basic?.description || "",
                courseCode: course.basic?.courseCode || "N/A",
                instructor: course.instructors?.primary?.name || "IAAI Team",
                courseType: "InPersonAestheticTraining",
                dateOfRegistration: enrollment.enrollmentData.registrationDate,
                status: enrollment.enrollmentData.status,
                startDate: course.schedule?.startDate,
                endDate: course.schedule?.endDate,
                duration: course.schedule?.duration || "TBD",
                location: `${course.venue?.city}, ${course.venue?.country}`,
                venue: course.venue?.name,

                // Course status flags
                courseEnded: courseEnded,
                courseInProgress: courseInProgress,
                courseNotStarted: courseNotStarted,

                timingStatus: timingStatus,
                courseStarted: timingStatus.courseStarted,
                withinGracePeriod: timingStatus.withinGracePeriod,
                attendanceGracePeriodEnd: timingStatus.gracePeriodEnd,
                daysUntilStart: timingStatus.daysUntilStart,
                attendanceConfirmed: attendanceConfirmed,
                canConfirmAttendance: canConfirmAttendance,
                attendanceGracePeriodEnd: gracePeriodEnd,
                attendanceDate: enrollment.userProgress?.completionDate,

                // ✅ FIXED: Assessment information with correct data source
                assessmentRequired: assessmentRequired,
                assessmentType: course.assessment?.type,
                assessmentCompleted: assessmentCompleted,
                assessmentScore: assessmentScore,
                assessmentPassed: assessmentPassed,
                passingScore: course.assessment?.passingScore || 70,
                currentAttempts: currentAttempts,
                maxAttempts: maxAttempts,
                lastAssessmentDate: lastAssessmentDate,
                canRetake: canRetake,
                hasAttempted: hasAttempted,

                // ✅ ENHANCED: Certification information with eligibility reasoning
                certificationEnabled: course.certification?.enabled || false,
                certificateEligibilityReason: certificateEligibilityReason,

                // ✅ ENHANCED: Linked course object (basic support)
                linkedCourse: {
                  isLinked: !!course.linkedCourse?.onlineCourseId,
                  linkedCourseType: course.linkedCourse?.onlineCourseId
                    ? "OnlineLiveTraining"
                    : null,
                  linkedCourseId: course.linkedCourse?.onlineCourseId || null,
                  linkedCourseTitle: null, // Would need population to get this
                  linkedCourseCode: null, // Would need population to get this
                  linkType: course.linkedCourse?.relationship || null,
                  isRequired: course.linkedCourse?.isRequired || false,
                  completionRequired:
                    course.linkedCourse?.completionRequired || false,
                  certificateIssuingRule:
                    course.linkedCourse?.certificateIssuingRule || null,
                  linkedCoursePlatform: null,
                  linkedCourseStartDate: null,
                  isPrerequisite:
                    course.linkedCourse?.relationship === "prerequisite",
                  isSupplementary:
                    course.linkedCourse?.relationship === "supplementary",
                  isFollowUp: course.linkedCourse?.relationship === "follow-up",
                },

                // ✅ UPDATED: Certificate status with proper checks and reasoning
                canViewCertificate: canViewCertificate,
                canGetCertificate: canGetCertificate,
                hasCertificate: hasCertificate,
                certificateId: certificateId,
                certificateMessage: certificateEligibilityReason,

                // ✅ ENHANCED: Certificate requirements summary with detailed breakdown
                certificateRequirements: {
                  courseEnded: courseEnded,
                  attendanceConfirmed: attendanceConfirmed,
                  assessmentRequired: assessmentRequired,
                  assessmentCompleted: assessmentCompleted,
                  assessmentPassed: assessmentPassed || !assessmentRequired,
                  certificationEnabled: course.certification?.enabled || false,
                  allRequirementsMet: canGetCertificate,
                  isLinkedToOnline: !!course.linkedCourse?.onlineCourseId,
                  linkedCourseRequired:
                    course.linkedCourse?.isRequired || false,
                  missingRequirements: [
                    !courseEnded && "Course must be completed",
                    !attendanceConfirmed && "Attendance must be confirmed",
                    assessmentRequired &&
                      !assessmentCompleted &&
                      "Assessment must be taken",
                    assessmentRequired &&
                      assessmentCompleted &&
                      !assessmentPassed &&
                      "Assessment must be passed",
                    !course.certification?.enabled &&
                      "Certification not enabled",
                  ].filter(Boolean),
                },

                // Course materials and resources
                materials: course.materials || {},
                media: course.media || {},
                resources: course.media?.links || [],
                providedMaterials: course.inclusions?.materials,

                // ✅ ENHANCED: Detailed assessment progress tracking
                assessmentProgress: {
                  required: assessmentRequired,
                  available: courseEnded || courseInProgress,
                  canTake:
                    assessmentRequired &&
                    attendanceConfirmed &&
                    (courseEnded || courseInProgress) &&
                    currentAttempts < maxAttempts,
                  status: assessmentRequired
                    ? !hasAttempted
                      ? "not-started"
                      : assessmentPassed
                      ? "passed"
                      : canRetake
                      ? "failed-can-retry"
                      : "failed-no-retries"
                    : "not-required",
                  attemptsUsed: currentAttempts,
                  attemptsRemaining: Math.max(0, maxAttempts - currentAttempts),
                  nextAttemptNumber: currentAttempts + 1,
                  scoreHistory: [], // Could be populated from course.assessment.results if needed
                  bestScore: assessmentScore,
                  locked:
                    !attendanceConfirmed || (!courseEnded && !courseInProgress),
                  lockReason: !attendanceConfirmed
                    ? "Confirm attendance first"
                    : !courseEnded && !courseInProgress
                    ? "Course not started or completed"
                    : null,
                },

                // ✅ ENHANCED: Action recommendations based on current state
                recommendedActions: (() => {
                  const actions = [];

                  if (courseNotStarted) {
                    actions.push({
                      type: "info",
                      title: "Course Upcoming",
                      description: `Course starts ${new Date(
                        course.schedule.startDate
                      ).toLocaleDateString()}`,
                      action: null,
                      urgent: false,
                    });
                  } else if (courseInProgress && !attendanceConfirmed) {
                    actions.push({
                      type: "attendance",
                      title: "Confirm Attendance",
                      description:
                        "Course is in progress - confirm your attendance now",
                      action: "confirm-attendance",
                      urgent: true,
                    });
                  } else if (
                    courseEnded &&
                    !attendanceConfirmed &&
                    canConfirmAttendance
                  ) {
                    actions.push({
                      type: "attendance",
                      title: "Confirm Attendance (Grace Period)",
                      description: `Confirm attendance before ${gracePeriodEnd.toLocaleDateString()}`,
                      action: "confirm-attendance",
                      urgent: true,
                    });
                  } else if (
                    courseEnded &&
                    !attendanceConfirmed &&
                    !canConfirmAttendance
                  ) {
                    actions.push({
                      type: "support",
                      title: "Contact Support",
                      description:
                        "Grace period expired - contact support for assistance",
                      action: "contact-support",
                      urgent: false,
                    });
                  } else if (
                    attendanceConfirmed &&
                    assessmentRequired &&
                    !assessmentCompleted
                  ) {
                    actions.push({
                      type: "assessment",
                      title: "Take Assessment",
                      description:
                        "Complete the required assessment to finish the course",
                      action: "take-assessment",
                      urgent: true,
                    });
                  } else if (
                    attendanceConfirmed &&
                    assessmentRequired &&
                    assessmentCompleted &&
                    !assessmentPassed &&
                    canRetake
                  ) {
                    actions.push({
                      type: "assessment",
                      title: "Retake Assessment",
                      description: `Score: ${assessmentScore}% (need ${
                        course.assessment?.passingScore || 70
                      }%) - ${
                        maxAttempts - currentAttempts
                      } attempts remaining`,
                      action: "retake-assessment",
                      urgent: true,
                    });
                  } else if (
                    attendanceConfirmed &&
                    assessmentRequired &&
                    assessmentCompleted &&
                    !assessmentPassed &&
                    !canRetake
                  ) {
                    actions.push({
                      type: "support",
                      title: "Assessment Attempts Exhausted",
                      description: "Contact support for additional attempts",
                      action: "contact-support",
                      urgent: false,
                    });
                  } else if (canGetCertificate && !hasCertificate) {
                    actions.push({
                      type: "certificate",
                      title: "Generate Certificate",
                      description:
                        "All requirements met - generate your certificate now",
                      action: "generate-certificate",
                      urgent: false,
                    });
                  } else if (hasCertificate) {
                    actions.push({
                      type: "certificate",
                      title: "View Certificate",
                      description: "Your certificate is ready",
                      action: "view-certificate",
                      urgent: false,
                    });
                  }

                  return actions;
                })(),
              });
            } else {
              console.log(`⚠️ Course data missing for enrollment`);
            }
          } else {
            console.log(
              `⚠️ Skipping course - invalid status: ${enrollment.enrollmentData?.status}`
            );
          }
        } catch (courseError) {
          console.error(`❌ Error loading in-person course:`, {
            error: courseError.message,
            stack: courseError.stack,
            courseId: enrollment.courseId?._id || "Unknown",
            userId: user._id,
          });
          continue;
        }
      }
    }

    // ✅ ENHANCED: Sort courses by priority and relevance
    inPersonCourses.sort((a, b) => {
      // Priority 1: Courses needing urgent action
      const aUrgent = a.recommendedActions.some((action) => action.urgent);
      const bUrgent = b.recommendedActions.some((action) => action.urgent);
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      // Priority 2: In progress courses
      if (a.courseInProgress && !b.courseInProgress) return -1;
      if (!a.courseInProgress && b.courseInProgress) return 1;

      // Priority 3: Recently ended courses
      if (a.courseEnded && !b.courseEnded) return -1;
      if (!a.courseEnded && b.courseEnded) return 1;

      // Priority 4: By start date (newest first)
      return new Date(b.startDate) - new Date(a.startDate);
    });

    // ✅ ENHANCED: Calculate comprehensive statistics
    const totalCourses = inPersonCourses.length;
    const attendedCourses = inPersonCourses.filter(
      (course) => course.attendanceConfirmed
    ).length;
    const completedCourses = inPersonCourses.filter(
      (course) => course.canViewCertificate
    ).length;
    const upcomingCourses = inPersonCourses.filter(
      (course) => new Date(course.startDate) > new Date()
    ).length;
    const inProgressCourses = inPersonCourses.filter(
      (course) => course.courseInProgress
    ).length;

    // Certificate statistics
    const certificatesAvailable = inPersonCourses.filter(
      (course) => course.hasCertificate
    ).length;
    const certificatesReady = inPersonCourses.filter(
      (course) => course.canGetCertificate && !course.hasCertificate
    ).length;

    // ✅ ENHANCED: Assessment statistics
    const coursesWithAssessments = inPersonCourses.filter(
      (c) => c.assessmentRequired
    ).length;
    const assessmentsPassed = inPersonCourses.filter(
      (c) => c.assessmentPassed
    ).length;
    const assessmentsPending = inPersonCourses.filter(
      (c) => c.assessmentRequired && !c.assessmentCompleted
    ).length;
    const assessmentsFailed = inPersonCourses.filter(
      (c) =>
        c.assessmentRequired && c.assessmentCompleted && !c.assessmentPassed
    ).length;

    // ✅ ENHANCED: Linked course statistics
    const linkedCourses = inPersonCourses.filter(
      (c) => c.linkedCourse.isLinked
    ).length;

    // ✅ ENHANCED: Urgent actions summary
    const urgentActions = inPersonCourses.reduce((total, course) => {
      return (
        total +
        course.recommendedActions.filter((action) => action.urgent).length
      );
    }, 0);

    // ✅ ENHANCED: Certification eligibility summary
    const coursesWithCertificationEnabled = inPersonCourses.filter(
      (c) => c.certificationEnabled
    ).length;

    console.log(`📊 In-Person Library Statistics (COMPLETELY FIXED):`, {
      totalCourses,
      attendedCourses,
      completedCourses,
      certificatesAvailable,
      certificatesReady,
      coursesWithAssessments,
      assessmentsPassed,
      assessmentsPending,
      assessmentsFailed,
      coursesWithCertificationEnabled,
      linkedCourses,
      urgentActions,
      inProgressCourses,
      upcomingCourses,
    });

    // ✅ ENHANCED: Render with comprehensive data
    res.render("library-in-person", {
      user: req.user,
      myCourses: inPersonCourses,

      // Basic statistics
      totalCourses: totalCourses,
      attendedCourses: attendedCourses,
      completedCourses: completedCourses,
      upcomingCourses: upcomingCourses,
      inProgressCourses: inProgressCourses,
      certificatesAvailable: certificatesAvailable,
      certificatesReady: certificatesReady,

      // ✅ ENHANCED: Assessment statistics for UI
      assessmentStats: {
        total: coursesWithAssessments,
        passed: assessmentsPassed,
        pending: assessmentsPending,
        failed: assessmentsFailed,
        passRate:
          coursesWithAssessments > 0
            ? Math.round((assessmentsPassed / coursesWithAssessments) * 100)
            : 0,
      },

      // ✅ ENHANCED: Action items for dashboard
      actionItems: {
        urgent: urgentActions,
        certificatesReady: certificatesReady,
        assessmentsPending: assessmentsPending,
        attendanceNeeded: inPersonCourses.filter(
          (c) => c.canConfirmAttendance && !c.attendanceConfirmed
        ).length,
      },

      // ✅ ENHANCED: Feature flags for UI
      features: {
        showAssessmentStats: coursesWithAssessments > 0,
        showCertificationStats: coursesWithCertificationEnabled > 0,
        showUrgentActions: urgentActions > 0,
        showProgressTracking: totalCourses > 0,
        enableAdvancedFiltering: totalCourses > 3,
        showLinkedCourseInfo: linkedCourses > 0,
      },

      linkedCourses: linkedCourses,
      title: "Your Library - In-Person Courses",
      pageType: "in-person-library",
      lastUpdated: new Date(),
      dataVersion: "completely-fixed-v3.0",
    });
  } catch (error) {
    console.error("❌ Error in getInPersonLibrary:", error);
    console.error("❌ Error stack:", error.stack);
    req.flash(
      "error_message",
      "Error loading your in-person courses. Please try again."
    );
    res.redirect("/dashboard");
  }
};

// ✅ ADD THIS RIGHT HERE:
exports.getMasterLibrary = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("📚 Loading master library for user:", userId);

    const User = require("../models/user");
    const user = await User.findById(userId).select(
      "mySelfPacedCourses myLiveCourses myInPersonCourses myCertificates"
    );

    if (!user) {
      req.flash("error_message", "User not found");
      return res.redirect("/dashboard");
    }

    // Calculate aggregated statistics
    const selfPacedCourses = user.mySelfPacedCourses || [];
    const liveCourses = user.myLiveCourses || [];
    const inPersonCourses = user.myInPersonCourses || [];
    const certificates = user.myCertificates || [];

    // Total courses across all types
    const totalCourses =
      selfPacedCourses.length + liveCourses.length + inPersonCourses.length;

    // Count completed courses
    let completedCourses = 0;
    let inProgressCourses = 0;
    let notStartedCourses = 0;

    // Self-paced course stats
    selfPacedCourses.forEach((course) => {
      const progress = course.courseProgress || {};
      if (
        progress.status === "completed" ||
        progress.overallPercentage === 100
      ) {
        completedCourses++;
      } else if (progress.overallPercentage > 0) {
        inProgressCourses++;
      } else {
        notStartedCourses++;
      }
    });

    // Live course stats
    liveCourses.forEach((course) => {
      const progress = course.userProgress || {};
      if (progress.courseStatus === "completed" || course.attendanceConfirmed) {
        completedCourses++;
      } else if (new Date(course.startDate) <= new Date()) {
        inProgressCourses++;
      } else {
        notStartedCourses++;
      }
    });

    // In-person course stats
    inPersonCourses.forEach((course) => {
      const progress = course.userProgress || {};
      if (progress.courseStatus === "completed" || course.attendanceConfirmed) {
        completedCourses++;
      } else if (new Date(course.startDate) <= new Date()) {
        inProgressCourses++;
      } else {
        notStartedCourses++;
      }
    });

    // Calculate study hours and average score (basic implementation)
    let totalStudyHours = 0;
    let totalScores = 0;
    let scoreCount = 0;

    selfPacedCourses.forEach((course) => {
      const progress = course.courseProgress || {};
      if (progress.totalWatchTime) {
        totalStudyHours += Math.round(progress.totalWatchTime / 60); // Convert minutes to hours
      }
      if (progress.averageExamScore) {
        totalScores += progress.averageExamScore;
        scoreCount++;
      }
    });

    const averageScore =
      scoreCount > 0 ? Math.round(totalScores / scoreCount) : 0;

    // Get recent activity (simplified - you can expand this)
    const recentActivity = [];

    // Add recent completions
    certificates.slice(-3).forEach((cert) => {
      recentActivity.push({
        type: "certificate",
        title: cert.courseName || "Course Completed",
        date: cert.issuedAt || cert.dateIssued,
        description: "Certificate earned",
      });
    });

    console.log("📊 Master library stats calculated:", {
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalStudyHours,
      averageScore,
    });

    res.render("librarymaster", {
      user: req.user,
      totalCourses: totalCourses,
      completedCourses: completedCourses,
      inProgressCourses: inProgressCourses,
      notStartedCourses: notStartedCourses,
      totalCertificates: certificates.length,
      totalStudyHours: totalStudyHours,
      averageScore: averageScore,
      recentActivity: recentActivity,
      libraryStats: {
        selfPacedCount: selfPacedCourses.length,
        liveCount: liveCourses.length,
        inPersonCount: inPersonCourses.length,
        totalCompletedVideos: 0, // You can calculate this from courseProgress
        totalVideosInLibrary: 0, // You can calculate this from courseProgress
        libraryProgressPercentage:
          totalCourses > 0
            ? Math.round((completedCourses / totalCourses) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("❌ Error loading master library:", error);
    req.flash("error_message", "Error loading library dashboard");
    res.redirect("/dashboard");
  }
};
/**
 * ✅ FIXED: Confirm Attendance with Proper Percentage Calculation
 * MINIMAL CHANGE - Only updating the attendance calculation logic
 */
exports.confirmAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { courseType } = req.body;
    const userId = req.user._id;

    console.log(
      "✅ Confirming attendance with percentage calculation:",
      courseId,
      "Type:",
      courseType
    );

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let updated = false;
    let linkedCourseInfo = null;

    if (courseType === "OnlineLiveTraining") {
      const enrollment = user.myLiveCourses.find(
        (c) => c.courseId.toString() === courseId
      );

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Course enrollment not found",
        });
      }

      // Initialize userProgress if needed
      if (!enrollment.userProgress) {
        enrollment.userProgress = {};
      }

      // Add attendance record
      if (!enrollment.userProgress.sessionsAttended) {
        enrollment.userProgress.sessionsAttended = [];
      }

      // Check if attendance already confirmed
      if (enrollment.userProgress.sessionsAttended.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Attendance has already been confirmed for this course",
        });
      }

      // Add attendance session
      enrollment.userProgress.sessionsAttended.push({
        sessionDate: new Date(),
        joinTime: new Date(),
        leaveTime: new Date(),
        duration: 120, // Default 2 hours
        attendancePercentage: 100,
      });

      // ✅ FIX: Calculate and set overall attendance percentage
      const totalSessions = 1; // Assuming 1 session for live online
      const attendedSessions = enrollment.userProgress.sessionsAttended.length;
      enrollment.userProgress.overallAttendancePercentage = Math.round(
        (attendedSessions / totalSessions) * 100
      );

      enrollment.userProgress.courseStatus = "completed";
      enrollment.userProgress.completionDate = new Date();
      updated = true;

      console.log(
        "✅ Live course attendance confirmed with percentage:",
        enrollment.userProgress.overallAttendancePercentage
      );
    } else if (courseType === "InPersonAestheticTraining") {
      const enrollment = user.myInPersonCourses.find(
        (c) => c.courseId.toString() === courseId
      );

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: "Course enrollment not found",
        });
      }

      // Initialize userProgress if needed
      if (!enrollment.userProgress) {
        enrollment.userProgress = {};
      }
      if (!enrollment.userProgress.attendanceRecords) {
        enrollment.userProgress.attendanceRecords = [];
      }

      // Check if attendance already confirmed
      if (enrollment.userProgress.attendanceRecords.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Attendance has already been confirmed for this course",
        });
      }

      // Add attendance record
      enrollment.userProgress.attendanceRecords.push({
        date: new Date(),
        checkIn: new Date(),
        checkOut: new Date(),
        hoursAttended: 8, // Default 8 hours
        status: "present",
      });

      // ✅ CRITICAL FIX: Calculate and set overall attendance percentage
      const totalRecords = enrollment.userProgress.attendanceRecords.length;
      const presentRecords = enrollment.userProgress.attendanceRecords.filter(
        (record) => record.status === "present"
      ).length;

      // Calculate percentage: (present records / total records) * 100
      enrollment.userProgress.overallAttendancePercentage = Math.round(
        (presentRecords / totalRecords) * 100
      );

      // For single-day courses, if user is present, it's 100%
      if (presentRecords > 0 && totalRecords === 1) {
        enrollment.userProgress.overallAttendancePercentage = 100;
      }

      enrollment.userProgress.courseStatus = "completed";
      enrollment.userProgress.completionDate = new Date();
      updated = true;

      console.log(
        "✅ In-person attendance confirmed with percentage:",
        enrollment.userProgress.overallAttendancePercentage
      );
    }

    if (updated) {
      await user.save();
      console.log(
        "✅ User saved successfully with calculated attendance percentage"
      );

      res.json({
        success: true,
        message:
          "Attendance confirmed successfully! You can now take the assessment.",
        canViewCertificate: false,
        needsAssessment: true,
        linkedCourseInfo: linkedCourseInfo,

        // ✅ Return the calculated percentage for confirmation
        attendancePercentage:
          courseType === "InPersonAestheticTraining"
            ? user.myInPersonCourses.find(
                (c) => c.courseId.toString() === courseId
              ).userProgress.overallAttendancePercentage
            : user.myLiveCourses.find((c) => c.courseId.toString() === courseId)
                .userProgress.overallAttendancePercentage,

        nextSteps: [
          "Take the assessment to complete the course",
          "Your certificate will be available after assessment completion",
        ],

        actions: {
          assessmentUrl:
            courseType === "OnlineLiveTraining"
              ? `/library/online-live/assessment/${courseId}`
              : `/library/in-person/assessment/${courseId}`,
          libraryUrl:
            courseType === "OnlineLiveTraining"
              ? "/library/live"
              : "/library/in-person",
        },
      });
    } else {
      console.log("❌ No enrollment found for course type:", courseType);
      res.status(404).json({
        success: false,
        message: "Course enrollment not found",
      });
    }
  } catch (error) {
    console.error("❌ Error confirming attendance:", error);
    res.status(500).json({
      success: false,
      message: "Error confirming attendance. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
/**
 * ✅ COMPLETE: Online Live Assessment Submission with Enhanced Error Handling
 */
exports.submitOnlineLiveAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body;
    const userId = req.user._id;

    console.log(
      "📝 Processing online assessment submission for course:",
      courseId
    );

    const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
    const course = await OnlineLiveTraining.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      return res.status(400).json({
        success: false,
        message: "This course does not require an assessment",
      });
    }

    const user = await User.findById(userId);
    const enrollmentIndex = user.myLiveCourses.findIndex(
      (c) => c.courseId.toString() === courseId
    );

    if (enrollmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "You are not enrolled in this course",
      });
    }

    const enrollment = user.myLiveCourses[enrollmentIndex];

    // ✅ CORRECTED: Initialize assessment arrays OUTSIDE userProgress
    if (!enrollment.assessmentAttempts) {
      enrollment.assessmentAttempts = [];
    }
    if (!enrollment.assessmentHistory) {
      enrollment.assessmentHistory = [];
    }

    // ✅ CORRECTED: Get current attempts using OUTSIDE userProgress structure
    const currentAttempts = enrollment.assessmentAttempts.length;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1;

    // ✅ CORRECTED: Check if already passed using OUTSIDE userProgress
    if (
      enrollment.assessmentCompleted &&
      (enrollment.bestAssessmentScore || 0) >=
        (course.assessment.passingScore || 70)
    ) {
      return res.status(400).json({
        success: false,
        message: "You have already passed this assessment",
      });
    }

    // Check attempt limits
    if (currentAttempts >= maxAttempts) {
      return res.status(400).json({
        success: false,
        message: "You have exceeded the maximum number of attempts",
      });
    }

    // Calculate score and build detailed results
    let correctAnswers = 0;
    let totalPoints = 0;
    const questions = course.assessment.questions || [];
    const detailedResults = [];

    questions.forEach((question, index) => {
      const userAnswer = answers[index];
      const points = question.points || 1;
      totalPoints += points;

      const isCorrect =
        userAnswer !== undefined &&
        parseInt(userAnswer) === question.correctAnswer;

      if (isCorrect) {
        correctAnswers += points;
      }

      detailedResults.push({
        questionIndex: index,
        question: question.question,
        userAnswer: userAnswer !== undefined ? parseInt(userAnswer) : null,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        points: points,
        earnedPoints: isCorrect ? points : 0,
        answers: question.answers,
      });
    });

    const score =
      totalPoints > 0 ? Math.round((correctAnswers / totalPoints) * 100) : 0;
    const passingScore = course.assessment.passingScore || 70;
    const passed = score >= passingScore;

    // ✅ CORRECTED: Add new attempt to OUTSIDE userProgress array
    const newAttempt = {
      attemptNumber: currentAttempts + 1,
      attemptDate: new Date(),
      score: score,
      passed: passed,
      answers: Object.keys(answers).map((key) => ({
        questionIndex: parseInt(key),
        userAnswer: parseInt(answers[key]),
        isCorrect: detailedResults[key]?.isCorrect || false,
      })),
      detailedResults: detailedResults,
    };

    enrollment.assessmentAttempts.push(newAttempt);

    // ✅ CORRECTED: Update summary fields OUTSIDE userProgress
    enrollment.assessmentCompleted = passed;
    enrollment.assessmentScore = score; // Latest score
    enrollment.lastAssessmentDate = new Date();

    // ✅ CORRECTED: Update best score OUTSIDE userProgress
    if (
      !enrollment.bestAssessmentScore ||
      score > enrollment.bestAssessmentScore
    ) {
      enrollment.bestAssessmentScore = score;
    }

    // ✅ CORRECTED: Add to assessment history OUTSIDE userProgress
    enrollment.assessmentHistory.push({
      attemptNumber: currentAttempts + 1,
      date: new Date(),
      score: score,
      passed: passed,
      answers: answers,
      totalQuestions: questions.length,
      correctAnswers: Math.round(correctAnswers),
      detailedResults: detailedResults,
    });

    // Update the user document
    user.myLiveCourses[enrollmentIndex] = enrollment;
    await user.save();

    console.log(
      `✅ Assessment submitted successfully. Score: ${score}%, Passed: ${passed}`
    );

    // ✅ FIXED: Calculate values first, then use them in responseData
    const canRetake = !passed && currentAttempts + 1 < maxAttempts;
    const attemptsRemaining = Math.max(0, maxAttempts - (currentAttempts + 1));

    // ✅ Enhanced responseData for modern UI
    const responseData = {
      success: true,
      passed: passed,
      score: score,
      passingScore: passingScore,

      // Attempt information
      currentAttempts: currentAttempts + 1,
      totalAttempts: maxAttempts,
      attemptsRemaining: attemptsRemaining,
      canRetake: canRetake,

      // Results data
      totalQuestions: questions.length,
      correctAnswers: Math.round(correctAnswers),
      detailedResults: detailedResults,

      // Progress information
      bestScore: enrollment.bestAssessmentScore,
      attemptHistory: enrollment.assessmentHistory.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        passed: attempt.passed,
        date: attempt.date,
      })),

      // Messages for UI
      title: passed
        ? "🎉 Congratulations!"
        : canRetake
        ? "Almost There!"
        : "Assessment Not Passed",
      message: passed
        ? `Excellent work! You passed with ${score}%`
        : canRetake
        ? `You scored ${score}%. You need ${passingScore}% to pass. You have ${attemptsRemaining} attempt(s) remaining.`
        : `You scored ${score}%. You have used all available attempts.`,

      // Next steps
      nextSteps: passed
        ? [
            "Return to your library to complete the course",
            "Confirm your attendance to receive your certificate",
            "Share your achievement with others",
          ]
        : canRetake
        ? [
            "Review your results and course materials",
            "Take the assessment again when ready",
            `You have ${attemptsRemaining} attempt(s) remaining`,
          ]
        : [
            "Contact support for additional attempts if needed",
            "Review course materials for better preparation",
            "Consider retaking the live course if available",
          ],

      // Action URLs
      actions: {
        libraryUrl: "/library/live",
        retakeUrl: passed
          ? null
          : `/library/online-live/assessment/${courseId}`,
        supportUrl: "/contact",
        courseUrl: `/online-live-training/courses/${courseId}`,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("❌ Error submitting online assessment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing assessment submission. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * ✅ COMPLETE: Get Online Live Assessment with Enhanced Validation
 */
exports.getOnlineLiveAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
    const course = await OnlineLiveTraining.findById(courseId).select(
      "basic assessment schedule platform attendance"
    );

    if (!course) {
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      req.flash("info_message", "This course does not require an assessment.");
      return res.redirect(`/library/live`);
    }

    const user = await User.findById(userId);
    const enrollment = user.myLiveCourses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!enrollment) {
      return res.status(404).render("error", {
        message: "You are not enrolled in this course",
        user: req.user,
      });
    }

    // Check if course has ended
    const courseEnded =
      new Date(course.schedule.endDate || course.schedule.startDate) <
      new Date();
    if (!courseEnded) {
      return res.status(400).render("error", {
        message: "Assessment is only available after the course has ended",
        user: req.user,
      });
    }

    // ✅ FIXED: Enhanced attendance validation
    const totalSessions = course.schedule.sessions?.length || 1;
    const attendedSessions =
      enrollment.userProgress?.sessionsAttended?.length || 0;
    const attendancePercentage =
      totalSessions > 0
        ? Math.round((attendedSessions / totalSessions) * 100)
        : 0;

    const hasConfirmedAttendance = attendedSessions > 0;
    const courseStatusCompleted =
      enrollment.userProgress?.courseStatus === "completed";
    const meetsAttendancePercentage =
      attendancePercentage >= (course.attendance?.minimumRequired || 80);

    const canAccessAssessment =
      hasConfirmedAttendance ||
      courseStatusCompleted ||
      meetsAttendancePercentage;

    if (!canAccessAssessment) {
      return res.status(400).render("error", {
        message: `Please confirm your attendance first before taking the assessment. Go back to your library and click "Confirm Attendance".`,
        user: req.user,
      });
    }

    // ✅ CRITICAL: Initialize assessment arrays OUTSIDE userProgress (consistency)
    if (!enrollment.assessmentAttempts) {
      enrollment.assessmentAttempts = [];
    }
    if (!enrollment.assessmentHistory) {
      enrollment.assessmentHistory = [];
    }

    // ✅ ALIGNED: Get assessment data using OUTSIDE userProgress structure
    const assessmentHistory = enrollment.assessmentHistory || [];
    const currentAttempts = enrollment.assessmentAttempts.length;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1;
    const canTakeAssessment = currentAttempts < maxAttempts;

    // ✅ CRITICAL ALIGNMENT: Calculate status flags consistently for view
    const assessmentCompleted = enrollment.assessmentCompleted || false;
    const assessmentScore =
      enrollment.assessmentScore || enrollment.bestAssessmentScore || null;
    const passingScore = course.assessment?.passingScore || 70;
    const hasPassedAssessment =
      assessmentCompleted && assessmentScore >= passingScore;

    console.log(`🔍 Online Live Assessment Status (ALIGNED):`, {
      courseId: courseId,
      userId: userId,
      hasConfirmedAttendance: hasConfirmedAttendance,
      attendancePercentage: attendancePercentage,
      canAccessAssessment: canAccessAssessment,
      assessmentCompleted: assessmentCompleted,
      assessmentScore: assessmentScore,
      passingScore: passingScore,
      hasPassedAssessment: hasPassedAssessment,
      currentAttempts: currentAttempts,
      maxAttempts: maxAttempts,
      canTakeAssessment: canTakeAssessment,
      assessmentHistoryLength: assessmentHistory.length,
    });

    // ✅ ENHANCED: Render with aligned data structure
    res.render("online-live-assessment", {
      user: req.user,
      course: course,
      assessment: course.assessment,

      // ✅ ALIGNED: Assessment history data
      assessmentHistory: assessmentHistory,
      currentAttempts: currentAttempts,
      maxAttempts: maxAttempts,
      canTakeAssessment: canTakeAssessment,

      // ✅ ALIGNED: Status flags that view expects
      assessmentCompleted: assessmentCompleted,
      hasPassedAssessment: hasPassedAssessment,
      assessmentScore: assessmentScore,
      passingScore: passingScore,

      // ✅ ALIGNED: Attendance info for display
      attendancePercentage: attendancePercentage,
      hasConfirmedAttendance: hasConfirmedAttendance,
      attendedSessions: attendedSessions,
      totalSessions: totalSessions,

      // ✅ ALIGNED: Course type identifiers
      courseType: "OnlineLiveTraining",
      courseTypeForUrl: "online-live",

      title: `Assessment - ${course.basic.title}`,
    });
  } catch (error) {
    console.error("❌ Error loading online assessment:", error);
    res.status(500).render("error", {
      message: "Error loading assessment",
      user: req.user,
    });
  }
};

/**
 * ✅ CRITICAL FIX: Assessment Submission with Proper User Model Sync
 * This ensures assessment results are saved to BOTH course model AND user model
 */
exports.submitInPersonAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers, timeSpent } = req.body;
    const userId = req.user._id;

    console.log(
      "📝 FIXED: Processing in-person assessment with dual model sync:",
      courseId
    );

    // Get the course document
    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const course = await InPersonAestheticTraining.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      return res.status(400).json({
        success: false,
        message: "This course does not require an assessment",
      });
    }

    // Get user enrollment
    const user = await User.findById(userId);
    const enrollment = user.myInPersonCourses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "You are not enrolled in this course",
      });
    }

    // Check attendance requirement
    const attendanceConfirmed =
      enrollment.userProgress?.attendanceRecords?.length > 0 ||
      enrollment.userProgress?.courseStatus === "completed";

    if (!attendanceConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Please confirm your attendance before taking the assessment",
      });
    }

    // Convert answers to array format
    const answersArray = [];
    const questions = course.assessment.questions || [];

    questions.forEach((question, index) => {
      const userAnswer = answers[index];
      if (userAnswer !== undefined) {
        answersArray[index] = parseInt(userAnswer);
      }
    });

    console.log(
      "🔧 Step 1: Saving to course model using submitAssessmentResults"
    );

    // ✅ STEP 1: Save to COURSE MODEL (existing working code)
    const courseResult = await course.submitAssessmentResults(
      userId,
      answersArray,
      timeSpent || 0
    );

    console.log("✅ Course model result:", {
      attemptNumber: courseResult.attemptNumber,
      score: courseResult.percentage,
      passed: courseResult.passed,
    });

    // ✅ STEP 2: CRITICAL FIX - Also save to USER MODEL
    console.log("🔧 Step 2: Syncing to user model");

    // Initialize user progress arrays if needed
    if (!enrollment.userProgress) {
      enrollment.userProgress = {};
    }
    if (!enrollment.userProgress.assessmentAttempts) {
      enrollment.userProgress.assessmentAttempts = [];
    }

    // ✅ CRITICAL: Add assessment attempt to USER MODEL
    const userAssessmentAttempt = {
      attemptNumber: courseResult.attemptNumber,
      attemptDate: new Date(),
      assessmentType: "combined",
      scores: {
        practicalScore: 0, // In-person courses may have practical component
        theoryScore: courseResult.percentage,
        totalScore: courseResult.percentage,
        maxPossibleScore: 100,
      },
      passed: courseResult.passed,
      answers: courseResult.responses.map((response, index) => ({
        questionIndex: response.questionIndex,
        questionText: questions[index]?.question || "",
        userAnswer: response.selectedAnswer,
        correctAnswer: questions[index]?.correctAnswer,
        isCorrect: response.isCorrect,
        points: questions[index]?.points || 1,
        earnedPoints: response.pointsEarned,
        category: "theory",
      })),
      timeSpent: timeSpent || 0,
      instructorNotes: "",
      retakeAllowed:
        !courseResult.passed &&
        courseResult.attemptNumber <
          (course.assessment.retakesAllowed || 0) + 1,
    };

    enrollment.userProgress.assessmentAttempts.push(userAssessmentAttempt);

    // ✅ CRITICAL: Update USER MODEL summary fields that certificate controller reads
    enrollment.assessmentCompleted = courseResult.passed;
    enrollment.assessmentScore = courseResult.percentage;
    enrollment.bestAssessmentScore = Math.max(
      enrollment.bestAssessmentScore || 0,
      courseResult.percentage
    );
    enrollment.lastAssessmentDate = new Date();
    enrollment.currentAttempts = courseResult.attemptNumber;
    enrollment.totalAttempts = courseResult.attemptNumber;

    // Update practical/theory flags
    enrollment.practicalAssessmentPassed = courseResult.passed;
    enrollment.theoryAssessmentPassed = courseResult.passed;

    console.log("✅ User model updated with:", {
      assessmentCompleted: enrollment.assessmentCompleted,
      assessmentScore: enrollment.assessmentScore,
      bestAssessmentScore: enrollment.bestAssessmentScore,
      currentAttempts: enrollment.currentAttempts,
    });

    // ✅ STEP 3: Save user document
    await user.save();
    console.log("✅ User document saved successfully");

    // ✅ Enhanced response
    res.json({
      success: true,
      passed: courseResult.passed,
      score: courseResult.percentage,
      totalScore: courseResult.totalScore,
      totalPossibleScore: courseResult.totalPossibleScore,
      passingScore: course.assessment.passingScore || 70,
      attemptNumber: courseResult.attemptNumber,

      // Attempt information
      currentAttempts: courseResult.attemptNumber,
      maxAttempts: (course.assessment.retakesAllowed || 0) + 1,
      canRetake:
        !courseResult.passed &&
        courseResult.attemptNumber <
          (course.assessment.retakesAllowed || 0) + 1,

      // Detailed results
      responses: courseResult.responses,
      detailedResults: courseResult.responses.map((response, index) => {
        const question = questions[index];
        return {
          questionIndex: response.questionIndex,
          question: question?.question || "",
          userAnswer: response.selectedAnswer,
          correctAnswer: question?.correctAnswer,
          isCorrect: response.isCorrect,
          points: question?.points || 1,
          earnedPoints: response.pointsEarned,
          answers: question?.answers || [],
        };
      }),

      // ✅ CRITICAL: Certificate eligibility check
      canGetCertificate:
        courseResult.passed &&
        enrollment.userProgress?.overallAttendancePercentage >= 80,

      // Messages
      message: courseResult.passed
        ? `Congratulations! You passed with ${courseResult.percentage}%`
        : `You scored ${courseResult.percentage}%. You need ${
            course.assessment.passingScore || 70
          }% to pass.`,

      // Next steps based on result
      nextSteps: courseResult.passed
        ? [
            "Your assessment has been completed successfully",
            "Return to your library to generate your certificate",
            "Share your achievement with your network",
          ]
        : [
            "Review the questions you missed",
            "Study the course materials again",
            courseResult.attemptNumber <
            (course.assessment.retakesAllowed || 0) + 1
              ? "You can retake the assessment"
              : "Contact support for additional attempts",
          ],

      // Action URLs
      actions: {
        libraryUrl: "/library/in-person",
        certificateUrl: courseResult.passed
          ? `/certificates/generate/${courseId}?type=InPersonAestheticTraining`
          : null,
        retakeUrl:
          !courseResult.passed &&
          courseResult.attemptNumber <
            (course.assessment.retakesAllowed || 0) + 1
            ? `/library/in-person/assessment/${courseId}`
            : null,
      },
    });
  } catch (error) {
    console.error("❌ Error in FIXED submitInPersonAssessment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing assessment submission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * ✅ COMPLETE: Get In-Person Assessment with Enhanced Validation
 */
/**
/**
 * ✅ FIXED: Get In-Person Assessment with Correct Data Structure
 */
exports.getInPersonAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    // ✅ FIX: Get course with assessment data
    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const course = await InPersonAestheticTraining.findById(courseId).select(
      "basic assessment schedule venue certification"
    );

    if (!course) {
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      req.flash("info_message", "This course does not require an assessment.");
      return res.redirect(`/library/in-person`);
    }

    // ✅ FIX: Get user enrollment
    const user = await User.findById(userId);
    const enrollment = user.myInPersonCourses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!enrollment) {
      return res.status(404).render("error", {
        message: "You are not enrolled in this course",
        user: req.user,
      });
    }

    // ✅ FIX: Check course timing and attendance
    const now = new Date();
    const courseEndDate = new Date(
      course.schedule.endDate || course.schedule.startDate
    );
    const courseStartDate = new Date(course.schedule.startDate);

    const courseEnded = courseEndDate < now;
    const courseInProgress = courseStartDate <= now && courseEndDate >= now;
    const courseNotStarted = courseStartDate > now;

    if (courseNotStarted) {
      return res.status(400).render("error", {
        message: "Assessment is only available during or after the course.",
        user: req.user,
      });
    }

    const attendanceConfirmed =
      enrollment.userProgress?.attendanceRecords?.length > 0 ||
      enrollment.userProgress?.courseStatus === "completed";

    if (!attendanceConfirmed) {
      return res.status(400).render("error", {
        message: `Please confirm your attendance first before taking the assessment. Go back to your library and click "Confirm Attendance".`,
        user: req.user,
      });
    }

    // ✅ CRITICAL FIX: Get assessment history from COURSE MODEL
    const userAssessmentResults =
      course.assessment.results?.filter(
        (result) => result.userId.toString() === userId.toString()
      ) || [];

    const currentAttempts = userAssessmentResults.length;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1;
    const canTakeAssessment = currentAttempts < maxAttempts;

    // ✅ FIX: Get latest result from course model
    const latestResult =
      userAssessmentResults.length > 0
        ? userAssessmentResults[userAssessmentResults.length - 1]
        : null;

    const hasPassedAssessment = latestResult ? latestResult.passed : false;
    const assessmentScore = latestResult ? latestResult.percentage : null;
    const assessmentCompleted = !!latestResult;

    console.log(`🔍 In-Person Assessment Status (Using Course Model):`, {
      courseId,
      userId,
      attendanceConfirmed,
      currentAttempts,
      maxAttempts,
      canTakeAssessment,
      hasPassedAssessment,
      assessmentScore,
      assessmentCompleted,
      totalResultsInCourse: course.assessment.results?.length || 0,
      userResultsFound: userAssessmentResults.length,
    });

    res.render("in-person-assessment", {
      user: req.user,
      course: course,
      assessment: course.assessment,

      // ✅ FIX: Use course model data
      assessmentHistory: userAssessmentResults.map((result) => ({
        attemptNumber: result.attemptNumber,
        score: result.percentage,
        passed: result.passed,
        date: result.completedAt,
        totalQuestions: result.responses?.length || 0,
        correctAnswers:
          result.responses?.filter((r) => r.isCorrect).length || 0,
      })),

      currentAttempts: currentAttempts,
      maxAttempts: maxAttempts,
      canTakeAssessment: canTakeAssessment,
      hasPassedAssessment: hasPassedAssessment,
      assessmentCompleted: assessmentCompleted,
      assessmentScore: assessmentScore,
      attendanceConfirmed: attendanceConfirmed,

      // ✅ ADD: Explicit course type for the view
      courseType: "InPersonAestheticTraining",
      courseTypeForUrl: "in-person",

      title: `Assessment - ${course.basic.title}`,
    });
  } catch (error) {
    console.error("❌ Error loading in-person assessment:", error);
    res.status(500).render("error", {
      message: "Error loading assessment",
      user: req.user,
    });
  }
};

//new

/**
 * ✅ FIXED: Get In-Person Assessment Results
 */
exports.getInPersonAssessmentResults = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    console.log("📊 Loading in-person assessment results for:", courseId);

    // ✅ FIX: Require the User model at the top of controller
    const User = require("../models/user");
    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");

    const course = await InPersonAestheticTraining.findById(courseId).select(
      "basic assessment schedule venue certification"
    );

    if (!course) {
      console.log("❌ Course not found in database:", courseId);
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      console.log("❌ Course does not have assessment:", courseId);
      req.flash("info_message", "This course does not have an assessment.");
      return res.redirect(`/library/in-person`);
    }

    // Get user enrollment
    const user = await User.findById(userId);
    const enrollment = user.myInPersonCourses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!enrollment) {
      console.log("❌ User not enrolled in course:", courseId);
      return res.status(404).render("error", {
        message: "You are not enrolled in this course",
        user: req.user,
      });
    }

    // Get assessment results from course model
    const userAssessmentResults =
      course.assessment.results?.filter(
        (result) => result.userId.toString() === userId.toString()
      ) || [];

    console.log(`📊 Found ${userAssessmentResults.length} assessment results`);

    if (userAssessmentResults.length === 0) {
      req.flash(
        "info_message",
        "No assessment results found. Please take the assessment first."
      );
      return res.redirect(`/library/in-person/assessment/${courseId}`);
    }

    // Format results for display
    const assessmentHistory = userAssessmentResults
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .map((result) => {
        const questions = course.assessment.questions || [];

        return {
          attemptNumber: result.attemptNumber,
          score: result.percentage,
          passed: result.passed,
          date: result.completedAt,
          totalQuestions: questions.length,
          correctAnswers:
            result.responses?.filter((r) => r.isCorrect).length || 0,
          timeSpent: result.timeSpent || null,
          detailedResults:
            result.responses?.map((response, index) => {
              const question = questions[index];
              return {
                questionIndex: index,
                question: question?.question || "",
                userAnswer: response.selectedAnswer,
                correctAnswer: question?.correctAnswer,
                isCorrect: response.isCorrect,
                points: question?.points || 1,
                earnedPoints: response.pointsEarned || 0,
                answers: question?.answers || [],
              };
            }) || [],
        };
      });

    // Check if user can retake
    const latestResult =
      userAssessmentResults[userAssessmentResults.length - 1];
    const hasPassedAssessment = latestResult ? latestResult.passed : false;
    const canRetake =
      !hasPassedAssessment &&
      userAssessmentResults.length <
        (course.assessment.retakesAllowed || 0) + 1;

    // Check certificate availability
    const existingCertificate = user.myCertificates?.find(
      (cert) =>
        cert.courseId.toString() === courseId &&
        cert.courseType === "InPersonAestheticTraining"
    );
    const canViewCertificate = hasPassedAssessment && !!existingCertificate;

    console.log("✅ Assessment results loaded successfully");

    res.render("assessment-results", {
      user: req.user,
      course: course,
      assessmentHistory: assessmentHistory,
      passingScore: course.assessment.passingScore || 70,
      canRetake: canRetake,
      canViewCertificate: canViewCertificate,
      assessmentUrl: `/library/in-person/assessment/${courseId}`,
      certificateUrl: canViewCertificate
        ? `/certificates/view/${existingCertificate.certificateId}`
        : null,
      libraryUrl: "/library/in-person",
      title: `Assessment Results - ${course.basic.title}`,
    });
  } catch (error) {
    console.error("❌ Error loading in-person assessment results:", error);
    console.error("❌ Stack trace:", error.stack);
    res.status(500).render("error", {
      message: "Error loading assessment results",
      user: req.user,
    });
  }
};

/**
 * ✅ FIXED: Get Online Live Assessment Results
 */
exports.getOnlineLiveAssessmentResults = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    console.log("📊 Loading online live assessment results for:", courseId);

    // ✅ FIX: Require the User model at the top of controller
    const User = require("../models/user");
    const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

    const course = await OnlineLiveTraining.findById(courseId).select(
      "basic assessment schedule platform attendance"
    );

    if (!course) {
      console.log("❌ Course not found in database:", courseId);
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      console.log("❌ Course does not have assessment:", courseId);
      req.flash("info_message", "This course does not have an assessment.");
      return res.redirect(`/library/live`);
    }

    // Get user enrollment
    const user = await User.findById(userId);
    const enrollment = user.myLiveCourses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!enrollment) {
      console.log("❌ User not enrolled in course:", courseId);
      return res.status(404).render("error", {
        message: "You are not enrolled in this course",
        user: req.user,
      });
    }

    // Get assessment history from user enrollment (stored outside userProgress)
    const assessmentHistory = enrollment.assessmentHistory || [];

    console.log(`📊 Found ${assessmentHistory.length} assessment results`);

    if (assessmentHistory.length === 0) {
      req.flash(
        "info_message",
        "No assessment results found. Please take the assessment first."
      );
      return res.redirect(`/library/online-live/assessment/${courseId}`);
    }

    // Sort by attempt number (latest first for display)
    const sortedHistory = assessmentHistory.sort(
      (a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0)
    );

    // Check if user can retake
    const latestAttempt = sortedHistory[0];
    const hasPassedAssessment = latestAttempt ? latestAttempt.passed : false;
    const currentAttempts = assessmentHistory.length;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1;
    const canRetake = !hasPassedAssessment && currentAttempts < maxAttempts;

    // Check certificate availability
    const existingCertificate = user.myCertificates?.find(
      (cert) =>
        cert.courseId.toString() === courseId &&
        cert.courseType === "OnlineLiveTraining"
    );
    const canViewCertificate = hasPassedAssessment && !!existingCertificate;

    console.log("✅ Online live assessment results loaded successfully");

    res.render("assessment-results", {
      user: req.user,
      course: course,
      assessmentHistory: sortedHistory,
      passingScore: course.assessment.passingScore || 70,
      canRetake: canRetake,
      canViewCertificate: canViewCertificate,
      assessmentUrl: `/library/online-live/assessment/${courseId}`,
      certificateUrl: canViewCertificate
        ? `/certificates/view/${existingCertificate.certificateId}`
        : null,
      libraryUrl: "/library/live",
      title: `Assessment Results - ${course.basic.title}`,
    });
  } catch (error) {
    console.error("❌ Error loading online live assessment results:", error);
    console.error("❌ Stack trace:", error.stack);
    res.status(500).render("error", {
      message: "Error loading assessment results",
      user: req.user,
    });
  }
};
// ============================================
// ✅ UTILITY METHODS
// ============================================

/**
 * ✅ Utility: Validate Course Model Methods
 * Helper function to safely check if course model methods exist
 */
const validateCourseMethod = (course, methodName) => {
  try {
    return course && typeof course[methodName] === "function";
  } catch (error) {
    console.warn(
      `⚠️ Error validating course method ${methodName}:`,
      error.message
    );
    return false;
  }
};

/**
 * ✅ Utility: Safe Course Method Call
 * Helper function to safely call course model methods with fallback
 */
const safeCourseMethodCall = async (course, methodName, ...args) => {
  try {
    if (validateCourseMethod(course, methodName)) {
      return await course[methodName](...args);
    }
    return null;
  } catch (error) {
    console.warn(
      `⚠️ Error calling course method ${methodName}:`,
      error.message
    );
    return null;
  }
};

// ============================================
// ✅ BACKWARD COMPATIBILITY
// ============================================

// ========================================
// MASTER LIBRARY HUB METHOD
// ========================================

// Keep the original method for backward compatibility
exports.getLibraryPage = exports.getSelfPacedLibrary;
