/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 18:05:02
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 20:33:13
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\middleware\fireUpload.js
 * @Description: Multer middleware for handling file uploads with filtering and logging.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Use synchronous fs for initial dir check within multer setup

// Define TEMP_DIR consistently
const TEMP_DIR = path.join(__dirname, '..', 'uploads', 'temp');

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure temp directory exists (sync is acceptable here during setup)
    try {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        cb(null, TEMP_DIR); // Save to temp directory first
    } catch (error) {
         console.error("[Multer Storage] Error ensuring temp directory exists:", error);
         cb(error); // Pass error to multer
    }
  },
  filename: (req, file, cb) => {
    // Generate a unique filename (timestamp + originalname)
    // Note: originalname might contain unsafe characters, consider sanitizing if needed
    const uniqueSuffix = Date.now();
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Basic sanitization
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  }
});

// Multer file filter configuration
const fileFilter = (req, file, cb) => {
  console.log(`[File Filter] Checking file: ${file.originalname}`); // Log filename
  const allowedTypes = ['.txt', '.csv']; // Allowed extensions
  const ext = path.extname(file.originalname).toLowerCase();
  console.log(`[File Filter] Detected extension: ${ext}`); // Log extension

  if (allowedTypes.includes(ext)) {
    console.log(`[File Filter] File type '${ext}' allowed.`);
    cb(null, true); // Accept the file
  } else {
    console.error(`[File Filter] File type '${ext}' NOT allowed.`); // Log rejection
    // Reject file with a specific MulterError for better handling later
    const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'); // Update field name to 'file'
    error.message = `不支持的文件类型: ${ext} (只允许 ${allowedTypes.join(', ')})`; // Specific message
    cb(error); // Pass the MulterError
  }
};

// Create the Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 100 // Example limit: 100MB per file
    // You can add other limits like number of files etc.
  }
});

module.exports = upload; // Export the configured multer instance