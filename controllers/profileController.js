// controllers/profileController.js - Complete Enhanced Version with Address/Billing
const User = require("../models/user");
const bcrypt = require("bcrypt");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

console.log("🔧 Profile Controller loaded successfully");

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("☁️ Cloudinary configured:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✅ SET" : "❌ MISSING",
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ SET" : "❌ MISSING",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ SET" : "❌ MISSING",
});

// ✅ 1️⃣ Fetch User Profile - Enhanced with Address/Billing Info
exports.getProfilePage = async (req, res) => {
  try {
    console.log("🔍 Fetching user profile...");
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    console.log("👤 User found:", user.email);

    // Calculate virtual fields manually for display
    const profileCompletionPercentage = calculateProfileCompletion(user);

    res.render("profile", {
      user: {
        ...user,
        profileCompletionPercentage: profileCompletionPercentage,
      },
      title: "My Profile",
    });
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).send("Error fetching profile");
  }
};

// ✅ 2️⃣ Update Basic User Profile
exports.updateProfile = async (req, res) => {
  try {
    console.log("🔧 Updating user profile...");
    const { firstName, lastName, phoneNumber, country, profession } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        firstName: firstName,
        lastName: lastName,
        phoneNumber: phoneNumber,
        country: country,
        profession: profession,
      },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log("✅ Profile updated successfully for:", updatedUser.email);
    res.json({ success: true, message: "✅ Profile updated successfully!" });
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res
      .status(500)
      .json({ success: false, message: "❌ Error updating profile" });
  }
};

