// controllers/instructorController.js
const Instructor = require('../models/Instructor');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ============================================
// PAGE RENDERING
// ============================================

// 1. Manage instructors page - Renders the admin view
exports.manageInstructors = async (req, res) => {
  try {
    const instructors = await Instructor.find({ isDeleted: false })
      .populate('assignedCourses.courseId', 'basic.title')
      .lean();
    
    // Add course counts for each instructor
    instructors.forEach(instructor => {
      instructor.courseStats = {
        total: instructor.assignedCourses?.length || 0,
        upcoming: instructor.assignedCourses?.filter(c => c.status === 'Upcoming').length || 0,
        inProgress: instructor.assignedCourses?.filter(c => c.status === 'In Progress').length || 0,
        completed: instructor.assignedCourses?.filter(c => c.status === 'Completed').length || 0
      };
    });
    
    console.log(`📋 Loading instructor management page. Found ${instructors.length} instructors`);
    
    res.render('admin-instructors', {
      instructors,
      user: req.user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('❌ Error loading instructors:', error);
    req.flash('error', 'Failed to load instructors');
    res.redirect('/dashboard');
  }
};

// ============================================
// API ENDPOINTS
// ============================================

// 2. Get all instructors API
exports.getInstructors = async (req, res) => {
  try {
    const instructors = await Instructor.find({ isDeleted: false })
      .select('firstName lastName email expertise status profileImage designation assignedCourses')
      .lean();
    
    // Add course stats to each instructor
    instructors.forEach(instructor => {
      instructor.courseStats = {
        total: instructor.assignedCourses?.length || 0,
        upcoming: instructor.assignedCourses?.filter(c => c.status === 'Upcoming').length || 0,
        inProgress: instructor.assignedCourses?.filter(c => c.status === 'In Progress').length || 0,
        completed: instructor.assignedCourses?.filter(c => c.status === 'Completed').length || 0
      };
    });
    
    console.log(`✅ API: Fetched ${instructors.length} instructors`);
    
    res.json({
      success: true,
      instructors
    });
  } catch (error) {
    console.error('❌ Error fetching instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructors',
      error: error.message
    });
  }
};

// 3. Get active instructors for dropdowns
exports.getActiveInstructors = async (req, res) => {
  try {
    const instructors = await Instructor.find({ 
      isDeleted: false, 
      status: 'Active' 
    })
    .select('firstName lastName email profileImage')
    .sort('lastName firstName')
    .lean();
    
    // Format for dropdown
    const formattedInstructors = instructors.map(inst => ({
      id: inst._id,
      name: `${inst.firstName} ${inst.lastName}`,
      email: inst.email,
      profileImage: inst.profileImage
    }));
    
    console.log(`✅ API: Fetched ${formattedInstructors.length} active instructors`);
    
    res.json({
      success: true,
      instructors: formattedInstructors
    });
  } catch (error) {
    console.error('❌ Error fetching active instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active instructors'
    });
  }
};

// 4. Get instructor by ID with full course details
exports.getInstructorById = async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.instructorId)
      .populate({
        path: 'assignedCourses.courseId',
        select: 'basic.title basic.courseCode schedule.startDate enrollment venue platform'
      });
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Calculate course statistics
    const courseStats = {
      total: instructor.assignedCourses.length,
      byType: {
        inPerson: instructor.assignedCourses.filter(c => c.courseType === 'InPersonAestheticTraining').length,
        onlineLive: instructor.assignedCourses.filter(c => c.courseType === 'OnlineLiveTraining').length,
        selfPaced: instructor.assignedCourses.filter(c => c.courseType === 'SelfPacedOnlineTraining').length
      },
      byStatus: {
        upcoming: instructor.assignedCourses.filter(c => c.status === 'Upcoming').length,
        inProgress: instructor.assignedCourses.filter(c => c.status === 'In Progress').length,
        completed: instructor.assignedCourses.filter(c => c.status === 'Completed').length
      }
    };
    
    res.json({
      success: true,
      instructor: instructor.toObject(),
      courseStats
    });
  } catch (error) {
    console.error('❌ Error fetching instructor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor details'
    });
  }
};

