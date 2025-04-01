/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 17:44:55
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-01 12:43:22
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\windTurbinesRouter.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
// backend/routes/windTurbines.js

const express = require('express');
const router = express.Router({ mergeParams: true }); // 合并来自父路由器的 :caseId
const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 风机验证模式
const windTurbineSchema = Joi.object({
  id: Joi.string().optional(), // 如果后端分配 ID，则此项可以可选
  name: Joi.string().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  hubHeight: Joi.number().required(),
  rotorDiameter: Joi.number().required(),
  type: Joi.string().optional(),
});

// 获取风机数据路径的辅助函数
const getWindTurbinesPath = (caseId) => {
  return path.join(__dirname, '../uploads', caseId, 'wind_turbines.json');
};

// 读取风机数据的辅助函数
const readWindTurbines = (caseId) => {
  const turbinesPath = getWindTurbinesPath(caseId);
  if (!fs.existsSync(turbinesPath)) {
    return [];
  }
  const data = fs.readFileSync(turbinesPath, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error parsing wind_turbines.json for case ${caseId}:`, err);
    return [];
  }
};

// 写入风机数据的辅助函数
const writeWindTurbines = (caseId, turbines) => {
  const turbinesPath = getWindTurbinesPath(caseId);
  fs.writeFileSync(turbinesPath, JSON.stringify(turbines, null, 2), 'utf-8');
};

// 路由：POST /api/cases/:caseId/wind-turbines
// 描述：添加单个风机
router.post('/', (req, res) => {
  const { caseId } = req.params;
  const turbineData = req.body;

  // 验证输入
  const { error, value } = windTurbineSchema.validate(turbineData);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  // 如果未提供，则分配 ID
  if (!value.id) {
    value.id = uuidv4();
  }

  // 读取现有风机
  const turbines = readWindTurbines(caseId);

  // 检查重复的名称或 ID
  if (turbines.some(t => t.id === value.id || t.name === value.name)) {
    return res.status(400).json({ success: false, message: 'Wind turbine with the same ID or name already exists.' });
  }

  // 添加新风机
  turbines.push(value);
  writeWindTurbines(caseId, turbines);

  res.status(201).json({ success: true, message: 'Wind turbine added successfully.', turbine: value });
});

// 路由：POST /api/cases/:caseId/wind-turbines/bulk
// 描述：添加多个风机（批量上传）
router.post('/bulk', async (req, res) => {
  const { caseId } = req.params;
  const turbinesData = req.body;

  console.log('Received bulk wind turbines request:', {
    caseId,
    turbinesCount: turbinesData.length
  });

  try {
    if (!Array.isArray(turbinesData)) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的数据格式：需要风机数组' 
      });
    }

    const validTurbines = [];
    const errors = [];

    // Validate each turbine
    turbinesData.forEach((turbine, index) => {
      try {
        // Basic validation
        if (!turbine.name || !turbine.longitude || !turbine.latitude || 
            !turbine.hubHeight || !turbine.rotorDiameter) {
          errors.push(`第 ${index + 1} 行数据不完整`);
          return;
        }

        // Add unique ID if not present
        const validTurbine = {
          id: turbine.id || `WT_${Date.now()}_${index}`,
          name: turbine.name,
          longitude: parseFloat(turbine.longitude),
          latitude: parseFloat(turbine.latitude),
          hubHeight: parseFloat(turbine.hubHeight),
          rotorDiameter: parseFloat(turbine.rotorDiameter),
          model: turbine.model || null
        };

        validTurbines.push(validTurbine);
      } catch (error) {
        errors.push(`第 ${index + 1} 行数据验证失败: ${error.message}`);
      }
    });

    // If there are any errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors
      });
    }

    // Save turbines to the case directory
    const casePath = path.join(__dirname, '../uploads', caseId);
    const turbinesPath = path.join(casePath, 'wind_turbines.json');

    // Create directory if it doesn't exist
    await fs.promises.mkdir(casePath, { recursive: true });

    // Read existing turbines if any
    let existingTurbines = [];
    try {
      if (await fs.promises.access(turbinesPath).then(() => true).catch(() => false)) {
        const data = await fs.promises.readFile(turbinesPath, 'utf8');
        existingTurbines = JSON.parse(data);
      }
    } catch (error) {
      console.warn('No existing turbines found or error reading file:', error);
    }

    // Combine existing and new turbines
    const allTurbines = [...existingTurbines, ...validTurbines];

    // Save all turbines
    await fs.promises.writeFile(
      turbinesPath, 
      JSON.stringify(allTurbines, null, 2)
    );

    console.log('Successfully saved turbines:', {
      caseId,
      newTurbinesCount: validTurbines.length,
      totalTurbinesCount: allTurbines.length
    });

    res.json({
      success: true,
      message: `成功添加 ${validTurbines.length} 个风机`,
      turbines: validTurbines
    });

  } catch (error) {
    console.error('Error processing bulk wind turbines:', error);
    res.status(500).json({
      success: false,
      message: '处理风机数据失败',
      error: error.message
    });
  }
});

// 路由：GET /api/cases/:caseId/wind-turbines
// 描述：检索特定工况的所有风机
router.get('/', (req, res) => {
  const { caseId } = req.params;
  const turbines = readWindTurbines(caseId);
  res.json({ success: true, turbines });
});

// 路由：GET /api/cases/:caseId/wind-turbines/:turbineId
// 描述：检索特定的风机
router.get('/:turbineId', (req, res) => {
  const { caseId, turbineId } = req.params;
  const turbines = readWindTurbines(caseId);
  const turbine = turbines.find(t => t.id === turbineId);
  if (!turbine) {
    return res.status(404).json({ success: false, message: 'Wind turbine not found.' });
  }
  res.json({ success: true, turbine });
});

// 路由：PUT /api/cases/:caseId/wind-turbines/:turbineId
// 描述：更新特定的风机
router.put('/:turbineId', (req, res) => {
  const { caseId, turbineId } = req.params;
  const updatedData = req.body;

  // 验证输入
  const { error, value } = windTurbineSchema.validate(updatedData);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  // 读取现有风机
  const turbines = readWindTurbines(caseId);
  const turbineIndex = turbines.findIndex(t => t.id === turbineId);
  if (turbineIndex === -1) {
    return res.status(404).json({ success: false, message: 'Wind turbine not found.' });
  }

  // 防止重复的名称或 ID（不包括当前风机）
  if (turbines.some(t => (t.id === value.id || t.name === value.name) && t.id !== turbineId)) {
    return res.status(400).json({ success: false, message: 'Another wind turbine with the same ID or name already exists.' });
  }

  // 更新风机数据
  turbines[turbineIndex] = { ...turbines[turbineIndex], ...value };
  writeWindTurbines(caseId, turbines);

  res.json({ success: true, message: 'Wind turbine updated successfully.', turbine: turbines[turbineIndex] });
});

// 路由：DELETE /api/cases/:caseId/wind-turbines/:turbineId
// 描述：删除特定的风机
router.delete('/:turbineId', (req, res) => {
  const { caseId, turbineId } = req.params;
  let turbines = readWindTurbines(caseId);
  const turbineIndex = turbines.findIndex(t => t.id === turbineId);
  if (turbineIndex === -1) {
    return res.status(404).json({ success: false, message: 'Wind turbine not found.' });
  }

  // 删除风机
  const removedTurbine = turbines.splice(turbineIndex, 1)[0];
  writeWindTurbines(caseId, turbines);

  res.json({ success: true, message: 'Wind turbine deleted successfully.', turbine: removedTurbine });
});

module.exports = router;