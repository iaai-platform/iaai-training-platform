// Run this script once to clean up existing data
// Save this as cleanupSelfPacedData.js and run: node cleanupSelfPacedData.js

const mongoose = require('mongoose');
const User = require('./models/user'); // Adjust path as needed

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/iaai')
  .then(() => console.log('Connected to MongoDB for cleanup'))
  .catch(err => console.log('Failed to connect to MongoDB:', err));

async function cleanupSelfPacedData() {
  try {
    console.log('🧹 Starting cleanup of self-paced course data...');
    
    // Find all users with self-paced courses
    const users = await User.find({ 'mySelfPacedCourses.0': { $exists: true } });
    console.log(`📊 Found ${users.length} users with self-paced courses`);
    
    for (let user of users) {
      let needsUpdate = false;
      
      for (let i = 0; i < user.mySelfPacedCourses.length; i++) {
        const course = user.mySelfPacedCourses[i];
        
        // Fix videos that don't have courseCode
        if (course.videos && course.videos.length > 0) {
          for (let j = 0; j < course.videos.length; j++) {
            if (!course.videos[j].courseCode) {
              console.log(`🔧 Fixing video ${j} for course ${course.courseCode}`);
              user.mySelfPacedCourses[i].videos[j].courseCode = course.courseCode;
              needsUpdate = true;
            }
          }
        }
      }
      
      if (needsUpdate) {
        console.log(`💾 Updating user: ${user.email}`);
        await user.save({ validateBeforeSave: false }); // Skip validation for cleanup
        console.log(`✅ Updated user: ${user.email}`);
      }
    }
    
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupSelfPacedData();