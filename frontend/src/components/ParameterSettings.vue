<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 18:51:11
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-15 19:25:21
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ParameterSettings.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="parameter-settings">
    <div class="header">
      <h2>参数设置</h2>
    </div>

    <!-- 工况信息展示区域 -->
    <div class="case-info-container">
      <div class="case-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="工况名称">
            {{ caseStore.caseName }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <el-divider />

    <div v-if="isLoading" class="loading-placeholder">
      <el-skeleton :rows="15" animated />
    </div>
    <div v-else>
      <el-form
        :model="caseStore.parameters"
        :rules="rules"
        ref="formRef"
        label-width="200px"
        class="parameter-form"
      >
        <!-- 计算域 -->
        <el-form-item label="计算域" class="parent-form-item">
          <el-form-item
            label="计算域长度 (m)" 
            prop="calculationDomain.width"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.calculationDomain.width"
              :min="0"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
          <el-form-item
            label="计算域高度 (m)" 
            prop="calculationDomain.height"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.calculationDomain.height"
              :min="0"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
        </el-form-item>

        <!-- 工况 -->
        <el-form-item label="工况" class="parent-form-item">
          <el-form-item
            label="风向角 (°)" 
            prop="conditions.windDirection"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.conditions.windDirection"
              :min="0"
              :max="360"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
          <el-form-item
            label="入口风速 (m/s)" 
            prop="conditions.inletWindSpeed"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.conditions.inletWindSpeed"
              :min="0"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
        </el-form-item>

        <!-- 网格 -->
        <el-form-item label="网格" class="parent-form-item">
          <div class="grid-section">
            <el-form-item
              label="粗糙层高度 (m)" 
              prop="grid.encryptionHeight"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.encryptionHeight"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="粗糙层层数" 
              prop="grid.encryptionLayers"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.encryptionLayers"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="纵向网格生长率" 
              prop="grid.gridGrowthRate"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.gridGrowthRate"
                step="0.1"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="最大网格尺寸 (m)" 
              prop="grid.maxExtensionLength"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.maxExtensionLength"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="最小网格尺寸 (m)" 
              prop="grid.encryptionRadialLength"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.encryptionRadialLength"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="尾流区径向长度 (m)" 
              prop="grid.downstreamRadialLength"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.downstreamRadialLength"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="网格加密区半径（内）(m)" 
              prop="grid.encryptionRadius"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.encryptionRadius"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="网格加密区半径（外）(m)" 
              prop="grid.encryptionTransitionRadius"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.encryptionTransitionRadius"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="地形区域半径（内）(m)" 
              prop="grid.terrainRadius"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.terrainRadius"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="地形区域半径（外）(m)" 
              prop="grid.terrainTransitionRadius"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.terrainTransitionRadius"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="尾流区加密长度 (m)" 
              prop="grid.downstreamLength"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.downstreamLength"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="尾流区加密宽度 (m)" 
              prop="grid.downstreamWidth"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.downstreamWidth"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
            <el-form-item
              label="缩尺比"
              prop="grid.scale"
              :inline="true"
              class="child-form-item"
            >
              <el-input-number
                v-model="caseStore.parameters.grid.scale"
                step="0.001"
                :min="0"
                :max="1"
                class="input-number"
                :disabled="caseStore.infoExists"
              />
            </el-form-item>
          </div>
        </el-form-item>

        <!-- 仿真 -->
        <el-form-item label="仿真" class="parent-form-item">
          <!-- Labels for simulation parameters are kept as is, as they are not in the provided table snippet -->
          <el-form-item
            label="核"
            prop="simulation.cores"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.simulation.cores"
              :min="1"
              class="input-number"
            />
          </el-form-item>
          <el-form-item
            label="步数"
            prop="simulation.steps"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.simulation.steps"
              :min="1"
              class="input-number"
            />
          </el-form-item>
          <el-form-item
            label="时间步长"
            prop="simulation.deltaT"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.simulation.deltaT"
              :min="0.001"
              class="input-number"
            />
          </el-form-item>
        </el-form-item>

        <!-- 后处理 -->
        <el-form-item label="后处理" class="parent-form-item">
          <!-- Labels for postProcessing parameters are kept as is, as they are not in the provided table snippet -->
          <el-form-item
            label="结果层数"
            prop="postProcessing.resultLayers"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.postProcessing.resultLayers"
              :min="1"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
          <el-form-item
            label="层数间距 (m)"
            prop="postProcessing.layerSpacing"
            :inline="true"
            class="child-form-item"
          >
            <el-input-number
              v-model="caseStore.parameters.postProcessing.layerSpacing"
              :min="0"
              class="input-number"
              :disabled="caseStore.infoExists"
            />
          </el-form-item>
        </el-form-item>

        <!-- 添加中心经纬度展示（只读） -->
        <el-form-item label="中心经纬度" class="parent-form-item"> <!-- KEPT (This is a summary label for a computed value, not a direct parameter from the table's "参数描述" list that's editable here) -->
          <el-input readonly :value="centerCoordinates" clearable class="location-input" />
        </el-form-item>

        <!-- 按钮区域 -->
        <el-form-item class="form-actions">
          <el-button
            type="primary"
            @click="handleGenerateClick"
            :disabled="isSubmitting || caseStore.infoExists || !hasTurbines"
            class="submit-button"
          >
            <template v-if="isSubmitting">
              <el-icon><Loading /></el-icon>
              提交中...
            </template>
            <span v-else>提交参数</span>
          </el-button>
          <el-button
            type="success"
            @click="handleDownloadClick"
            v-if="caseStore.infoExists"
            class="download-button"
          >
            下载 info.json
          </el-button>
          <el-button @click="forceRefresh" type="warning" size="small">刷新数据</el-button>
        </el-form-item>

        <div
          v-if="submissionMessage"
          :class="{
            'message-box': true,
            'success-message': submissionSuccess,
            'error-message': !submissionSuccess,
          }"
        >
          {{ submissionMessage }}
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from "vue";
  import { ElMessage } from "element-plus";
  import { Loading } from '@element-plus/icons-vue';
  import { useRoute } from "vue-router";
  import { useCaseStore } from "../store/caseStore";
  import { knownTasks } from '../utils/tasks.js';
  import { isRef, isReactive } from 'vue'; // 修改导入
  import { storeToRefs } from 'pinia'; 

  const route = useRoute();
  const caseStore = useCaseStore();
  const { windTurbines, infoExists } = storeToRefs(caseStore); // 使用 storeToRefs 解构

  const caseId = route.params.caseId;
  const formRef = ref(null);
  const submissionMessage = ref("");
  const submissionSuccess = ref(true);
  const isSubmitting = ref(false);
  const isLoading = ref(true); // Loading 状态

  // 直接使用 caseStore 中的 caseName
  const caseName = computed(() => caseStore.caseName);

  // 计算中心经纬度
  const centerCoordinates = computed(() => {
    console.log("计算centerCoordinates，风机数量:", caseStore.windTurbines?.length || 0);

    if (caseStore.windTurbines && caseStore.windTurbines.length > 0) {
      // 验证第一个风机数据有效性
      const firstTurbine = caseStore.windTurbines[0];
      if (!firstTurbine.longitude || !firstTurbine.latitude) {
        console.warn("风机数据不完整:", firstTurbine);
        return "经度: N/A, 纬度: N/A";
      }

      // 原有的计算逻辑
      const longitudes = caseStore.windTurbines.map(turbine => turbine.longitude);
      const latitudes = caseStore.windTurbines.map(turbine => turbine.latitude);

      // 添加检查，确保数组不为空
      if (longitudes.length === 0 || latitudes.length === 0) {
        return "经度: N/A, 纬度: N/A";
      }

      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const centerLon = (minLon + maxLon) / 2;
      const centerLat = (minLat + maxLat) / 2;

      return `经度: ${centerLon.toFixed(6)}, 纬度: ${centerLat.toFixed(6)}`;
    }
    return "经度: N/A, 纬度: N/A";
  });

  // Initialize case in the store
  const initialize = async () => {
    await caseStore.initializeCase(caseId);
  };

  const forceRefresh = () => {
    console.log("强制刷新，当前风机数量:", caseStore.windTurbines.length);
    caseStore.windTurbines.forEach(turbine => {
      console.log(turbine.id, turbine.name);
    });
  };

  onMounted(async () => {
  const routeCaseId = route.params.caseId;
  console.log("组件挂载，从路由获取的caseId:", routeCaseId);
  
  if (!routeCaseId) {
    ElMessage.error('无效的工况ID');
    return;
  }
  
  try {
    // 确保调用initializeCase来更新store中的caseId
    await caseStore.initializeCase(routeCaseId);
    console.log("store初始化后的caseId:", caseStore.caseId);
    
    // 现在store.caseId应该已经设置为routeCaseId
    if (caseStore.caseId !== routeCaseId) {
      console.error("初始化失败，store中的caseId未更新:", caseStore.caseId);
      ElMessage.error("初始化工况失败");
      return;
    }
    
    // 初始化成功后再加载其他数据
    if (caseStore.windTurbines.length === 0) {
      await caseStore.fetchWindTurbines();
    }
  } catch (error) {
    console.error("初始化store失败:", error);
    ElMessage.error("初始化工况失败");
  } finally {
    isLoading.value = false;
  }
});

  // Validation rules
  const rules = {
    "calculationDomain.width": [
      { required: true, message: "请输入计算域宽度", trigger: "blur" },
      { type: "number", min: 1, message: "宽度必须大于0", trigger: "blur" },
    ],
    "calculationDomain.height": [
      { required: true, message: "请输入计算域高度", trigger: "blur" },
      { type: "number", min: 1, message: "高度必须大于0", trigger: "blur" },
    ],
    "conditions.windDirection": [
      { required: true, message: "请输入风向角", trigger: "blur" },
      {
        type: "number",
        min: 0,
        max: 360,
        message: "风向角必须在0到360之间",
        trigger: "blur",
      },
    ],
    "conditions.inletWindSpeed": [
      { required: true, message: "请输入入口风速", trigger: "blur" },
      { type: "number", min: 0, message: "风速必须大于0", trigger: "blur" },
    ],
    "grid.encryptionHeight": [
      { required: true, message: "请输入加密区高度", trigger: "blur" },
      { type: "number", min: 0, message: "高度必须大于0", trigger: "blur" },
    ],
    "grid.encryptionLayers": [
      { required: true, message: "请输入加密层数", trigger: "blur" },
      { type: "number", min: 0, message: "层数必须大于0", trigger: "blur" },
    ],
    "grid.gridGrowthRate": [
      { required: true, message: "请输入网格生长率", trigger: "blur" },
      { type: "number", min: 0, message: "生长率必须大于0", trigger: "blur" },
    ],
    "grid.maxExtensionLength": [
      { required: true, message: "请输入最大特征长度", trigger: "blur" },
      { type: "number", min: 0, message: "长度必须大于0", trigger: "blur" },
    ],
    "grid.encryptionRadialLength": [
      { required: true, message: "请输入加密区径向长度", trigger: "blur" },
      { type: "number", min: 0, message: "长度必须大于0", trigger: "blur" },
    ],
    "grid.downstreamRadialLength": [
      { required: true, message: "请输入尾流区径向长度", trigger: "blur" },
      { type: "number", min: 0, message: "长度必须大于0", trigger: "blur" },
    ],
    "grid.encryptionRadius": [
      { required: true, message: "请输入加密半径", trigger: "blur" },
      { type: "number", min: 0, message: "半径必须大于0", trigger: "blur" },
    ],
    "grid.encryptionTransitionRadius": [
      { required: true, message: "请输入加密过渡半径", trigger: "blur" },
      { type: "number", min: 0, message: "半径必须大于0", trigger: "blur" },
    ],
    "grid.terrainRadius": [
      { required: true, message: "请输入地形半径", trigger: "blur" },
      { type: "number", min: 0, message: "半径必须大于0", trigger: "blur" },
    ],
    "grid.terrainTransitionRadius": [
      { required: true, message: "请输入地形过渡半径", trigger: "blur" },
      { type: "number", min: 0, message: "半径必须大于0", trigger: "blur" },
    ],
    "grid.downstreamLength": [
      { required: true, message: "请输入尾流区长度", trigger: "blur" },
      { type: "number", min: 0, message: "长度必须大于0", trigger: "blur" },
    ],
    "grid.downstreamWidth": [
      { required: true, message: "请输入尾流区宽度", trigger: "blur" },
      { type: "number", min: 0, message: "宽度必须大于0", trigger: "blur" },
    ],
    "grid.scale": [
      { required: true, message: "请输入缩放比", trigger: "blur" },
      { type: "number", min: 0, max: 1, message: "缩放比必须在0到1之间", trigger: "blur" },
    ],
    "simulation.cores": [
      { required: true, message: "请输入仿真核心数", trigger: "blur" },
      { type: "number", min: 1, message: "核心数必须大于0", trigger: "blur" },
    ],
    "simulation.steps": [
      { required: true, message: "请输入仿真步数", trigger: "blur" },
      { type: "number", min: 1, message: "步数必须大于0", trigger: "blur" },
    ],
    "simulation.deltaT": [
      { required: true, message: "请输入时间步长", trigger: "blur" },
      { type: "number", min: 0, message: "时间步长必须大于0", trigger: "blur" },
    ],
    "postProcessing.resultLayers": [
      { required: true, message: "请输入结果层数", trigger: "blur" },
      { type: "number", min: 1, message: "结果层数必须大于0", trigger: "blur" },
    ],
    "postProcessing.layerSpacing": [
      { required: true, message: "请输入层数间距", trigger: "blur" },
      { type: "number", min: 0, message: "间距必须大于0", trigger: "blur" },
    ],
    "postProcessing.layerDataWidth": [
      { required: true, message: "请输入各层数据宽度", trigger: "blur" },
      { type: "number", min: 0, message: "宽度必须大于0", trigger: "blur" },
    ],
    "postProcessing.layerDataHeight": [
      { required: true, message: "请输入各层数据高度", trigger: "blur" },
      { type: "number", min: 0, message: "高度必须大于0", trigger: "blur" },
    ],
  };

  // Handle parameter submission
  const handleGenerateClick = async () => {
    if (caseStore.windTurbines.length === 0) {
      ElMessage.error("请先上传风机数据");
      return;
    }
    isSubmitting.value = true;
    try {
      await formRef.value.validate();
      await caseStore.submitParameters();
      // 添加这一行，确保生成 info.json
      await caseStore.generateInfoJson();

      submissionSuccess.value = true;
      submissionMessage.value = "参数提交成功，info.json 已生成";
      ElMessage.success("参数提交成功，info.json 已生成");
    } catch (error) {
      submissionSuccess.value = false;
      submissionMessage.value = error.message || "参数提交失败";
      ElMessage.error(submissionMessage.value);
    } finally {
      isSubmitting.value = false;
    }
  };

  // Handle info.json download
  const handleDownloadClick = async () => {
    await caseStore.downloadInfoJson();
  };

  // 添加额外的计算属性，增强稳定性
  const hasTurbines = computed(() => {
    return caseStore.windTurbines && caseStore.windTurbines.length > 0;
  });