// 5. Create instructor
exports.createInstructor = async (req, res) => {
  try {
    const instructorData = {};
    
    console.log('📝 Creating instructor with data:', req.body);
    console.log('📁 File uploaded:', req.file ? req.file.filename : 'No file');
    
    // Parse form data
    for (let [key, value] of Object.entries(req.body)) {
      if (key === 'expertise' || key === 'preferredCourseTypes') {
        try {
          instructorData[key] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, handle as string
          if (key === 'expertise') {
            instructorData[key] = value.split(',').map(e => e.trim()).filter(e => e);
          } else {
            instructorData[key] = [value];
          }
        }
      } else if (key === 'hourlyRate' && value) {
        instructorData[key] = parseFloat(value);
      } else if (value) {
        instructorData[key] = value;
      }
    }
    
    // Handle social media
    if (instructorData.linkedin || instructorData.website) {
      instructorData.socialMedia = {
        linkedin: instructorData.linkedin || '',
        website: instructorData.website || ''
      };
      delete instructorData.linkedin;
      delete instructorData.website;
    }
    
    // Handle file upload
    if (req.file) {
      instructorData.profileImage = `/instructors/photo/${req.file.filename}`;
      console.log('✅ Profile image path:', instructorData.profileImage);
    }
    
    instructorData.createdBy = req.user.email;
    
    // Check if email already exists
    const existing = await Instructor.findOne({ email: instructorData.email });
    if (existing) {
      // If file was uploaded but instructor exists, delete the uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'An instructor with this email already exists'
      });
    }
    
    const instructor = new Instructor(instructorData);
    await instructor.save();
    
    console.log('✅ Instructor created:', instructor.email);
    
    res.json({
      success: true,
      message: 'Instructor created successfully',
      instructor
    });
  } catch (error) {
    // If error occurs and file was uploaded, delete it
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    }
    
    console.error('❌ Error creating instructor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create instructor: ' + error.message
    });
  }
};

// 6. Update instructor
exports.updateInstructor = async (req, res) => {
  const { instructorId } = req.params;
  
  try {
    const updateData = {};
    
    console.log('📝 Updating instructor:', instructorId);
    console.log('📁 File uploaded:', req.file ? req.file.filename : 'No file');
    
    // Parse form data
    for (let [key, value] of Object.entries(req.body)) {
      if (key === 'expertise' || key === 'preferredCourseTypes') {
        try {
          updateData[key] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, handle as string
          if (key === 'expertise') {
            updateData[key] = value.split(',').map(e => e.trim()).filter(e => e);
          } else {
            updateData[key] = [value];
          }
        }
      } else if (key === 'hourlyRate' && value) {
        updateData[key] = parseFloat(value);
      } else if (value) {
        updateData[key] = value;
      }
    }
    
    // Handle social media
    if (updateData.linkedin || updateData.website) {
      updateData.socialMedia = {
        linkedin: updateData.linkedin || '',
        website: updateData.website || ''
      };
      delete updateData.linkedin;
      delete updateData.website;
    }
    
    updateData.lastModifiedBy = req.user.email;
    
    // Get existing instructor to check for old photo
    const existingInstructor = await Instructor.findById(instructorId);
    
    if (!existingInstructor) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Handle file upload
    if (req.file) {
      updateData.profileImage = `/instructors/photo/${req.file.filename}`;
      console.log('✅ New profile image path:', updateData.profileImage);
      
      // Delete old photo if it exists
      if (existingInstructor.profileImage) {
        const oldPhotoFilename = existingInstructor.profileImage.split('/').pop();
        const oldPhotoPath = path.join(__dirname, '..', 'uploads', 'instructors', 'photos', oldPhotoFilename);
        
        if (fs.existsSync(oldPhotoPath)) {
          try {
            fs.unlinkSync(oldPhotoPath);
            console.log('✅ Deleted old profile photo:', oldPhotoFilename);
          } catch (e) {
            console.error('Error deleting old photo:', e);
          }
        }
      }
    }
    
    const instructor = await Instructor.findByIdAndUpdate(
      instructorId,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Instructor updated:', instructor.email);
    
    res.json({
      success: true,
      message: 'Instructor updated successfully',
      instructor
    });
  } catch (error) {
    // If error occurs and file was uploaded, delete it
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    }
    
    console.error('❌ Error updating instructor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update instructor: ' + error.message
    });
  }
};

