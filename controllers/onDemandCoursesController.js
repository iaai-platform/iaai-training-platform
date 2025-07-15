const OnDemandApplication = require('../models/onDemandApplication'); // ✅ Make sure this line is present

// ✅ 1️⃣ Display On-Demand Courses Page
exports.getOnDemandCoursesPage = (req, res) => {
    res.render('on-demand-courses');
};

// ✅ 2️⃣ Handle Application Submission
exports.submitApplication = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, courseInterest } = req.body;

        if (!fullName || !email || !phoneNumber || !courseInterest) {
            return res.status(400).json({ success: false, message: "⚠️ All fields are required!" });
        }

        // ✅ Ensure the `OnDemandApplication` model is used properly
        const application = new OnDemandApplication({ fullName, email, phoneNumber, courseInterest });
        await application.save();

        res.json({ success: true, message: "✅ Application submitted successfully!" });

    } catch (err) {
        console.error("❌ Error submitting application:", err);
        res.status(500).json({ success: false, message: "❌ Server error! Please try again." });
    }
};