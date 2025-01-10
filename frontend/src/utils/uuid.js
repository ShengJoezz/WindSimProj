/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:42:14
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\utils\uuid.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
import { v4 as uuidv4 } from 'uuid';

export const generateUUID = () => {
  return uuidv4();
};