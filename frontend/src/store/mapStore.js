// frontend/src/store/mapStore.js

import { defineStore } from 'pinia';
import axios from 'axios';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

export const useMapStore = defineStore('mapStore', () => {
// Existing State
// Remove case-related states from here if they exist
// For example, if parameters, windTurbines, infoExists were here, remove them

// Example:
// const parameters = ref({});
// const windTurbines = ref([]);
// const infoExists = ref(false);

const mapData = ref(null); // Example map-related state

// Existing Actions
// Remove case-related actions
// For example, remove setParameters, setResults, checkInfoExists, loadWindTurbines, generateInfoJson, downloadInfoJson

// Example:
// const setParameters = (params) => { ... };
// const setResults = (res) => { ... };

const loadMapData = async () => {
try {
const response = await axios.get('/api/map-data');
mapData.value = response.data;
} catch (error) {
console.error('加载地图数据失败:', error);
ElMessage.error('加载地图数据失败');
}
};

return {
// State
mapData,

// Actions
loadMapData
// Remove case-related actions here
};
});