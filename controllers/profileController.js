// controllers/profileController.js - Final Complete Version with All Debugging
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

// ✅ 1️⃣ Fetch User Profile - Enhanced with Professional Info
exports.getProfilePage = async (req, res) => {
  try {
    console.log("🔍 Fetching user profile...");
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    console.log("👤 User found:", user.email);
    console.log(
      "📊 Profile completion:",
      user.profileCompletionPercentage || 25
    );

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

// ✅ 3️⃣ Update Detailed Professional Information
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

// ✅ 4️⃣ Update User Password
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

// ✅ 5️⃣ Cloudinary Storage Configuration - FINAL VERSION
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
    resource_type: "auto", // Handles both images and PDFs
    public_id: (req, file) => `user-${req.user._id}-id-${Date.now()}`,
  },
});

console.log("📁 Cloudinary storage configurations created:");
console.log(
  "📸 Profile pictures → iaai-platform/user-documents/profile-pictures"
);
console.log("📄 ID documents → iaai-platform/user-documents/id-documents");

// ✅ Multer Configuration for Different File Types
const profileUpload = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for profile pictures
  },
});

const documentUpload = multer({
  storage: idDocumentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for ID documents
  },
});

console.log("📤 Multer upload configurations created:");
console.log("📸 profileUpload → 2MB limit, profile-pictures folder");
console.log("📄 documentUpload → 5MB limit, id-documents folder");

