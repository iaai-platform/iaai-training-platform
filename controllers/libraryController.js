//libraryController.js - Updated for Optimized User Model
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");

// Self-Paced Library (updated for new structure)
/**
 * Get Self-Paced Library - FINAL COMPLETE VERSION
 * Displays user's self-paced courses with comprehensive progress tracking
 * ALL DATA FROM USER MODEL: user.mySelfPacedCourses[]
 */
exports.getSelfPacedLibrary = async (req, res) => {
  try {
    console.log("📚 Loading self-paced library for user:", req.user.email);

    // ✅ STEP 1: Get user with populated course data from USER MODEL
    const user = await User.findById(req.user._id)
      .populate({
        path: "mySelfPacedCourses.courseId",
        model: "SelfPacedOnlineTraining",
        select: "basic content videos instructor media certification", // Only select needed fields
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.redirect("/login");
    }

    console.log(`👤 User: ${user.email}`);
    console.log(
      `📚 Total self-paced enrollments in USER MODEL: ${
        user.mySelfPacedCourses?.length || 0
      }`
    );

    const selfPacedCourses = [];

    // ✅ STEP 2: Process Self-Paced Courses from USER MODEL
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      for (const enrollment of user.mySelfPacedCourses) {
        try {
          console.log(`🔄 Processing enrollment:`, {
            courseId: enrollment.courseId?._id?.toString() || "NO ID",
            status: enrollment.enrollmentData?.status,
            hasPopulatedData: !!enrollment.courseId?.basic,
          });

          // ✅ Check if user has access (paid/registered/completed)
          if (
            enrollment.enrollmentData?.status === "paid" ||
            enrollment.enrollmentData?.status === "registered" ||
            enrollment.enrollmentData?.status === "completed"
          ) {
            const course = enrollment.courseId; // Already populated

            if (course && course.basic) {
              console.log(`✅ Processing course: ${course.basic.title}`);

              // ✅ STEP 3: Get user's progress data from USER MODEL
              const userProgress = enrollment.courseProgress || {
                completedVideos: [],
                completedExams: [],
                overallPercentage: 0,
                status: "not-started",
                totalWatchTime: 0,
                averageExamScore: 0,
                lastAccessedAt: new Date(),
              };

              // ✅ Create progress maps for efficient lookup from USER MODEL
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

              // ✅ STEP 4: Calculate comprehensive statistics
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

              // ✅ ENHANCED: Comprehensive completion check
              const allVideosWatched =
                totalVideos > 0 && completedVideos === totalVideos;
              const allExamsCompleted =
                totalExamsAvailable === 0 ||
                completedExams === totalExamsAvailable;
              const isCompleted =
                userProgress.status === "completed" &&
                allVideosWatched &&
                allExamsCompleted;

              // ✅ ENHANCED: Calculate accurate completion percentage
              let overallCompletion = 0;
              if (totalVideos > 0) {
                const videoWeight = totalExamsAvailable > 0 ? 0.7 : 1.0; // 70% weight for videos if exams exist
                const examWeight = totalExamsAvailable > 0 ? 0.3 : 0.0; // 30% weight for exams

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

              // ✅ STEP 5: Process videos with user progress from USER MODEL
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

              // ✅ STEP 6: Find next video/exam to complete
              const nextVideo = videosWithProgress.find((video) => {
                // First priority: incomplete videos
                if (!video.userProgress.isCompleted) return true;
                // Second priority: videos with incomplete exams
                if (
                  video.userProgress.hasExam &&
                  !video.userProgress.examCompleted
                )
                  return true;
                return false;
              });

              // ✅ STEP 7: Calculate additional metrics
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

              // ✅ STEP 8: Build comprehensive course object
              selfPacedCourses.push({
                // ✅ Course details from populated data
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

                // ✅ User-specific enrollment data from USER MODEL
                dateOfRegistration:
                  enrollment.enrollmentData?.registrationDate || new Date(),
                status: enrollment.enrollmentData?.status || "unknown",
                accessExpiryDate: enrollment.enrollmentData?.expiryDate,
                isExpired: isExpired,
                daysUntilExpiry: daysUntilExpiry,
                paidAmount: enrollment.enrollmentData?.paidAmount || 0,

                // ✅ Progress data from USER MODEL
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

                // ✅ NEW: Certificate information
                certificate: {
                  isEligible:
                    isCompleted && allVideosWatched && allExamsCompleted,
                  hasBeenIssued: !!enrollment.certificateId,
                  certificateId: enrollment.certificateId || null,
                  canView: isCompleted && !!enrollment.certificateId,
                  requiresAction: isCompleted && !enrollment.certificateId,
                },

                // ✅ Comprehensive statistics
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
                  ), // 15 min per video
                },

                // ✅ Enhanced video data with user progress
                videos: videosWithProgress,
                nextVideo: nextVideo,
                isCompleted: isCompleted,
                hasVideos: totalVideos > 0,

                // ✅ Detailed status information
                statusInfo: {
                  canStartCourse: totalVideos > 0 && !isExpired,
                  canViewCertificate: isCompleted && !!enrollment.certificateId,
                  canGetCertificate: isCompleted && !enrollment.certificateId,
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

                // ✅ Quick access information
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
                    isCompleted && enrollment.certificateId
                      ? `/certificates/view/${enrollment.certificateId}`
                      : null,
                  lastVideoWatched: videosWithProgress.find(
                    (v) => v.userProgress.lastWatched
                  ),
                  totalNotesCount: (enrollment.videoNotes || []).filter(
                    (vn) => vn.notes && vn.notes.trim()
                  ).length,
                },

                // ✅ Course metadata
                metadata: {
                  enrollmentId: enrollment._id,
                  lastUpdated: new Date(),
                  dataSource: "USER_MODEL", // For debugging
                  version: "2.0", // For future compatibility
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
          console.error(`❌ Error processing self-paced course:`, courseError);
        }
      }
    } else {
      console.log("📭 No self-paced course enrollments found in USER MODEL");
    }

    // ✅ STEP 9: Sort courses by priority and activity
    selfPacedCourses.sort((a, b) => {
      // Priority 1: Active courses (in progress) first
      if (a.statusInfo.hasActiveProgress && !b.statusInfo.hasActiveProgress)
        return -1;
      if (!a.statusInfo.hasActiveProgress && b.statusInfo.hasActiveProgress)
        return 1;

      // Priority 2: Expiring soon courses
      if (a.statusInfo.isExpiringSoon && !b.statusInfo.isExpiringSoon)
        return -1;
      if (!a.statusInfo.isExpiringSoon && b.statusInfo.isExpiringSoon) return 1;

      // Priority 3: Recent activity
      if (a.statusInfo.hasRecentActivity && !b.statusInfo.hasRecentActivity)
        return -1;
      if (!a.statusInfo.hasRecentActivity && b.statusInfo.hasRecentActivity)
        return 1;

      // Priority 4: Completion status (incomplete first, then completed)
      if (!a.isCompleted && b.isCompleted) return -1;
      if (a.isCompleted && !b.isCompleted) return 1;

      // Priority 5: Registration date (newest first)
      return new Date(b.dateOfRegistration) - new Date(a.dateOfRegistration);
    });

    // ✅ STEP 10: Calculate comprehensive library statistics
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

    // ✅ STEP 11: Enhanced library statistics object
    const libraryStats = {
      // Basic counts
      totalVideosInLibrary: totalVideosInLibrary,
      totalCompletedVideos: totalCompletedVideos,
      totalExamsInLibrary: totalExamsInLibrary,
      totalCompletedExams: totalCompletedExams,

      // Progress percentages
      libraryProgressPercentage: libraryProgressPercentage,
      examProgressPercentage: examProgressPercentage,

      // Time statistics
      totalWatchTimeMinutes: totalWatchTimeMinutes,
      totalWatchTimeHours: Math.round(totalWatchTimeMinutes / 60),
      averageTimePerCourse:
        totalCourses > 0 ? Math.round(totalWatchTimeMinutes / totalCourses) : 0,

      // Course distribution
      courseDistribution: {
        completed: completedCourses,
        inProgress: inProgressCourses,
        notStarted: notStartedCourses,
        expiringSoon: expiringSoonCourses,
      },

      // Achievement metrics
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

      // Recent activity
      hasRecentActivity: selfPacedCourses.some(
        (course) => course.statusInfo.hasRecentActivity
      ),
      coursesNeedingAttention: selfPacedCourses.filter(
        (course) => course.statusInfo.needsAttention
      ).length,

      // Library health score (0-100)
      libraryHealthScore: Math.round(
        libraryProgressPercentage * 0.4 +
          examProgressPercentage * 0.3 +
          (completedCourses / Math.max(totalCourses, 1)) * 100 * 0.3
      ),
    };

    console.log(`📊 Library Statistics:`, {
      totalCourses,
      completed: completedCourses,
      inProgress: inProgressCourses,
      libraryProgress: libraryProgressPercentage,
      healthScore: libraryStats.libraryHealthScore,
    });

    // ✅ STEP 12: Render the library page with comprehensive data
    res.render("library-online", {
      // User data
      user: req.user,

      // Course data (from USER MODEL)
      myCourses: selfPacedCourses,

      // Basic statistics
      totalCourses: totalCourses,
      completedCourses: completedCourses,
      inProgressCourses: inProgressCourses,
      notStartedCourses: notStartedCourses,
      expiringSoonCourses: expiringSoonCourses,

      // Enhanced statistics
      libraryStats: libraryStats,

      // Page metadata
      title: "Your Library - Self-Paced Courses",
      pageType: "self-paced-library",
      lastUpdated: new Date(),

      // Feature flags
      features: {
        showExpiryWarnings: expiringSoonCourses > 0,
        showProgressCharts: totalCourses > 0,
        showRecommendations: completedCourses > 0,
        enableNotifications: true,
      },
    });
  } catch (error) {
    console.error("❌ Error in getSelfPacedLibrary:", error);
    req.flash("error_message", "Error loading your library. Please try again.");
    res.redirect("/dashboard");
  }
};

// ============================================
// ✅ UPDATED: Live Online Library with Certificate Support
// ============================================
exports.getLiveLibrary = async (req, res) => {
  try {
    console.log("📚 Loading live course library for user:", req.user.email);

    const user = await User.findById(req.user._id)
      .populate({
        path: "myLiveCourses.courseId",
        model: "OnlineLiveTraining",
        select:
          "basic schedule platform instructors media recording materials assessment certification technical interaction attendance",
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
            const course = enrollment.courseId; // Already populated

            if (course) {
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

              // ============================================
              // ✅ UPDATED: Assessment fields are OUTSIDE userProgress
              // ============================================
              const assessmentRequired =
                course.assessment?.required &&
                course.assessment?.type !== "none";

              // Use OUTSIDE userProgress structure (per your User model)
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

              // ============================================
              // ✅ NEW: Certificate eligibility and status checking
              // ============================================
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

              // Final certificate view eligibility
              const canViewCertificate = canGetCertificate || hasCertificate;

              console.log(`📊 Course: ${course.basic.title}`, {
                courseEnded,
                attendanceConfirmed,
                assessmentRequired,
                assessmentPassed,
                canGetCertificate,
                hasCertificate,
                canViewCertificate,
              });

              liveCourses.push({
                courseId: course._id,
                title: course.basic?.title || "Untitled Course",
                description: course.basic?.description || "",
                courseCode: course.basic?.courseCode || "N/A",
                instructor: course.instructors?.primary?.name || "IAAI Team",
                courseType: "OnlineLiveTraining",
                dateOfRegistration: enrollment.enrollmentData.registrationDate,
                status: enrollment.enrollmentData.status,
                startDate: course.schedule?.startDate,
                endDate: course.schedule?.endDate,
                schedule: course.schedule?.duration || "TBD",
                platform: course.platform?.name || "Zoom",
                platformFeatures: course.platform?.features || {},
                courseUrl: course.platform?.accessUrl,
                meetingId: course.platform?.meetingId,
                passcode: course.platform?.passcode,

                // ✅ ADD THESE LINES HERE (inside the push object):
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

                // ✅ CORRECTED: Assessment information using OUTSIDE userProgress
                assessmentRequired: assessmentRequired,
                assessmentType: course.assessment?.type,
                assessmentCompleted: assessmentCompleted,
                assessmentScore: assessmentScore,
                assessmentPassed: assessmentPassed,
                passingScore: course.assessment?.passingScore || 70,
                maxAttempts: maxAttempts,
                currentAttempts: currentAttempts,

                // Assessment history for display (OUTSIDE userProgress)
                assessmentHistory: enrollment.assessmentHistory || [],

                // ✅ NEW: Certificate information
                canViewCertificate: canViewCertificate,
                canGetCertificate: canGetCertificate,
                hasCertificate: hasCertificate,
                certificateId: certificateId,

                // Certificate requirements status
                certificateRequirements: {
                  courseEnded: courseEnded,
                  attendanceConfirmed: attendanceConfirmed,
                  meetsAttendance: meetsAttendanceRequirement,
                  assessmentRequired: assessmentRequired,
                  assessmentPassed: assessmentPassed || !assessmentRequired,
                  allRequirementsMet: canGetCertificate,
                },

                // Course materials and resources
                materials: course.materials || {},
                media: course.media || {},
                resources: course.media?.links || [],
                recordings: course.recording?.sessions || [],
                recordingAvailable:
                  course.recording?.enabled &&
                  course.recording?.availability?.forStudents,
                recordingDuration:
                  course.recording?.availability?.duration || 90,

                // Technical requirements
                technical: course.technical || {},
                techCheckRequired: course.technical?.techCheckRequired,
                techCheckDate: course.technical?.techCheckDate,
                techCheckUrl: course.technical?.techCheckUrl,

                // Interaction features
                interaction: course.interaction || {},

                // Attendance settings
                attendance: course.attendance || {},
              });
            }
          }
        } catch (courseError) {
          console.error(`❌ Error loading live course:`, courseError);
        }
      }
    }

    // Sort by start date (upcoming first, then recent)
    liveCourses.sort((a, b) => {
      const aDate = new Date(a.startDate);
      const bDate = new Date(b.startDate);
      const now = new Date();

      // Upcoming courses first
      const aUpcoming = aDate > now;
      const bUpcoming = bDate > now;

      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;

      // Then by date
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

    // ✅ NEW: Certificate statistics
    const certificatesAvailable = liveCourses.filter(
      (course) => course.hasCertificate
    ).length;
    const certificatesReady = liveCourses.filter(
      (course) => course.canGetCertificate && !course.hasCertificate
    ).length;

    console.log(`📊 Live Library Statistics:`, {
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

      // ✅ NEW: Certificate statistics
      certificatesAvailable: certificatesAvailable,
      certificatesReady: certificatesReady,

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

// ============================================
// ✅ CORRECTED: Online Live Assessment Submission
// ============================================
// ============================================
// ✅ UPDATED: Online Live Assessment Submission
// ============================================
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

    // ============================================
    // ✅ CORRECTED: Initialize assessment arrays OUTSIDE userProgress
    // ============================================
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

    // ============================================
    // ✅ CORRECTED: Add new attempt to OUTSIDE userProgress array
    // ============================================
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

    // ✅ NEW: Enhanced response for modern UI
    const response = {
      success: true,
      passed: passed,
      score: score,
      passingScore: passingScore,

      // Attempt information
      currentAttempts: currentAttempts + 1,
      totalAttempts: maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - (currentAttempts + 1)),
      canRetake: !passed && currentAttempts + 1 < maxAttempts,

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
        : response.canRetake
        ? "Almost There!"
        : "Assessment Not Passed",
      message: passed
        ? `Excellent work! You passed with ${score}%`
        : response.canRetake
        ? `You scored ${score}%. You need ${passingScore}% to pass. You have ${response.attemptsRemaining} attempt(s) remaining.`
        : `You scored ${score}%. You have used all available attempts.`,

      // Next steps
      nextSteps: passed
        ? [
            "Return to your library to complete the course",
            "Confirm your attendance to receive your certificate",
            "Share your achievement with others",
          ]
        : response.canRetake
        ? [
            "Review your results and course materials",
            "Take the assessment again when ready",
            `You have ${response.attemptsRemaining} attempt(s) remaining`,
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

    res.json(response);
  } catch (error) {
    console.error("❌ Error submitting online assessment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing assessment submission. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// ✅ CORRECTED: Get Online Live Assessment
// ============================================
// ============================================
// ✅ FIXED: Get Online Live Assessment - Proper Completion Status
// ============================================
// ============================================
// ✅ FIXED: Get Online Live Assessment - Proper Completion Status
// ============================================
// ============================================
// ✅ FIXED: Get Online Live Assessment - Corrected Attendance Flow
// ============================================
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

    // ✅ FIXED: Check attendance requirement - Allow assessment after attendance confirmation
    const totalSessions = course.schedule.sessions?.length || 1;
    const attendedSessions =
      enrollment.userProgress?.sessionsAttended?.length || 0;
    const attendancePercentage =
      totalSessions > 0
        ? Math.round((attendedSessions / totalSessions) * 100)
        : 0;

    // ✅ NEW LOGIC: Allow assessment if:
    // 1. User has confirmed attendance (sessionsAttended.length > 0), OR
    // 2. Course status is completed, OR
    // 3. User meets the actual attendance percentage requirement
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

    // ============================================
    // ✅ FIXED: Initialize assessment arrays OUTSIDE userProgress
    // ============================================
    if (!enrollment.assessmentAttempts) {
      enrollment.assessmentAttempts = [];
    }
    if (!enrollment.assessmentHistory) {
      enrollment.assessmentHistory = [];
    }

    // ✅ FIXED: Get assessment data using OUTSIDE userProgress structure
    const assessmentHistory = enrollment.assessmentHistory || [];
    const currentAttempts = enrollment.assessmentAttempts.length;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1;
    const canTakeAssessment = currentAttempts < maxAttempts;

    // ✅ FIXED: Properly check completion status using OUTSIDE userProgress
    const assessmentCompleted = enrollment.assessmentCompleted || false;
    const assessmentScore =
      enrollment.assessmentScore || enrollment.bestAssessmentScore || null;
    const passingScore = course.assessment?.passingScore || 70;
    const hasPassedAssessment =
      assessmentCompleted && assessmentScore >= passingScore;

    console.log(`🔍 Assessment Status Check:`, {
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
    });

    res.render("online-live-assessment", {
      user: req.user,
      course: course,
      assessment: course.assessment,
      assessmentHistory: assessmentHistory,
      currentAttempts: currentAttempts,
      maxAttempts: maxAttempts,
      canTakeAssessment: canTakeAssessment,

      // ✅ FIXED: Pass proper completion status flags with safe defaults
      assessmentCompleted: assessmentCompleted || false,
      hasPassedAssessment: hasPassedAssessment || false,
      assessmentScore: assessmentScore || null,
      passingScore: passingScore || 70,

      // ✅ NEW: Pass attendance info for display
      attendancePercentage: attendancePercentage,
      hasConfirmedAttendance: hasConfirmedAttendance,
      attendedSessions: attendedSessions,
      totalSessions: totalSessions,

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

// In-Person Library (updated for new structure)
exports.getInPersonLibrary = async (req, res) => {
  try {
    console.log(
      "📚 Loading in-person course library for user:",
      req.user.email
    );

    const user = await User.findById(req.user._id)
      .populate({
        path: "myInPersonCourses.courseId",
        model: "InPersonAestheticTraining",
        select:
          "basic schedule venue instructors media materials assessment certification",
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.redirect("/login");
    }

    const inPersonCourses = [];

    // Process In-Person Aesthetic Training Courses
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      for (const enrollment of user.myInPersonCourses) {
        try {
          if (
            enrollment.enrollmentData.status === "paid" ||
            enrollment.enrollmentData.status === "registered"
          ) {
            const course = enrollment.courseId; // Already populated

            if (course) {
              // Check if course has ended
              const courseEnded =
                new Date(course.schedule.endDate || course.schedule.startDate) <
                new Date();

              // Check attendance and assessment status
              const attendanceConfirmed =
                enrollment.userProgress?.attendanceRecords?.length > 0 ||
                enrollment.userProgress?.courseStatus === "completed";

              // Check if assessment is required and completed
              const assessmentRequired =
                course.assessment?.required &&
                course.assessment?.type !== "none";
              const assessmentCompleted =
                enrollment.userProgress?.assessmentCompleted || false;
              const assessmentScore =
                enrollment.userProgress?.assessmentScore ||
                enrollment.userProgress?.bestAssessmentScore ||
                null;
              const assessmentPassed =
                assessmentScore &&
                assessmentScore >= (course.assessment?.passingScore || 70);
              // Determine if user can get certificate
              const canGetCertificate =
                attendanceConfirmed &&
                (!assessmentRequired ||
                  (assessmentCompleted && assessmentPassed));

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
                attendanceConfirmed: attendanceConfirmed,
                attendanceDate: enrollment.userProgress?.completionDate,

                // ✅ ADD THESE ASSESSMENT FIELDS:
                assessmentRequired: assessmentRequired,
                assessmentType: course.assessment?.type,
                assessmentCompleted: assessmentCompleted,
                assessmentScore: assessmentScore,
                assessmentPassed: assessmentPassed,
                passingScore: course.assessment?.passingScore || 70,

                // ✅ ADD ATTEMPT TRACKING:
                currentAttempts:
                  enrollment.userProgress?.assessmentAttempts || 0,
                maxAttempts: (course.assessment?.retakesAllowed || 0) + 1,
                lastAssessmentDate: enrollment.userProgress?.lastAssessmentDate,
                canRetake:
                  !assessmentPassed &&
                  (enrollment.userProgress?.assessmentAttempts || 0) <
                    (course.assessment?.retakesAllowed || 0) + 1,

                // Certificate eligibility
                canViewCertificate: canGetCertificate,

                // Course materials and resources
                materials: course.materials || {},
                media: course.media || {},
                resources: course.media?.links || [],
                providedMaterials: course.inclusions?.materials,
              });
            }
          }
        } catch (courseError) {
          console.error(`❌ Error loading in-person course:`, courseError);
        }
      }
    }

    // Sort by start date
    inPersonCourses.sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );

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

    res.render("library-in-person", {
      user: req.user,
      myCourses: inPersonCourses,
      totalCourses: totalCourses,
      attendedCourses: attendedCourses,
      completedCourses: completedCourses,
      upcomingCourses: upcomingCourses,
      title: "Your Library - In-Person Courses",
    });
  } catch (error) {
    console.error("❌ Error in getInPersonLibrary:", error);
    req.flash(
      "error_message",
      "Error loading your in-person courses. Please try again."
    );
    res.redirect("/dashboard");
  }
};

// ============================================
// ✅ FIXED: Confirm Attendance - Simplified Logic
// ============================================
exports.confirmAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { courseType } = req.body;
    const userId = req.user._id;

    console.log(
      "✅ Confirming attendance for course:",
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

      // ✅ SIMPLIFIED: Just confirm attendance without assessment checks
      // Assessment will be handled separately after attendance confirmation

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

      enrollment.userProgress.courseStatus = "completed";
      enrollment.userProgress.completionDate = new Date();
      updated = true;

      console.log("✅ Attendance confirmed for Online Live course");
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

      enrollment.userProgress.courseStatus = "completed";
      enrollment.userProgress.completionDate = new Date();
      updated = true;

      console.log("✅ Attendance confirmed for In-Person course");
    }

    if (updated) {
      await user.save();
      console.log("✅ User saved successfully after attendance confirmation");

      res.json({
        success: true,
        message:
          "Attendance confirmed successfully! You can now take the assessment.",
        canViewCertificate: false, // Will be true after assessment
        needsAssessment: true, // Indicate assessment is next step
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

// In-Person Assessment Submission
exports.submitInPersonAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body;
    const userId = req.user._id;

    console.log("📝 Processing assessment submission for course:", courseId);

    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const course = await InPersonAestheticTraining.findById(courseId);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      return res.status(400).json({
        success: false,
        message: "This course does not require an assessment",
      });
    }

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

    // Initialize userProgress if needed
    if (!enrollment.userProgress) {
      enrollment.userProgress = {};
    }

    // Check retake attempts
    const currentAttempts = enrollment.userProgress.assessmentAttempts || 0;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1; // Initial attempt + retakes

    if (
      enrollment.userProgress.assessmentCompleted &&
      currentAttempts >= maxAttempts
    ) {
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
    const passed = score >= (course.assessment.passingScore || 70);

    // Update user progress
    enrollment.userProgress.assessmentCompleted = passed;
    enrollment.userProgress.assessmentScore = score;
    enrollment.userProgress.assessmentAttempts = currentAttempts + 1;
    enrollment.userProgress.lastAssessmentDate = new Date();

    // Store assessment details
    if (!enrollment.userProgress.assessmentHistory) {
      enrollment.userProgress.assessmentHistory = [];
    }

    enrollment.userProgress.assessmentHistory.push({
      attemptNumber: currentAttempts + 1,
      date: new Date(),
      score: score,
      passed: passed,
      answers: answers,
      totalQuestions: questions.length,
      correctAnswers: correctAnswers,
      detailedResults: detailedResults, // Store detailed results for review
    });

    await user.save();

    res.json({
      success: true,
      passed: passed,
      score: score,
      message: passed
        ? `Congratulations! You passed with ${score}%`
        : `You scored ${score}%. You need ${course.assessment.passingScore}% to pass.`,
      canRetake: !passed && currentAttempts + 1 < maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - (currentAttempts + 1)),
      totalAttempts: maxAttempts,
      detailedResults: detailedResults,
      passingScore: course.assessment.passingScore || 70,
    });
  } catch (error) {
    console.error("❌ Error submitting assessment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing assessment submission",
    });
  }
};

// Get In-Person Assessment
exports.getInPersonAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const course = await InPersonAestheticTraining.findById(courseId).select(
      "basic assessment schedule venue"
    );

    if (!course) {
      return res.status(404).render("error", {
        message: "Course not found",
        user: req.user,
      });
    }

    if (!course.assessment?.required || course.assessment?.type === "none") {
      return res.redirect(`/library/in-person`);
    }

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

    // Get user's assessment history
    const assessmentHistory = enrollment.userProgress?.assessmentHistory || [];
    const currentAttempts = enrollment.userProgress?.assessmentAttempts || 0;
    const maxAttempts = (course.assessment.retakesAllowed || 0) + 1; // Initial attempt + retakes
    const canTakeAssessment = currentAttempts < maxAttempts;
    const hasPassedAssessment =
      enrollment.userProgress?.assessmentCompleted || false;

    res.render("in-person-assessment", {
      user: req.user,
      course: course,
      assessment: course.assessment,
      assessmentHistory: assessmentHistory,
      currentAttempts: currentAttempts,
      maxAttempts: maxAttempts,
      canTakeAssessment: canTakeAssessment,
      hasPassedAssessment: hasPassedAssessment,
      title: `Assessment - ${course.basic.title}`,
    });
  } catch (error) {
    console.error("❌ Error loading assessment:", error);
    res.status(500).render("error", {
      message: "Error loading assessment",
      user: req.user,
    });
  }
};

// Keep the original method for backward compatibility
exports.getLibraryPage = exports.getSelfPacedLibrary;