// ✅ 3️⃣ NEW: Update Address & Billing Information - COMPLETE VERSION
exports.updateAddressBilling = async (req, res) => {
  try {
    console.log("🔧 Updating address & billing information...");
    console.log("📥 Request body:", req.body);

    const {
      // Address Information
      address,
      city,
      state,
      zipCode,
      country,
      alternativePhone,

      // Delivery Information
      useDifferentDeliveryAddress,
      deliveryRecipientName,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZipCode,
      deliveryCountry,
      deliveryPhone,
      deliveryNotes,
      preferredDeliveryMethod,

      // Payment Preferences
      preferredCurrency,
      preferredPaymentMethods,
      hasTaxId,
      taxId,
      taxType,
      isBusinessCustomer,
    } = req.body;

    // ✅ Handle preferred payment methods array properly
    const paymentMethods = [];
    if (preferredPaymentMethods) {
      if (Array.isArray(preferredPaymentMethods)) {
        paymentMethods.push(...preferredPaymentMethods);
      } else {
        paymentMethods.push(preferredPaymentMethods);
      }
    }

    console.log("💳 Payment methods to save:", paymentMethods);
    console.log("🏛️ Tax info to save:", {
      hasTaxId: hasTaxId === "true",
      taxId: taxId,
      taxType: taxType,
      isBusinessCustomer: isBusinessCustomer === "true",
    });

    // ✅ Build complete update object with ALL required fields
    const updateData = {};

    // Update Address Information
    updateData["addressInfo.address"] = address || "";
    updateData["addressInfo.city"] = city || "";
    updateData["addressInfo.state"] = state || "";
    updateData["addressInfo.zipCode"] = zipCode || "";
    updateData["addressInfo.country"] = country || "";
    updateData["addressInfo.alternativePhone"] = alternativePhone || "";
    updateData["addressInfo.isComplete"] = !!(address && city && country);
    updateData["addressInfo.lastUpdated"] = new Date();

    // Update Delivery Information
    updateData["deliveryInfo.useDifferentDeliveryAddress"] =
      useDifferentDeliveryAddress === "true";
    updateData["deliveryInfo.deliveryNotes"] = deliveryNotes || "";
    updateData["deliveryInfo.preferredDeliveryMethod"] =
      preferredDeliveryMethod || "email";

    // ✅ Handle delivery address fields
    if (useDifferentDeliveryAddress === "true") {
      updateData["deliveryInfo.deliveryAddress.recipientName"] =
        deliveryRecipientName || "";
      updateData["deliveryInfo.deliveryAddress.address"] =
        deliveryAddress || "";
      updateData["deliveryInfo.deliveryAddress.city"] = deliveryCity || "";
      updateData["deliveryInfo.deliveryAddress.state"] = deliveryState || "";
      updateData["deliveryInfo.deliveryAddress.zipCode"] =
        deliveryZipCode || "";
      updateData["deliveryInfo.deliveryAddress.country"] =
        deliveryCountry || "";
      updateData["deliveryInfo.deliveryAddress.phone"] = deliveryPhone || "";
    } else {
      // Clear delivery address if not using different address
      updateData["deliveryInfo.deliveryAddress.recipientName"] = null;
      updateData["deliveryInfo.deliveryAddress.address"] = null;
      updateData["deliveryInfo.deliveryAddress.city"] = null;
      updateData["deliveryInfo.deliveryAddress.state"] = null;
      updateData["deliveryInfo.deliveryAddress.zipCode"] = null;
      updateData["deliveryInfo.deliveryAddress.country"] = null;
      updateData["deliveryInfo.deliveryAddress.phone"] = null;
    }

    // ✅ COMPLETE: Update Payment Preferences
    updateData["paymentPreferences.preferredCurrency"] = "AED"; // Force AED since it's the only option
    updateData["paymentPreferences.preferredPaymentMethods"] = paymentMethods;
    updateData["paymentPreferences.defaultBillingAddress"] = "profile";

    // ✅ COMPLETE: Update Tax Information
    updateData["paymentPreferences.taxInfo.hasTaxId"] = hasTaxId === "true";
    updateData["paymentPreferences.taxInfo.taxId"] =
      hasTaxId === "true" ? taxId || null : null;
    updateData["paymentPreferences.taxInfo.taxType"] =
      hasTaxId === "true" ? taxType || null : null;
    updateData["paymentPreferences.taxInfo.isBusinessCustomer"] =
      isBusinessCustomer === "true";

    console.log(
      "📝 Complete update data:",
      JSON.stringify(updateData, null, 2)
    );

    // ✅ Use findByIdAndUpdate to avoid full document validation
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      {
        new: true,
        runValidators: false, // ✅ CRITICAL: Skip validation to avoid paymentTransactions issues
        lean: true,
      }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const completionPercentage = calculateProfileCompletion(updatedUser);

    console.log(
      "✅ Address & billing information updated successfully for:",
      req.user.email
    );
    console.log("📊 Profile completion:", completionPercentage + "%");
    console.log(
      "💳 Final payment preferences:",
      updatedUser.paymentPreferences
    );

    res.json({
      success: true,
      message: "✅ Address & billing information updated successfully!",
      completionPercentage: completionPercentage,
    });
  } catch (err) {
    console.error("❌ Error updating address & billing info:", err);
    res.status(500).json({
      success: false,
      message: "❌ Error updating address & billing information",
    });
  }
};

// ✅ 4️⃣ Update Detailed Professional Information
exports.updateDetailedInfo = async (req, res) => {
  try {
    console.log("🔧 Updating detailed professional information...");
    const {
      title,
      fieldOfStudy,
      specialty,
      aestheticsExperience,
      yearsOfExperience,
      currentWorkplace,
      hasLicense,
      licenseNumber,
      licenseState,
      licenseCountry,
      areasOfInterest,
      trainingGoals,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Initialize professionalInfo if it doesn't exist
    if (!user.professionalInfo) {
      user.professionalInfo = {};
    }

    // Update professional information
    user.professionalInfo.title = title;
    user.professionalInfo.fieldOfStudy = fieldOfStudy;
    user.professionalInfo.specialty = specialty;
    user.professionalInfo.aestheticsExperience = aestheticsExperience;
    user.professionalInfo.yearsOfExperience = yearsOfExperience
      ? parseInt(yearsOfExperience)
      : null;
    user.professionalInfo.currentWorkplace = currentWorkplace;
    user.professionalInfo.areasOfInterest = areasOfInterest || [];
    user.professionalInfo.trainingGoals = trainingGoals;

    // Update license information
    if (!user.professionalInfo.licenseInfo) {
      user.professionalInfo.licenseInfo = {};
    }
    user.professionalInfo.licenseInfo.hasLicense = hasLicense;
    user.professionalInfo.licenseInfo.licenseNumber = hasLicense
      ? licenseNumber
      : null;
    user.professionalInfo.licenseInfo.licenseState = hasLicense
      ? licenseState
      : null;
    user.professionalInfo.licenseInfo.licenseCountry = hasLicense
      ? licenseCountry
      : null;

    // Update profile completion
    if (typeof user.updateProfileCompletion === "function") {
      user.updateProfileCompletion();
    }

    await user.save();

    const completionPercentage = calculateProfileCompletion(user);

    console.log(
      "✅ Detailed information updated successfully for:",
      user.email
    );
    res.json({
      success: true,
      message: "✅ Professional information updated successfully!",
      completionPercentage: completionPercentage,
    });
  } catch (err) {
    console.error("❌ Error updating detailed info:", err);
    res.status(500).json({
      success: false,
      message: "❌ Error updating professional information",
    });
  }
};

// ✅ 5️⃣ Update User Password
exports.updatePassword = async (req, res) => {
  try {
    console.log("🔐 Updating user password...");
    const { currentPassword, newPassword } = req.body;

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "⚠️ Password must be at least 8 characters long",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log("❌ Current password mismatch for user:", user.email);
      return res
        .status(400)
        .json({ success: false, message: "⚠️ Incorrect current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    console.log("✅ Password updated successfully for:", user.email);
    res.json({ success: true, message: "✅ Password updated successfully!" });
  } catch (err) {
    console.error("❌ Error updating password:", err);
    res
      .status(500)
      .json({ success: false, message: "❌ Error updating password" });
  }
};

// ✅ Cloudinary Storage Configuration
const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/user-documents/profile-pictures",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
    public_id: (req, file) => `user-${req.user._id}-profile-${Date.now()}`,
  },
});

const idDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/user-documents/id-documents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    resource_type: "auto",
    public_id: (req, file) => `user-${req.user._id}-id-${Date.now()}`,
  },
});

const profileUpload = multer({
  storage: profilePictureStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const documentUpload = multer({
  storage: idDocumentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ✅ 6️⃣ Handle Document Upload to Cloudinary
exports.uploadDocument = async (req, res) => {
  try {
    let uploadType = req.query.type || req.body.type;

    if (!uploadType || !["profile", "id"].includes(uploadType)) {
      return res.status(400).json({
        success: false,
        message: "❌ Invalid upload type. Must be 'id' or 'profile'",
      });
    }

    let upload = uploadType === "profile" ? profileUpload : documentUpload;

    upload.single("file")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "❌ " + err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "❌ No file uploaded",
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (!user.profileData) user.profileData = {};

      const fileData = {
        filename: req.file.filename || "unknown",
        originalName: req.file.originalname || "unknown",
        url: req.file.path || req.file.secure_url || "unknown",
        uploadDate: new Date(),
        fileSize: req.file.bytes || req.file.size || 0,
        mimeType: req.file.mimetype || req.file.format || "unknown",
        cloudinaryPublicId: req.file.filename || "unknown",
      };

      if (uploadType === "id") {
        user.profileData.identificationDocument = {
          ...fileData,
          documentType: "passport",
          verificationStatus: "pending",
        };
      } else if (uploadType === "profile") {
        user.profileData.profilePicture = fileData;
      }

      if (typeof user.updateProfileCompletion === "function") {
        user.updateProfileCompletion();
      }

      await user.save();

      const message =
        uploadType === "id"
          ? "✅ ID document uploaded successfully!"
          : "✅ Profile picture uploaded successfully!";

      res.json({
        success: true,
        message: message,
        fileUrl: req.file.path,
        uploadType: uploadType,
      });
    });
  } catch (err) {
    console.error("❌ Error in upload document:", err);
    res
      .status(500)
      .json({ success: false, message: "❌ Error uploading document" });
  }
};

// ✅ 7️⃣ Delete Document from Cloudinary
exports.deleteDocument = async (req, res) => {
  try {
    const { type } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let publicId = null;
    let documentName = "";

    if (type === "profile" && user.profileData?.profilePicture) {
      publicId =
        user.profileData.profilePicture.cloudinaryPublicId ||
        user.profileData.profilePicture.filename;
      documentName = "Profile Picture";
      user.profileData.profilePicture = undefined;
    } else if (type === "id" && user.profileData?.identificationDocument) {
      publicId =
        user.profileData.identificationDocument.cloudinaryPublicId ||
        user.profileData.identificationDocument.filename;
      documentName = "ID Document";
      user.profileData.identificationDocument = undefined;
    }

    if (!publicId) {
      return res.status(404).json({
        success: false,
        message: `❌ ${documentName} not found`,
      });
    }

    try {
      const deleteResult = await cloudinary.uploader.destroy(publicId);
      console.log("🗑️ Cloudinary deletion result:", deleteResult);
    } catch (cloudinaryError) {
      console.error("❌ Error deleting from Cloudinary:", cloudinaryError);
    }

    if (typeof user.updateProfileCompletion === "function") {
      user.updateProfileCompletion();
    }
    await user.save();

    res.json({
      success: true,
      message: `✅ ${documentName} deleted successfully!`,
    });
  } catch (err) {
    console.error("❌ Error deleting document:", err);
    res
      .status(500)
      .json({ success: false, message: "❌ Error deleting document" });
  }
};

// ✅ 8️⃣ Get User Profile Data (API endpoint)
exports.getProfileData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const profileData = {
      basicInfo: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        country: user.country,
        profession: user.profession,
      },
      addressInfo: user.addressInfo || {},
      deliveryInfo: user.deliveryInfo || {},
      paymentPreferences: user.paymentPreferences || {},
      professionalInfo: user.professionalInfo || {},
      profileData: user.profileData || {},
      completionPercentage: calculateProfileCompletion(user),
    };

    res.json({ success: true, data: profileData });
  } catch (err) {
    console.error("❌ Error fetching profile data:", err);
    res
      .status(500)
      .json({ success: false, message: "❌ Error fetching profile data" });
  }
};

// ✅ Helper Function: Calculate Profile Completion
function calculateProfileCompletion(user) {
  let completion = 0;
  const weights = {
    basicInfo: 20, // firstName, lastName, email
    addressInfo: 25, // address, city, country
    professionalInfo: 30, // fieldOfStudy, experience, specialty
    profilePicture: 10, // profile picture upload
    identification: 15, // ID/passport upload
  };

  // Basic info completion
  if (user.firstName && user.lastName && user.email) {
    completion += weights.basicInfo;
  }

  // Address info completion (including payment preferences)
  if (
    user.addressInfo?.address &&
    user.addressInfo?.city &&
    user.addressInfo?.country &&
    user.paymentPreferences?.preferredPaymentMethods?.length > 0
  ) {
    completion += weights.addressInfo;
  }

  // Professional info completion
  if (
    user.professionalInfo?.fieldOfStudy &&
    user.professionalInfo?.aestheticsExperience
  ) {
    completion += weights.professionalInfo;
  }

  // Profile picture completion
  if (user.profileData?.profilePicture?.url) {
    completion += weights.profilePicture;
  }

  // ID document completion
  if (user.profileData?.identificationDocument?.url) {
    completion += weights.identification;
  }

  return Math.round(completion);
}

console.log(
  "✅ Complete Enhanced Profile Controller loaded with address/billing support"
);
