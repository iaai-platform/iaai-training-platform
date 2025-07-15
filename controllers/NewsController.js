//NewsController.js

const HomepageUpdate = require('../models/homepageUpdate');

/* ======================================================
   ✅ Fetch & Display All News Details (`NewsDetails.ejs`)
====================================================== */
exports.getAllNewsDetails = async (req, res) => {
    try {
        // ✅ Fetch Latest News & Other Latest Sections from Database
        const latestNews = await HomepageUpdate.findOne().sort({ createdAt: -1 });

        // ✅ Ensure Default Data is Provided if No News Exists
        if (!latestNews) {
            return res.render('NewsDetails', {
                latestNews: {
                    latestNewsTitle: "Latest News Not Available",
                    latestNewsDes: "Stay tuned for updates.",
                    latestNewsDetails: "News details will be published here.",
                    latestNewsImage: "/images/placeholder.png",
                    latest1Title: "No Title",
                    latest1Detail: "No Details Available",
                    latest1Image: "/images/placeholder.png",
                    latest2Title: "No Title",
                    latest2Detail: "No Details Available",
                    latest2Image: "/images/placeholder.png",
                    latest3Title: "No Title",
                    latest3Detail: "No Details Available",
                    latest3Image: "/images/placeholder.png"
                }
            });
        }

        // ✅ Render Page with Data
        res.render('NewsDetails', { latestNews });

    } catch (error) {
        console.error("❌ Error fetching news details:", error);
        res.status(500).send("Error loading news details.");
    }
};