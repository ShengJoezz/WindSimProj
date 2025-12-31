// terrain.js - Node.js route handling for terrain operations
const express = require("express");
const path = require("path");
const fs = require("fs");
const Joi = require("joi");
const { spawn, spawnSync } = require("child_process");
const router = express.Router();

// Validate caseId to avoid path traversal and inconsistent behavior
const caseIdSchema = Joi.string()
  .alphanum()
  .min(1)
  .max(50)
  .required()
  .messages({
    "string.alphanum": "工况 ID 只能包含字母和数字",
    "string.min": "工况 ID 至少需要 1 个字符",
    "string.max": "工况 ID 不能超过 50 个字符",
    "any.required": "工况 ID 是必需的",
  });

router.use("/:caseId", (req, res, next) => {
  const { error, value } = caseIdSchema.validate(req.params.caseId);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  req.params.caseId = value;
  next();
});

const parseRequiredNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const validateLatLonBox = ({ minLat, minLon, maxLat, maxLon }) => {
  if (minLat === null || minLon === null || maxLat === null || maxLon === null) {
    return "Missing required coordinates";
  }
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return "Latitude out of range (-90~90)";
  }
  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    return "Longitude out of range (-180~180)";
  }
  if (maxLat <= minLat || maxLon <= minLon) {
    return "Invalid bbox (max must be greater than min)";
  }
  return null;
};