// 7. Delete instructor (soft delete)
exports.deleteInstructor = async (req, res) => {
  const { instructorId } = req.params;
  
  try {
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Check if instructor has active courses
    const activeCourses = instructor.assignedCourses.filter(
      c => c.status === 'Upcoming' || c.status === 'In Progress'
    );
    
    if (activeCourses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete instructor with ${activeCourses.length} active courses. Please reassign courses first.`
      });
    }
    
    // Delete profile image if exists
    if (instructor.profileImage) {
      const photoFilename = instructor.profileImage.split('/').pop();
      const photoPath = path.join(__dirname, '..', 'uploads', 'instructors', 'photos', photoFilename);
      
      if (fs.existsSync(photoPath)) {
        try {
          fs.unlinkSync(photoPath);
          console.log('✅ Deleted profile photo:', photoFilename);
        } catch (e) {
          console.error('Error deleting photo:', e);
        }
      }
    }
    
    // Soft delete the instructor
    instructor.isDeleted = true;
    instructor.lastModifiedBy = req.user.email;
    await instructor.save();
    
    console.log('✅ Instructor deleted:', instructor.email);
    
    res.json({
      success: true,
      message: 'Instructor deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting instructor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete instructor'
    });
  }
};

// 8. Search instructors
exports.searchInstructors = async (req, res) => {
  try {
    const { query } = req.params;
    
    const instructors = await Instructor.find({
      isDeleted: false,
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
    .select('firstName lastName email profileImage')
    .limit(10)
    .lean();
    
    res.json({
      success: true,
      instructors
    });
  } catch (error) {
    console.error('❌ Error searching instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search instructors'
    });
  }
};

// 9. Bulk import instructors
exports.bulkImportInstructors = async (req, res) => {
  try {
    const { instructors } = req.body;
    
    if (!Array.isArray(instructors) || instructors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No instructors provided for import'
      });
    }
    
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const instructorData of instructors) {
      try {
        instructorData.createdBy = req.user.email;
        const instructor = new Instructor(instructorData);
        await instructor.save();
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: instructorData.email,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Import completed. ${results.successful} successful, ${results.failed} failed.`,
      results
    });
  } catch (error) {
    console.error('❌ Error bulk importing instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import instructors'
    });
  }
};

// ============================================
// COURSE MANAGEMENT
// ============================================

// 10. Sync instructor courses from all course models
exports.syncInstructorCourses = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        message: 'Instructor not found' 
      });
    }
    
    console.log(`🔄 Syncing courses for instructor: ${instructor.email}`);
    
    // Clear existing assignments to avoid duplicates
    instructor.assignedCourses = [];
    
    // Load course models
    const InPersonCourse = mongoose.model('InPersonAestheticTraining');
    const OnlineLiveCourse = mongoose.model('OnlineLiveTraining');
    const SelfPacedCourse = mongoose.model('SelfPacedOnlineTraining');
    
    // Find In-Person courses
    const inPersonCourses = await InPersonCourse.find({
      $or: [
        { 'instructors.primary.instructorId': instructorId },
        { 'instructors.additional.instructorId': instructorId }
      ],
      'basic.status': { $ne: 'cancelled' }
    });
    
    // Process In-Person courses
    for (const course of inPersonCourses) {
      let role = 'Co-Instructor';
      
      if (course.instructors.primary?.instructorId?.toString() === instructorId) {
        role = course.instructors.primary.role || 'Lead Instructor';
      } else {
        const additional = course.instructors.additional?.find(
          i => i.instructorId?.toString() === instructorId
        );
        if (additional) {
          role = additional.role || 'Co-Instructor';
        }
      }
      
      // Determine status based on dates
      const now = new Date();
      let status = 'Upcoming';
      
      if (course.schedule.startDate <= now && (!course.schedule.endDate || course.schedule.endDate >= now)) {
        status = 'In Progress';
      } else if (course.schedule.endDate && course.schedule.endDate < now) {
        status = 'Completed';
      }
      
      instructor.assignedCourses.push({
        courseId: course._id,
        courseType: 'InPersonAestheticTraining',
        courseTitle: course.basic.title,
        startDate: course.schedule.startDate,
        endDate: course.schedule.endDate,
        role: role,
        status: status
      });
    }
    
    // Find Online Live courses
    const onlineLiveCourses = await OnlineLiveCourse.find({
      $or: [
        { 'instructors.primary.instructorId': instructorId },
        { 'instructors.additional.instructorId': instructorId }
      ],
      'basic.status': { $ne: 'cancelled' }
    });
    
    // Process Online Live courses
    for (const course of onlineLiveCourses) {
      let role = 'Co-Instructor';
      
      if (course.instructors.primary?.instructorId?.toString() === instructorId) {
        role = course.instructors.primary.role || 'Lead Instructor';
      } else {
        const additional = course.instructors.additional?.find(
          i => i.instructorId?.toString() === instructorId
        );
        if (additional) {
          role = additional.role || 'Co-Instructor';
        }
      }
      
      // Determine status
      const now = new Date();
      let status = 'Upcoming';
      
      if (course.schedule.startDate <= now && (!course.schedule.endDate || course.schedule.endDate >= now)) {
        status = 'In Progress';
      } else if (course.schedule.endDate && course.schedule.endDate < now) {
        status = 'Completed';
      }
      
      instructor.assignedCourses.push({
        courseId: course._id,
        courseType: 'OnlineLiveTraining',
        courseTitle: course.basic.title,
        startDate: course.schedule.startDate,
        endDate: course.schedule.endDate,
        role: role,
        status: status
      });
    }
    
    // Find Self-Paced courses
    const selfPacedCourses = await SelfPacedCourse.find({
      'instructor.instructorId': instructorId,
      'basic.status': { $ne: 'archived' }
    });
    
    // Process Self-Paced courses
    for (const course of selfPacedCourses) {
      instructor.assignedCourses.push({
        courseId: course._id,
        courseType: 'SelfPacedOnlineTraining',
        courseTitle: course.basic.title,
        startDate: course.createdAt,
        endDate: null, // Self-paced courses don't have end dates
        role: 'Lead Instructor',
        status: course.basic.status === 'published' ? 'In Progress' : 'Upcoming'
      });
    }
    
    // Save the updated instructor
    await instructor.save();
    
    console.log(`✅ Synced ${instructor.assignedCourses.length} courses for ${instructor.email}`);
    
    res.json({
      success: true,
      message: `Successfully synced ${instructor.assignedCourses.length} courses`,
      courseBreakdown: {
        total: instructor.assignedCourses.length,
        inPerson: instructor.assignedCourses.filter(c => c.courseType === 'InPersonAestheticTraining').length,
        onlineLive: instructor.assignedCourses.filter(c => c.courseType === 'OnlineLiveTraining').length,
        selfPaced: instructor.assignedCourses.filter(c => c.courseType === 'SelfPacedOnlineTraining').length
      }
    });
  } catch (error) {
    console.error('❌ Error syncing courses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync courses',
      error: error.message 
    });
  }
};

