const EmailCollection = require("../models/emailCollection");

const emailCollectionController = {
  // Collect email from any form
  collectEmail: async (req, res) => {
    try {
      const { email, reason, source, additionalInfo } = req.body;

      // Basic validation - only check for email
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address",
        });
      }

      // Set defaults if missing
      const finalReason = reason || "general-updates";
      const finalSource = source || "website-form";

      // Try to save (will update if already exists)
      const emailData = await EmailCollection.findOneAndUpdate(
        { email: email.toLowerCase(), reason: finalReason },
        {
          email: email.toLowerCase(),
          reason: finalReason,
          source: finalSource,
          additionalInfo: additionalInfo || "",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          collectedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      console.log(
        `📧 Email collected: ${email} for ${finalReason} from ${finalSource}`
      );

      res.json({
        success: true,
        message: "Thank you! We'll keep you updated.",
        data: {
          email: emailData.email,
          reason: emailData.reason,
          source: emailData.source,
        },
      });
    } catch (error) {
      console.error("❌ Error collecting email:", error);

      // Handle duplicate error gracefully
      if (error.code === 11000) {
        return res.json({
          success: true,
          message: "You're already subscribed to these updates!",
        });
      }

      res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  },

  // Admin view to see all collected emails
  adminView: async (req, res) => {
    try {
      // Check if user is admin (add your admin check here)
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).render("error", {
          message: "Access denied. Admin only.",
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const reason = req.query.reason || "";
      const source = req.query.source || "";

      // Build filter
      const filter = { status: "active" };
      if (reason) filter.reason = reason;
      if (source) filter.source = source;

      // Get emails with pagination
      const emails = await EmailCollection.find(filter)
        .sort({ collectedAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const totalEmails = await EmailCollection.countDocuments(filter);
      const totalPages = Math.ceil(totalEmails / limit);

      // Get summary statistics
      const stats = await EmailCollection.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: { reason: "$reason", source: "$source" },
            count: { $sum: 1 },
            latestCollection: { $max: "$collectedAt" },
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.render("admin/email-collections", {
        title: "Email Collections",
        emails,
        stats,
        currentPage: page,
        totalPages,
        totalEmails,
        filter: { reason, source },
        user: req.user,
      });
    } catch (error) {
      console.error("❌ Error in admin view:", error);
      res.status(500).render("error", {
        message: "Error loading email collections",
      });
    }
  },

  // Export emails (CSV)
  exportEmails: async (req, res) => {
    try {
      // Check admin access
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const reason = req.query.reason || "";
      const source = req.query.source || "";

      const filter = { status: "active" };
      if (reason) filter.reason = reason;
      if (source) filter.source = source;

      const emails = await EmailCollection.find(filter)
        .sort({ collectedAt: -1 })
        .lean();

      // Simple CSV generation
      let csv = "Email,Reason,Source,Additional Info,Collected At\n";
      emails.forEach((item) => {
        csv += `"${item.email}","${item.reason}","${item.source}","${
          item.additionalInfo || ""
        }","${item.collectedAt}"\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="email-collections.csv"'
      );
      res.send(csv);
    } catch (error) {
      console.error("❌ Error exporting emails:", error);
      res.status(500).json({ message: "Export failed" });
    }
  },
};

module.exports = emailCollectionController;