// ✅ 6️⃣ Handle Document Upload to Cloudinary - FIXED VERSION
exports.uploadDocument = async (req, res) => {
  try {
    console.log("=".repeat(60));
    console.log("📤 STARTING DOCUMENT UPLOAD TO CLOUDINARY");
    console.log("=".repeat(60));

    console.log("📥 Initial request body:", req.body);
    console.log("📥 Initial request query:", req.query);

    // FIRST: Try to determine upload type from URL or query parameters
    // Since we need to know which multer to use BEFORE processing
    let uploadType = req.query.type || req.body.type;

    if (!uploadType) {
      // If no type specified, try to guess from the input field name or other clues
      console.log("⚠️ No upload type specified, checking for clues...");
      return res.status(400).json({
        success: false,
        message:
          "❌ Upload type must be specified. Add '?type=profile' or '?type=id' to the URL",
      });
    }

    console.log("📤 Upload type detected:", uploadType);
    console.log(
      "📤 Upload type is valid:",
      ["profile", "id"].includes(uploadType)
    );

    // Validate upload type
    if (!["profile", "id"].includes(uploadType)) {
      console.log("❌ INVALID UPLOAD TYPE:", uploadType);
      return res.status(400).json({
        success: false,
        message: "❌ Invalid upload type. Must be 'id' or 'profile'",
      });
    }

    // CRITICAL: Choose the correct storage based on upload type
    let upload;
    let expectedFolder;

    if (uploadType === "profile") {
      upload = profileUpload;
      expectedFolder = "iaai-platform/user-documents/profile-pictures";
      console.log("📸 USING PROFILE UPLOAD STORAGE");
      console.log("📸 Expected folder:", expectedFolder);
    } else if (uploadType === "id") {
      upload = documentUpload;
      expectedFolder = "iaai-platform/user-documents/id-documents";
      console.log("📄 USING ID DOCUMENT UPLOAD STORAGE");
      console.log("📄 Expected folder:", expectedFolder);
    }

    console.log("🔧 About to call upload.single('file')...");

    upload.single("file")(req, res, async (err) => {
      console.log("🔧 Inside multer callback...");
      console.log("📥 After multer - Request body:", req.body);
      console.log("📥 After multer - File present:", !!req.file);

      if (err) {
        console.error("❌ CLOUDINARY UPLOAD ERROR:", err);
        console.error("❌ Error details:", err.message);
        return res.status(400).json({
          success: false,
          message: "❌ " + err.message,
        });
      }

      if (!req.file) {
        console.error("❌ NO FILE IN REQUEST AFTER MULTER");
        console.error("❌ Request body after multer:", req.body);
        console.error(
          "❌ This usually means the file input name doesn't match 'file'"
        );
        return res.status(400).json({
          success: false,
          message: "❌ No file uploaded - check file input name",
        });
      }

      console.log("✅ FILE UPLOADED SUCCESSFULLY!");
      console.log(
        "🔍 Complete req.file object:",
        JSON.stringify(req.file, null, 2)
      );

      // Safe logging with null checks
      const safePublicId = req.file.public_id || "undefined";
      const safePath = req.file.path || req.file.secure_url || "undefined";
      const safeOriginalname = req.file.originalname || "undefined";
      const safeSize = req.file.size || req.file.bytes || "undefined";
      const safeMimetype = req.file.mimetype || "undefined";

      console.log("☁️ Cloudinary response:", {
        path: safePath,
        public_id: safePublicId,
        folder:
          safePublicId !== "undefined"
            ? safePublicId.split("/").slice(0, -1).join("/")
            : "undefined",
        originalname: safeOriginalname,
        size: safeSize,
        mimetype: safeMimetype,
      });

      console.log("✅ File uploaded to Cloudinary:", safePath);
      console.log("☁️ Cloudinary public_id:", safePublicId);
      console.log("🎯 Expected folder:", expectedFolder);

      // Safe folder extraction
      const actualFolder =
        safePublicId !== "undefined"
          ? safePublicId.split("/").slice(0, -1).join("/")
          : "unknown";
      console.log("🎯 Actual folder from public_id:", actualFolder);

      // Check if file went to correct folder
      if (actualFolder === expectedFolder) {
        console.log("✅ FILE WENT TO CORRECT FOLDER!");
      } else {
        console.log("❌ FILE WENT TO WRONG FOLDER!");
        console.log("❌ Expected:", expectedFolder);
        console.log("❌ Actual:", actualFolder);
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Initialize profileData if it doesn't exist
      if (!user.profileData) {
        user.profileData = {};
        console.log("🔧 Initialized user.profileData");
      }

      const fileData = {
        filename: req.file.filename || "unknown",
        originalName: req.file.originalname || "unknown",
        url: req.file.path || req.file.secure_url || "unknown",
        uploadDate: new Date(),
        fileSize: req.file.bytes || req.file.size || 0,
        mimeType: req.file.mimetype || req.file.format || "unknown",
        cloudinaryPublicId: req.file.filename || "unknown", // This should be saved!
      };

      console.log("💾 File data to store (with cloudinaryPublicId):", fileData);
      console.log("🔍 cloudinaryPublicId value:", req.file.filename);

      // Store in separate fields to avoid conflicts
      if (uploadType === "id") {
        const documentData = {
          ...fileData,
          documentType: "passport", // Default
          verificationStatus: "pending",
        };
        user.profileData.identificationDocument = documentData;
        console.log("📄 ✅ ID DOCUMENT STORED IN DATABASE");
        console.log("📄 Stored in: user.profileData.identificationDocument");
        console.log(
          "📄 Document data being saved:",
          JSON.stringify(documentData, null, 2)
        );
        console.log("📄 Document URL:", req.file.path);
      } else if (uploadType === "profile") {
        user.profileData.profilePicture = fileData;
        console.log("📸 ✅ PROFILE PICTURE STORED IN DATABASE");
        console.log("📸 Stored in: user.profileData.profilePicture");
        console.log(
          "📸 Picture data being saved:",
          JSON.stringify(fileData, null, 2)
        );
        console.log("📸 Picture URL:", req.file.path);
      }

      // Update profile completion
      if (typeof user.updateProfileCompletion === "function") {
        user.updateProfileCompletion();
        console.log("📊 Profile completion updated");
      }

      await user.save();
      console.log("💾 User data saved to database");

      const message =
        uploadType === "id"
          ? "✅ ID document uploaded successfully! It will be reviewed for verification."
          : "✅ Profile picture uploaded successfully!";

      console.log("=".repeat(60));
      console.log("✅ UPLOAD COMPLETED SUCCESSFULLY");
      console.log("=".repeat(60));

      res.json({
        success: true,
        message: message,
        fileUrl: req.file.path, // Return Cloudinary URL
        uploadType: uploadType, // Return type for frontend handling
        actualFolder: actualFolder, // For debugging
        expectedFolder: expectedFolder, // For debugging
      });
    });
  } catch (err) {
    console.error("❌ CRITICAL ERROR IN UPLOAD DOCUMENT:", err);
    console.error("❌ Stack trace:", err.stack);
    res
      .status(500)
      .json({ success: false, message: "❌ Error uploading document" });
  }
};

// ✅ 7️⃣ Delete Document from Cloudinary
exports.deleteDocument = async (req, res) => {
  try {
    console.log("🗑️ STARTING DOCUMENT DELETION");
    const { type } = req.body; // 'profile' or 'id'
    console.log("🗑️ Delete type:", type);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log(
      "🔍 User profileData:",
      JSON.stringify(user.profileData, null, 2)
    );

    let publicId = null;
    let documentName = "";

    if (type === "profile") {
      console.log("🔍 Checking for profile picture...");
      console.log(
        "🔍 Profile picture exists:",
        !!user.profileData?.profilePicture
      );
      console.log("🔍 Profile picture data:", user.profileData?.profilePicture);

      if (user.profileData?.profilePicture) {
        // Try cloudinaryPublicId first, then fallback to filename
        publicId =
          user.profileData.profilePicture.cloudinaryPublicId ||
          user.profileData.profilePicture.filename;
        documentName = "Profile Picture";
        user.profileData.profilePicture = undefined;
        console.log("🗑️ Deleting profile picture with publicId:", publicId);
      } else {
        console.log("❌ Profile picture not found");
      }
    } else if (type === "id") {
      console.log("🔍 Checking for ID document...");
      console.log(
        "🔍 ID document exists:",
        !!user.profileData?.identificationDocument
      );
      console.log(
        "🔍 ID document data:",
        user.profileData?.identificationDocument
      );

      if (user.profileData?.identificationDocument) {
        // Try cloudinaryPublicId first, then fallback to filename
        publicId =
          user.profileData.identificationDocument.cloudinaryPublicId ||
          user.profileData.identificationDocument.filename;
        documentName = "ID Document";
        user.profileData.identificationDocument = undefined;
        console.log("🗑️ Deleting ID document with publicId:", publicId);
      } else {
        console.log("❌ ID document not found");
      }
    }

    if (!publicId) {
      console.log("❌ No publicId found for deletion:", type);
      return res.status(404).json({
        success: false,
        message: `❌ ${
          type === "profile" ? "Profile picture" : "ID document"
        } not found`,
      });
    }

    try {
      // Delete from Cloudinary
      console.log("🗑️ Attempting to delete from Cloudinary:", publicId);
      const deleteResult = await cloudinary.uploader.destroy(publicId);
      console.log("🗑️ Cloudinary deletion result:", deleteResult);
      console.log("🗑️ ✅ Deleted from Cloudinary:", publicId);
    } catch (cloudinaryError) {
      console.error("❌ Error deleting from Cloudinary:", cloudinaryError);
      // Continue anyway to remove from database
    }

    // Update profile completion
    if (typeof user.updateProfileCompletion === "function") {
      user.updateProfileCompletion();
    }
    await user.save();
    console.log("💾 User data updated after deletion");

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
    basicInfo: 25, // firstName, lastName, email
    professionalInfo: 40, // fieldOfStudy, experience, specialty
    profilePicture: 15, // profile picture upload
    identification: 20, // ID/passport upload
  };

  // Basic info completion (required at signup)
  if (user.firstName && user.lastName && user.email) {
    completion += weights.basicInfo;
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

console.log("✅ Profile Controller fully loaded with all functions");