// Preview terrain crop
router.post("/:caseId/terrain/preview-crop", async (req, res) => {
  const { caseId } = req.params;
  const { minLat, minLon, maxLat, maxLon } = req.body;

  console.log("Terrain crop preview request:", { caseId, minLat, minLon, maxLat, maxLon });

  const minLatNum = parseRequiredNumber(minLat);
  const minLonNum = parseRequiredNumber(minLon);
  const maxLatNum = parseRequiredNumber(maxLat);
  const maxLonNum = parseRequiredNumber(maxLon);
  const bboxError = validateLatLonBox({
    minLat: minLatNum,
    minLon: minLonNum,
    maxLat: maxLatNum,
    maxLon: maxLonNum,
  });

  if (bboxError) {
    return res.status(400).json({
      success: false,
      message: bboxError
    });
  }

  try {
    const filePath = path.join(__dirname, `../uploads/${caseId}/terrain.tif`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Terrain file not found" });
    }

    // Prepare arguments for the Python script
    const scriptPath = path.join(__dirname, "../utils/terrain_clipper.py");
    const args = [
      "--preview-only",
      `--bbox=${minLonNum},${minLatNum},${maxLonNum},${maxLatNum}`,
      filePath
    ];

    // Spawn Python process
    const pythonProcess = spawn("python3", [scriptPath, ...args]);

    let dataString = "";
    let errorString = "";

    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    const result = await new Promise((resolve, reject) => {
      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${errorString}`));
        } else {
          try {
            const result = JSON.parse(dataString);
            resolve(result);
          } catch (e) {
            resolve({ output: dataString.trim() });
          }
        }
      });

      pythonProcess.on("error", (error) => {
        reject(error);
      });
    });

    // Return the preview information
    res.json({
      success: true,
      preview: result
    });

  } catch (err) {
    console.error("Error previewing crop:", err);
    res.status(500).json({
      success: false,
      message: "Error previewing terrain crop",
      error: err.message
    });
  }
});
// Apply terrain crop with enhanced debugging
router.post("/:caseId/terrain/crop", async (req, res) => {
  const { caseId } = req.params;
  const { minLat, minLon, maxLat, maxLon } = req.body;

  console.log("Terrain crop request:", { caseId, minLat, minLon, maxLat, maxLon });

  const minLatNum = parseRequiredNumber(minLat);
  const minLonNum = parseRequiredNumber(minLon);
  const maxLatNum = parseRequiredNumber(maxLat);
  const maxLonNum = parseRequiredNumber(maxLon);
  const bboxError = validateLatLonBox({
    minLat: minLatNum,
    minLon: minLonNum,
    maxLat: maxLatNum,
    maxLon: maxLonNum,
  });

  if (bboxError) {
    return res.status(400).json({
      success: false,
      message: bboxError
    });
  }

  try {
    // DEBUG: Check if uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads');
    console.log(`1. Checking if uploads directory exists: ${uploadsDir}`);
    const uploadsExists = fs.existsSync(uploadsDir);
    console.log(`   Uploads directory exists: ${uploadsExists}`);

    // DEBUG: Check if case directory exists
    const caseDir = path.join(__dirname, `../uploads/${caseId}`);
    console.log(`2. Checking if case directory exists: ${caseDir}`);
    const caseDirExists = fs.existsSync(caseDir);
    console.log(`   Case directory exists: ${caseDirExists}`);

    if (!caseDirExists) {
      console.log(`   Creating case directory: ${caseDir}`);
      fs.mkdirSync(caseDir, { recursive: true });
    }

    // Check if the input file exists
    const sourceFilePath = path.join(__dirname, `../uploads/${caseId}/terrain.tif`);
    console.log(`3. Checking if source file exists: ${sourceFilePath}`);
    const sourceExists = fs.existsSync(sourceFilePath);
    console.log(`   Source file exists: ${sourceExists}`);

    if (!sourceExists) {
      console.error(`   Source file not found: ${sourceFilePath}`);
      return res.status(404).json({ success: false, message: "Terrain file not found" });
    }

    // DEBUG: Check file size and permissions
    const stats = fs.statSync(sourceFilePath);
    console.log(`4. File size: ${stats.size} bytes, Mode: ${stats.mode.toString(8)}`);

    // Create a backup if it doesn't exist
    const backupFilePath = path.join(__dirname, `../uploads/${caseId}/terrain_original.tif`);
    console.log(`5. Setting up backup file: ${backupFilePath}`);

    try {
      if (!fs.existsSync(backupFilePath)) {
        console.log('   Creating backup file...');
        fs.copyFileSync(sourceFilePath, backupFilePath);
        console.log('   Backup created successfully');
      } else {
        console.log('   Backup already exists');
      }
    } catch (copyError) {
      console.error('   Error creating backup:', copyError);
      return res.status(500).json({
        success: false,
        message: "Error creating backup",
        error: copyError.message
      });
    }

    // Create temporary file path
    const tempFilePath = path.join(__dirname, `../uploads/${caseId}/terrain_temp.tif`);
    console.log(`6. Setting up temp file path: ${tempFilePath}`);

    // Try a simple gdalinfo command first to verify GDAL works with this file
    console.log(`7. Testing GDAL with gdalinfo on source file`);

    try {
      console.log('   Running gdalinfo command...');
      const gdalInfoResult = spawnSync('gdalinfo', [sourceFilePath], {
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (gdalInfoResult.error) throw gdalInfoResult.error;
      if (gdalInfoResult.status !== 0) {
        throw new Error(gdalInfoResult.stderr || `gdalinfo exited with code ${gdalInfoResult.status}`);
      }
      const gdalInfoOutput = gdalInfoResult.stdout || '';
      console.log('   gdalinfo successful');

      // Optional: Extract some useful info from gdalinfo output
      const sizeMatch = gdalInfoOutput.match(/Size is (\d+), (\d+)/);
      if (sizeMatch) {
        console.log(`   Image size: ${sizeMatch[1]}x${sizeMatch[2]}`);
      }
    } catch (gdalInfoError) {
      console.error('   Error running gdalinfo:', gdalInfoError);
      return res.status(500).json({
        success: false,
        message: "Error running gdalinfo",
        error: gdalInfoError.message
      });
    }

    // Try the crop operation with gdal_translate
    console.log(`8. Running gdal_translate for crop operation`);
    console.log(`   Coordinates: minLon=${minLonNum}, maxLat=${maxLatNum}, maxLon=${maxLonNum}, minLat=${minLatNum}`);

    const gdalArgs = [
      '-projwin',
      String(minLonNum),
      String(maxLatNum),
      String(maxLonNum),
      String(minLatNum),
      '-of',
      'GTiff',
      sourceFilePath,
      tempFilePath,
    ];
    console.log(`   Command: gdal_translate ${gdalArgs.join(' ')}`);

    try {
      console.log('   Executing gdal_translate...');
      const cropResult = spawnSync('gdal_translate', gdalArgs, {
        encoding: 'utf8',
        timeout: 5 * 60_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (cropResult.error) throw cropResult.error;
      if (cropResult.status !== 0) {
        throw new Error(cropResult.stderr || `gdal_translate exited with code ${cropResult.status}`);
      }
      console.log('   gdal_translate output:', cropResult.stdout || cropResult.stderr || '');

      // Check if temp file was created
      if (!fs.existsSync(tempFilePath)) {
        console.error('   Temp file was not created!');
        return res.status(500).json({
          success: false,
          message: "gdal_translate did not create output file"
        });
      }

      console.log('   Temp file created successfully');
      const tempStats = fs.statSync(tempFilePath);
      console.log(`   Temp file size: ${tempStats.size} bytes`);

      // Replace original with cropped version
      console.log('9. Replacing original file with cropped version');
      fs.renameSync(tempFilePath, sourceFilePath);
      console.log('   Original file replaced successfully');

      console.log('10. Crop operation completed');
      return res.json({
        success: true,
        message: "Terrain successfully cropped"
      });

    } catch (cropError) {
      console.error('   Error executing gdal_translate:', cropError);
      return res.status(500).json({
        success: false,
        message: "Error executing gdal_translate",
        error: cropError.message,
        command: `gdal_translate ${gdalArgs.join(' ')}`
      });
    }

  } catch (err) {
    console.error("Error in crop operation:", err);
    return res.status(500).json({
      success: false,
      message: "Error cropping terrain",
      error: err.message,
      stack: err.stack
    });
  }
});

// Save cropped terrain with direct GDAL command
router.post("/:caseId/terrain/save", async (req, res) => {
  const { caseId } = req.params;
  const { filename, format, preserveGeoreference } = req.body;

  console.log("Save terrain request:", { caseId, filename, format, preserveGeoreference });

  if (!filename) {
    return res.status(400).json({
      success: false,
      message: "Filename is required"
    });
  }

  if (typeof filename !== 'string' || filename.length > 200 || /[\\/]/.test(filename) || filename.includes('..')) {
    return res.status(400).json({
      success: false,
      message: "Invalid filename"
    });
  }

  try {
    const sourceFilePath = path.join(__dirname, `../uploads/${caseId}/terrain.tif`);
    const outputFileName = filename + (format === 'geotiff' ? '.tif' : '.asc');
    const outputFilePath = path.join(__dirname, `../uploads/${caseId}`, outputFileName);

    console.log(`1. Checking if source file exists: ${sourceFilePath}`);
    if (!fs.existsSync(sourceFilePath)) {
      return res.status(404).json({ success: false, message: "Terrain file not found" });
    }

    console.log(`2. Setting up output file path: ${outputFilePath}`);

    // Use gdal_translate directly
    const { spawn } = require('child_process');

    let gdalArgs = [
      '-of', format === 'geotiff' ? 'GTiff' : 'AAIGrid'
    ];

    // Add compression for GeoTIFF
    if (format === 'geotiff') {
      gdalArgs.push('-co', 'COMPRESS=LZW');
    }

    // Add source and destination paths
    gdalArgs.push(sourceFilePath, outputFilePath);

    console.log(`3. Running gdal_translate with args: ${gdalArgs.join(' ')}`);

    const gdalProcess = spawn('gdal_translate', gdalArgs);

    let stdoutData = '';
    let stderrData = '';

    gdalProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`GDAL stdout: ${data}`);
    });

    gdalProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log(`GDAL stderr: ${data}`);
    });

    await new Promise((resolve, reject) => {
      gdalProcess.on('close', (code) => {
        console.log(`GDAL process exited with code ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`GDAL process failed with code ${code}: ${stderrData}`));
        }
      });
    });

    // For ASCII Grid, remove .prj file if preserveGeoreference is false
    if (format !== 'geotiff' && !preserveGeoreference) {
      const prjFile = outputFilePath.replace(/\.[^.]+$/, '.prj');
      if (fs.existsSync(prjFile)) {
        await fs.promises.unlink(prjFile);
        console.log(`Removed PRJ file: ${prjFile}`);
      }
    }

    console.log(`4. File created successfully at ${outputFilePath}`);

    // Send the file back to client
    res.download(outputFilePath, outputFileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }

      // Don't delete the file immediately - it gives front-end time to download
      // You might want to implement a cleanup job for these temporary files
      /*
      fs.unlink(outputFilePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error removing output file:", unlinkErr);
        }
      });
      */
    });

  } catch (err) {
    console.error("Error saving terrain:", err);
    res.status(500).json({
      success: false,
      message: "Error saving terrain",
      error: err.message
    });
  }
});

// Restore original terrain
router.post("/:caseId/terrain/restore", async (req, res) => {
  const { caseId } = req.params;

  try {
    const originalFilePath = path.join(__dirname, `../uploads/${caseId}/terrain_original.tif`);
    const currentFilePath = path.join(__dirname, `../uploads/${caseId}/terrain.tif`);

    if (!fs.existsSync(originalFilePath)) {
      return res.status(404).json({
        success: false,
        message: "No original terrain backup found"
      });
    }

    // Restore from backup
    await fs.promises.copyFile(originalFilePath, currentFilePath);

    res.json({
      success: true,
      message: "Original terrain restored"
    });
  } catch (err) {
    console.error("Error restoring original terrain:", err);
    res.status(500).json({
      success: false,
      message: "Error restoring original terrain",
      error: err.message
    });
  }
});

module.exports = router;
