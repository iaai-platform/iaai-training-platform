// completeDatabaseCleanup.js - Complete cleanup of database issues
const mongoose = require('mongoose');

async function completeDatabaseCleanup() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/iaai');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // 1. List all current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}.`, JSON.stringify(index.key), index.name || 'unnamed');
    });

    // 2. Drop ALL problematic indexes
    const indexesToDrop = ['email_1', 'myAccount.email_1'];
    
    for (const indexName of indexesToDrop) {
      try {
        await usersCollection.dropIndex(indexName);
        console.log(`✅ Dropped ${indexName} index`);
      } catch (error) {
        if (error.message.includes('index not found')) {
          console.log(`⚠️ ${indexName} index not found (already dropped)`);
        } else {
          console.log(`❌ Error dropping ${indexName}:`, error.message);
        }
      }
    }

    // 3. Drop the entire collection and recreate it clean
    console.log('\n🗑️ Dropping entire users collection to start fresh...');
    try {
      await usersCollection.drop();
      console.log('✅ Users collection dropped');
    } catch (error) {
      if (error.message.includes('ns not found')) {
        console.log('⚠️ Users collection not found (already dropped)');
      } else {
        console.log('❌ Error dropping collection:', error.message);
      }
    }

    // 4. Recreate collection with proper index
    console.log('\n🆕 Creating fresh users collection...');
    await db.createCollection('users');
    console.log('✅ Users collection created');

    // 5. Create the correct index
    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('✅ Created email index');

    // 6. Verify final state
    console.log('\n📋 Final indexes:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`${i + 1}.`, JSON.stringify(index.key), index.name || 'unnamed');
    });

    const userCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in collection: ${userCount}`);

    console.log('\n🎉 Database cleanup completed! You can now register users successfully.');

  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📤 MongoDB connection closed');
  }
}

completeDatabaseCleanup();