import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { knownTasks } from "../utils/tasks";

export const useCaseStore = defineStore("caseStore", () => {
    // State
    const caseId = ref(null);
    const caseName = ref(null);
    const currentCaseId = ref(localStorage.getItem('currentCaseId') || null);
    const parameters = ref({
        calculationDomain: { width: 10000, height: 800 },
        conditions: { windDirection: 0, inletWindSpeed: 10 },
        grid: {
            encryptionHeight: 210,
            encryptionLayers: 21,
            gridGrowthRate: 1.2,
            maxExtensionLength: 360,
            encryptionRadialLength: 50,
            downstreamRadialLength: 100,
            encryptionRadius: 200,
            encryptionTransitionRadius: 400,
            terrainRadius: 4000,
            terrainTransitionRadius: 5000,
            downstreamLength: 2000,
            downstreamWidth: 600,
            scale: 0.001,
        },
        simulation: { cores: 1, steps: 100, deltaT: 10 },
        postProcessing: {
            resultLayers: 10,
            layerSpacing: 20,
            layerDataWidth: 1000,
            layerDataHeight: 1000,
        },
    });
    const windTurbines = ref([]);
    const infoExists = ref(false);
    const results = ref({});
    const calculationStatus = ref("not_started");
    const currentTask = ref(null);
    const overallProgress = ref(0);
    const calculationOutputs = ref([]);
    const tasks = ref(knownTasks.map((task) => ({ ...task, status: "pending" })));

    // Actions

    const initializeCase = async (id, name) => {
        if (!id) {
            ElMessage.error("缺少工况ID");
            return;
        }
        currentCaseId.value = id;
        localStorage.setItem('currentCaseId', id);
        caseId.value = id;
        caseName.value = name || id;


        try {
            // 加载参数
            const response = await axios.get(`/api/cases/${caseId.value}/parameters`);
            if (response.data && response.data.parameters) {
                parameters.value = {
                    ...parameters.value, // 默认值
                    ...response.data.parameters, // 加载的值
                };
            } else {
                ElMessage.warning("未找到工况参数，使用默认值");
            }
            // 加载风机数据
            const turbinesResponse = await axios.get(`/api/cases/${caseId.value}/wind-turbines/list`);
            if (turbinesResponse.data.windTurbines) {
                windTurbines.value = turbinesResponse.data.windTurbines;
            }
            // 检查 info.json 是否存在
            const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
            infoExists.value = infoResponse.data.exists;

            // 初始化时加载计算状态
            await fetchCalculationStatus();

        } catch (error) {
            console.error("Failed to initialize case:", error);
            ElMessage.error('初始化失败');
        }
    };

    const fetchCalculationStatus = async () => {
        try {
            const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
            calculationStatus.value = response.data.calculationStatus;
            return true;
        } catch (error) {
            console.error("获取计算状态失败:", error);
            calculationStatus.value = "not_started";
            return false;
        }
    };

    const submitParameters = async () => {
        try {
            const response = await axios.post(
                `/api/cases/${caseId.value}/parameters`,
                parameters.value
            );
            if (response.data.success) {
                ElMessage.success("参数保存成功");
                infoExists.value = false;
            } else {
                throw new Error(response.data.message || "参数保存失败");
            }
        } catch (error) {
            console.error("Error submitting parameters:", error);
            ElMessage.error(error.message || "参数提交失败");
            throw error;
        }
    };

    const generateInfoJson = async () => {
        console.log("generateInfoJson called in caseStore!");
        try {
            const payload = {
                parameters: parameters.value,
                windTurbines: windTurbines.value,
            };
            const response = await axios.post(
                `/api/cases/${caseId.value}/info`,
                payload
            );
            console.log("Case ID:", caseId.value);

            if (response.data.success) {
                ElMessage.success("info.json 生成成功");
                calculationStatus.value = "not_completed";
                infoExists.value = true;
            } else {
                throw new Error(response.data.message || "生成 info.json 失败");
            }
        } catch (error) {
            console.error("Error generating info.json:", error);
            ElMessage.error("生成 info.json 失败");
            throw error;
        }
    };

    const downloadInfoJson = async () => {
        try {
            const response = await axios.get(
                `/api/cases/${caseId.value}/info-download`,
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "info.json");
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url); // 释放内存

            ElMessage.success("info.json 已下载");
        } catch (error) {
            console.error("Error downloading info.json:", error);
            ElMessage.error("下载 info.json 失败");
        }
    };

    const addWindTurbine = async (turbine) => {
        try {
            windTurbines.value.push(turbine);
            infoExists.value = false;

            const response = await axios.post(
                `/api/cases/${caseId.value}/wind-turbines`,
                windTurbines.value
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "保存风机数据失败");
            }

            ElMessage.success("风力涡轮机添加成功");
        } catch (error) {
            console.error("Error adding wind turbine:", error);
            ElMessage.error("添加风机失败: " + error.message);
            windTurbines.value.pop();
            throw error;
        }
    };

    const removeWindTurbine = async (turbineId) => {
        let removedTurbine = null;
        let index = -1;
        try {
            index = windTurbines.value.findIndex((t) => t.id === turbineId);
            if (index === -1) {
                throw new Error("风机未找到");
            }

            removedTurbine = windTurbines.value[index];
            windTurbines.value.splice(index, 1);
            infoExists.value = false;

            const response = await axios.post(
                `/api/cases/${caseId.value}/wind-turbines`,
                windTurbines.value
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "更新风机数据失败");
            }

            ElMessage.success("风力涡轮机删除成功");
        } catch (error) {
            console.error("Error removing wind turbine:", error);
            ElMessage.error("删除风机失败: " + error.message);

            if (removedTurbine && index !== -1) {
                windTurbines.value.splice(index, 0, removedTurbine);
            }
            throw error;
        }
    };

    const updateWindTurbine = async (updatedTurbine) => {
        try {
            const index = windTurbines.value.findIndex(
                (t) => t.id === updatedTurbine.id
            );
            if (index !== -1) {
                windTurbines.value[index] = {
                    ...windTurbines.value[index],
                    ...updatedTurbine,
                };
                infoExists.value = false;

                const response = await axios.post(
                    `/api/cases/${caseId.value}/wind-turbines`,
                    windTurbines.value
                );

                if (!response.data.success) {
                    throw new Error(response.data.message || "更新风机数据失败");
                }

                ElMessage.success("风力涡轮机更新成功");
            } else {
                throw new Error("风机未找到");
            }
        } catch (error) {
            console.error("Error updating wind turbine:", error);
            ElMessage.error("更新风机失败: " + error.message);
            throw error;
        }
    };

    const setResults = (newResults) => {
        results.value = newResults;
        calculationStatus.value = 'completed';
    };


    const saveCalculationProgress = async () => {
        if (!currentCaseId.value) {
            console.error('No case ID available');
            return;
        }

        try {
            const progressData = {
                isCalculating: true,
                progress: overallProgress.value,
                tasks: tasks.value,
                outputs: calculationOutputs.value
            };

            const response = await axios.post(
                `/api/cases/${currentCaseId.value}/calculation-progress`,
                progressData
            );

            if (!response.data.success) {
                throw new Error(response.data.message || '保存失败');
            }
        } catch (error) {
            console.error('\n 保存计算进度失败:', error);
        }
    };


    const loadCalculationProgress = async () => {
        try {
            const response = await axios.get(
                `/api/cases/${caseId.value}/calculation-progress`
            );
            if (response.data.progress) {
                return response.data.progress;
            }

            const savedProgress = localStorage.getItem(`calculation_${caseId.value}`);
            if (savedProgress) {
                return JSON.parse(savedProgress);
            }
        } catch (error) {
            console.error("加载计算进度失败:", error);
        }
        return null;
    };

    return {
        caseId,
        caseName,
        currentCaseId,
        parameters,
        windTurbines,
        infoExists,
        results,
        calculationStatus,
        currentTask,
        overallProgress,
        calculationOutputs,
        tasks,
        setResults,
        initializeCase,
        fetchCalculationStatus,
        submitParameters,
        generateInfoJson,
        downloadInfoJson,
        addWindTurbine,
        removeWindTurbine,
        updateWindTurbine,
        saveCalculationProgress,
        loadCalculationProgress,
    };
});