// utils/ccavenueUtils.js - CCAvenue Encryption/Decryption Utility

const crypto = require("crypto");

class CCavenueUtils {
  constructor(workingKey) {
    this.workingKey = workingKey;
  }

  // Encrypt function for CCAvenue
  encrypt(plainText) {
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
  }

  // Decrypt function for CCAvenue response
  decrypt(encText) {
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
  }
}

module.exports = CCavenueUtils;
