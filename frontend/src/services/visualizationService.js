/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-02 19:10:20
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-26 00:15:00 (Refactored Visualization API)
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\services\visualizationService.js
 * @Description: Service layer for fetching visualization data from the backend.
 *               Uses updated API endpoints that provide pre-calculated pixel coordinates.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import axios from 'axios';
import { ElMessage } from 'element-plus';

// --- 客户端缓存 ---
const clientCache = {
  metadata: {}, // Stores main metadata (heights, turbine list with km coords, etc.)
  profile: {},  // Stores wind profile data per turbine
  wake: {},     // Stores wake data per turbine
  // Note: Slice data (image URL, pixel coords, dimensions) is generally not cached client-side
  //       as it changes frequently with height selection.
};

// --- 缓存 Key 生成函数 ---
const getMetadataKey = (caseId) => `metadata_${caseId}`;
const getProfileKey = (caseId, turbineId) => `profile_${caseId}_${turbineId}`;
const getWakeKey = (caseId, turbineId) => `wake_${caseId}_${turbineId}`;

/**
 * 获取工况的主元数据（不包含特定切片的像素信息）。
 * 主元数据包含高度层级、风机列表（公里坐标）、颜色范围等。
 * @param {string} caseId 工况 ID
 * @returns {Promise<object>} 包含元数据的 Promise 对象
 */
export const getMetadata = async (caseId) => {
  const cacheKey = getMetadataKey(caseId);
  if (clientCache.metadata[cacheKey]) {
    console.log(`缓存命中 (客户端 - 主元数据): ${cacheKey}`);
    return clientCache.metadata[cacheKey];
  }
  console.log(`缓存未命中 (客户端 - 主元数据): ${cacheKey}, 正在获取主元数据...`);
  try {
    // Fetch main metadata (heights, turbines list, vmin/vmax, extent, etc.)
    const response = await axios.get(`/api/cases/${caseId}/visualization-metadata`);
    let metadata = null;
    if (response.data.success && response.data.metadata) {
        metadata = response.data.metadata;
    } else if (response.data && typeof response.data === 'object' && response.data.heightLevels) {
        // Compatibility for potential direct metadata response
        console.warn("后端主元数据响应结构可能已更改。假设数据即元数据。");
        metadata = response.data;
    }

    if (metadata) {
      // Ensure 'extent' exists if 'extentKm' is present (for backward compatibility if needed)
      if (!metadata.extent && metadata.extentKm) {
        metadata.extent = metadata.extentKm;
      }
      clientCache.metadata[cacheKey] = metadata; // Cache the main metadata
      return metadata;
    }

    // Throw error if metadata is not valid
    throw new Error(response.data?.message || '未能获取有效的主元数据');
  } catch (error) {
    console.error(`获取工况 ${caseId} 的主元数据失败:`, error);
    ElMessage.error('加载主元数据失败: ' + (error.response?.data?.message || error.message));
    throw error; // Re-throw to allow calling component to handle
  }
};

/**
 * 获取特定高度的速度切片信息。
 * 返回该切片图像的URL、原始尺寸、预计算的风机像素坐标等。
 * @param {string} caseId 工况 ID
 * @param {number} height 请求的高度 (米)
 * @returns {Promise<object>} 包含切片信息的 Promise 对象 (imageUrl, actualHeight, imageDimensions, turbinesPixels, vmin, vmax, extentKm)
 */
