const express = require("express");
const path = require("path");
const GeoTIFF = require("geotiff");
const fs = require("fs").promises;
const Joi = require("joi");
const cache = require("memory-cache");

const router = express.Router();

// Cache duration: 1 hour (in milliseconds)
const CACHE_DURATION = 3600000;

// Validation schema for caseId
const caseIdSchema = Joi.string()
  .alphanum()
  .min(1)
  .max(50)
  .required()
  .messages({
    "string.alphanum": "Case ID must only contain alphanumeric characters",
    "string.min": "Case ID must be at least 1 character long",
    "string.max": "Case ID must be at most 50 characters long",
    "any.required": "Case ID is required",
  });

// Validate caseId middleware
const validateCaseId = (req, res, next) => {
  const { error, value } = caseIdSchema.validate(req.params.caseId);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  req.params.caseId = value; // Use the validated value
  next();
};

// Apply the middleware to all routes that use caseId
router.use("/:caseId", validateCaseId);

// Helper function for sending error responses
const sendErrorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({ error: message });
};

// Get terrain data metadata with caching
router.get("/:caseId/metadata", async (req, res) => {
  const { caseId } = req.params; // Assuming caseId is already validated
  const cacheKey = `metadata_${caseId}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const filePath = path.join(
      __dirname,
      `../uploads/${caseId}/terrain.tif`
    );
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();

    const metadata = {
      width: image.getWidth(),
      height: image.getHeight(),
      bbox,
      minZoom: 0,
      maxZoom: Math.ceil(
        Math.log2(Math.max(image.getWidth(), image.getHeight()) / 256)
      ),
    };

    cache.put(cacheKey, metadata, CACHE_DURATION);
    res.json(metadata);
  } catch (err) {
    console.error("Error getting metadata:", err);
    sendErrorResponse(res, 500, "Error retrieving terrain metadata");
  }
});

// Provide complete GeoTIFF data
router.get("/:caseId/terrain", async (req, res) => {
  const { caseId } = req.params;
  try {
    const filePath = path.join(
      __dirname,
      `../uploads/${caseId}/terrain.tif`
    );
    const data = await fs.readFile(filePath);

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(data);
  } catch (err) {
    console.error("Error sending GeoTIFF:", err);
    sendErrorResponse(res, 500, "Error sending terrain data");
  }
});

// Handle elevation data statistics with caching
router.get("/:caseId/statistics", async (req, res) => {
  const { caseId } = req.params;
  const cacheKey = `statistics_${caseId}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const filePath = path.join(
      __dirname,
      `../uploads/${caseId}/terrain.tif`
    );
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const data = rasters[0];

    const statistics = {
      min: Math.min(...data),
      max: Math.max(...data),
      mean: data.reduce((a, b) => a + b, 0) / data.length,
    };

    cache.put(cacheKey, statistics, CACHE_DURATION);
    res.json(statistics);
  } catch (err) {
    console.error("Error calculating statistics:", err);
    sendErrorResponse(res, 500, "Error calculating terrain statistics");
  }
});

module.exports = router;