/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 17:44:55
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-14 20:09:37
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
  type: Joi.number().optional(), 
  model: Joi.string().allow('', null).optional()
});

const normalizeModelId = (model, fallbackType) => {
  const asString = model === null || model === undefined ? '' : String(model).trim();
  if (asString) {
    const asNumber = Number(asString);
    if (Number.isFinite(asNumber)) {
      const intModel = Math.trunc(asNumber);
      if (intModel >= 1 && intModel <= 10) return String(intModel);
    }
  }

  const asType = Number(fallbackType);
  if (Number.isFinite(asType)) {
    const intType = Math.trunc(asType);
    if (intType >= 1 && intType <= 10) return String(intType);
  }
  return '1';
};

const normalizeTypeId = (type, modelId) => {
  const fromType = Number(type);
  if (Number.isFinite(fromType)) {
    const intType = Math.trunc(fromType);
    if (intType >= 1 && intType <= 10) return intType;
  }

  const fromModel = Number(modelId);
  if (Number.isFinite(fromModel)) {
    const intType = Math.trunc(fromModel);
    if (intType >= 1 && intType <= 10) return intType;
  }

  return 1;
};

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
  fs.mkdirSync(path.dirname(turbinesPath), { recursive: true });
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
    console.error(`[VALIDATION FAILED] Joi validation error for case ${caseId}:`, error.details[0].message);
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  // 如果未提供，则分配 ID
  if (!value.id) {
    value.id = uuidv4();
  }

  // 读取现有风机
  const turbines = readWindTurbines(caseId);

  // 检查重复的名称或 ID
  if (turbines.some(t => t.id === value.id)) {
    console.error(`[DUPLICATE CHECK FAILED] Duplicate ID found for case ${caseId}. ID: ${value.id}`);
    return res.status(400).json({ success: false, message: `Wind turbine with the same ID (${value.id}) already exists.` });
  }
  if (turbines.some(t => t.name === value.name)) {
      console.error(`[DUPLICATE CHECK FAILED] Duplicate name found for case ${caseId}. Name: ${value.name}`);
      return res.status(400).json({ success: false, message: `Wind turbine with the same name ('${value.name}') already exists.` });
  }

  const modelId = normalizeModelId(value.model, value.type);
  const typeId = normalizeTypeId(value.type, modelId);
  const normalized = {
    ...value,
    model: modelId,
    type: typeId,
  };

  // 添加新风机
  turbines.push(normalized);
  writeWindTurbines(caseId, turbines);

  console.log(`[SUCCESS] Wind turbine '${normalized.name}' added successfully to case ${caseId}.`);
  res.status(201).json({ success: true, message: 'Wind turbine added successfully.', turbine: normalized });
});

// 路由：POST /api/cases/:caseId/wind-turbines/bulk
// 描述：添加多个风机（批量上传）
router.post('/bulk', async (req, res) => {
  const { caseId } = req.params;
  const turbinesData = req.body;

  console.log('Received bulk wind turbines request:', {
    caseId,
    turbinesCount: Array.isArray(turbinesData) ? turbinesData.length : null,
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

    // Read existing turbines if any
    const casePath = path.join(__dirname, '../uploads', caseId);
    const turbinesPath = path.join(casePath, 'wind_turbines.json');
    await fs.promises.mkdir(casePath, { recursive: true });

    let existingTurbines = [];
    try {
      if (await fs.promises.access(turbinesPath).then(() => true).catch(() => false)) {
        const data = await fs.promises.readFile(turbinesPath, 'utf8');
        existingTurbines = JSON.parse(data);
      }
    } catch (error) {
      console.warn('No existing turbines found or error reading file:', error);
    }

    const existingIds = new Set(existingTurbines.map(t => t?.id).filter(Boolean));
    const existingNames = new Set(existingTurbines.map(t => t?.name).filter(Boolean));
    const incomingIds = new Set();
    const incomingNames = new Set();

    // Validate each turbine
    turbinesData.forEach((turbine, index) => {
      try {
        const name = turbine?.name ? String(turbine.name).trim() : '';
        const longitude = turbine?.longitude;
        const latitude = turbine?.latitude;
        const hubHeight = turbine?.hubHeight;
        const rotorDiameter = turbine?.rotorDiameter;

        if (!name) {
          errors.push(`第 ${index + 1} 行缺少名称`);
          return;
        }

        const lon = Number(longitude);
        const lat = Number(latitude);
        const hub = Number(hubHeight);
        const rotor = Number(rotorDiameter);

        if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
          errors.push(`第 ${index + 1} 行经度无效 (${longitude})`);
          return;
        }
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          errors.push(`第 ${index + 1} 行纬度无效 (${latitude})`);
          return;
        }
        if (!Number.isFinite(hub) || hub <= 0) {
          errors.push(`第 ${index + 1} 行轮毂高度无效 (${hubHeight})`);
          return;
        }
        if (!Number.isFinite(rotor) || rotor <= 0) {
          errors.push(`第 ${index + 1} 行叶轮直径无效 (${rotorDiameter})`);
          return;
        }

        const modelId = normalizeModelId(turbine?.model, turbine?.type);
        const typeId = normalizeTypeId(turbine?.type, modelId);

        // Add unique ID if not present (avoid collisions in existing file)
        const requestedId = turbine?.id ? String(turbine.id).trim() : '';
        let id = requestedId || `WT_${Date.now()}_${index}`;
        if (existingIds.has(id) || incomingIds.has(id)) {
          id = uuidv4();
        }

        if (existingNames.has(name) || incomingNames.has(name)) {
          errors.push(`第 ${index + 1} 行风机名称重复: "${name}"`);
          return;
        }

        const validTurbine = {
          id,
          name,
          longitude: lon,
          latitude: lat,
          hubHeight: hub,
          rotorDiameter: rotor,
          model: modelId,
          type: typeId,
        };

        incomingIds.add(validTurbine.id);
        incomingNames.add(validTurbine.name);
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
