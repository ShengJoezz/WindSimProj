/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:55:45
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:56:04
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\utils\fileUtils.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// backend/utils/fileUtils.js
const fs = require('fs').promises; // Use the promise-based API
const path = require('path');

/**
 * Ensures that a directory exists. If it doesn't exist, it's created recursively.
 * @param {string} dirPath The absolute path to the directory.
 * @returns {Promise<void>} A promise that resolves when the directory exists or is created, or rejects on error.
 */
async function ensureDirectoryExists(dirPath) {
  try {
    // fs.mkdir with recursive: true will create parent directories if they don't exist
    // and won't throw an error if the directory already exists.
    await fs.mkdir(dirPath, { recursive: true });
    // console.log(`Directory ensured: ${dirPath}`); // Optional: for debugging
  } catch (error) {
    // Catch errors other than the directory already existing (though mkdir recursive handles this)
    // Primarily useful for permission errors etc.
    console.error(`Error ensuring directory ${dirPath}:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

module.exports = {
  ensureDirectoryExists,
  // Add other file utility functions here if needed in the future
};