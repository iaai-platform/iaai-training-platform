const mongoose = require("mongoose");

// ✅ REPLACE THIS with your actual MongoDB Atlas connection string
const MONGODB_URI =
  "mongodb+srv://mminepour:h74CbFOMVTKB7GOm@cluster0.oispm0h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// 🔒 Or better yet, use environment variables or your existing config
// const MONGODB_URI = process.env.MONGODB_URI || require('./config/database').mongoURI;

async function fixDatabase() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas successfully!");

    // Show current database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📁 Working with database: ${dbName}`);

    // Check how many users have payment transactions
    const usersWithPayments = await mongoose.connection.db
      .collection("users")
      .countDocuments({
        paymentTransactions: { $exists: true, $not: { $size: 0 } },
      });
    console.log(
      `👥 Found ${usersWithPayments} users with payment transactions`
    );

    if (usersWithPayments === 0) {
      console.log("✅ No users have payment transactions to remove");
      await mongoose.disconnect();
      return;
    }

    // Show a sample user before update (just the payment transactions field)
    const sampleUser = await mongoose.connection.db
      .collection("users")
      .findOne(
        { paymentTransactions: { $exists: true } },
        { email: 1, paymentTransactions: 1 }
      );

    if (sampleUser) {
      console.log("📋 Sample user before update:");
      console.log(`   Email: ${sampleUser.email}`);
      console.log(
        `   Payment transactions count: ${
          sampleUser.paymentTransactions?.length || 0
        }`
      );
    }

    // Confirm before proceeding
    console.log("⚠️  About to remove payment transactions from all users...");
    console.log("💡 This will fix the video progress saving issue");

    // Remove payment transactions from all users
    console.log("🔄 Removing payment transactions...");
    const result = await mongoose.connection.db.collection("users").updateMany(
      {},
      {
        $unset: {
          paymentTransactions: 1,
        },
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    console.log(`📊 Matched ${result.matchedCount} documents`);

    // Verify the fix
    const usersWithPaymentsAfter = await mongoose.connection.db
      .collection("users")
      .countDocuments({
        paymentTransactions: { $exists: true },
      });
    console.log(
      `🔍 Users with payment transactions after update: ${usersWithPaymentsAfter}`
    );

    if (usersWithPaymentsAfter === 0) {
      console.log("🎉 Payment transactions removed successfully!");
      console.log("✅ Video progress saving should now work!");
    } else {
      console.log("⚠️  Some payment transactions may still exist");
    }

    await mongoose.disconnect();
    console.log("✅ Disconnected from database");
    console.log("");
    console.log("🎬 Next steps:");
    console.log("   1. Go back to your video player");
    console.log("   2. Try watching a video");
    console.log("   3. Check browser console for success messages");
    console.log("   4. Verify progress shows in your library");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log("");
    console.log("🔧 Troubleshooting:");
    console.log("   1. Check your connection string format");
    console.log("   2. Verify your MongoDB Atlas credentials");
    console.log("   3. Make sure your IP is whitelisted in Atlas");
    console.log("   4. Check if your cluster is paused");

    if (error.message.includes("authentication failed")) {
      console.log("   🔑 Authentication issue: Check username/password");
    }
    if (error.message.includes("network")) {
      console.log(
        "   🌐 Network issue: Check internet connection and Atlas whitelist"
      );
    }
  }
}

// Run the fix
fixDatabase();