export const getSliceData = async (caseId, height) => {
  console.log(`正在获取工况 ${caseId}，高度 ${height} 的切片图像和像素信息...`);
  try {
    // Fetch slice-specific data: image URL, pixel coords for turbines on *this* image, original image dimensions
    const response = await axios.get(`/api/cases/${caseId}/visualization-slice`, {
      params: { height } // Pass height as query parameter
    });

    // Check the expected response structure from the updated API
    if (response.data.success &&
        response.data.sliceImageUrl &&
        response.data.turbinesPixels &&       // Expecting turbinesPixels array
        response.data.imageDimensions         // Expecting imageDimensions object
       ) {
      // Return the relevant data for the frontend component
      return {
        imageUrl: response.data.sliceImageUrl,
        actualHeight: response.data.actualHeight,
        imageDimensions: response.data.imageDimensions, // Original dimensions of the slice image
        turbinesPixels: response.data.turbinesPixels,   // Pre-calculated pixel coordinates [{id, x, y}, ...]
        extentKm: response.data.extentKm,               // Domain extent (may still be useful)
        vmin: response.data.vmin,
        vmax: response.data.vmax,
      };
    }

    // Handle cases where the response structure is not as expected or success is false
    throw new Error(response.data?.message || `未能获取高度 ${height} 的有效切片信息 (URL/像素/尺寸)`);

  } catch (error) {
    console.error(`获取工况 ${caseId}，高度 H=${height} 的切片信息失败:`, error);
    const errorMessage = error.response?.data?.message || error.message || `获取切片 H=${height} 时网络/服务器错误`;
    // Show error message to the user
    ElMessage.error(`加载高度 ${height.toFixed(1)}m 的图像信息失败: ${errorMessage}`);
    // Re-throw the error so the calling component knows the operation failed
    throw new Error(errorMessage);
  }
};

/**
 * 获取指定风机的风速廓线数据。
 * @param {string} caseId 工况 ID
 * @param {string} turbineId 风机 ID
 * @returns {Promise<object>} 包含风廓线数据的 Promise 对象 (profile: {heights, speeds})
 */
export const getProfileData = async (caseId, turbineId) => {
  const cacheKey = getProfileKey(caseId, turbineId);
  if (clientCache.profile[cacheKey]) {
    console.log(`缓存命中 (客户端 - 风廓线): ${cacheKey}`);
    return clientCache.profile[cacheKey];
  }
  console.log(`缓存未命中 (客户端 - 风廓线): ${cacheKey}, 正在获取风机 ${turbineId} 的风廓线数据...`);
  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-profile/${turbineId}`);
    if (response.data.success && response.data.profile) {
      clientCache.profile[cacheKey] = response.data; // Cache the successful response
      return response.data; // Return the whole response structure {success: true, profile: {...}}
    }
    // Handle unsuccessful response or missing profile data
    throw new Error(response.data?.message || `未能获取风机 ${turbineId} 的风廓线数据`);
  } catch (error) {
    console.error(`获取工况 ${caseId}，风机 ${turbineId} 的风廓线数据失败:`, error);
    ElMessage.error(`加载风机 ${turbineId} 的风廓线数据失败`);
    // Re-throw a more specific error
    throw new Error(error.response?.data?.message || error.message || `获取风机 ${turbineId} 风廓线数据时网络/服务器错误`);
  }
};

/**
 * 获取指定风机的尾流分析数据。
 * @param {string} caseId 工况 ID
 * @param {string} turbineId 风机 ID
 * @returns {Promise<object>} 包含尾流数据的 Promise 对象 (wake: {distances, speeds, hubHeightUsed})
 */
export const getWakeData = async (caseId, turbineId) => {
  const cacheKey = getWakeKey(caseId, turbineId);
  if (clientCache.wake[cacheKey]) {
    console.log(`缓存命中 (客户端 - 尾流): ${cacheKey}`);
    return clientCache.wake[cacheKey];
  }
  console.log(`缓存未命中 (客户端 - 尾流): ${cacheKey}, 正在获取风机 ${turbineId} 的尾流数据...`);
  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-wake/${turbineId}`);
    if (response.data.success && response.data.wake) {
      clientCache.wake[cacheKey] = response.data; // Cache the successful response
      return response.data; // Return the whole response structure {success: true, wake: {...}}
    }
    // Handle unsuccessful response or missing wake data
    throw new Error(response.data?.message || `未能获取风机 ${turbineId} 的尾流数据`);
  } catch (error) {
    console.error(`获取工况 ${caseId}，风机 ${turbineId} 的尾流数据失败:`, error);
    ElMessage.error(`加载风机 ${turbineId} 的尾流数据失败`);
    // Re-throw a more specific error
    throw new Error(error.response?.data?.message || error.message || `获取风机 ${turbineId} 尾流数据时网络/服务器错误`);
  }
};

