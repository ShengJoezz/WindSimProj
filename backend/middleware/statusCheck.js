/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 16:06:44
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:52:28
 * @FilePath: <<filepath('relative')>>
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const path = require("path");
const fs = require('fs');
const Joi = require("joi");

// 允许的计算状态
const allowedStatuses = [
  "not_started",
  "running",
  "completed",
  "failed",
  "unknown",
];

// caseId 的验证架构
const caseIdSchema = Joi.string()
  .alphanum()
  .min(1)
  .max(50)
  .required()
  .messages({
    "string.alphanum": "工况 ID 只能包含字母数字字符",
    "string.min": "工况 ID 必须至少包含 1 个字符",
    "string.max": "工况 ID 最多包含 50 个字符",
    "any.required": "工况 ID 为必填项",
  });

const checkCalculationStatus = async (req, res, next) => {
  // 验证 caseId
  const { error, value: caseId } = caseIdSchema.validate(req.params.caseId);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const statusPath = path.join(
    __dirname,
    `../uploads/${caseId}/status.json`
  );
  const infoJsonPath = path.join(__dirname, `../uploads/${caseId}/info.json`);
  try {
    let status = "not_started"; // 如果文件不存在，则默认状态

    if (fs.existsSync(infoJsonPath)) {
        const data = JSON.parse(await fs.promises.readFile(infoJsonPath, 'utf-8'));
          status = allowedStatuses.includes(data.calculationStatus)
            ? data.calculationStatus
            : "unknown";

     }
      else if (fs.existsSync(statusPath)) {
        const statusData = JSON.parse(
            await fs.promises.readFile(statusPath, "utf-8")
        );
        status = allowedStatuses.includes(statusData.calculationStatus)
            ? statusData.calculationStatus
            : "unknown";
    }

    req.calculationStatus = status;
  } catch (error) {
    console.error("读取或解析状态文件时出错:", error);
    req.calculationStatus = "unknown";
  }

  next();
};

module.exports = checkCalculationStatus;