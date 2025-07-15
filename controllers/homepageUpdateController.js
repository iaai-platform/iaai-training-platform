//homepageUpdateController.js
const HomepageUpdate = require('../models/homepageUpdate');

/* ======================================================
   ✅ 1. Fetch Homepage Content for User View (`homecontent.ejs`)
====================================================== */
exports.getHomepageContent = async (req, res) => {
    try {
        const homepageContent = await HomepageUpdate.findOne().sort({ createdAt: -1 });

        // ✅ Ensure homepageContent is never undefined
        if (!homepageContent) {
            return res.render('homecontent', {
                homepageContent: {
                    latestNewsTitle: "Latest News",
                    latestNewsDes: "No news available.",
                    NewsDetails: "Details will be added soon.",
                    latestNewsImage: "/images/placeholder.png", // ✅ Default Image

                    latest1Title: "Latest 1",
                    latest1Detail: "Details for latest 1 are not available.",
                    latest1Image: "/images/placeholder.png",

                    latest2Title: "Latest 2",
                    latest2Detail: "Details for latest 2 are not available.",
                    latest2Image: "/images/placeholder.png",

                    latest3Title: "Latest 3",
                    latest3Detail: "Details for latest 3 are not available.",
                    latest3Image: "/images/placeholder.png",
                }
            });
        }

        // ✅ Render the Homepage with Data
        res.render('homecontent', { homepageContent });

    } catch (error) {
        console.error("❌ Error fetching homepage content:", error);
        res.status(500).send("Error loading homepage content.");
    }
};

/* ======================================================
   ✅ 2. Admin Panel: Fetch All Records for Editing (`admin-homepage.ejs`)
====================================================== */
exports.getHomepageRecords = async (req, res) => {
    try {
        const homepageRecords = await HomepageUpdate.find();
        res.render('admin-homepage', { homepageRecords });
    } catch (error) {
        console.error("❌ Error fetching homepage records:", error);
        res.status(500).send("Error loading homepage management.");
    }
};

/* ======================================================
   ✅ 3. Fetch Specific Homepage Content for Editing (`admin-homepage.ejs`)
====================================================== */
exports.getHomepageById = async (req, res) => {
    try {
        const homepageContent = await HomepageUpdate.findById(req.params.id);
        if (!homepageContent) {
            return res.status(404).json({ message: "Content not found" });
        }
        res.json(homepageContent); // ✅ Send data to frontend
    } catch (error) {
        console.error("❌ Error fetching homepage content:", error);
        res.status(500).json({ message: "Failed to fetch homepage content." });
    }
};

/* ======================================================
   ✅ 4. Update or Insert Homepage Content with Images
====================================================== */
exports.updateHomepageContent = async (req, res) => {
    try {
        const data = req.body;
        const files = req.files;
        
        const updateData = {
            latestNewsTitle: data.latestNewsTitle,
            latestNewsDes: data.latestNewsDes,
            NewsDetails: data.NewsDetails,
            latestNewsImage: files.latestNewsImage ? `/uploads/${files.latestNewsImage[0].filename}` : '',
        };

        // ✅ Only update latest items if they exist in request
        if (data.latest1Title) {
            updateData.latest1Title = data.latest1Title;
            updateData.latest1Detail = data.latest1Detail;
            if (files.latest1Image) {
                updateData.latest1Image = `/uploads/${files.latest1Image[0].filename}`;
            }
        }

        if (data.latest2Title) {
            updateData.latest2Title = data.latest2Title;
            updateData.latest2Detail = data.latest2Detail;
            if (files.latest2Image) {
                updateData.latest2Image = `/uploads/${files.latest2Image[0].filename}`;
            }
        }

        if (data.latest3Title) {
            updateData.latest3Title = data.latest3Title;
            updateData.latest3Detail = data.latest3Detail;
            if (files.latest3Image) {
                updateData.latest3Image = `/uploads/${files.latest3Image[0].filename}`;
            }
        }

        // ✅ Find existing document or create new one
        const homepageContent = await HomepageUpdate.findOneAndUpdate(
            { _id: data.id || new HomepageUpdate() },
            updateData,
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "Homepage content updated successfully!", homepageContent });

    } catch (error) {
        console.error("❌ Error updating homepage content:", error);
        res.status(500).json({ success: false, message: "Failed to update homepage content." });
    }
};

/* ======================================================
   ✅ 5. Delete Homepage Content (Admin)
====================================================== */
exports.deleteHomepageContent = async (req, res) => {
    try {
        await HomepageUpdate.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Homepage content deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting homepage content:", error);
        res.status(500).json({ success: false, message: "Failed to delete homepage content." });
    }
};