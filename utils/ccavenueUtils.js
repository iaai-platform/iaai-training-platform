// utils/ccavenueUtils.js - Safe version for development

const crypto = require("crypto");

class CCavenueUtils {
  constructor(workingKey) {
    if (!workingKey) {
      console.log(
        "⚠️ CCAvenue working key not provided - running in development mode"
      );
      this.workingKey = "development_key_placeholder";
      this.isDevelopment = true;
    } else {
      this.workingKey = workingKey;
      this.isDevelopment = false;
    }
  }

  // Encrypt function for CCAvenue
  encrypt(plainText) {
    if (this.isDevelopment) {
      console.log("⚠️ CCAvenue encrypt called in development mode");
      return "development_encrypted_data";
    }

    try {
      const md5 = crypto.createHash("md5").update(this.workingKey).digest();
      const keyBase64 = Buffer.from(md5).toString("base64");
      const ivBase64 = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
        0x0c, 0x0d, 0x0e, 0x0f,
      ]).toString("base64");

      const cipher = crypto.createCipheriv(
        "aes-128-cbc",
        Buffer.from(keyBase64, "base64"),
        Buffer.from(ivBase64, "base64")
      );
      let encrypted = cipher.update(plainText, "utf8", "hex");
      encrypted += cipher.final("hex");
      return encrypted;
    } catch (error) {
      console.error("❌ CCAvenue encryption error:", error);
      return "encryption_error";
    }
  }

  // Decrypt function for CCAvenue response
  decrypt(encText) {
    if (this.isDevelopment) {
      console.log("⚠️ CCAvenue decrypt called in development mode");
      return "order_status=Success&order_id=DEV_ORDER&tracking_id=DEV_TRACK&amount=99.99&merchant_param1=DEV_TXN&merchant_param2=DEV_USER";
    }

    try {
      const md5 = crypto.createHash("md5").update(this.workingKey).digest();
      const keyBase64 = Buffer.from(md5).toString("base64");
      const ivBase64 = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
        0x0c, 0x0d, 0x0e, 0x0f,
      ]).toString("base64");

      const decipher = crypto.createDecipheriv(
        "aes-128-cbc",
        Buffer.from(keyBase64, "base64"),
        Buffer.from(ivBase64, "base64")
      );
      let decrypted = decipher.update(encText, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      console.error("❌ CCAvenue decryption error:", error);
      return "decryption_error";
    }
  }
}

module.exports = CCavenueUtils;