</script>

<style scoped>
.parameter-settings {
  padding: 24px;
  background-color: #f9fafc;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 24px;
  text-align: center;
}

.header h2 {
  color: #303133;
  font-weight: 600;
  margin: 0;
  padding-bottom: 12px;
  position: relative;
}

.header h2::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background-color: #409EFF;
  border-radius: 3px;
}

.case-info-container {
  margin-bottom: 20px;
  background-color: #f0f7ff;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid #409EFF;
}

.case-info {
  margin-bottom: 0;
}

.el-divider {
  margin: 28px 0;
}

.parameter-form {
  margin-top: 20px;
}

/* 父子表单项样式 */
.parent-form-item {
  margin-bottom: 28px;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
}

.parent-form-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background-color: #409EFF;
  border-radius: 4px 0 0 4px;
}

.parent-form-item > .el-form-item__label {
  color: #409EFF;
  font-weight: 600;
  font-size: 16px;
}

.grid-section {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 5px;
}

.child-form-item {
  margin-right: 20px;
  margin-bottom: 10px;
  min-width: 300px;
}

.input-number {
  width: 120px !important;
}

.location-input {
  font-family: monospace;
  font-size: 14px;
  width: 100%;
  max-width: 400px;
}

.form-actions {
  display: flex;
  justify-content: center;
  margin-top: 30px;
  padding: 0 !important;
  background: none !important;
  box-shadow: none !important;
}

.form-actions::before {
  display: none;
}

.submit-button {
  min-width: 180px;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  background-color: #409EFF;
  border-color: #409EFF;
  transition: all 0.3s;
}

.submit-button:hover:not(:disabled) {
  background-color: #66b1ff;
  border-color: #66b1ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.download-button {
  margin-left: 16px;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
}

.message-box {
  margin-top: 24px;
  padding: 16px;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.success-message {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

.error-message {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.loading-placeholder {
  padding: 24px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .parameter-settings {
    padding: 16px;
  }

  .child-form-item {
    min-width: 100%;
    margin-right: 0;
  }

  .grid-section {
    flex-direction: column;
  }

  .form-actions {
    flex-direction: column;
  }

  .download-button {
    margin-left: 0;
    margin-top: 12px;
  }

  .parent-form-item {
    padding: 15px;
  }
}
</style>