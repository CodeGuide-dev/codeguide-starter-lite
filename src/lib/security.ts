import crypto from "crypto";

// AES-256 encryption for sensitive data at rest
const algorithm = "aes-256-gcm";
const keyLength = 32; // 256 bits

// Generate or get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  
  // If key is shorter than required, derive it using PBKDF2
  if (key.length < keyLength * 2) { // *2 because hex encoding
    return crypto.pbkdf2Sync(key, "salt", 100000, keyLength, "sha256");
  }
  
  return Buffer.from(key, "hex");
}

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  authTag: string;
}

export function encrypt(text: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedText: encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

export function decrypt(encryptedData: EncryptedData): string {
  try {
    const key = getEncryptionKey();
    const { encryptedText, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

// Hash function for passwords (though we use Clerk, this is for other sensitive data)
export function hashData(data: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const [salt, hash] = hashedData.split(":");
    const dataHash = crypto.pbkdf2Sync(data, salt, 100000, 64, "sha256").toString("hex");
    return hash === dataHash;
  } catch (error) {
    return false;
  }
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
}

// Validate UUID format
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Content Security Policy headers
export const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.clerk.accounts.dev *.clerk.com",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: *.supabase.co *.clerk.com",
    "connect-src 'self' *.supabase.co *.clerk.accounts.dev *.clerk.com wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Rate limiting configurations
export const rateLimits = {
  auth: { points: 5, duration: 900 }, // 5 attempts per 15 minutes
  api: { points: 100, duration: 3600 }, // 100 requests per hour
  upload: { points: 10, duration: 3600 }, // 10 uploads per hour
  export: { points: 5, duration: 3600 }, // 5 exports per hour
};