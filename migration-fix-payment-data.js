// migration-fix-payment-data.js
// Run this script once to fix existing payment transaction data

const mongoose = require("mongoose");
const User = require("./models/user"); // Adjust path as needed

async function fixPaymentTransactions() {
  try {
    console.log("🔧 Starting payment transactions data migration...");

    // Find users with payment transactions that have validation issues
    const users = await User.find({
      $or: [
        { "paymentTransactions.customerInfo.userId": { $exists: false } },
        { "paymentTransactions.financial.finalAmount": { $exists: false } },
        { "paymentTransactions.financial.subtotal": { $exists: false } },
        { "paymentTransactions.orderNumber": { $exists: false } },
        { "paymentTransactions.items.courseType": "Online Live" },
      ],
    });

    console.log(
      `📊 Found ${users.length} users with payment transaction issues`
    );

    for (const user of users) {
      let updated = false;

      for (let i = 0; i < user.paymentTransactions.length; i++) {
        const transaction = user.paymentTransactions[i];

        // Fix missing required fields
        if (!transaction.customerInfo?.userId) {
          transaction.customerInfo = transaction.customerInfo || {};
          transaction.customerInfo.userId = user._id;
          updated = true;
        }

        if (!transaction.financial?.finalAmount) {
          transaction.financial = transaction.financial || {};
          transaction.financial.finalAmount =
            transaction.financial.finalAmount || 0;
          updated = true;
        }

        if (!transaction.financial?.subtotal) {
          transaction.financial.subtotal =
            transaction.financial.subtotal ||
            transaction.financial.finalAmount ||
            0;
          updated = true;
        }

        if (!transaction.orderNumber) {
          transaction.orderNumber =
            transaction.orderNumber ||
            `ORD_${Date.now()}_${user._id.toString().slice(-6)}_${i}`;
          updated = true;
        }

        // Fix enum values in items
        if (transaction.items && transaction.items.length > 0) {
          for (const item of transaction.items) {
            if (item.courseType === "Online Live") {
              item.courseType = "OnlineLiveTraining";
              updated = true;
            }
          }
        }
      }

      if (updated) {
        // Use updateOne to bypass validation
        await User.updateOne(
          { _id: user._id },
          { $set: { paymentTransactions: user.paymentTransactions } },
          { runValidators: false }
        );
        console.log(`✅ Fixed payment transactions for user: ${user.email}`);
      }
    }

    console.log("✅ Payment transactions migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during migration:", error);
  }
}

// Alternative: Remove incomplete payment transactions
async function removeIncompleteTransactions() {
  try {
    console.log("🗑️ Removing incomplete payment transactions...");

    const result = await User.updateMany(
      {},
      {
        $pull: {
          paymentTransactions: {
            $or: [
              { "customerInfo.userId": { $exists: false } },
              { "financial.finalAmount": { $exists: false } },
              { "financial.subtotal": { $exists: false } },
              { orderNumber: { $exists: false } },
            ],
          },
        },
      },
      { runValidators: false }
    );

    console.log(
      `✅ Removed incomplete transactions from ${result.modifiedCount} users`
    );
  } catch (error) {
    console.error("❌ Error removing incomplete transactions:", error);
  }
}

// Export functions for use
module.exports = {
  fixPaymentTransactions,
  removeIncompleteTransactions,
};

// If running directly
if (require.main === module) {
  // Connect to your database first
  mongoose
    .connect(process.env.MONGODB_URI || "your-mongodb-connection-string")
    .then(() => {
      console.log("📦 Connected to MongoDB");

      // Choose one of these options:

      // Option 1: Fix the data (recommended)
      return fixPaymentTransactions();

      // Option 2: Remove incomplete transactions (if you want to clean slate)
      // return removeIncompleteTransactions();
    })
    .then(() => {
      console.log("✅ Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}
