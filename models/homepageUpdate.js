const mongoose = require('mongoose');

const HomepageUpdateSchema = new mongoose.Schema({
    latestNewsTitle: { type: String, required: true },
    latestNewsDes: { type: String, required: true },
    latestNewsDetails: { type: String, required: true },
    latestNewsImage: { type: String, default: '' }, // ✅ Image for latest news

    latest1Title: { type: String, required: true },
    latest1Detail: { type: String, required: true },
    latest1Image: { type: String, default: '' }, // ✅ Image for latest 1

    latest2Title: { type: String, required: true },
    latest2Detail: { type: String, required: true },
    latest2Image: { type: String, default: '' }, // ✅ Image for latest 2

    latest3Title: { type: String, required: true },
    latest3Detail: { type: String, required: true },
    latest3Image: { type: String, default: '' }, // ✅ Image for latest 3

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HomepageUpdate', HomepageUpdateSchema);