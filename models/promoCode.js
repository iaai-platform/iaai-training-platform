const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },  // Example: "DISCOUNT10"
    discountPercentage: { type: Number, required: true },  // Example: 10 (for 10% discount)
    isActive: { type: Boolean, default: true },  // Allow enabling/disabling promo codes
    expiryDate: { type: Date }  // Optional expiration date
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema);