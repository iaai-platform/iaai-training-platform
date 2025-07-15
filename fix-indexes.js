// Node.js script to fix the MongoDB indexes programmatically
// Create a new file: fix-indexes.js and run it with: node fix-indexes.js

const mongoose = require("mongoose");

async function fixIndexes() {
  try {
    // Connect to your MongoDB database
    // Update this connection string to match your setup
    await mongoose.connect("mongodb://localhost:27017/iaai", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("onlinelivetrainings");

    // 1. Get current indexes
    console.log("📋 Current indexes:");
    const currentIndexes = await collection.indexes();
    currentIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, index.key);
    });

    // 2. Check if the problematic index exists
    const problematicIndex = currentIndexes.find(
      (idx) => idx.key.courseCode === 1 && !idx.key["basic.courseCode"]
    );

    if (problematicIndex) {
      console.log(`🗑️ Dropping problematic index: ${problematicIndex.name}`);
      await collection.dropIndex(problematicIndex.name);
      console.log("✅ Problematic index dropped");
    } else {
      console.log("ℹ️ No problematic courseCode index found");
    }

    // 3. Check if correct index exists
    const correctIndex = currentIndexes.find(
      (idx) => idx.key["basic.courseCode"] === 1
    );

    if (!correctIndex) {
      console.log("🔧 Creating correct index for basic.courseCode");
      await collection.createIndex({ "basic.courseCode": 1 }, { unique: true });
      console.log("✅ Correct index created");
    } else {
      console.log("ℹ️ Correct index already exists");
    }

    // 4. Check for any documents with null courseCode
    console.log("🔍 Checking for documents with null courseCode...");

    const nullCodeDocs = await collection
      .find({
        $or: [
          { "basic.courseCode": null },
          { "basic.courseCode": { $exists: false } },
          { "basic.courseCode": "" },
        ],
      })
      .toArray();

    if (nullCodeDocs.length > 0) {
      console.log(
        `⚠️ Found ${nullCodeDocs.length} documents with null/empty courseCode:`
      );
      nullCodeDocs.forEach((doc) => {
        console.log(
          `  - ID: ${doc._id}, Title: ${doc.basic?.title || "No title"}`
        );
      });

      // Option to fix them
      console.log("🔧 Fixing documents with null/empty courseCode...");
      for (let doc of nullCodeDocs) {
        const newCode = `TEMP-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        await collection.updateOne(
          { _id: doc._id },
          { $set: { "basic.courseCode": newCode } }
        );
        console.log(
          `  ✅ Updated document ${doc._id} with courseCode: ${newCode}`
        );
      }
    } else {
      console.log("✅ All documents have valid courseCode");
    }

    // 5. Verify final state
    console.log("📋 Final indexes:");
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, index.key);
    });

    console.log("🎉 Index fix completed successfully!");
  } catch (error) {
    console.error("❌ Error fixing indexes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the fix
fixIndexes();
