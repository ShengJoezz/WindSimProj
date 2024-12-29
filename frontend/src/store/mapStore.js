import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";
import { ElMessage } from "element-plus";

export const useMapStore = defineStore("mapStore", () => {
  // State
  const mapData = ref(null);

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

    // Actions
    loadMapData,
  };
});