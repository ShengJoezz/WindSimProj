// backend/middleware/statusCheck.js

const path = require('path');
const fs = require('fs');

const checkCalculationStatus = async (req, res, next) => {
  const { caseId } = req.params;
  const statusPath = path.join(__dirname, `../uploads/${caseId}/status.json`);
  
  if (fs.existsSync(statusPath)) {
    try {
      const status = JSON.parse(await fs.promises.readFile(statusPath, 'utf-8'));
      req.calculationStatus = status.calculationStatus;
    } catch (error) {
      console.error('读取状态文件失败:', error);
      req.calculationStatus = 'unknown';
    }
  } else {
    req.calculationStatus = 'not_started';
  }
  
  next();
};

module.exports = checkCalculationStatus;