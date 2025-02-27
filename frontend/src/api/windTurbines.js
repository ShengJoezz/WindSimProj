/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-02-18 20:30:07
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-02-18 20:30:11
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\api\windTurbines.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */


import axios from 'axios'

export const uploadWindTurbines = (formData) => {
  return axios.post('/api/wind-turbines/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then(res => res.data)
}