// 11. Sync all instructors' courses
exports.syncAllInstructorsCourses = async (req, res) => {
  try {
    console.log('🔄 Starting sync for all instructors...');
    
    const instructors = await Instructor.find({ isDeleted: false });
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const instructor of instructors) {
      try {
        // Use the same logic as syncInstructorCourses but without the response
        instructor.assignedCourses = [];
        
        const InPersonCourse = mongoose.model('InPersonAestheticTraining');
        const OnlineLiveCourse = mongoose.model('OnlineLiveTraining');
        const SelfPacedCourse = mongoose.model('SelfPacedOnlineTraining');
        
        // Find and process all course types (same logic as above)
        // ... (copy the course finding logic from syncInstructorCourses)
        
        await instructor.save();
        results.successful++;
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          instructor: `${instructor.firstName} ${instructor.lastName}`,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Sync completed: ${results.successful} successful, ${results.failed} failed`);
    
    res.json({
      success: true,
      message: `Sync completed for ${instructors.length} instructors`,
      results
    });
  } catch (error) {
    console.error('❌ Error in bulk sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync all instructors',
      error: error.message
    });
  }
};

// 12. Get instructor's courses
exports.getInstructorCourses = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { status, type } = req.query; // Optional filters
    
    const instructor = await Instructor.findById(instructorId)
      .populate({
        path: 'assignedCourses.courseId',
        select: 'basic schedule enrollment venue platform'
      });
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    let courses = instructor.assignedCourses;
    
    // Apply filters
    if (status) {
      courses = courses.filter(c => c.status === status);
    }
    
    if (type) {
      courses = courses.filter(c => c.courseType === type);
    }
    
    // Sort by start date (newest first)
    courses.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateB - dateA;
    });
    
    res.json({
      success: true,
      courses,
      total: courses.length
    });
  } catch (error) {
    console.error('❌ Error fetching instructor courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor courses'
    });
  }
};

// 13. Manually assign course to instructor
exports.assignCourse = async (req, res) => {
  const { instructorId } = req.params;
  const { courseData } = req.body;
  
  try {
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Validate course data
    if (!courseData.courseId || !courseData.courseType || !courseData.courseTitle) {
      return res.status(400).json({
        success: false,
        message: 'Missing required course data'
      });
    }
    
    // Check if already assigned
    const existing = instructor.assignedCourses.find(
      c => c.courseId.toString() === courseData.courseId
    );
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Course already assigned to this instructor'
      });
    }
    
    await instructor.assignCourse(courseData);
    
    console.log(`✅ Course ${courseData.courseTitle} assigned to ${instructor.email}`);
    
    res.json({
      success: true,
      message: 'Course assigned successfully',
      instructor
    });
  } catch (error) {
    console.error('❌ Error assigning course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign course'
    });
  }
};

// 14. Update course status for instructor
exports.updateCourseStatus = async (req, res) => {
  const { instructorId, courseId } = req.params;
  const { status } = req.body;
  
  try {
    const validStatuses = ['Upcoming', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: Upcoming, In Progress, or Completed'
      });
    }
    
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    await instructor.updateCourseStatus(courseId, status);
    
    console.log(`✅ Updated course status to ${status} for instructor ${instructor.email}`);
    
    res.json({
      success: true,
      message: 'Course status updated successfully',
      instructor
    });
  } catch (error) {
    console.error('❌ Error updating course status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update course status'
    });
  }
};

// 15. Remove course assignment
exports.removeCourseAssignment = async (req, res) => {
  const { instructorId, courseId } = req.params;
  
  try {
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Find and remove the course
    const courseIndex = instructor.assignedCourses.findIndex(
      c => c.courseId.toString() === courseId
    );
    
    if (courseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Course assignment not found'
      });
    }
    
    // Check if course is active
    const course = instructor.assignedCourses[courseIndex];
    if (course.status === 'In Progress') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove an active course assignment'
      });
    }
    
    instructor.assignedCourses.splice(courseIndex, 1);
    await instructor.save();
    
    console.log(`✅ Removed course assignment for ${instructor.email}`);
    
    res.json({
      success: true,
      message: 'Course assignment removed successfully'
    });
  } catch (error) {
    console.error('❌ Error removing course assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove course assignment'
    });
  }
};

// ============================================
// RATINGS & FEEDBACK
// ============================================

// 16. Add rating to instructor
exports.addRating = async (req, res) => {
  const { instructorId } = req.params;
  const { courseId, rating, feedback } = req.body;
  
  try {
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Check if course is assigned to instructor
    const courseAssignment = instructor.assignedCourses.find(
      c => c.courseId.toString() === courseId
    );
    
    if (!courseAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Course not assigned to this instructor'
      });
    }
    
    await instructor.addRating(courseId, rating, feedback);
    
    console.log(`✅ Rating added for instructor ${instructor.email}`);
    
    res.json({
      success: true,
      message: 'Rating added successfully',
      averageRating: instructor.ratings.overall
    });
  } catch (error) {
    console.error('❌ Error adding rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add rating'
    });
  }
};

// 17. Get instructor ratings
exports.getInstructorRatings = async (req, res) => {
  try {
    const { instructorId } = req.params;
    
    const instructor = await Instructor.findById(instructorId)
      .select('ratings')
      .populate({
        path: 'ratings.courseRatings.courseId',
        select: 'basic.title basic.courseCode'
      });
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    res.json({
      success: true,
      ratings: instructor.ratings,
      summary: {
        averageRating: instructor.ratings.overall,
        totalRatings: instructor.ratings.totalRatings,
        distribution: calculateRatingDistribution(instructor.ratings.courseRatings)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings'
    });
  }
};

// ============================================
// AVAILABILITY & SCHEDULING
// ============================================

// 18. Check instructor availability
exports.checkAvailability = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required'
      });
    }
    
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    const isAvailable = instructor.isAvailable(startDate, endDate || startDate);
    
    // Get conflicting courses if not available
    let conflicts = [];
    if (!isAvailable) {
      conflicts = instructor.assignedCourses.filter(course => {
        const courseStart = new Date(course.startDate);
        const courseEnd = new Date(course.endDate || course.startDate);
        const checkStart = new Date(startDate);
        const checkEnd = new Date(endDate || startDate);
        
        return (
          (checkStart >= courseStart && checkStart <= courseEnd) ||
          (checkEnd >= courseStart && checkEnd <= courseEnd) ||
          (checkStart <= courseStart && checkEnd >= courseEnd)
        );
      });
    }
    
    res.json({
      success: true,
      available: isAvailable,
      conflicts: conflicts.map(c => ({
        courseTitle: c.courseTitle,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status
      }))
    });
  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
};

// 19. Get instructor schedule
exports.getInstructorSchedule = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { month, year } = req.query;
    
    const instructor = await Instructor.findById(instructorId)
      .populate({
        path: 'assignedCourses.courseId',
        select: 'basic schedule venue platform'
      });
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    let courses = instructor.assignedCourses;
    
    // Filter by month/year if provided
    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      
      courses = courses.filter(course => {
        const courseStart = new Date(course.startDate);
        const courseEnd = new Date(course.endDate || course.startDate);
        
        return (
          (courseStart >= startOfMonth && courseStart <= endOfMonth) ||
          (courseEnd >= startOfMonth && courseEnd <= endOfMonth) ||
          (courseStart <= startOfMonth && courseEnd >= endOfMonth)
        );
      });
    }
    
    // Sort by date
    courses.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    res.json({
      success: true,
      schedule: courses,
      total: courses.length
    });
  } catch (error) {
    console.error('❌ Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedule'
    });
  }
};

// ============================================
// STATISTICS & REPORTS
// ============================================

// 20. Get instructor statistics
exports.getInstructorStats = async (req, res) => {
  try {
    const { instructorId } = req.params;
    
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }
    
    // Calculate various statistics
    const now = new Date();
    const stats = {
      totalCourses: instructor.assignedCourses.length,
      coursesByType: {
        inPerson: instructor.assignedCourses.filter(c => c.courseType === 'InPersonAestheticTraining').length,
        onlineLive: instructor.assignedCourses.filter(c => c.courseType === 'OnlineLiveTraining').length,
        selfPaced: instructor.assignedCourses.filter(c => c.courseType === 'SelfPacedOnlineTraining').length
      },
      coursesByStatus: {
        upcoming: instructor.assignedCourses.filter(c => c.status === 'Upcoming').length,
        inProgress: instructor.assignedCourses.filter(c => c.status === 'In Progress').length,
        completed: instructor.assignedCourses.filter(c => c.status === 'Completed').length
      },
      coursesByRole: {
        lead: instructor.assignedCourses.filter(c => c.role === 'Lead Instructor').length,
        coInstructor: instructor.assignedCourses.filter(c => c.role === 'Co-Instructor').length,
        assistant: instructor.assignedCourses.filter(c => c.role === 'Assistant').length
      },
      ratings: {
        average: instructor.ratings.overall,
        total: instructor.ratings.totalRatings,
        recentFeedback: instructor.ratings.courseRatings
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
      },
      upcomingCourses: instructor.getUpcomingCourses().length,
      currentCourses: instructor.getCurrentCourses().length,
      expertise: instructor.expertise,
      preferredCourseTypes: instructor.preferredCourseTypes,
      status: instructor.status,
      contractType: instructor.contractType
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching instructor statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function - Get instructor by identifier (for use by other controllers)
exports.getInstructorByIdentifier = async (identifier) => {
  try {
    const instructor = await Instructor.findOne({
      $or: [
        { _id: identifier },
        { email: identifier },
        { $expr: { $eq: [{ $concat: ['$firstName', ' ', '$lastName'] }, identifier] } }
      ],
      isDeleted: false
    });
    
    return instructor;
  } catch (error) {
    console.error('Error finding instructor:', error);
    return null;
  }
};

// Helper function - Check instructor availability
exports.checkInstructorAvailability = async (instructorId, startDate, endDate) => {
  try {
    const instructor = await Instructor.findById(instructorId);
    
    if (!instructor || instructor.isDeleted) {
      return false;
    }
    
    return instructor.isAvailable(startDate, endDate);
  } catch (error) {
    console.error('Error checking instructor availability:', error);
    return false;
  }
};

// Helper function - Calculate rating distribution
function calculateRatingDistribution(ratings) {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  ratings.forEach(r => {
    const rating = Math.round(r.rating);
    if (rating >= 1 && rating <= 5) {
      distribution[rating]++;
    }
  });
  
  return distribution;
}