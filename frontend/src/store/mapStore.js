/*
 * @Author: joe 847304926@qq.com
 * @Date: 2024-12-30 10:58:27
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:41:47
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\store\mapStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";
import { ElMessage } from "element-plus";

export const useMapStore = defineStore("mapStore", () => {
  // State
  const mapData = ref(null);
    const results = ref({});

     const setResults = (newResults) => {
        results.value = newResults;
    };

  // Actions
  const loadMapData = async () => {
    try {
      const response = await axios.get("/api/map-data");
      mapData.value = response.data;
    } catch (error) {
      console.error("加载地图数据失败:", error);
      ElMessage.error("加载地图数据失败");
    }
  };

  return {
    // State
    mapData,
      results,
     setResults,
    // Actions
    loadMapData,
  };
});