/**
 * 清除指定工况的所有客户端缓存（元数据、风廓线、尾流）。
 * @param {string} caseId 工况 ID
 */
export const clearClientCaseCache = (caseId) => {
  const metaKey = getMetadataKey(caseId);
  delete clientCache.metadata[metaKey];

  // Clear profile cache entries for this caseId
  Object.keys(clientCache.profile).forEach(key => {
      if (key.startsWith(`profile_${caseId}_`)) {
          delete clientCache.profile[key];
      }
  });

  // Clear wake cache entries for this caseId
  Object.keys(clientCache.wake).forEach(key => {
      if (key.startsWith(`wake_${caseId}_`)) {
          delete clientCache.wake[key];
      }
  });

  console.log(`已清除工况 ${caseId} 的客户端缓存`);
};

/**
 * 在数组中查找最接近给定值的元素的索引。
 * @param {number[]} arr 要搜索的数字数组
 * @param {number} value 要查找的值
 * @returns {number} 最接近元素的索引，如果数组为空则返回 -1
 */
export const findClosestIndex = (arr, value) => {
  if (!arr || arr.length === 0) return -1;
  let closest = 0;
  let minDiff = Math.abs(arr[0] - value);
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(arr[i] - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
};

/**
 * 查询指定坐标点的风速。
 * @param {string} caseId 工况 ID
 * @param {number} x X 坐标
 * @param {number} y Y 坐标
 * @param {number} z Z 坐标
 * @returns {Promise<object>} 包含风速信息的 Promise 对象
 */
export const getPointWindSpeed = async (caseId, x, y, z) => {
  try {
    const response = await axios.get(`/api/cases/${caseId}/query-wind-speed`, {
      params: { x, y, z }
    });
    if (response.data.success) {
      return response.data; // e.g., { success: true, speed: 12.34 }
    } else {
      throw new Error(response.data.message || '查询失败');
    }
  } catch (error) {
    const apiData = error?.response?.data;
    const apiMessage = apiData?.message;
    const detail = apiData?.error || apiData?.debug?.stderr || apiData?.debug?.stdout;

    // Avoid dumping raw stderr/stdout (can be noisy and not user-friendly).
    console.error(`查询点 (${x}, ${y}, ${z}) 风速失败`, {
      status: error?.response?.status,
      message: apiMessage || error?.message,
    });

    const mapLegacyOrRawMessage = () => {
      const msg = String(apiMessage || error?.message || '').trim();
      const detailText = String(detail || '').trim();

      // Backward-compatible handling for older backend versions that returned raw stderr.
      if (msg === '执行查询脚本时出错') {
        if (detailText.includes('Missing required Python package')) {
          return '单点风速查询依赖 Python 包 numpy/scipy；请确认后端已安装依赖并重启服务。';
        }
        if (detailText.toLowerCase().includes('python3') && (detailText.toLowerCase().includes('not found') || detailText.toLowerCase().includes('no such file'))) {
          return '后端未找到 python3，无法执行单点风速查询。';
        }
        return '单点风速查询失败：后端脚本运行异常，请查看后端日志。';
      }

      if (msg === '查询失败') {
        if (detailText.includes('Data files (output.json/speed.bin) not found')) {
          return '未找到速度场数据文件（output.json/speed.bin）。请先完成计算，并确认结果文件未被清理。';
        }
        if (detailText.includes('Binary data size mismatch')) {
          return '速度场数据文件损坏或与元数据不匹配（output.json/speed.bin）。请重新计算或重新生成结果文件。';
        }
      }

      // Prefer backend-provided message when present (already human-readable in newer backend).
      return msg || '查询单点风速时服务器出错';
    };

    throw new Error(mapLegacyOrRawMessage());
  }
};
