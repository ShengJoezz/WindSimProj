/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-02 17:11:26
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-04-02 19:10:20
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\services\visualizationService.js
 * @Description:
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import axios from 'axios';
import { ElMessage } from 'element-plus';

// Simple In-Memory Cache (Replace with LRU if many cases/large data expected)
const clientCache = {
  metadata: {}, // caseId -> metadata
  // slices: {},   // sliceKey -> sliceData  // Removed slice cache
  profile: {}, // caseId_turbineId -> profileData  // Add profile cache
  wake: {},    // caseId_turbineId -> wakeData     // Add wake cache
};

// Generate cache keys
const getMetadataKey = (caseId) => `metadata_${caseId}`;
// const getSliceKey = (caseId, height) => `slice_${caseId}_${height.toFixed(1)}`; // Removed slice key
const getProfileKey = (caseId, turbineId) => `profile_${caseId}_${turbineId}`; // Profile cache key
const getWakeKey = (caseId, turbineId) => `wake_${caseId}_${turbineId}`;    // Wake cache key


// --- API Fetching Functions with Client-Side Caching ---

export const getMetadata = async (caseId) => {
  const cacheKey = getMetadataKey(caseId);

  if (clientCache.metadata[cacheKey]) {
    console.log(`Cache hit (Client - Metadata): ${cacheKey}`);
    return clientCache.metadata[cacheKey];
  }

  console.log(`Cache miss (Client - Metadata): ${cacheKey}, Fetching metadata...`);

  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-metadata`);
    if (response.data.success && response.data.metadata) {
      // Add compatibility handling, ensure extent property exists
      const metadata = response.data.metadata;
      if (!metadata.extent && metadata.extentKm) {
        metadata.extent = metadata.extentKm;
      }
      clientCache.metadata[cacheKey] = metadata;
      return metadata;
    }

    // If backend response structure is directly the metadata object
    if (response.data && typeof response.data === 'object' && response.data.heightLevels) {
      console.warn("Backend metadata response structure might have changed. Assuming data is metadata.");
      const metadata = response.data;
      if (!metadata.extent && metadata.extentKm) {
        metadata.extent = metadata.extentKm;
      }
      clientCache.metadata[cacheKey] = metadata;
      return metadata;
    }

    throw new Error(response.data?.message || 'Failed to fetch valid metadata');
  } catch (error) {
    console.error(`Error fetching metadata for ${caseId}:`, error);
    throw error;
  }
};

export const getSliceData = async (caseId, height) => {
  console.log(`Fetching slice image info for case ${caseId}, height ${height}...`);
  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-slice`, {
      params: { height }
    });
    if (response.data.success && response.data.sliceImageUrl) {
      return {
        imageUrl: response.data.sliceImageUrl,
        actualHeight: response.data.actualHeight,
        turbines: response.data.turbines,
        extentKm: response.data.extentKm,
        vmin: response.data.vmin,
        vmax: response.data.vmax
      }; // Return the data needed for image display and overlay
    }
    throw new Error(response.data?.message || `Failed to fetch valid slice image info for height ${height}`); // Updated error message
  } catch (error) {
    console.error(`Error fetching slice image info for ${caseId}, H=${height}:`, error); // Updated error log
    // Propagate a more informative error message
    const errorMessage = error.response?.data?.message || error.message || `Network/server error fetching slice H=${height}`;
    ElMessage.error(`加载高度 ${height.toFixed(1)}m 的图像失败: ${errorMessage}`); // Show user error
    throw new Error(errorMessage);
  }
};

export const getProfileData = async (caseId, turbineId) => {
  const cacheKey = getProfileKey(caseId, turbineId);
  if (clientCache.profile[cacheKey]) {
    console.log(`Cache hit (Client - Profile): ${cacheKey}`);
    return clientCache.profile[cacheKey];
  }

  console.log(`Cache miss (Client - Profile): ${cacheKey}, Fetching profile data for turbine ${turbineId}...`);
  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-profile/${turbineId}`);
    if (response.data.success && response.data.profile) {
      clientCache.profile[cacheKey] = response.data; // Cache the entire response
      return response.data;
    }
    throw new Error(response.data?.message || `Failed to fetch profile data for turbine ${turbineId}`);
  } catch (error) {
    console.error(`Error fetching profile data for ${caseId}, turbine ${turbineId}:`, error);
    ElMessage.error(`加载风机 ${turbineId} 的风廓线数据失败`);
    throw new Error(error.response?.data?.message || error.message || `Network/server error fetching profile data for turbine ${turbineId}`);
  }
};


export const getWakeData = async (caseId, turbineId) => {
  const cacheKey = getWakeKey(caseId, turbineId);
  if (clientCache.wake[cacheKey]) {
    console.log(`Cache hit (Client - Wake): ${cacheKey}`);
    return clientCache.wake[cacheKey];
  }

  console.log(`Cache miss (Client - Wake): ${cacheKey}, Fetching wake data for turbine ${turbineId}...`);
  try {
    const response = await axios.get(`/api/cases/${caseId}/visualization-wake/${turbineId}`);
    if (response.data.success && response.data.wake) {
      clientCache.wake[cacheKey] = response.data; // Cache the entire response
      return response.data;
    }
    throw new Error(response.data?.message || `Failed to fetch wake data for turbine ${turbineId}`);
  } catch (error) {
    console.error(`Error fetching wake data for ${caseId}, turbine ${turbineId}:`, error);
    ElMessage.error(`加载风机 ${turbineId} 的尾流数据失败`);
    throw new Error(error.response?.data?.message || error.message || `Network/server error fetching wake data for turbine ${turbineId}`);
  }
};


// Function to clear cache for a specific case (call when needed)
export const clearClientCaseCache = (caseId) => {
  const metaKey = getMetadataKey(caseId);
  delete clientCache.metadata[metaKey];
  // Object.keys(clientCache.slices).forEach(key => {  // Removed slice cache clearing
  //     if (key.startsWith(`slice_${caseId}_`)) delete clientCache.slices[key];
  // });
  // Clear profile/wake caches
  Object.keys(clientCache.profile).forEach(key => {
      if (key.startsWith(`profile_${caseId}_`)) delete clientCache.profile[key];
  });
  Object.keys(clientCache.wake).forEach(key => {
      if (key.startsWith(`wake_${caseId}_`)) delete clientCache.wake[key];
  });

  console.log(`Client cache cleared for case ${caseId}`);
};

// --- Helper Functions ---
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

// Optional: Add interpolation if needed later, but not required for this test component
// export const interpolateWindSpeed = (heights, speeds, targetHeight) => { ... };