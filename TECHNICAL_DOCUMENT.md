好的，我已经理解了您的全部需求。目标是让用户能通过网页前端上传风机的性能曲线文件（U-P-Ct.txt），后端接收这些文件并将其存储到 OpenFOAM 求解器期望的 `run/Input/` 目录中。

以下是根据您提供的详细修改计划和原始代码，修改后的完整文件版本。

---

### 1. `ParameterSettings.vue` (前端组件)

我已按照您的要求进行了如下修改：
1.  在`<script setup>`中导入了 `UploadFilled` 图标和 `reactive`。
2.  添加了 `curveFileList` 响应式变量和 `handleCurveAdd` / `handleCurveRemove` 事件处理器，用于管理上传列表并通过 `caseStore` 更新状态。
3.  在表单的提交按钮前，添加了 `<el-form-item>` 和 `<el-upload>` 组件，用于文件上传。
4.  修改了 `handleGenerateClick` 方法，在提交参数前先调用 `caseStore.uploadCurveFiles()` 来上传曲线文件。

```vue
<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 18:51:11
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-03 20:54:18
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
            <div class="input-with-hint">
              <el-input-number
                v-model="caseStore.parameters.calculationDomain.width"
                :min="0"
                class="input-number"
                :disabled="caseStore.infoExists"
                style="width: 100%;"
              />
              
              <!-- 这是新增的提示信息 -->
              <div v-if="showDomainSizeHint" class="form-item-hint">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ domainSizeHintText }}</span>
              </div>
            </div>
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
                :step="0.1"
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
                :step="0.001"
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
        <el-form-item label="中心经纬度" class="parent-form-item"> 
        </el-form-item>

        <!-- ===== 新增 : 风机性能曲线 ===== -->
        <el-form-item label="风机性能曲线 (U-P-Ct)">
          <el-upload
              drag
              ref="curveUploader"
              :auto-upload="false"
              :limit="10"
              :file-list="curveFileList"
              :on-remove="handleCurveRemove"
              :on-change="handleCurveAdd"
              accept=".txt,.csv"
              multiple>
            <el-icon><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将 <b>1-U-P-Ct.txt</b>、<b>2-U-P-Ct.txt</b> … 拖到这里，或点击上传
            </div>
          </el-upload>
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
  import { ref, computed, onMounted, reactive } from "vue";
  import { InfoFilled, UploadFilled, Loading } from '@element-plus/icons-vue';
  import { ElMessage } from "element-plus";
  import { useRoute } from "vue-router";
  import { useCaseStore } from "../store/caseStore";
  import { knownTasks } from '../utils/tasks.js';
  import { isRef, isReactive } from 'vue'; 
  import { storeToRefs } from 'pinia'; 

  const route = useRoute();
  const caseStore = useCaseStore();
  const { windTurbines, infoExists, geographicSize } = storeToRefs(caseStore); 

  // ===== 新增: 风机性能曲线相关 =====
  const curveFileList = reactive([]); // element-plus file list

  const handleCurveAdd = (file, fileList) => {
    // 使用 fileList 参数更新整个列表
    curveFileList.splice(0, curveFileList.length, ...fileList);
    // 将原始 File 对象传递给 store
    caseStore.setCurveFiles(fileList.map(f => f.raw));
  };
  
  const handleCurveRemove = (file, fileList) => {
    curveFileList.splice(0, curveFileList.length, ...fileList);
    caseStore.setCurveFiles(fileList.map(f => f.raw));
  };
  // ===================================

  // 1. 计算推荐的计算域尺寸 (地形宽高的最大值)
  const recommendedDomainSize = computed(() => {
    const size = geographicSize.value;
    // 确保尺寸有效后再进行计算
    if (size && size.width > 0 && size.height > 0) {
      // 返回宽和高中较大的一个，并向上取整，给用户一个清晰的整数建议
      return Math.ceil(Math.max(size.width, size.height));
    }
    return 0; // 如果地形尺寸无效，则不提供建议
  });

  // 2. 判断是否需要显示提示
  const showDomainSizeHint = computed(() => {
    // 如果没有有效的推荐值，则不显示提示
    if (recommendedDomainSize.value === 0) {
      return false;
    }
    // 如果用户输入的计算域长度小于推荐值，则显示提示
    // 请确保这里的 `parameters.value.calculationDomain.width` 能正确访问到您的数据
    return caseStore.parameters.calculationDomain.width < recommendedDomainSize.value;
  });

  // 3. (可选) 将提示文本也做成计算属性，使模板更干净
  const domainSizeHintText = computed(() => {
    if (recommendedDomainSize.value > 0) {
      return `建议大于地形尺寸最大值 (${recommendedDomainSize.value} m)`;
    }
    return '';
  });

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

const handleGenerateClick = async () => {
    if (caseStore.windTurbines.length === 0) {
        ElMessage.error("请先上传风机数据");
        return;
    }
    
    isSubmitting.value = true;
    try {
        await formRef.value.validate();
        
        // ===== 修改: 先上传曲线文件 =====
        await caseStore.uploadCurveFiles();

        // 添加地理范围信息到提交数据
        const submitData = {
            parameters: caseStore.parameters,
            windTurbines: caseStore.windTurbines,
            // 添加tif地理范围信息
            geographicBounds: {
                minLat: caseStore.minLatitude,
                maxLat: caseStore.maxLatitude,
                minLon: caseStore.minLongitude,
                maxLon: caseStore.maxLongitude
            }
        };
        
        await caseStore.submitParameters(submitData);
        await caseStore.generateInfoJson(submitData); // 传递完整数据
        
        submissionSuccess.value = true;
        submissionMessage.value = "参数提交成功，info.json 已生成";
        // ElMessage 已在各个 action 中调用，这里可以不再重复
    } catch (error) {
        submissionSuccess.value = false;
        const errorMessage = error.response?.data?.message || error.message || "参数提交失败";
        submissionMessage.value = errorMessage;
        // ElMessage 已在各个 action 的 catch块 中调用
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

/* 在 ParameterSettings.vue 的 <style scoped> 中 */

.input-with-hint {
  display: flex; /* 使用 flex 布局让输入框和提示在同一行 */
  align-items: center; /* 垂直居中对齐 */
  gap: 10px; /* 在输入框和提示之间增加一些间距 */
  width: 100%;
}

.form-item-hint {
  /* 基础样式 */
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap; /* 防止文字换行 */
  
  /* 颜色方案 (借鉴 Element Plus 的 warning 样式) */
  color: #E6A23C;
  background-color: #fdf6ec;
  border: 1px solid #faecd8;

  /* 添加一个平滑的过渡效果 */
  transition: all 0.3s ease;
}

.form-item-hint .el-icon {
  margin-right: 5px; /* 图标和文字之间的间距 */
}
</style>
```

---

### 2. `caseStore.js` (Pinia状态管理)

我已按照您的要求进行了如下修改：
1.  添加了新的状态 `curveFiles`。
2.  添加了 `setCurveFiles` mutator 用于从组件更新文件列表。
3.  添加了 `uploadCurveFiles` action，该action会构建一个 `FormData` 对象并发起 `POST` 请求到新的后端API。该方法还包含了错误处理和用户反馈。
4.  在 `return` 对象中导出了新的 state 和 action。

```javascript
/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 19:55:12
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-07 12:03:56
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\store\caseStore.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import { ElMessage, ElNotification } from 'element-plus';
import { knownTasks } from '../utils/tasks.js';
import { io } from 'socket.io-client';
import { useWindMastStore } from './windMastStore';

export const useCaseStore = defineStore('caseStore', () => {
  const caseId = ref(null);
  const caseName = ref(null);
  const currentCaseId = ref(localStorage.getItem('currentCaseId') || null);
  const minLatitude = ref(null);
  const maxLatitude = ref(null);
  const minLongitude = ref(null);
  const maxLongitude = ref(null);
  const parameters = ref({
    calculationDomain: { width: 6500, height: 800 },
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
    simulation: { cores: 1, steps: 100, deltaT: 1 },
    postProcessing: {
      resultLayers: 10,
      layerSpacing: 20,
      layerDataWidth: 1000,
      layerDataHeight: 1000,
    },
  });
  const windTurbines = ref([]);
  const infoExists = ref(false);
  const curveFiles = ref([]); // ===== 新增: State for curve files =====

  // ==========================================================
  // [新增] 在这里添加计算地理尺寸的 computed 属性
  // ==========================================================
  const geographicSize = computed(() => {
    if (
      typeof minLongitude.value !== 'number' ||
      typeof maxLongitude.value !== 'number' ||
      typeof minLatitude.value !== 'number' ||
      typeof maxLatitude.value !== 'number'
    ) {
      return { width: 0, height: 0 };
    }

    // 使用 Haversine 公式进行更精确的距离计算
    // 这比简单的常数乘法在不同纬度下更准确
    const R = 6371000; // 地球半径，单位：米

    const lat1Rad = minLatitude.value * Math.PI / 180;
    const lat2Rad = maxLatitude.value * Math.PI / 180;
    const midLatRad = ((minLatitude.value + maxLatitude.value) / 2) * Math.PI / 180;
    
    // 计算高度 (纬度差)
    const deltaLatRad = (maxLatitude.value - minLatitude.value) * Math.PI / 180;
    const aHeight = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2);
    const cHeight = 2 * Math.atan2(Math.sqrt(aHeight), Math.sqrt(1 - aHeight));
    const height = R * cHeight;
    
    // 计算宽度 (经度差)，需要在地形的中心纬度进行计算
    const deltaLonRad = (maxLongitude.value - minLongitude.value) * Math.PI / 180;
    const aWidth = Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    // 使用中点纬度计算更准确
    const aWidthMid = Math.sin(deltaLonRad/2) * Math.sin(deltaLonRad/2) * Math.cos(midLatRad) * Math.cos(midLatRad);
    const cWidth = 2 * Math.atan2(Math.sqrt(aWidthMid), Math.sqrt(1 - aWidthMid));
    const width = R * cWidth;

    return { width, height };
  });
  const results = ref({});
  const calculationStatus = ref('not_started');
  const currentTask = ref(null);
  const overallProgress = ref(0);
  const calculationOutputs = ref([]);
  const tasks = ref({});
  knownTasks.forEach(task => {
    tasks.value[task.id] = 'pending';
  });
  const hasFetchedCalculationStatus = ref(false);
  const socket = ref(null);
  const startTime = ref(null);
  const isSubmittingParameters = ref(false);

  // ===== 新增: Mutator for curve files =====
  function setCurveFiles(files) {
    curveFiles.value = files;
  }

  // ===== 新增: Action to upload curve files =====
  async function uploadCurveFiles() {
    if (!caseId.value) throw new Error('工况未初始化，无法上传曲线文件');
    if (curveFiles.value.length === 0) {
      console.log('没有选择任何性能曲线文件，跳过上传。');
      return; // Nothing to do
    }
  
    const form = new FormData();
    curveFiles.value.forEach(f => form.append('curveFiles', f, f.name));
  
    try {
      const response = await axios.post(`/api/cases/${caseId.value}/curve-files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        ElMessage.success(`成功上传 ${response.data.files.length} 个性能曲线文件`);
      } else {
        throw new Error(response.data.message || '曲线文件上传失败');
      }
    } catch (error) {
      console.error('上传性能曲线时出错:', error);
      const errorMessage = error.response?.data?.message || error.message || '上传性能曲线时发生未知错误';
      ElMessage.error(errorMessage);
      throw error; // Re-throw to stop the calling process (e.g., handleGenerateClick)
    }
  }


  const initializeCase = async (id, name) => {
    return new Promise(async (resolve, reject) => {
      if (!id) {
        ElMessage.error('缺少工况ID');
        reject('缺少工况ID');
        return;
      }
      currentCaseId.value = id;
      localStorage.setItem('currentCaseId', id);
      caseId.value = id;
      caseName.value = name || id;
      try {
        const response = await axios.get(`/api/cases/${caseId.value}/parameters`);
        if (response.data && response.data.parameters) {
          parameters.value = {
            ...parameters.value,
            ...response.data.parameters,
          };
        } else {
          ElMessage.warning('未找到工况参数，使用默认值');
        }

        await fetchWindTurbines();
        const infoResponse = await axios.get(`/api/cases/${caseId.value}/info-exists`);
        infoExists.value = infoResponse.data.exists;
        await fetchCalculationStatus(); // Fetch status after case ID is set

        connectSocket(id); // Connect or rejoin socket room

        const windMastStore = useWindMastStore();
        windMastStore.resetState();

        if (window.location.pathname.includes('/windmast')) {
          try {
            await windMastStore.fetchResults(id);
          } catch (error) {
            console.warn('预加载测风塔分析数据失败，可能分析尚未完成', error);
          }
        }
        resolve();
      } catch (error) {
        console.error('Failed to initialize case:', error);
        ElMessage.error('初始化失败');
        reject(error);
      }
    });
  };

  const fetchCalculationStatus = async () => {
    if (!caseId.value) {
        console.warn("fetchCalculationStatus called without caseId.");
        calculationStatus.value = 'not_started'; // Default if no caseId
        return false;
    }
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-status`);
      const backendStatus = response.data.calculationStatus;

      // MODIFICATION: Protect running state
      if (calculationStatus.value === 'running' && backendStatus === 'not_started') {
        console.log('保护运行中的状态不被覆盖 (fetchCalculationStatus): 前端为 running, 后端为 not_started. 保持前端状态.');
        // Optionally, you might want to schedule another check or rely on socket updates.
        // For now, we just don't overwrite.
        hasFetchedCalculationStatus.value = true; // We did fetch, even if we didn't apply.
        return true; // Indicate fetch was "successful" in the sense of getting a response
      }

      calculationStatus.value = backendStatus;
      hasFetchedCalculationStatus.value = true;
      return true;
    } catch (error) {
      console.error('获取计算状态失败:', error);
      // MODIFICATION: Conditional reset of status on error
      if (!calculationStatus.value || calculationStatus.value === 'not_started') {
        calculationStatus.value = 'not_started';
      }
      // If calculationStatus.value was 'running', 'completed', etc., a network error
      // during fetch won't reset it to 'not_started'.
      return false;
    }
  };

  const submitParameters = async () => {
    try {
      isSubmittingParameters.value = true;
      const response = await axios.post(`/api/cases/${caseId.value}/parameters`, parameters.value);
      if (response.data.success) {
        ElMessage.success('参数保存成功');
        infoExists.value = false;
      } else {
        throw new Error(response.data.message || '参数保存失败');
      }
    } catch (error) {
      console.error('Error submitting parameters:', error);
      ElMessage.error(error.message || '参数提交失败');
      throw error;
    } finally {
      isSubmittingParameters.value = false;
    }
  };

  const generateInfoJson = async () => {
    try {
      const payload = { parameters: parameters.value, windTurbines: windTurbines.value };
      const response = await axios.post(`/api/cases/${caseId.value}/info`, payload);
      if (response.data.success) {
        ElMessage.success('info.json 生成成功');
        infoExists.value = true;
      } else {
        throw new Error(response.data.message || '生成 info.json 失败');
      }
    } catch (error) {
      console.error('Error generating info.json:', error);
      ElMessage.error('生成 info.json 失败');
      throw error;
    }
  };

  const downloadInfoJson = async () => {
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/info-download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'info.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      ElMessage.success('info.json 已下载');
    } catch (error) {
      console.error('Error downloading info.json:', error);
      ElMessage.error('下载 info.json 失败');
    }
  };

  const addWindTurbine = async (turbine) => {
  try {
    const response = await axios.post(`/api/cases/${caseId.value}/wind-turbines`, turbine);
    if (response.data.success) {
      // --- 修改开始 ---
      // 原来的代码 (修改数组)
      // windTurbines.value.push(response.data.turbine);

      // 新的代码 (替换数组)
      windTurbines.value = [...windTurbines.value, response.data.turbine];
      // --- 修改结束 ---

      infoExists.value = false;
      ElMessage.success('风力涡轮机添加成功');
    } else {
      throw new Error(response.data.message || '保存风机数据失败');
    }
  } catch (error) {
    console.error('Error adding wind turbine:', error);
    ElMessage.error('添加风机失败: ' + error.message);
    throw error;
  }
};

  const addBulkWindTurbines = async (turbines) => {
    console.log("caseStore.addBulkWindTurbines被调用，turbines数量:", turbines.length);
    console.log("当前工况ID:", currentCaseId.value);
    try {
      if (!currentCaseId.value) {
        console.error("没有有效的工况ID");
        throw new Error('没有选择工况，请先创建或选择一个工况');
      }
      console.log("开始API请求...");
      const response = await axios.post(
        `/api/cases/${currentCaseId.value}/wind-turbines/bulk`,
        turbines,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      console.log("API响应:", response.data);
      if (response.data.success) {
        const newTurbines = response.data.turbines || turbines;
        console.log("收到的新风机数据:", newTurbines);
        console.log("更新store前，当前风机数量:", windTurbines.value.length);
        // windTurbines.value = [...windTurbines.value, ...newTurbines]; // This might duplicate if backend returns all
        await fetchWindTurbines(); // Re-fetch all turbines to ensure consistency
        console.log("更新store后，当前风机数量:", windTurbines.value.length);
        infoExists.value = false;
        return newTurbines; // Or response.data.turbines if it contains only the newly added ones with IDs
      } else {
        throw new Error(response.data.message || '批量导入风机失败');
      }
    } catch (error) {
      console.error("caseStore.addBulkWindTurbines出错:", error);
      if (error.response) {
        console.error("服务器错误:", error.response.status, error.response.data);
        throw new Error(`服务器返回错误: ${error.response.status} - ${error.response.data.message || '未知错误'}`);
      } else if (error.request) {
        console.error("无响应错误:", error.request);
        throw new Error('服务器没有响应，请检查网络连接');
      }
      throw error;
    }
  };

  const fetchWindTurbines = async () => {
    if (!currentCaseId.value) {
      console.warn("fetchWindTurbines: No current case ID.");
      windTurbines.value = [];
      return;
    }
    try {
      console.log(`Fetching turbines for case: ${currentCaseId.value}`);
      const response = await axios.get(`/api/cases/${currentCaseId.value}/wind-turbines`);
      if (response.data && Array.isArray(response.data.turbines)) {
        console.log(`Received ${response.data.turbines.length} turbines from API.`);
        windTurbines.value = response.data.turbines;
      } else {
        console.warn("API response for turbines was invalid or not an array:", response.data);
        windTurbines.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch wind turbines:", error);
      windTurbines.value = [];
    }
  };

  const deleteWindTurbine = async (turbineId) => {
    try {
      const response = await axios.delete(`/api/cases/${caseId.value}/wind-turbines/${turbineId}`);
      if (response.data.success) {
        windTurbines.value = windTurbines.value.filter(t => t.id !== turbineId);
        infoExists.value = false; // Info needs regeneration
        ElMessage.success('风力涡轮机删除成功');
      } else {
        throw new Error(response.data.message || '删除风机数据失败');
      }
    } catch (error) {
      console.error('Error deleting wind turbine:', error);
      ElMessage.error('删除风机失败: ' + error.message);
      throw error;
    }
  };

  const removeWindTurbine = async (turbineId) => { // This seems like a duplicate of deleteWindTurbine or an older version. Keeping deleteWindTurbine as it's more standard REST.
    // If this has specific frontend-only logic before backend call, clarify. Otherwise, prefer deleteWindTurbine.
    // For now, assuming deleteWindTurbine is the primary one.
    console.warn("removeWindTurbine called. Consider using deleteWindTurbine for consistency.");
    await deleteWindTurbine(turbineId); // Delegate to the more standard one
  };

  const updateWindTurbine = async (updatedTurbine) => {
    try {
      const response = await axios.put(`/api/cases/${caseId.value}/wind-turbines/${updatedTurbine.id}`, updatedTurbine);
      if (response.data.success) {
        const index = windTurbines.value.findIndex(t => t.id === updatedTurbine.id);
        if (index !== -1) {
          windTurbines.value[index] = response.data.turbine; // Use the turbine data from response
        } else {
            windTurbines.value.push(response.data.turbine); // If somehow not found, add it
        }
        infoExists.value = false; // Info needs regeneration
        ElMessage.success('风力涡轮机更新成功');
      } else {
        throw new Error(response.data.message || '更新风机数据失败');
      }
    } catch (error) {
      console.error('Error updating wind turbine:', error);
      ElMessage.error('更新风机失败: ' + error.message);
      throw error;
    }
  };

  const setResults = (newResults) => {
    results.value = newResults;
    calculationStatus.value = 'completed'; // This implies calculation is done when results are set.
  };

  const saveCalculationProgress = async () => {
    if (!currentCaseId.value) {
      console.error('No case ID available for saving progress');
      return;
    }
    try {
      const progressData = {
        // isCalculating: calculationStatus.value === 'running', // More reliable to use status
        status: calculationStatus.value, // Persist current status
        progress: overallProgress.value,
        tasks: tasks.value,
        outputs: calculationOutputs.value, // This is an array of log objects
        startTime: startTime.value, // Persist start time
        timestamp: Date.now(),
        completed: calculationStatus.value === 'completed' && overallProgress.value === 100
      };
      const response = await axios.post(`/api/cases/${currentCaseId.value}/calculation-progress`, progressData);
      if (!response.data.success) {
        throw new Error(response.data.message || '保存进度失败');
      }
    } catch (error) {
      console.error('保存计算进度失败:', error.message || error);
    }
  };

  const resetCalculationProgress = () => {
    calculationStatus.value = 'not_started'; // Explicitly set status
    overallProgress.value = 0;
    calculationOutputs.value = [];
    const newTasks = {};
    knownTasks.forEach(task => {
      newTasks[task.id] = 'pending';
    });
    tasks.value = newTasks;
    currentTask.value = null;
    startTime.value = null;
    // Do not call saveCalculationProgress here automatically, let the component decide if reset needs saving.
  };

  const loadCalculationProgress = async () => {
    if (!caseId.value) {
        console.warn("loadCalculationProgress called without caseId.");
        return null;
    }
    try {
      const response = await axios.get(`/api/cases/${caseId.value}/calculation-progress`);
      if (response.data && response.data.progress) { // Assuming backend wraps it in 'progress'
        const prog = response.data.progress;

        // Important: Only apply saved status if it's more "advanced" or consistent.
        // For example, don't let a saved 'not_started' overwrite an in-memory 'running'.
        // The component (CalculationOutput.vue) onMounted handles this logic better.
        // This function should primarily just load and return the data.
        // The store's state can be updated by the component based on this loaded data.

        overallProgress.value = prog.progress || 0;
        if (prog.tasks) {
            const persistentTasks = {};
            knownTasks.forEach(task => {
              persistentTasks[task.id] = prog.tasks[task.id] || 'pending';
            });
            tasks.value = persistentTasks;
        } else {
            // Reset tasks if not in saved data
            knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; });
        }
        calculationOutputs.value = prog.outputs || [];
        startTime.value = prog.startTime || null; // Load start time

        // Set calculationStatus from persisted data if it's definitive (completed/error)
        // Or if it's 'running' and timestamp is recent (though 'running' should ideally be confirmed by backend)
        // For simplicity, the component will handle status updates more robustly.
        if (prog.status) {
             // Allow component to decide if this status should be applied
             // calculationStatus.value = prog.status;
        } else if (prog.completed) { // Legacy 'completed' field
             // calculationStatus.value = 'completed';
        }

        return prog; // Return the loaded progress object
      }
    } catch (error) {
      // If 404, means no progress saved, which is fine.
      if (error.response && error.response.status !== 404) {
          console.error('加载计算进度失败:', error);
      } else if (!error.response) {
          console.error('加载计算进度失败 (network or other error):', error);
      }
    }
    return null;
  };

  const startCalculation = async () => { // This is called by the component, which handles UI. Store might not need its own.
    // The component `CalculationOutput.vue` directly calls the API `/api/cases/${caseId}/calculate`.
    // This store method might be redundant if component handles it.
    // If kept, ensure it aligns with component's logic.
    console.warn("store.startCalculation() called. This logic is primarily in CalculationOutput.vue's startComputation().");
    try {
      // This should mirror what the component does: call API, then update status.
      const response = await axios.post(`/api/cases/${caseId.value}/calculate`);
      if (response.data.success) {
        calculationStatus.value = 'running';
        startTime.value = Date.now();
        overallProgress.value = 0; // Reset progress
        knownTasks.forEach(task => { tasks.value[task.id] = 'pending'; }); // Reset tasks
        calculationOutputs.value = [{ type: 'info', message: 'Calculation started via store.' }];
        await saveCalculationProgress();
      } else {
        throw new Error(response.data.message || 'Failed to start calculation via store.');
      }
    } catch (error) {
      calculationStatus.value = 'error'; // Or 'not_started' depending on error
      calculationOutputs.value.push({ type: 'error', message: `Failed to start calculation (store): ${error.message}` });
      await saveCalculationProgress(); // Save error state
    }
  };


  const connectSocket = (id) => {
    if (socket.value && socket.value.connected && caseId.value === id) {
        console.log(`Socket already connected and in room for case: ${id}`);
        return;
    }
    if (socket.value && socket.value.connected && caseId.value !== id) {
        socket.value.emit('leaveCase', caseId.value);
        console.log(`Socket left old case room: ${caseId.value}`);
        socket.value.emit('joinCase', id);
        console.log(`Socket joined new case room: ${id}`);
        caseId.value = id;
        return;
    }
    if (socket.value && !socket.value.connected) {
        console.log("Socket exists but not connected, attempting to connect...");
        socket.value.connect(); // Attempt to reconnect existing instance
        // Listeners should still be attached. If it connects, it will join room.
    } else if (!socket.value) {
        console.log("No socket instance, creating new one.");
        socket.value = io( {
          transports: ['websocket'],
          reconnectionAttempts: 5,
          timeout: 10000,
          // autoConnect: false, // Connect manually if needed
        });
    }

    caseId.value = id;

    // Remove all existing listeners before attaching new ones to prevent duplicates if re-called
    if(socket.value){
        socket.value.offAny(); // Removes all listeners
    }

    socket.value.on('connect', () => {
      console.log('Socket connected:', socket.value.id);
      if (caseId.value) {
          socket.value.emit('joinCase', caseId.value);
          console.log(`Socket joined case room: ${caseId.value} on connect.`);
      }
    });

    socket.value.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // No need to set calculationStatus here, rely on API polling or manual restart
    });

    socket.value.on('connect_error', error => console.error('Socket connection error:', error));
    socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout:', timeout));
    socket.value.on('reconnect_attempt', attempt => console.log(`Socket reconnect attempt ${attempt}`));
    socket.value.on('reconnect_error', error => console.error('Socket reconnection error:', error));
    socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed'));
    socket.value.on('reconnect', attempt => console.log(`Socket reconnected after ${attempt} attempts`));


    // Calculation Specific Listeners from component are primary. Store can also listen.
    // These mirror what the component listens for.
    socket.value.on('calculationOutput', (output) => {
        calculationOutputs.value.push({ type: 'output', message: output });
        // No direct UI update here, component handles that.
    });
    socket.value.on('taskUpdate', (taskStatuses) => {
        Object.keys(taskStatuses).forEach(taskId => {
            if (tasks.value.hasOwnProperty(taskId)) {
                tasks.value[taskId] = taskStatuses[taskId];
            }
        });
        saveCalculationProgress(); // Save progress on task update
    });
    socket.value.on('calculationProgress', (data) => {
        overallProgress.value = data.progress;
        if (data.currentTaskName) currentTask.value = data.currentTaskName;
        // startTime might be set here if backend sends it
        saveCalculationProgress(); // Save progress
    });
    socket.value.on('calculationCompleted', () => {
        calculationStatus.value = 'completed';
        overallProgress.value = 100;
        currentTask.value = null;
        calculationOutputs.value.push({ type: 'success', message: 'Calculation completed (socket)!' });
        saveCalculationProgress();
    });
    socket.value.on('calculationError', (error) => { // error is {message: string}
        calculationStatus.value = 'error';
        const errorMessage = error.message || "Unknown calculation error from socket";
        currentTask.value = null; // Clear current task on error
        calculationOutputs.value.push({ type: 'error', message: `Calculation error (socket): ${errorMessage}` });
        saveCalculationProgress();
    });
    // calculationStarted is handled by component setting status to 'running' after API call.
    // If backend sends 'calculationStarted' event, can use it for confirmation:
    socket.value.on('calculationStarted', (data) => { // data might include { startTime }
        if (calculationStatus.value !== 'running') { // If not already set to running by optimistic update
            calculationStatus.value = 'running';
        }
        if(data && data.startTime) startTime.value = data.startTime;
        else if(!startTime.value) startTime.value = Date.now(); // Fallback
        console.log("Calculation started event received from socket.");
        saveCalculationProgress();
    });


    const windMastStore = useWindMastStore();
    socket.value.on('windmast_analysis_progress', (message) => {
      windMastStore.addProgressMessage(message);
    });
    socket.value.on('windmast_analysis_error', (errorMessage) => {
      console.error('Socket received windmast_analysis_error:', errorMessage);
      windMastStore.addProgressMessage(`后台错误: ${errorMessage}`);
    });
    socket.value.on('windmast_analysis_complete', (data) => {
      console.log('Socket received windmast_analysis_complete:', data);
      if (data.success) {
        windMastStore.setAnalysisStatus('success');
        ElNotification({ title: '成功', message: '测风塔数据分析完成', type: 'success', duration: 4000 });
        windMastStore.fetchResults(caseId.value);
      } else {
        windMastStore.setAnalysisStatus('error', data.message || '分析失败', data.error || '');
        ElNotification({ title: '失败', message: `测风塔分析失败: ${data.message || ''}`, type: 'error', duration: 0 });
      }
    });

    if (socket.value && !socket.value.connected) {
      socket.value.connect(); // Manually connect if not already connected
      console.log("Attempting to connect socket for case:", id);
    } else if (socket.value && socket.value.connected && caseId.value){
        // If already connected, ensure it's in the correct room (handled at start of function)
    }
  };

  const disconnectSocket = () => {
    if (socket.value) {
      console.log("Disconnecting socket and removing listeners...");
      if (caseId.value) {
          socket.value.emit('leaveCase', caseId.value);
          console.log(`Socket left case room: ${caseId.value} on disconnect call.`);
      }
      socket.value.offAny(); // Remove all listeners
      socket.value.disconnect();
      socket.value = null;
      // Do not reset caseId here, it might be needed if page isn't fully unmounted
      console.log("Socket disconnected and event listeners removed.");
    }
  };

  const listenToSocketEvents = () => { // This function seems to mostly re-attach generic error listeners.
                                     // The main event listeners are attached in connectSocket.
    if (!socket.value) {
      console.error('Socket is not connected, cannot listen to events.');
      return;
    }
    // These are usually attached once during io() or connectSocket.
    // Re-attaching them here might not be necessary if connectSocket handles it comprehensively.
    // socket.value.on('connect_error', error => console.error('Socket connection error (listenToSocketEvents):', error));
    // socket.value.on('connect_timeout', timeout => console.error('Socket connection timeout (listenToSocketEvents):', timeout));
    // socket.value.on('reconnect_error', error => console.error('Socket reconnection error (listenToSocketEvents):', error));
    // socket.value.on('reconnect_failed', () => console.error('Socket reconnection failed (listenToSocketEvents)'));
    console.log("listenToSocketEvents called. Ensure listeners are not duplicated.");
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
    hasFetchedCalculationStatus,
    socket,
    startTime,
    isSubmittingParameters,
    setResults,
    initializeCase,
    fetchCalculationStatus,
    submitParameters,
    generateInfoJson,
    downloadInfoJson,
    addWindTurbine,
    addBulkWindTurbines,
    fetchWindTurbines,
    deleteWindTurbine,
    removeWindTurbine, // Consider deprecating if deleteWindTurbine is sufficient
    updateWindTurbine,
    saveCalculationProgress,
    resetCalculationProgress,
    loadCalculationProgress,
    connectSocket,
    disconnectSocket,
    startCalculation, // Component primarily handles this
    listenToSocketEvents,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    geographicSize,
    // ===== 新增: Export new state and actions =====
    curveFiles,
    setCurveFiles,
    uploadCurveFiles,
  };
});
```

---

### 3. `cases.js` (后端 Express 路由)

我已按照您的要求进行了如下修改：
1.  在现有 multer 配置之后，添加了专门用于处理曲线文件上传的 `curveStorage` 和 `uploadCurves` multer实例。
2.  `curveStorage` 配置确保文件：
    *   保存在 `uploads/<caseId>/run/Input/` 目录下（如果目录不存在则自动创建）。
    *   保留其原始文件名，例如 `1-U-P-Ct.txt`。
3.  添加了一个新的API端点 `router.post('/:caseId/curve-files', ...)`。
4.  该端点使用 `uploadCurves` 中间件处理文件上传，包含错误处理，并在成功后返回上传的文件列表。

```javascript
/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-24 19:55:48
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-05 20:12:42
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\backend\routes\cases.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

const express = require("express");
const router = express.Router();
const Joi = require("joi");
const path = require("path");
const fs = require('fs');
const fsPromises = require('fs').promises;
const multer = require("multer");
const { spawn } = require("child_process");
const checkCalculationStatus = require("../middleware/statusCheck");
const rateLimit = require('express-rate-limit');
const { knownTasks } = require('../utils/tasks');
const windTurbinesRouter = require('./windTurbines');
const archiver = require('archiver');
const pdfDataService = require('../services/pdfDataService'); // 引入 PDF 数据服务

// --- 辅助函数 ---
const calculateXY = (lon, lat, centerLon, centerLat) => {
    // console.log('calculateXY - Input:', { lon, lat, centerLon, centerLat }); // Debug log
    const EARTH_RADIUS = 6371000;
    const RAD_PER_DEG = Math.PI / 180;
    const METER_PER_DEG_LAT = EARTH_RADIUS * RAD_PER_DEG;
    const LONG_LAT_RATIO = Math.cos(centerLat * RAD_PER_DEG);
    const tempAngle = 0 * RAD_PER_DEG; // Assuming no rotation for now
    const tempX = (lon - centerLon) * METER_PER_DEG_LAT * LONG_LAT_RATIO;
    const tempY = (lat - centerLat) * METER_PER_DEG_LAT;
    const projx = tempX * Math.cos(tempAngle) - tempY * Math.sin(tempAngle);
    const projy = tempY * Math.cos(tempAngle) + tempX * Math.sin(tempAngle);
    // console.log('calculateXY - Output:', { x: projx, y: projy }); // Debug log
    return { x: projx, y: projy };
};

const ensureVTKDirectories = (caseId) => {
    const dirs = [
        path.join(__dirname, '..', 'uploads'),
        path.join(__dirname, '..', 'uploads', caseId),
        path.join(__dirname, '..', 'uploads', caseId, 'run'),
        path.join(__dirname, '..', 'uploads', caseId, 'run', 'VTK')
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            // console.log(`Created directory: ${dir}`); // Optional log
        }
    });
};

// --- 中间件和配置 ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: '请求过于频繁，请稍后再试',
    skip: (req) => process.env.NODE_ENV !== 'production'
});
router.use(limiter);

// 验证 caseId 的 schema
const caseIdSchema = Joi.string()
    .alphanum()
    .min(1)
    .max(50) // Reasonable max length
    .required()
    .messages({
        "string.alphanum": "工况 ID 只能包含字母和数字",
        "string.min": "工况 ID 至少需要 1 个字符",
        "string.max": "工况 ID 不能超过 50 个字符",
        "any.required": "工况 ID 是必需的",
    });

// Case ID 验证中间件
router.use("/:caseId", (req, res, next) => {
    const { error, value } = caseIdSchema.validate(req.params.caseId);
    if (error) {
        console.warn(`无效的工况 ID: ${req.params.caseId}, 错误: ${error.details[0].message}`);
        return res.status(400).json({
            success: false,
            message: error.details[0].message,
        });
    }
    req.params.caseId = value; // Use validated value
    next();
});

// Multer 配置 (地形文件)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use caseId from route params if caseName is not in body (e.g., for later uploads)
        const caseId = req.params.caseId || req.body.caseName;
        if (!caseId) {
            return cb(new Error('无法确定工况 ID'));
        }
        const uploadPath = path.join(__dirname, '../uploads', caseId);
        fs.mkdir(uploadPath, { recursive: true }, (err) => { // Use async mkdir
            if (err) {
                console.error("创建上传目录失败:", err);
                return cb(err);
            }
            cb(null, uploadPath);
        });
    },
    filename: (req, file, cb) => {
        if (file.fieldname === 'terrainFile') {
            cb(null, 'terrain.tif'); // Always name terrain file terrain.tif
        } else {
            // Sanitize original filename (optional but recommended)
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, safeName);
        }
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const terrainTypes = ['.tif', '.tiff'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (file.fieldname === 'terrainFile') {
            if (!terrainTypes.includes(ext)) {
                return cb(new Error('仅支持 GeoTIFF (.tif, .tiff) 文件'), false);
            }
        }
        // Add filters for other file types if needed
        cb(null, true);
    },
    limits: { fileSize: 500 * 1024 * 1024 } // Example: 500MB limit
}).fields([{ name: 'terrainFile', maxCount: 1 }]); 

// ===== 新增: Multer 配置 (风机性能曲线) =====
const curveStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const caseId = req.params.caseId;
        const inputDir = path.join(__dirname, '../uploads', caseId, 'run', 'Input');
        // 确保目标目录存在
        fs.mkdirSync(inputDir, { recursive: true });
        cb(null, inputDir);
    },
    filename: (req, file, cb) => {
        // 直接使用原始文件名 (例如 1-U-P-Ct.txt)
        cb(null, file.originalname);
    }
});
const uploadCurves = multer({
    storage: curveStorage,
    fileFilter: (req, file, cb) => {
        // 可选：验证文件扩展名
        const allowedExt = ['.txt', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExt.includes(ext)) {
            return cb(new Error(`仅支持 ${allowedExt.join(', ')} 文件`), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 1 * 1024 * 1024 } // 1MB limit per file
}).array('curveFiles', 10); // 'curveFiles' 对应前端 FormData的key, 最多10个文件
// ============================================

// --- 工况管理路由 ---

// 1. 创建新工况
router.post('/', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            upload(req, res, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        const caseName = req.body.caseName;
        // Joi schema for caseName validation
        const caseNameSchema = Joi.string()
            .alphanum() // Allow letters and numbers
            .min(1)
            .max(50) // Adjust max length as needed
            .required()
            .messages({
                "string.alphanum": "工况名称只能包含字母和数字",
                "string.min": "工况名称至少需要 1 个字符",
                "string.max": "工况名称不能超过 50 个字符",
                "any.required": "工况名称不能为空",
            });

        const { error: nameError, value: validatedCaseName } = caseNameSchema.validate(caseName);
        if (nameError) {
             console.warn(`无效的工况名称: ${caseName}, 错误: ${nameError.details[0].message}`);
            // Clean up potentially created directory if name is invalid
            const potentialPath = path.join(__dirname, '../uploads', caseName); // Use original name for cleanup path
            if (fs.existsSync(potentialPath)) {
                fs.rm(potentialPath, { recursive: true, force: true }, (rmErr) => {
                    if (rmErr) console.error(`清理无效工况目录 ${potentialPath} 失败:`, rmErr);
                });
            }
            return res.status(400).json({ success: false, message: nameError.details[0].message });
        }

        // Use validatedCaseName from now on
        const caseId = validatedCaseName;
        const casePath = path.join(__dirname, '../uploads', caseId);


        if (!req.files || !req.files['terrainFile'] || !req.files['terrainFile'][0]) {
            console.error('terrainFile is missing for case:', caseId);
            // Clean up created directory if terrain file is missing
             if (fs.existsSync(casePath)) {
                 fs.rm(casePath, { recursive: true, force: true }, (rmErr) => {
                     if (rmErr) console.error(`清理无地形文件工况目录 ${casePath} 失败:`, rmErr);
                 });
             }
            return res.status(400).json({ success: false, message: '请上传 GeoTIFF 地形文件' });
        }

        console.log(`工况 ${caseId} 创建成功，地形文件已上传。`);
        res.json({ success: true, message: '工况创建成功', caseName: caseId }); // Return the validated case name

    } catch (err) {
        // Handle Multer errors or other exceptions
        console.error('创建工况时出错:', err);
        let userMessage = '文件处理失败';
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                userMessage = '上传的文件过大，请确保文件大小在 500MB 以内。';
            } else {
                userMessage = `文件上传错误: ${err.message}`;
            }
             return res.status(400).json({ success: false, message: userMessage });
        } else if (err.message.includes('仅支持 GeoTIFF')) {
             userMessage = err.message;
             return res.status(400).json({ success: false, message: userMessage });
        }
        res.status(500).json({ success: false, message: err.message || userMessage });
    }
});


// 2. 获取所有工况
router.get("/", async (req, res) => {
    try {
        const uploadsPath = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsPath)) {
            console.log("Uploads 目录不存在，返回空列表。");
            return res.json({ cases: [] });
        }
        const caseNames = await fsPromises.readdir(uploadsPath, { withFileTypes: true });
        const cases = caseNames
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .sort(); // Sort alphabetically
        res.json({ cases });
    } catch (error) {
        console.error("获取工况列表失败:", error);
        res.status(500).json({ success: false, message: "获取工况列表失败" });
    }
});

// 3. 获取特定工况的地形文件
router.get("/:caseId/terrain", (req, res) => {
    const { caseId } = req.params; // Already validated by middleware
    const terrainFilePath = path.join(__dirname, "../uploads", caseId, "terrain.tif");

    if (!fs.existsSync(terrainFilePath)) {
        console.warn(`工况 ${caseId} 未找到地形文件: ${terrainFilePath}`);
        return res.status(404).json({ success: false, message: "未找到地形数据" });
    }

    res.setHeader('Content-Type', 'image/tiff');
    const stream = fs.createReadStream(terrainFilePath);

    stream.on('error', (err) => {
        console.error(`读取地形文件流时出错 (${terrainFilePath}):`, err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "读取地形文件失败" });
        } else {
            res.end(); // End response if headers were already sent
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        // console.log(`客户端断开了地形文件请求 (${terrainFilePath})`);
        stream.destroy(); // Close the stream
    });

    stream.pipe(res);
});

// 4. 删除工况
router.delete("/:caseId", async (req, res) => {
    const { caseId } = req.params; // Validated
    console.log(`尝试删除工况: ${caseId}`);
    const casePath = path.join(__dirname, "../uploads", caseId);

    try {
        if (!fs.existsSync(casePath)) {
            return res.status(404).json({ success: false, message: "工况不存在" });
        }
        await fsPromises.rm(casePath, { recursive: true, force: true });
        console.log(`成功删除工况目录: ${casePath}`);
        // Optionally clear any associated cache (e.g., speedDataCache)
        // delete speedDataCache.data[caseId];
        res.json({ success: true, message: "工况删除成功" });
    } catch (error) {
        console.error(`删除工况 ${caseId} 失败:`, error);
        res.status(500).json({ success: false, message: "删除工况失败", error: error.message });
    }
});

// 5. 获取特定工况的参数 (合并 parameters.json 和 info.json)
router.get("/:caseId/parameters", async (req, res) => {
    const { caseId } = req.params; // Validated
    const casePath = path.join(__dirname, "../uploads", caseId);
    const parametersPath = path.join(casePath, "parameters.json");
    const infoJsonPath = path.join(casePath, "info.json");

    try {
        let parameters = {};
        let info = {};

        // Read parameters.json if exists
        if (fs.existsSync(parametersPath)) {
            try {
                const parametersData = await fsPromises.readFile(parametersPath, "utf-8");
                parameters = JSON.parse(parametersData);
            } catch (err) {
                console.warn(`读取或解析 parameters.json (${caseId}) 出错:`, err);
                // Decide if this is a fatal error or just continue without these params
            }
        }

        // Read info.json if exists
        if (fs.existsSync(infoJsonPath)) {
            try {
                const infoData = await fsPromises.readFile(infoJsonPath, "utf-8");
                info = JSON.parse(infoData);
            } catch (err) {
                console.warn(`读取或解析 info.json (${caseId}) 出错:`, err);
            }
        }

        // Combine data, potentially overwriting parameters from info if necessary
        // Use parameters from parameters.json as the base, then overlay relevant info from info.json
        const combinedParameters = {
            ...parameters, // Start with parameters.json content
            caseName: info.key || caseId, // Use key from info.json or caseId as fallback
            center: info.center || parameters.center || { lon: null, lat: null }, // Prioritize info.center, then parameters.center
            // Overwrite specific parameters ONLY if they exist in info.json AND differ significantly
            // or if parameters.json was empty.
            calculationDomain: {
                width: info.domain?.lt ?? parameters.calculationDomain?.width ?? 6500,
                height: info.domain?.h ?? parameters.calculationDomain?.height ?? 800,
            },
            conditions: {
                 windDirection: info.wind?.angle ?? parameters.conditions?.windDirection ?? 0,
                 inletWindSpeed: info.wind?.speed ?? parameters.conditions?.inletWindSpeed ?? 10,
            },
             grid: {
                 encryptionHeight: info.mesh?.h1 ?? parameters.grid?.encryptionHeight ?? 210,
                 encryptionLayers: info.mesh?.ceng ?? parameters.grid?.encryptionLayers ?? 21,
                 gridGrowthRate: info.mesh?.q1 ?? parameters.grid?.gridGrowthRate ?? 1.2,
                 maxExtensionLength: info.mesh?.lc1 ?? parameters.grid?.maxExtensionLength ?? 360,
                 encryptionRadialLength: info.mesh?.lc2 ?? parameters.grid?.encryptionRadialLength ?? 10,
                 downstreamRadialLength: info.mesh?.lc3 ?? parameters.grid?.downstreamRadialLength ?? 60,
                 encryptionRadius: info.mesh?.r1 ?? parameters.grid?.encryptionRadius ?? 200,
                 encryptionTransitionRadius: info.mesh?.r2 ?? parameters.grid?.encryptionTransitionRadius ?? 400,
                 terrainRadius: info.mesh?.tr1 ?? parameters.grid?.terrainRadius ?? 5000,
                 terrainTransitionRadius: info.mesh?.tr2 ?? parameters.grid?.terrainTransitionRadius ?? 6500,
                 downstreamLength: info.mesh?.wakeL ?? parameters.grid?.downstreamLength ?? 2000,
                 downstreamWidth: info.mesh?.wakeB ?? parameters.grid?.downstreamWidth ?? 600,
                 scale: info.mesh?.scale ?? parameters.grid?.scale ?? 0.001,
             },
             simulation: {
                 cores: info.simulation?.core ?? parameters.simulation?.cores ?? 8,
                 steps: info.simulation?.step_count ?? parameters.simulation?.steps ?? 1000,
                 deltaT: info.simulation?.deltaT ?? parameters.simulation?.deltaT ?? 1,
             },
             postProcessing: {
                 resultLayers: info.post?.numh ?? parameters.postProcessing?.resultLayers ?? 10,
                 layerSpacing: info.post?.dh ?? parameters.postProcessing?.layerSpacing ?? 20,
                 // Keep width/height from parameters.json if defined, otherwise use info.json or defaults
                 layerDataWidth: parameters.postProcessing?.layerDataWidth ?? info.post?.width ?? 1000,
                 layerDataHeight: parameters.postProcessing?.layerDataHeight ?? info.post?.height ?? 1000,
             },
        };


        // Define default parameters structure (only if parameters.json was empty/missing AND info.json was missing/empty)
        const defaultParams = {
            caseName: caseId,
            calculationDomain: { width: 6500, height: 800 },
            conditions: { windDirection: 0, inletWindSpeed: 10 }, // Default North wind
            grid: {
                encryptionHeight: 210, encryptionLayers: 21, gridGrowthRate: 1.2,
                maxExtensionLength: 360, encryptionRadialLength: 10, downstreamRadialLength: 60,
                encryptionRadius: 200, encryptionTransitionRadius: 400, terrainRadius: 5000,
                terrainTransitionRadius: 6500, downstreamLength: 2000, downstreamWidth: 600,
                scale: 0.001,
            },
            simulation: { cores: 8, steps: 200, deltaT: 1 }, // Increased defaults
            postProcessing: {
                resultLayers: 10, layerSpacing: 20, layerDataWidth: 1000,
                layerDataHeight: 1000,
            },
            center: { lon: null, lat: null },
        };

        // If no parameters were loaded from parameters.json and no info loaded from info.json, use defaults
        const finalParameters = (Object.keys(parameters).length > 0 || Object.keys(info).length > 0)
            ? combinedParameters
            : defaultParams;

        res.json({ success: true, parameters: finalParameters });

    } catch (error) {
        console.error(`获取工况 ${caseId} 参数失败:`, error);
        res.status(500).json({ success: false, message: "获取参数失败" });
    }
});


// 6. 保存特定工况的参数 (只保存到 parameters.json)
router.post("/:caseId/parameters", async (req, res) => {
    const { caseId } = req.params; // Validated
    const parameters = req.body;
    const casePath = path.join(__dirname, "../uploads", caseId);
    const parametersPath = path.join(casePath, "parameters.json");

    const paramSchema = Joi.object({
        caseName: Joi.string().optional(),
        calculationDomain: Joi.object({
            width: Joi.number().positive().required(),
            height: Joi.number().positive().required()
        }).required(),
        conditions: Joi.object({
            windDirection: Joi.number().min(0).max(360).required(),
            inletWindSpeed: Joi.number().positive().required()
        }).required(),
        grid: Joi.object({ // 明确定义 grid 对象内部所有期望的参数
            encryptionHeight: Joi.number().required(), // 例如：encryptionHeight 是数字且必须
            encryptionLayers: Joi.number().integer().required(),
            gridGrowthRate: Joi.number().positive().required(),
            maxExtensionLength: Joi.number().required(),
            encryptionRadialLength: Joi.number().required(),
            downstreamRadialLength: Joi.number().required(),
            encryptionRadius: Joi.number().required(),
            encryptionTransitionRadius: Joi.number().required(),
            terrainRadius: Joi.number().required(),
            terrainTransitionRadius: Joi.number().required(),
            downstreamLength: Joi.number().required(),
            downstreamWidth: Joi.number().required(),
            scale: Joi.number().min(0).max(1).required() // scale 在 0-1 之间
        }).required(), // grid 对象本身是必须的
        simulation: Joi.object({
            cores: Joi.number().integer().positive().required(),
            steps: Joi.number().integer().positive().required(),
            deltaT: Joi.number().positive().required()
        }).required(),
        postProcessing: Joi.object({ // 明确定义 postProcessing 对象内部所有期望的参数
            resultLayers: Joi.number().integer().positive().required(),
            layerSpacing: Joi.number().positive().required(),
            layerDataWidth: Joi.number().positive().required(),
            layerDataHeight: Joi.number().positive().required()
        }).required(), // postProcessing 对象本身是必须的
        center: Joi.object({
            lon: Joi.number().allow(null),
            lat: Joi.number().allow(null)
        }).optional(),
    }).unknown(true); // 允许顶层对象包含其他未定义的字段 (如果需要的话)

     const { error: validationError, value: validatedParams } = paramSchema.validate(parameters);

     if (validationError) {
        console.warn(`参数保存验证失败 (${caseId}):`, validationError.details.map(d => d.message).join(', '));
        return res.status(400).json({ success: false, message: "参数格式无效", errors: validationError.details.map(d => d.message) });
     }

    try {
        if (!fs.existsSync(casePath)) {
            // Should not happen if caseId is valid, but good practice
            await fsPromises.mkdir(casePath, { recursive: true });
            console.warn(`工况目录 ${caseId} 不存在，已创建。`);
            // return res.status(404).json({ success: false, message: "工况不存在" });
        }

        // Only save the relevant parameters, exclude derived ones like caseName or center if they come from info.json
        const paramsToSave = { ...validatedParams }; // Use validated params
        // Remove fields that should ideally be managed by info.json generation
        // Only remove caseName if it matches the caseId to avoid confusion
        if (paramsToSave.caseName === caseId) {
            delete paramsToSave.caseName;
        }
        // Consider if 'center' should always be saved here or derived later for info.json
        // delete paramsToSave.center;

        await fsPromises.writeFile(parametersPath, JSON.stringify(paramsToSave, null, 2), 'utf-8');
        console.log(`工况 ${caseId} 参数已保存到 ${parametersPath}`);
        res.json({ success: true, message: "参数保存成功" });
    } catch (error) {
        console.error(`保存工况 ${caseId} 参数失败:`, error);
        res.status(500).json({ success: false, message: "保存参数失败", error: error.message });
    }
});


// ===== 新增: 上传风机性能曲线文件 =====
router.post('/:caseId/curve-files', async (req, res) => {
    uploadCurves(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer specific errors
            console.error(`Multer error on curve upload (${req.params.caseId}):`, err.message);
            return res.status(400).json({ success: false, message: `文件上传错误: ${err.message}` });
        } else if (err) {
            // Other errors (e.g., file filter)
            console.error(`Non-multer error on curve upload (${req.params.caseId}):`, err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
        
        // Success
        const uploadedFiles = req.files.map(f => f.filename);
        console.log(`工况 ${req.params.caseId} 成功上传了性能曲线:`, uploadedFiles);
        return res.json({ success: true, files: uploadedFiles });
    });
});
// ======================================


// --- 计算与结果路由 ---

// 7. 获取特定工况的仿真结果 (results.json - 保持不变)
router.get("/:caseId/results", async (req, res) => {
    const { caseId } = req.params;
    const casePath = path.join(__dirname, "../uploads", caseId);
    const resultsPath = path.join(casePath, "results.json"); // Assuming results are stored here
    try {
        if (!fs.existsSync(resultsPath)) {
            // Check if Output files exist as an alternative indicator of results
             const outputPath = path.join(casePath, 'run', 'Output');
             const initFile = path.join(outputPath, 'Output04-U-P-Ct-fn(INIT)');
             const adjustFile = path.join(outputPath, 'Output06-U-P-Ct-fn(ADJUST)');
             if (fs.existsSync(initFile) || fs.existsSync(adjustFile)) {
                 // Calculation might be done, but results.json not generated yet
                 return res.json({ success: true, results: null, message: "计算可能已完成，但汇总结果文件 (results.json) 未生成。" });
             } else {
                 return res.json({ success: true, results: null, message: "暂无计算结果" });
             }
        }
        const resultsData = await fsPromises.readFile(resultsPath, "utf-8");
        const results = JSON.parse(resultsData);
        res.json({ success: true, results: results });
    } catch (error) {
        console.error(`获取工况 ${caseId} 结果失败:`, error);
        res.status(500).json({ success: false, message: "获取结果文件失败" });
    }
});
// backend/routes/cases.js

// ... (文件顶部的其他 require 和配置，例如 express, path, fs, etc.)

// 8. 启动特定工况的计算 (已应用方案3进行修改)
router.post("/:caseId/calculate", checkCalculationStatus, async (req, res) => {
    const { caseId } = req.params;
    const scriptPath = path.join(__dirname, "../base/run.sh"); // 主计算脚本
    const precomputeScriptPath = path.join(__dirname, '../utils/precompute_visualization.py'); // 可视化预处理脚本
    const casePath = path.join(__dirname, "../uploads", caseId);
    const progressPath = path.join(casePath, 'calculation_progress.json');
    const infoJsonPath = path.join(casePath, "info.json");
    const runDir = path.join(casePath, 'run');
    const io = req.app.get("socketio"); // 获取 Socket.IO 实例

    // --- 前置检查 ---
    if (!fs.existsSync(scriptPath)) {
        console.error("主计算脚本 run.sh 未找到!");
        return res.status(500).json({ success: false, message: "服务器错误：计算脚本丢失" });
    }
    if (!fs.existsSync(casePath)) {
        return res.status(404).json({ success: false, message: "工况目录不存在" });
    }
    if (!fs.existsSync(infoJsonPath)) {
        console.error(`工况 ${caseId} 的 info.json 未找到，无法开始计算。`);
        return res.status(400).json({ success: false, message: "缺少配置文件 (info.json)，请先生成或上传" });
    }

    // --- 准备计算环境 ---
    console.log(`准备启动工况 ${caseId} 的计算...`);
    try {
        if (!fs.existsSync(runDir)) await fsPromises.mkdir(runDir, { recursive: true });
        // 清理旧的可视化缓存
        const cacheDir = path.join(casePath, 'visualization_cache');
        if (fs.existsSync(cacheDir)) await fsPromises.rm(cacheDir, { recursive: true, force: true });
    } catch (err) {
        console.error(`准备运行环境 (${caseId}) 失败:`, err);
        return res.status(500).json({ success: false, message: '无法准备运行环境' });
    }

    // 更新 info.json 状态为 'running'
    try {
        const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
        info.calculationStatus = "running";
        info.lastCalculationStart = new Date().toISOString();
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
    } catch (err) {
        console.warn(`警告: 更新 info.json (${caseId}) 状态为 'running' 失败:`, err);
    }

    // 初始化任务状态并通过 WebSocket 发送
    const taskStatuses = {};
    knownTasks.forEach(task => { taskStatuses[task.id] = "pending"; });
    if (io) io.to(caseId).emit("taskUpdate", taskStatuses);

    // --- 执行主计算脚本 (run.sh) ---
    try {
        console.log(`执行 run.sh，工况: ${caseId}, CWD: ${casePath}`);
        const child = spawn("bash", [scriptPath], { cwd: casePath, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        
        const logFilePath = path.join(runDir, `calculation_log_${Date.now()}.txt`);
        const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
        
        // <<< 修改点 1: 引入 stderr 缓冲区 >>>
        let stderrOutput = '';

        // 处理 stdout (进度、信息、任务)
        child.stdout.on("data", async (data) => {
            const outputString = data.toString();
            logStream.write(outputString);
            if (io) io.to(caseId).emit("calculationOutput", outputString); // 实时发送原始输出

            // 解析 JSON 格式的进度信息
            const lines = outputString.split("\n").filter(line => line.trim().startsWith('{'));
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line);
                    let progressChanged = false;

                    // 处理任务状态更新
                    if (msg.action === "taskStart" && taskStatuses[msg.taskId] !== 'running') {
                        taskStatuses[msg.taskId] = "running";
                        if (io) io.to(caseId).emit("taskStarted", msg.taskId);
                        progressChanged = true;
                    } else if (msg.action === "progress" || msg.action === "taskEnd") {
                        const {taskId, progress} = msg;
                        if (knownTasks.some(t => t.id === taskId)) {
                            if (progress === "ERROR" && taskStatuses[taskId] !== 'error') {
                                taskStatuses[taskId] = "error";
                                progressChanged = true;
                            } else if (progress === "COMPLETE" || parseInt(progress, 10) === 100) {
                                if (taskStatuses[taskId] !== 'error') taskStatuses[taskId] = "completed";
                                progressChanged = true;
                            }
                            if (io) io.to(caseId).emit("calculationProgress", { progress: parseInt(progress, 10) || 0, taskId });
                        }
                    }
                    
                    // 如果任务状态有变，则更新并持久化
                    if (progressChanged) {
                        const progressData = {
                            isCalculating: true, tasks: taskStatuses,
                            timestamp: Date.now(), completed: false
                        };
                        await fsPromises.writeFile(progressPath, JSON.stringify(progressData, null, 2));
                        if (io) io.to(caseId).emit("taskUpdate", taskStatuses);
                    }
                } catch (e) { /* 不是合法的 JSON，忽略 */ }
            }
        });

        // <<< 修改点 2: stderr 处理器只收集信息到缓冲区 >>>
        child.stderr.on("data", (data) => {
            const errorChunk = data.toString();
            stderrOutput += errorChunk; // 累加到缓冲区
            logStream.write(`STDERR: ${errorChunk}`);
            console.warn(`run.sh stderr (buffering) (${caseId}): ${errorChunk.trim()}`);
        });

        // <<< 修改点 3: 在进程结束时根据退出码做最终判断 >>>
        child.on("close", async (code) => {
            logStream.end();
            console.log(`run.sh 进程 (${caseId}) 退出，退出码: ${code}`);

            // 检查是否有任何任务报告了错误
            const hasReportedErrors = Object.values(taskStatuses).includes('error');
            const isSuccess = (code === 0 && !hasReportedErrors);
            const finalStatus = isSuccess ? "completed" : "error";
            
            if (isSuccess && stderrOutput.trim()) {
                // 成功退出，但 stderr 有输出（通常是警告或 INFO/DEBUG 日志）
                console.warn(`脚本 (${caseId}) 成功退出，但 stderr 包含输出 (可能为日志/警告)`);
                // 将这些“警告”作为普通输出发送给前端
                if (io) io.to(caseId).emit("calculationOutput", `[SCRIPT-WARN] 脚本成功退出，但 stderr 包含以下内容:\n---\n${stderrOutput.trim()}\n---`);
            }

            // 更新所有未完成的任务状态
            Object.keys(taskStatuses).forEach(taskId => {
                if (taskStatuses[taskId] === 'pending' || taskStatuses[taskId] === 'running') {
                    taskStatuses[taskId] = isSuccess ? 'completed' : 'error';
                }
            });
            if(io) io.to(caseId).emit("taskUpdate", taskStatuses);

            // 更新最终进度文件
            const completedTaskCount = Object.values(taskStatuses).filter(s => s === 'completed').length;
            const finalProgressValue = isSuccess ? 100 : Math.round((completedTaskCount / knownTasks.length) * 100);
            const finalProgress = {
                isCalculating: false, progress: finalProgressValue, tasks: taskStatuses,
                timestamp: Date.now(), completed: isSuccess, exitCode: code
            };
            await fsPromises.writeFile(progressPath, JSON.stringify(finalProgress, null, 2));
            
            // 更新 info.json
            try {
                const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                info.calculationStatus = finalStatus;
                info.lastCalculationEnd = new Date().toISOString();
                if (!isSuccess) {
                    info.lastCalculationError = `脚本退出码: ${code}. 详情: ${stderrOutput.substring(0, 1000).trim()}`;
                }
                await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
            } catch (err) {
                console.warn(`警告: 更新最终 info.json (${caseId}) 状态失败:`, err);
            }
            
            // 发送最终的 WebSocket 消息
            if (isSuccess) {
                if (io) io.to(caseId).emit("calculationCompleted", { message: "主计算成功完成" });
                
                // 触发后续的可视化预计算...
                // (此处省略了可视化预计算的spawn逻辑，您可以根据需要保留或添加)
                console.log(`主计算成功 (${caseId})，可触发可视化预计算。`);

            } else { // 失败
                console.error(`主计算 (${caseId}) 失败，退出码 ${code}。错误详情:\n${stderrOutput.trim()}`);
                if (io) io.to(caseId).emit("calculationFailed", {
                    message: `主计算失败，退出码: ${code}`,
                    details: stderrOutput.trim() // 将收集到的 stderr 内容作为错误详情发送
                });
            }
        });

        // 处理进程启动错误
        child.on("error", async (error) => {
            logStream.end();
            console.error(`执行 run.sh (${caseId}) 出错: ${error.message}`);
            if (io) io.to(caseId).emit("calculationError", { message: "无法执行计算脚本", details: error.message });
            // ... (更新 info.json 和 progress.json 为失败状态的逻辑)
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: "执行计算脚本失败" });
            }
        });

        // 立即响应，表示已接受请求
        if (!res.headersSent) {
            res.status(202).json({ success: true, message: "计算已启动，请通过 WebSocket 接收进度更新。" });
        }

    } catch (error) {
        console.error(`设置计算 (${caseId}) 时出错:`, error);
        if (io) io.to(caseId).emit("calculationError", { message: "计算启动失败", details: error.message });
         if (!res.headersSent) {
             res.status(500).json({ success: false, message: "计算启动失败" });
         }
    }
});


// --- ======================================== ---
// ---       REVISED VISUALIZATION API          ---
// --- ======================================== ---

// 1. Get Main Visualization Metadata (Excluding per-slice info)
router.get('/:caseId/visualization-metadata', async (req, res) => {
    const { caseId } = req.params;
    const metadataPath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'metadata.json');
    try {
        if (!fs.existsSync(metadataPath)) {
             console.warn(`Main metadata cache not found for ${caseId} at ${metadataPath}`);
            // Check if precomputation failed or hasn't run
            const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
            let vizStatus = 'not_run';
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                    vizStatus = info.visualizationStatus || vizStatus; // e.g., 'failed', 'completed'
                } catch { /* ignore read error */ }
            }
             let message = '未找到主元数据缓存。';
             if (vizStatus === 'failed') {
                 message += ' 可视化预计算可能已失败。';
             } else if (vizStatus === 'starting' || vizStatus === 'running') {
                 message += ' 可视化预计算正在进行中。';
             } else {
                  message += ' 请运行预计算。';
             }
            return res.status(404).json({ success: false, message: message, visualizationStatus: vizStatus });
        }
        const data = await fsPromises.readFile(metadataPath, 'utf-8');
        res.json({ success: true, metadata: JSON.parse(data) }); // Return parsed JSON
    } catch (error) {
        console.error(`读取主元数据缓存 (${caseId}) 出错:`, error);
        res.status(500).json({ success: false, message: '读取主元数据缓存失败。' });
    }
});

// 2. Get Specific Height Slice Info (Image URL, Pixel Coords, Dimensions)
router.get('/:caseId/visualization-slice', async (req, res) => {
    const { caseId } = req.params;
    const requestedHeight = parseFloat(req.query.height);

    if (isNaN(requestedHeight)) {
        return res.status(400).json({ success: false, message: '无效或缺少高度参数。' });
    }

    // Define paths
    const baseUploadPath = path.join(__dirname, '../uploads', caseId);
    const cachePath = path.join(baseUploadPath, 'visualization_cache');
    const mainMetadataPath = path.join(cachePath, 'metadata.json'); // Need this for height levels and vmin/vmax
    const slicesInfoDir = path.join(cachePath, 'slices_info');    // Directory for slice JSONs
    const slicesImgDir = path.join(cachePath, 'slices_img');      // Directory for slice PNGs

    try {
        // 1. Read main metadata to find closest height and get common info
        if (!fs.existsSync(mainMetadataPath)) {
            console.error(`主元数据文件未找到 (${caseId}) at ${mainMetadataPath}`);
            // Check viz status from info.json
            const infoJsonPath = path.join(baseUploadPath, 'info.json');
            let vizStatus = 'not_run';
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                    vizStatus = info.visualizationStatus || vizStatus;
                } catch { /* ignore */ }
            }
             let message = '未找到主元数据缓存。';
             if (vizStatus === 'failed') message += ' 可视化预计算可能已失败。';
             else if (vizStatus === 'starting' || vizStatus === 'running') message += ' 可视化预计算正在进行中。';
             else message += ' 请运行预计算。';
            return res.status(404).json({ success: false, message: message, visualizationStatus: vizStatus });
        }
        const mainMetadata = JSON.parse(await fsPromises.readFile(mainMetadataPath, 'utf-8'));
        const availableHeights = mainMetadata.heightLevels || [];
        const extentKm = mainMetadata.extentKm || mainMetadata.extent || mainMetadata.extent_m;
        const vmin = mainMetadata.vmin;
        const vmax = mainMetadata.vmax;
        const plotAreaPixels = mainMetadata.plotAreaPixels; // Get plot area bounds

        if (availableHeights.length === 0) {
            return res.status(404).json({ success: false, message: '主元数据中未找到高度层级。' });
        }
        if (!extentKm) {
             console.error(`主元数据中缺少 extentKm 或 extent (${caseId})`);
             return res.status(500).json({ success: false, message: '主元数据中缺少域范围信息。' });
        }
        // PlotAreaPixels is useful but maybe not strictly required for basic display
        // if (!plotAreaPixels) {
        //      console.error(`Main metadata is missing plotAreaPixels (${caseId})`);
        //      return res.status(500).json({ success: false, message: 'Main metadata is missing plot area pixel information.' });
        // }

        // 2. Find the closest available height
        const actualHeight = availableHeights.reduce((prev, curr) =>
            Math.abs(curr - requestedHeight) < Math.abs(prev - requestedHeight) ? curr : prev
        );

        // 3. Construct paths for slice image and slice info JSON
        // Use fixed precision formatting consistent with precompute script (e.g., 1 decimal place)
        const heightString = actualHeight.toFixed(1);
        const imageFilename = `slice_height_${heightString}.png`;
        const imagePathOnServer = path.join(slicesImgDir, imageFilename);
        const infoFilename = `slice_info_${heightString}.json`;
        const infoPathOnServer = path.join(slicesInfoDir, infoFilename);

        // 4. Check if both image and info file exist
        const imageExists = fs.existsSync(imagePathOnServer);
        const infoExists = fs.existsSync(infoPathOnServer);

        if (!imageExists || !infoExists) {
            let missingFiles = [];
            if (!imageExists) missingFiles.push(`图像 (${imageFilename})`);
            if (!infoExists) missingFiles.push(`信息文件 (${infoFilename})`);
            const message = `未找到高度 ${heightString}m 的 ${missingFiles.join(' 和 ')}。可能预计算未完成或失败。`;
            console.warn(message + ` Expected paths: Img=${imagePathOnServer}, Info=${infoPathOnServer}`);
            return res.status(404).json({
                success: false,
                message: message,
                debug_expectedImagePath: imagePathOnServer,
                debug_expectedInfoPath: infoPathOnServer
            });
        }

        // 5. Read slice info JSON
        const sliceInfoData = JSON.parse(await fsPromises.readFile(infoPathOnServer, 'utf-8'));
        const turbinesPixels = sliceInfoData.turbinesPixels || [];
        const imageDimensions = sliceInfoData.imageDimensions || null;

        if (!imageDimensions) {
            console.error(`切片信息 JSON (${infoFilename}) 缺少 imageDimensions。`);
            return res.status(500).json({ success: false, message: '切片信息文件损坏 (缺少图像尺寸)。' });
        }

        // 6. Construct the public URL path for the image
        // Ensure correct base path for serving static files is used
        const imageUrl = `/uploads/${caseId}/visualization_cache/slices_img/${imageFilename}`;

        // 7. Return combined information
        res.json({
            success: true,
            sliceImageUrl: imageUrl,
            actualHeight: actualHeight,
            imageDimensions: imageDimensions,   // Original dimensions of this slice image
            turbinesPixels: turbinesPixels,     // Precalculated pixel coordinates for this slice
            vmin: vmin,                         // Color range min
            vmax: vmax,                         // Color range max
            extentKm: extentKm,                 // Domain extent (might be useful for context)
            plotAreaPixels: plotAreaPixels      // Include plot area pixel bounds from main metadata
        });

    } catch (error) {
        console.error(`处理 /visualization-slice (${caseId}, H=${requestedHeight}) 出错:`, error);
        res.status(500).json({ success: false, message: '检索切片信息时发生内部服务器错误。' });
    }
});

// backend/routes/cases.js

// 3. Get Wind Profile Data
router.get('/:caseId/visualization-profile/:turbineId', async (req, res) => {
    const { caseId, turbineId } = req.params;
    // Validate turbineId format if necessary
    const turbineIdSchema = Joi.string().pattern(/^[\w-]+$/).max(50).required();
    const { error: idError } = turbineIdSchema.validate(turbineId);
    if (idError) {
         return res.status(400).json({ success: false, message: `无效的风机 ID 格式: ${turbineId}` });
    }

    const profilePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'profiles', `turbine_${turbineId}.json`);

    try {
        if (!fs.existsSync(profilePath)) {
            console.warn(`Profile file not found: ${profilePath}`);
            return res.status(404).json({ success: false, message: `未找到风机 ${turbineId} 的风廓线数据。` });
        }

        const data = await fsPromises.readFile(profilePath, 'utf-8');
        const profileData = JSON.parse(data); // Parse the root object

        // --- VALIDATION for {heights, speeds} structure ---
        // Check if it's an object and has the required arrays of the same length
        if (!profileData || typeof profileData !== 'object' || !Array.isArray(profileData.heights) || !Array.isArray(profileData.speeds) || profileData.heights.length !== profileData.speeds.length) {
            console.error(`风廓线数据结构无效 (缺少 heights/speeds 或长度不匹配) (${caseId}, Turbine ${turbineId})`);
            return res.status(500).json({ success: false, message: '风廓线数据文件结构无效。' });
        }

        // Optional: Further check types within arrays, allowing null for speeds
        if (profileData.heights.some(h => typeof h !== 'number') || profileData.speeds.some(s => typeof s !== 'number' && s !== null)) {
             console.error(`风廓线数据类型无效 (heights/speeds 包含非数字/null) (${caseId}, Turbine ${turbineId})`);
             // Consider if non-numeric heights are also an error
             return res.status(500).json({ success: false, message: '风廓线数据类型无效 (heights 或 speeds 数组包含非数字或不允许的 null 值)。' });
        }
        // --- END VALIDATION ---

        // Send the entire profileData object, as expected by the frontend service
        // frontend's visualizationService.js expects response.data.profile to be this object
        console.log(`成功读取并验证风廓线数据 (${caseId}, Turbine ${turbineId})`); // Add success log
        res.json({ success: true, profile: profileData });

    } catch (error) {
        // Handle JSON parsing errors separately
        if (error instanceof SyntaxError) {
             console.error(`解析风廓线 JSON 失败 (${caseId}, Turbine ${turbineId}):`, error);
             res.status(500).json({ success: false, message: '风廓线数据文件损坏 (无效 JSON)。' });
        } else {
            // Handle other errors (e.g., file read errors)
            console.error(`读取风廓线缓存 (${caseId}, Turbine ${turbineId}) 出错:`, error);
            res.status(500).json({ success: false, message: '读取风廓线数据缓存失败。' });
        }
    }
});

// 4. Get Wake Data
router.get('/:caseId/visualization-wake/:turbineId', async (req, res) => {
     const { caseId, turbineId } = req.params;
     // Validate turbineId format
    const turbineIdSchema = Joi.string().pattern(/^[\w-]+$/).max(50).required();
    const { error: idError } = turbineIdSchema.validate(turbineId);
    if (idError) {
         return res.status(400).json({ success: false, message: `无效的风机 ID 格式: ${turbineId}` });
    }

     const wakePath = path.join(__dirname, '../uploads', caseId, 'visualization_cache', 'wakes', `turbine_${turbineId}.json`);
     try {
         if (!fs.existsSync(wakePath)) {
             return res.status(404).json({ success: false, message: `未找到风机 ${turbineId} 的尾流数据。` });
         }
         const data = await fsPromises.readFile(wakePath, 'utf-8');
         // Optional: Validate JSON structure
         const wake = JSON.parse(data);
         // Example validation: Check for expected keys like 'centerline', 'deficit', etc.
         // if (!wake || typeof wake.centerline === 'undefined' || typeof wake.deficit === 'undefined') {
         //     console.error(`Wake data format invalid (${caseId}, Turbine ${turbineId})`);
         //     return res.status(500).json({ success: false, message: 'Wake data file has invalid format.' });
         // }
         res.json({ success: true, wake: wake });
     } catch (error) {
         if (error instanceof SyntaxError) {
             console.error(`Parsing wake JSON failed (${caseId}, Turbine ${turbineId}):`, error);
             res.status(500).json({ success: false, message: 'Wake data file is corrupted (invalid JSON).' });
         } else {
             console.error(`Reading wake cache (${caseId}, Turbine ${turbineId}) failed:`, error);
             res.status(500).json({ success: false, message: 'Failed to read wake data cache.' });
         }
     }
});

// --- 5. 手动触发预计算 API ---
router.post('/:caseId/precompute-visualization', async (req, res) => {
    const { caseId } = req.params;
    const scriptPath = path.join(__dirname, '../utils/precompute_visualization.py');
    const casePath = path.join(__dirname, '../uploads', caseId);
    const cacheDir = path.join(casePath, 'visualization_cache');
    const infoJsonPath = path.join(casePath, 'info.json');
    const io = req.app.get('socketio');

    // 1. Check if case exists
    if (!fs.existsSync(casePath)) {
        return res.status(404).json({ success: false, message: '工况目录不存在' });
    }
    // 2. Check if calculation is completed (precomputation needs results)
     let calcStatus = 'unknown';
     if (fs.existsSync(infoJsonPath)) {
         try {
             const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
             calcStatus = info.calculationStatus || 'unknown';
         } catch { /* ignore read error */ }
     }
     if (calcStatus !== 'completed') {
          let message = '无法开始可视化预计算。';
          if (calcStatus === 'running') message += ' 主计算仍在运行中。';
          else if (calcStatus === 'error') message += ' 主计算失败。';
          else if (calcStatus === 'not_started' || calcStatus === 'not_configured') message += ' 主计算尚未运行或完成。';
          else message += ` 当前计算状态: ${calcStatus}。`;
          return res.status(400).json({ success: false, message: message, calculationStatus: calcStatus });
     }

    // 3. Clear old cache
    try {
        if (fs.existsSync(cacheDir)) {
            console.log(`手动触发：清理工况 ${caseId} 的可视化缓存...`);
            await fsPromises.rm(cacheDir, { recursive: true, force: true });
        }
    } catch(err) {
        console.error(`手动触发：清理缓存 (${caseId}) 失败:`, err);
        // Decide if this is fatal. Probably should continue.
        // return res.status(500).json({ success: false, message: '清理旧缓存失败' });
    }

    // 4. Check script existence
    if (!fs.existsSync(scriptPath)) {
         console.error(`预计算脚本未找到: ${scriptPath}`);
        return res.status(500).json({ success: false, message: '服务器上未找到预计算脚本。' });
    }

    console.log(`手动为工况 ${caseId} 触发预计算...`);

    // 5. Update info.json status
    try {
        const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
        info.visualizationStatus = "starting"; // Set status before starting
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
    } catch (err) {
        console.warn(`警告: 更新 info.json (${caseId}) 预计算状态 (starting) 失败:`, err);
    }

    // 6. Respond immediately (202 Accepted)
    // Send this *before* spawning the potentially long process
    res.status(202).json({ success: true, message: '预计算已开始。请通过 WebSocket 查看进度。' });

    // 7. Spawn Python script asynchronously
    // We don't wait for this to finish before responding to the HTTP request.
    // Use an async function wrapper to handle the spawn and updates without blocking.
    (async () => {
        try {
            const pythonProcess = spawn('python3', [scriptPath, '--caseId', caseId], {
                stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, capture stdout/stderr
            });

            let stdout = '';
            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                stdout += output + '\n';
                console.log(`Precompute (Manual) (${caseId}) stdout: ${output}`);
                if (io) io.to(caseId).emit('visualization_progress', { message: output });
            });

            let stderr = '';
            pythonProcess.stderr.on('data', (data) => {
                const errorOutput = data.toString().trim();
                stderr += errorOutput + '\n';
                console.error(`Precompute (Manual) (${caseId}) stderr: ${errorOutput}`);
                if (io) io.to(caseId).emit('visualization_error', { message: errorOutput });
            });

            pythonProcess.on('close', async (code) => { // Make handler async for file writes
                const finalStatus = code === 0 ? 'completed' : 'failed';
                console.log(`手动预计算 (${caseId}) 完成，退出码 ${code} (${finalStatus}).`);
                if (io) io.to(caseId).emit('visualization_status', { status: finalStatus, code: code });

                // Update info.json with final status
                 try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                    info.visualizationStatus = finalStatus;
                    if (finalStatus === 'failed') info.lastVisualizationError = stderr.substring(0, 500);
                    await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
                 } catch (err) {
                     console.warn(`警告: 更新最终 info.json (${caseId}) 预计算状态 (${finalStatus}) 失败:`, err);
                 }

                if (code !== 0) console.error(`手动预计算失败 (${caseId}). Stderr:\n${stderr}`);
            });

            pythonProcess.on('error', async (err) => { // Make handler async
                console.error(`启动手动预计算 (${caseId}) 失败:`, err);
                if (io) io.to(caseId).emit('visualization_status', { status: 'failed', error: err.message });
                 // Update info.json with failure status
                  try {
                    const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                    info.visualizationStatus = 'failed';
                    info.lastVisualizationError = `启动预计算进程失败: ${err.message}`;
                    await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
                  } catch (errFS) {
                      console.warn(`警告: 更新 info.json (${caseId}) 预计算失败状态 (spawn error) 失败:`, errFS);
                  }
            });
        } catch (spawnError) {
             // This catches errors if spawn itself fails immediately
             console.error(`手动预计算 (${caseId}) spawn 错误:`, spawnError);
             if (io) io.to(caseId).emit('visualization_status', { status: 'failed', error: `Spawn failed: ${spawnError.message}` });
              try {
                const info = JSON.parse(await fsPromises.readFile(infoJsonPath, "utf-8"));
                info.visualizationStatus = 'failed';
                info.lastVisualizationError = `Spawn failed: ${spawnError.message}`;
                await fsPromises.writeFile(infoJsonPath, JSON.stringify(info, null, 2), "utf-8");
              } catch (errFS) {
                  console.warn(`警告: 更新 info.json (${caseId}) 预计算失败状态 (spawn catch) 失败:`, errFS);
              }
        }
    })(); // Immediately invoke the async function

});


// --- 其他路由 (info.json, 状态, VTK, PDF 等 - 保持不变) ---

// 11. 检查 info.json 是否存在
router.get('/:caseId/info-exists', (req, res) => {
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
    try {
        const exists = fs.existsSync(infoJsonPath);
        res.json({ exists });
    } catch (error) {
        console.error(`检查 info.json (${caseId}) 出错: ${error}`);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 12. 下载 info.json
router.get('/:caseId/info-download', (req, res) => {
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
    if (!fs.existsSync(infoJsonPath)) {
        return res.status(404).json({ success: false, message: 'info.json 不存在' });
    }
    // Send file with correct Content-Type
    res.download(infoJsonPath, 'info.json', (err) => {
        if (err) {
            console.error(`发送 info.json (${caseId}) 失败:`, err);
            // Avoid sending error response if headers already sent
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: '下载文件时服务器错误' });
            }
        }
    });
});

// 13. 生成并保存 info.json
router.post('/:caseId/info', async (req, res) => {
    const { caseId } = req.params;
    
    // --- Joi Schema for Validation ---
    const turbineSchema = Joi.object({
        id: Joi.string().required(),
        longitude: Joi.number().min(-180).max(180).required(),
        latitude: Joi.number().min(-90).max(90).required(),
        hubHeight: Joi.number().positive().required(),
        rotorDiameter: Joi.number().positive().required(),
        model: Joi.string().allow(null, '').optional(),
        type: Joi.string().allow(null, '').optional(),
        name: Joi.string().allow(null, '').optional(),
    }).required();

    const parametersSchema = Joi.object({
        calculationDomain: Joi.object({
            width: Joi.number().required(),
            height: Joi.number().required()
        }).required(),
        conditions: Joi.object({
            windDirection: Joi.number().required(),
            inletWindSpeed: Joi.number().required()
        }).required(),
        grid: Joi.object().unknown(true).required(),
        simulation: Joi.object().unknown(true).required(),
        postProcessing: Joi.object().unknown(true).required(),
        center: Joi.object({
            lon: Joi.number().allow(null).optional(),
            lat: Joi.number().allow(null).optional()
        }).optional(),
        caseName: Joi.string().optional()
    }).unknown(true).required();

    // 添加地理范围验证schema
    const geographicBoundsSchema = Joi.object({
        minLat: Joi.number().min(-90).max(90).required(),
        maxLat: Joi.number().min(-90).max(90).required(),
        minLon: Joi.number().min(-180).max(180).required(),
        maxLon: Joi.number().min(-180).max(180).required()
    }).optional();

    const schema = Joi.object({
        parameters: parametersSchema,
        windTurbines: Joi.array().items(turbineSchema).min(1).required().messages({
            'array.min': '至少需要提供一个风机信息',
            'array.base': '风机信息必须是一个列表',
        }),
        // 添加地理范围字段
        geographicBounds: geographicBoundsSchema
    });

    // --- Validate Request Body ---
    const { error: validationError, value } = schema.validate(req.body, { abortEarly: false });
    if (validationError) {
        const errorMessages = validationError.details.map(detail => detail.message);
        console.warn(`info.json 生成验证失败 (${caseId}):`, errorMessages);
        return res.status(400).json({ success: false, message: "请求数据无效", errors: errorMessages });
    }

    const { parameters, windTurbines, geographicBounds } = value;

    try {
        // --- Calculate Wind Farm Center ---
        let windFarmCenterLon, windFarmCenterLat;
        if (windTurbines.length > 0) {
            const longitudes = windTurbines.map(turbine => turbine.longitude);
            const latitudes = windTurbines.map(turbine => turbine.latitude);
            windFarmCenterLon = (longitudes.length > 0) ? (Math.min(...longitudes) + Math.max(...longitudes)) / 2 : 0;
            windFarmCenterLat = (latitudes.length > 0) ? (Math.min(...latitudes) + Math.max(...latitudes)) / 2 : 0;
        } else {
            return res.status(400).json({ success: false, message: "风机列表不能为空" });
        }

        // --- Calculate CFD Domain Center (based on tif geographic bounds) ---
        let cfdCenterLon, cfdCenterLat;
        if (geographicBounds) {
            // 验证地理范围的有效性
            if (geographicBounds.maxLon <= geographicBounds.minLon || 
                geographicBounds.maxLat <= geographicBounds.minLat) {
                console.warn(`无效的地理范围 (${caseId}):`, geographicBounds);
                return res.status(400).json({ success: false, message: "地理范围数据无效" });
            }
            
            cfdCenterLon = (geographicBounds.minLon + geographicBounds.maxLon) / 2;
            cfdCenterLat = (geographicBounds.minLat + geographicBounds.maxLat) / 2;
            
            console.log(`CFD domain center (tif-based): (${cfdCenterLon.toFixed(6)}, ${cfdCenterLat.toFixed(6)})`);
            console.log(`Wind farm center: (${windFarmCenterLon.toFixed(6)}, ${windFarmCenterLat.toFixed(6)})`);
        } else {
            // fallback: 使用风机群中心
            cfdCenterLon = windFarmCenterLon;
            cfdCenterLat = windFarmCenterLat;
            console.log(`Warning: No geographic bounds provided for case ${caseId}, using wind farm center as CFD domain center`);
        }

        // --- Read existing info.json to preserve status ---
        let existingInfo = {};
        const casePath = path.join(__dirname, '../uploads', caseId);
        const infoJsonPath = path.join(casePath, 'info.json');
        if (fs.existsSync(infoJsonPath)) {
            try {
                existingInfo = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
            } catch (readErr) {
                console.warn(`读取现有 info.json (${caseId}) 失败，将重新创建:`, readErr);
            }
        }

        // --- Construct info.json Content ---
        const infoJson = {
            key: caseId,
            // Preserve existing status, default to 'not_started' if new or unreadable
            calculationStatus: existingInfo.calculationStatus || 'not_started',
            visualizationStatus: existingInfo.visualizationStatus,
            domain: {
                lt: parameters.calculationDomain?.width ?? 10000,
                h: parameters.calculationDomain?.height ?? 800,
                // CFD域的实际中心（基于tif数据）
                centerLon: parseFloat(cfdCenterLon.toFixed(6)),
                centerLat: parseFloat(cfdCenterLat.toFixed(6))
            },
            // 添加地理范围信息（如果提供的话）
            geographicBounds: geographicBounds ? {
                minLon: parseFloat(geographicBounds.minLon.toFixed(6)),
                maxLon: parseFloat(geographicBounds.maxLon.toFixed(6)),
                minLat: parseFloat(geographicBounds.minLat.toFixed(6)),
                maxLat: parseFloat(geographicBounds.maxLat.toFixed(6))
            } : null,
            // 风机群中心（用于坐标转换）
            windFarmCenter: {
                lon: parseFloat(windFarmCenterLon.toFixed(6)),
                lat: parseFloat(windFarmCenterLat.toFixed(6))
            },
            wind: {
                angle: parameters.conditions?.windDirection ?? 270,
                speed: parameters.conditions?.inletWindSpeed ?? 10
            },
            mesh: {
                h1: parameters.grid?.encryptionHeight ?? 210,
                ceng: parameters.grid?.encryptionLayers ?? 21,
                q1: parameters.grid?.gridGrowthRate ?? 1.2,
                lc1: parameters.grid?.maxExtensionLength ?? 360,
                lc2: parameters.grid?.encryptionRadialLength ?? 50,
                lc3: parameters.grid?.downstreamRadialLength ?? 100,
                r1: parameters.grid?.encryptionRadius ?? 200,
                r2: parameters.grid?.encryptionTransitionRadius ?? 400,
                tr1: parameters.grid?.terrainRadius ?? 4000,
                tr2: parameters.grid?.terrainTransitionRadius ?? 5000,
                wakeL: parameters.grid?.downstreamLength ?? 2000,
                wakeB: parameters.grid?.downstreamWidth ?? 600,
                scale: parameters.grid?.scale ?? 0.001,
            },
            simulation: {
                core: parameters.simulation?.cores ?? 4,
                step_count: parameters.simulation?.steps ?? 1000,
                deltaT: parameters.simulation?.deltaT ?? 1
            },
            post: {
                numh: parameters.postProcessing?.resultLayers ?? 10,
                dh: parameters.postProcessing?.layerSpacing ?? 20,
                width: parameters.postProcessing?.layerDataWidth ?? 1000,
                height: parameters.postProcessing?.layerDataHeight ?? 1000,
            },
            turbines: windTurbines.map(turbine => {
                // 注意：这里仍然使用风机群中心计算投影坐标
                // 坐标转换将在预处理阶段进行
                const { x, y } = calculateXY(turbine.longitude, turbine.latitude, windFarmCenterLon, windFarmCenterLat);
                return {
                    id: turbine.id,
                    lon: turbine.longitude,
                    lat: turbine.latitude,
                    hub: turbine.hubHeight,
                    d: turbine.rotorDiameter,
                    x: parseFloat(x.toFixed(3)), // 相对于风机群中心的投影坐标（米）
                    y: parseFloat(y.toFixed(3)),
                    type: turbine.type || 'GenericWTG',
                    name: turbine.name || `Turbine_${turbine.id}`,
                    model: turbine.model || null
                };
            }),
            center: {
                // 保持向后兼容性，这里仍然是风机群中心
                lon: parseFloat(windFarmCenterLon.toFixed(6)),
                lat: parseFloat(windFarmCenterLat.toFixed(6))
            },
            // Add timestamp
            lastInfoGenerated: new Date().toISOString(),
        };

        // --- Save info.json ---
        await fsPromises.mkdir(casePath, { recursive: true });
        await fsPromises.writeFile(infoJsonPath, JSON.stringify(infoJson, null, 2), 'utf-8');

        console.log(`info.json 已为工况 ${caseId} 生成/更新，包含CFD域中心信息。`);
        
        // 输出调试信息
        if (geographicBounds) {
            console.log(`  - 地理范围: Lon[${geographicBounds.minLon.toFixed(6)}, ${geographicBounds.maxLon.toFixed(6)}], Lat[${geographicBounds.minLat.toFixed(6)}, ${geographicBounds.maxLat.toFixed(6)}]`);
            console.log(`  - CFD域中心: (${cfdCenterLon.toFixed(6)}, ${cfdCenterLat.toFixed(6)})`);
            console.log(`  - 风机群中心: (${windFarmCenterLon.toFixed(6)}, ${windFarmCenterLat.toFixed(6)})`);
            
            // 计算中心之间的距离（粗略估算）
            const earthRadius = 6371000; // 地球半径（米）
            const lat1 = cfdCenterLat * Math.PI / 180;
            const lat2 = windFarmCenterLat * Math.PI / 180;
            const deltaLat = (windFarmCenterLat - cfdCenterLat) * Math.PI / 180;
            const deltaLon = (windFarmCenterLon - cfdCenterLon) * Math.PI / 180;
            
            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                     Math.cos(lat1) * Math.cos(lat2) *
                     Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = earthRadius * c;
            
            console.log(`  - 中心距离: ${distance.toFixed(1)} 米`);
        }

        res.status(201).json({ success: true, message: 'info.json 生成/更新成功' });

    } catch (error) {
        console.error(`生成和保存 info.json (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, message: '生成或保存 info.json 时服务器出错' });
    }
});


// 14. 获取特定工况的计算状态 (从 info.json 读取)
router.get('/:caseId/calculation-status', async (req, res) => { // Make async
    const { caseId } = req.params;
    const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');

    if (!fs.existsSync(infoJsonPath)) {
        // If info.json doesn't exist, the case setup is likely incomplete
        return res.json({ calculationStatus: 'not_configured', visualizationStatus: null }); // More specific status
    }

    try {
        const data = await fsPromises.readFile(infoJsonPath, 'utf-8');
        const info = JSON.parse(data);
        const calcStatus = info.calculationStatus || 'unknown'; // Default to 'unknown' if field missing
        const vizStatus = info.visualizationStatus || null; // Get viz status too
        res.json({ calculationStatus: calcStatus, visualizationStatus: vizStatus });
    } catch (error) {
        console.error(`读取 info.json (${caseId}) 状态时出错:`, error);
        // Return a specific error status if reading fails
        res.json({ calculationStatus: 'error_reading_status', visualizationStatus: null });
    }
});

// --- 进度、日志、状态文件路由 ---

// 存储计算进度 - 放宽验证
router.post('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);

    try {
        // 更宽松的验证
        if (typeof req.body !== 'object' || req.body === null) {
            return res.status(400).json({ success: false, error: '无效的进度数据格式' });
        }

        // 确保必要的字段存在，提供默认值
        const progressData = {
            status: req.body.status || req.body.calculationStatus || 'not_started',
            isCalculating: req.body.isCalculating !== undefined ? req.body.isCalculating : false,
            progress: req.body.progress || 0,
            tasks: req.body.tasks || {},
            outputs: req.body.outputs || [],
            timestamp: req.body.timestamp || Date.now(),
            completed: req.body.completed || false,
            startTime: req.body.startTime || null,
            ...req.body // 包含其他字段
        };

        await fsPromises.writeFile(progressPath, JSON.stringify(progressData, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error(`保存计算进度 (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, error: '保存进度失败', details: error.message });
    }
});


// 获取计算进度
router.get('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
    try {
        if (fs.existsSync(progressPath)) {
            const progressData = await fsPromises.readFile(progressPath, 'utf-8');
            const progress = JSON.parse(progressData);
            // Ensure all required fields are present, provide defaults if not
            const defaultProgress = { isCalculating: false, progress: 0, tasks: {}, completed: false, timestamp: null };
            res.json({ progress: { ...defaultProgress, ...progress } }); // Merge with defaults
        } else {
            // Return a default progress state if file doesn't exist
             const defaultProgress = { isCalculating: false, progress: 0, tasks: {}, completed: false, timestamp: null };
             // Try getting status from info.json as a fallback
             const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
             if (fs.existsSync(infoJsonPath)) {
                 try {
                     const info = JSON.parse(await fsPromises.readFile(infoJsonPath, 'utf-8'));
                     if (info.calculationStatus === 'completed') {
                         defaultProgress.completed = true;
                         defaultProgress.progress = 100;
                         // Populate tasks as completed? Maybe too complex here.
                     } else if (info.calculationStatus === 'running') {
                         defaultProgress.isCalculating = true;
                     }
                 } catch {/* ignore */}
             }
            res.json({ progress: defaultProgress });
        }
    } catch (error) {
        console.error(`获取计算进度 (${caseId}) 失败:`, error);
        if (error instanceof SyntaxError) {
             res.status(500).json({ success: false, error: '进度文件损坏 (无效 JSON)' });
        } else {
            res.status(500).json({ success: false, error: '获取进度失败', details: error.message });
        }
    }
});


// 删除计算进度 (Maybe useful for forcing a recalculation state reset?)
router.delete('/:caseId/calculation-progress', async (req, res) => {
    const { caseId } = req.params;
    const progressPath = path.join(__dirname, `../uploads/${caseId}/calculation_progress.json`);
    try {
        if (fs.existsSync(progressPath)) {
            await fsPromises.unlink(progressPath);
            console.log(`计算进度文件已删除 (${caseId}): ${progressPath}`);
            res.json({ success: true, message: '计算进度文件删除成功' });
        } else {
            res.json({ success: true, message: '计算进度文件不存在，无需删除' });
        }
    } catch (error) {
        console.error(`删除计算进度 (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, message: '删除计算进度失败', error: error.message });
    }
});


// 获取 OpenFOAM (或其他计算核心) 的日志输出
router.get('/:caseId/calculation-log', async (req, res) => {
    const { caseId } = req.params;
    const runDir = path.join(__dirname, `../uploads/${caseId}/run`);

    // Define preferred log file names in order of preference
    const logPreferences = [
        'log.simpleFoam', // OpenFOAM solver log
        'log.snappyHexMesh', // Meshing log
        'log.blockMesh', // Initial mesh log
        'log.potentialFoam' // Initial field log
    ];

    try {
         // Check for preferred logs first
         for (const logName of logPreferences) {
             const logPath = path.join(runDir, logName);
             if (fs.existsSync(logPath)) {
                 console.log(`Serving preferred log: ${logName} for case ${caseId}`);
                 const output = await fsPromises.readFile(logPath, 'utf-8');
                 return res.type('text/plain').send(output);
             }
         }

         // If no preferred logs found, try finding the latest timestamped log
         if (fs.existsSync(runDir)) {
             const files = await fsPromises.readdir(runDir);
             const logFiles = files
                 .filter(f => f.startsWith('calculation_log_') && f.endsWith('.txt'))
                 .sort()
                 .reverse(); // Sort descending to get latest

             if (logFiles.length > 0) {
                 const latestLogPath = path.join(runDir, logFiles[0]);
                 console.log(`Serving latest timestamped log: ${logFiles[0]} for case ${caseId}`);
                 const output = await fsPromises.readFile(latestLogPath, 'utf-8');
                 return res.type('text/plain').send(output);
             }
         }

        // If no logs found at all
        res.status(404).type('text/plain').send(`未找到工况 ${caseId} 的计算日志文件。`);

    } catch (error) {
        console.error(`获取计算日志 (${caseId}) 失败:`, error);
        res.status(500).type('text/plain').send(`获取计算日志失败: ${error.message}`);
    }
});


// --- 风机状态路由 (保持不变) ---
// 保存风机状态 (通常由前端的交互触发, e.g., toggling on/off)
router.post('/:caseId/state', async (req, res) => {
    const { caseId } = req.params;
    const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);

    // Validate incoming state (e.g., must be an object with a windTurbines array)
     const stateSchema = Joi.object({
         windTurbines: Joi.array().items(Joi.object({
             id: Joi.string().required(),
             // Add other state properties to validate, e.g., 'enabled', 'yawOffset'
             enabled: Joi.boolean().optional(), // Example state property
             // ... other state fields
         }).unknown(true)) // Allow other properties within each turbine object
         .required() // The windTurbines array is required
     }).required(); // The root object is required

     const { error: validationError, value: validatedState } = stateSchema.validate(req.body);
     if (validationError) {
         console.warn(`保存风机状态验证失败 (${caseId}):`, validationError.details.map(d => d.message));
         return res.status(400).json({ success: false, message: '无效的风机状态数据格式', errors: validationError.details.map(d => d.message) });
     }

    try {
        // Ensure directory exists (might be redundant if case created properly)
         await fsPromises.mkdir(path.dirname(statePath), { recursive: true });

        await fsPromises.writeFile(statePath, JSON.stringify(validatedState, null, 2), 'utf-8');
        console.log(`风机状态已保存 (${caseId}): ${statePath}`);
        res.json({ success: true, message: '风机状态保存成功' });
    } catch (error) {
        console.error(`保存风机状态 (${caseId}) 失败:`, error);
        res.status(500).json({ success: false, message: '保存风机状态失败', error: error.message });
    }
});


// 获取风机状态
router.get('/:caseId/state', async (req, res) => {
    const { caseId } = req.params;
    const statePath = path.join(__dirname, `../uploads/${caseId}/turbine_state.json`);
    try {
        if (fs.existsSync(statePath)) {
            const stateData = await fsPromises.readFile(statePath, 'utf-8');
            const state = JSON.parse(stateData);
            // Ensure it returns the expected structure, e.g., { windTurbines: [...] }
            // Validate structure before sending?
            if (!state || !Array.isArray(state.windTurbines)) {
                 console.warn(`风机状态文件格式无效 (${caseId}), 返回空列表。 Path: ${statePath}`);
                 return res.json({ success: true, windTurbines: [] });
            }
            res.json({ success: true, windTurbines: state.windTurbines });
        } else {
            // If state file doesn't exist, try getting turbines from info.json
            const infoJsonPath = path.join(__dirname, '../uploads', caseId, 'info.json');
            if (fs.existsSync(infoJsonPath)) {
                try {
                    const infoData = await fsPromises.readFile(infoJsonPath, 'utf-8');
                    const info = JSON.parse(infoData);
                    if (info && Array.isArray(info.turbines)) {
                         // Return basic turbine info from info.json as default state (e.g., all enabled)
                         const defaultState = info.turbines.map(t => ({ id: t.id, name: t.name, enabled: true /* Default state */ }));
                         return res.json({ success: true, windTurbines: defaultState });
                    }
                } catch (err) {
                     console.warn(`读取 info.json 以获取默认状态失败 (${caseId}):`, err);
                }
            }
            // Return empty array if neither state nor info file provides data
            res.json({ success: true, windTurbines: [] });
        }
    } catch (error) {
        console.error(`获取风机状态 (${caseId}) 失败:`, error);
         if (error instanceof SyntaxError) {
             console.error(`风机状态文件损坏 (${caseId}):`, error);
             res.status(500).json({ success: false, message: '获取风机状态失败 (文件损坏)' });
         } else {
             res.status(500).json({ success: false, message: '获取风机状态失败', error: error.message });
         }
    }
});


// --- VTK 和后处理文件路由 (保持不变) ---

// 确保 VTK 目录存在 (中间件)
// Apply middleware specifically to routes that need the VTK dir
const ensureVTKMiddleware = (req, res, next) => {
    ensureVTKDirectories(req.params.caseId);
    next();
};
router.use('/:caseId/VTK', ensureVTKMiddleware);
router.use('/:caseId/list-vtk-files', ensureVTKMiddleware);


// 主要的VTK文件提供路由
router.get('/:caseId/VTK/*', async (req, res) => {
    const { caseId } = req.params;
    // req.params[0] captures everything after /VTK/
    const relativePath = req.params[0];
    if (!relativePath || relativePath.includes('..')) { // Basic traversal check
        return res.status(400).json({ success: false, error: '无效或禁止的 VTK 文件路径' });
    }
    // Construct the full path relative to the case's VTK directory
    const filePath = path.join(__dirname, '../uploads', caseId, 'run/VTK', relativePath);

    // More robust path traversal check
    const vtkBaseDir = path.resolve(path.join(__dirname, '../uploads', caseId, 'run/VTK'));
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(vtkBaseDir)) {
         console.warn(`Path traversal attempt detected: ${resolvedFilePath} vs ${vtkBaseDir}`);
         return res.status(403).json({ success: false, error: '禁止访问' });
    }


    try {
        if (!fs.existsSync(resolvedFilePath)) {
            console.warn('VTK 文件未找到:', resolvedFilePath);
            return res.status(404).json({ success: false, error: 'VTK 文件未找到', path: relativePath });
        }

        const stat = await fsPromises.stat(resolvedFilePath);
        if (stat.isDirectory()) {
             return res.status(400).json({ success: false, error: '请求路径是一个目录，不是文件', path: relativePath });
        }

        const ext = path.extname(resolvedFilePath).toLowerCase();
        // Determine content type based on extension
        let contentType = 'application/octet-stream'; // Default binary
        if (ext === '.vtk') contentType = 'text/plain'; // Legacy VTK often text
        // Modern VTK XML formats
        else if (ext === '.vtu') contentType = 'application/vnd.kitware.vtk+xml'; // Unstructured Grid
        else if (ext === '.vtp') contentType = 'application/vnd.kitware.vtk+xml'; // PolyData
        else if (ext === '.vti') contentType = 'application/vnd.kitware.vtk+xml'; // ImageData
        else if (ext === '.vts') contentType = 'application/vnd.kitware.vtk+xml'; // Structured Grid
        else if (ext === '.vtr') contentType = 'application/vnd.kitware.vtk+xml'; // Rectilinear Grid
        else if (ext === '.vtm') contentType = 'application/vnd.kitware.vtk+xml'; // MultiBlock Data
        else if (ext === '.pvsm') contentType = 'application/xml'; // ParaView State File
        else if (ext === '.json') contentType = 'application/json';

        res.setHeader('Content-Type', contentType);
        // Add cache control headers if desired (e.g., cache for a short time)
        // res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

        const fileStream = fs.createReadStream(resolvedFilePath);
        fileStream.on('error', (error) => {
            console.error(`读取 VTK 文件流 (${resolvedFilePath}) 出错:`, error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: '读取文件失败', details: error.message });
            } else {
                 res.end();
            }
        });

        req.on('close', () => {
            // console.log(`Client disconnected while streaming VTK file: ${resolvedFilePath}`);
            fileStream.destroy(); // Clean up stream if client disconnects
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error(`提供 VTK 文件 (${resolvedFilePath}) 时出错:`, error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: '服务器内部错误', details: error.message });
        }
    }
});

// 列出可用的VTK文件 (递归查找)
router.get('/:caseId/list-vtk-files', async (req, res) => {
    const { caseId } = req.params;
    const vtkBaseDir = path.join(__dirname, '../uploads', caseId, 'run', 'VTK');
    const uploadsBaseDir = path.join(__dirname, '..', 'uploads'); // Base for relative paths

    try {
        if (!fs.existsSync(vtkBaseDir)) {
            console.log(`VTK 目录未找到: ${vtkBaseDir}`);
            // Return empty list if directory doesn't exist
             // The base directory path should be relative to the server root or configured static path
            return res.json({ success: true, files: [], baseDirectory: `/uploads/${caseId}/run/VTK` });
        }

        const vtkFiles = [];
        const directories = [vtkBaseDir]; // Stack for directories to explore

        while (directories.length > 0) {
            const currentDir = directories.pop();
            let entries;
            try {
                entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
            } catch (readDirError) {
                 console.warn(`无法读取目录 ${currentDir}: ${readDirError.message}`);
                 continue; // Skip directories that cannot be read
            }


            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    // Avoid infinite loops with symlinks (though less common here)
                    // Add basic depth limit?
                    directories.push(fullPath); // Add subdirectory to stack
                } else if (entry.isFile()) { // Ensure it's a file
                    const ext = path.extname(entry.name).toLowerCase();
                     // Define recognizable VTK/ParaView extensions
                    const vtkExtensions = ['.vtk', '.vtu', '.vtp', '.vti', '.vts', '.vtr', '.vtm', '.pvsm', '.pvd'];
                    if (vtkExtensions.includes(ext)) {
                        // Store relative path from the VTK base directory for easier client-side requests
                        const relativePath = path.relative(vtkBaseDir, fullPath).replace(/\\/g, '/'); // Use forward slashes
                        vtkFiles.push(relativePath);
                    }
                }
            }
        }
        vtkFiles.sort(); // Sort for consistency
        console.log(`工况 ${caseId} 找到 VTK/PVSM 文件:`, vtkFiles.length);
        // Return relative paths from the static 'uploads' root for the base directory
        res.json({ success: true, files: vtkFiles, baseDirectory: `/uploads/${caseId}/run/VTK` });

    } catch (error) {
        console.error(`列出 VTK 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, error: '列出 VTK 文件失败', details: error.message });
    }
});


// VTK 处理 (示例，按需实现)
router.post('/:caseId/process-vtk', async (req, res) => {
    const { caseId } = req.params;
    const script = path.join(__dirname, '../utils/process_vtk.py'); // Example script
    // Get input/output specifications from request body?
    const inputFileRelative = req.body.inputFile; // e.g., "some_input.vtu" or "subdir/some_input.vtu"
    const outputName = req.body.outputName || 'processed_output'; // e.g., "slice"

     if (!inputFileRelative || inputFileRelative.includes('..')) {
         return res.status(400).json({ success: false, error: '无效或缺失输入文件参数' });
     }

    const inputPath = path.join(__dirname, '../uploads', caseId, 'run/VTK', inputFileRelative);
    // Define output directory within VTK folder
    const outputDir = path.join(__dirname, '../uploads', caseId, 'run/VTK', 'processed', outputName);

    // Security checks
    const vtkBaseDir = path.resolve(path.join(__dirname, '../uploads', caseId, 'run/VTK'));
    const resolvedInputPath = path.resolve(inputPath);
     const resolvedOutputDir = path.resolve(outputDir);
    if (!resolvedInputPath.startsWith(vtkBaseDir) || !resolvedOutputDir.startsWith(vtkBaseDir)) {
        return res.status(403).json({ success: false, error: '禁止访问输入/输出路径' });
    }


    if (!fs.existsSync(script)) {
        console.error(`VTK 处理脚本未找到: ${script}`);
        return res.status(500).json({ success: false, error: 'VTK 处理脚本未找到' });
    }
     if (!fs.existsSync(resolvedInputPath)) {
        return res.status(404).json({ success: false, error: `输入 VTK 文件未找到: ${inputFileRelative}` });
    }

    try {
        await fsPromises.mkdir(resolvedOutputDir, { recursive: true });
        console.log(`执行 VTK 处理脚本: python3 ${script} ${resolvedInputPath} ${resolvedOutputDir}`);
        // Pass arguments securely
        const pythonProcess = spawn('python3', [script, resolvedInputPath, resolvedOutputDir]);

        let outputData = '';
        let errorData = '';
        pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); console.log(`VTK Proc stdout: ${data}`); });
        pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); console.error(`VTK Proc stderr: ${data}`);});

        const exitCode = await new Promise((resolve, reject) => {
            pythonProcess.on('close', resolve);
            pythonProcess.on('error', (err) => {
                console.error(`VTK 处理进程启动错误 (${caseId}):`, err);
                 reject(new Error(`VTK 处理脚本启动失败: ${err.message}`));
            });
        });

        if (exitCode !== 0) {
            console.error(`VTK 处理脚本 (${caseId}) 失败，退出码 ${exitCode}:\n${errorData}`);
            // Send specific error if possible
            return res.status(500).json({ success: false, message: 'VTK 处理脚本执行失败', exitCode: exitCode, stderr: errorData.substring(0, 1000) }); // Limit stderr length
        }

        console.log(`VTK 处理脚本 (${caseId}) 成功完成. Output:\n${outputData}`);
        // Look for expected output files or metadata
        // Example: Check if a specific output file was created
        const expectedOutputFile = path.join(resolvedOutputDir, 'result.vtp'); // Example output name
        if (fs.existsSync(expectedOutputFile)) {
             res.json({ success: true, message: 'VTK 处理成功', output: outputData, resultFile: path.relative(vtkBaseDir, expectedOutputFile).replace(/\\/g, '/') });
        } else {
            res.json({ success: true, message: 'VTK 处理脚本执行成功，但未找到预期的输出文件', output: outputData });
        }

    } catch (error) {
        console.error(`处理 VTK 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, error: '处理 VTK 文件时发生服务器错误', details: error.message });
    }
});


// 获取速度场 VTP 文件列表 (用于 ParaView Glance 等)
router.get('/:caseId/list-velocity-files', async (req, res) => {
    const { caseId } = req.params;
    // Correct path for post-processing data (often within 'run' directory)
    const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');
    console.log(`[list-velocity-files] Reading directory: ${dataPath} for case ${caseId}`);

    try {
        // Prevent browser caching of the list
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (!fs.existsSync(dataPath)) {
            console.warn(`[list-velocity-files] Directory not found: ${dataPath}`);
            return res.json({ success: true, files: [], baseDirectory: `/uploads/${caseId}/run/postProcessing/Data` });
        }

        // Read directory content
        const files = await fsPromises.readdir(dataPath);
        // Filter for files ending with .vtp (case-insensitive) and sort
        const velocityFiles = files
            .filter(file => file.toLowerCase().endsWith('.vtp'))
            .sort((a, b) => {
                 // Attempt to sort numerically if possible (e.g., slice_10.vtp, slice_100.vtp)
                 const numA = parseFloat(a.replace(/[^0-9.]/g, ''));
                 const numB = parseFloat(b.replace(/[^0-9.]/g, ''));
                 if (!isNaN(numA) && !isNaN(numB)) {
                     return numA - numB;
                 }
                 // Fallback to alphabetical sort if not numeric
                 return a.localeCompare(b);
            });


        console.log(`[list-velocity-files] Found ${velocityFiles.length} VTP files for case ${caseId}.`);
        res.json({ success: true, files: velocityFiles, baseDirectory: `/uploads/${caseId}/run/postProcessing/Data` });

    } catch (error) {
        console.error(`[list-velocity-files] Error reading directory ${dataPath}:`, error);
        res.status(500).json({ success: false, message: '读取速度场文件列表失败', details: error.message });
    }
});


// --- 报告相关路由 (保持不变) ---
// 列出 Output 目录下的特定文件 (for report generation)
router.get('/:caseId/list-output-files', async (req, res) => {
    const { caseId } = req.params;
    const outputPath = path.join(__dirname, '../uploads', caseId, 'run', 'Output');
    // Files typically needed for the report
    const requiredFiles = ['Output02-realHigh', 'Output04-U-P-Ct-fn(INIT)', 'Output06-U-P-Ct-fn(ADJUST)'];
    const outputBaseUrl = `/uploads/${caseId}/run/Output`; // Relative URL path

    try {
        let availableFiles = [];
        if (fs.existsSync(outputPath)) {
            const filesInDir = await fsPromises.readdir(outputPath);
            availableFiles = filesInDir.filter(file => requiredFiles.includes(file)).sort();
            console.log(`Found required output files for report (${caseId}):`, availableFiles);
        } else {
             console.warn(`Output 目录未找到: ${outputPath} for case ${caseId}`);
        }
        res.json({ success: true, files: availableFiles, baseDirectory: outputBaseUrl });

    } catch (error) {
        console.error(`列出 Output 文件 (${caseId}) 时出错:`, error);
        res.status(500).json({ success: false, message: '列出 Output 文件失败', details: error.message });
    }
});

// 读取指定 Output 文件内容
router.get('/:caseId/output-file/:fileName', async (req, res) => {
    const { caseId, fileName } = req.params;
    // Basic validation on fileName to prevent arbitrary file access
    // Use a regex or explicit list check
     const allowedFiles = ['Output02-realHigh', 'Output04-U-P-Ct-fn(INIT)', 'Output06-U-P-Ct-fn(ADJUST)'];
    if (!fileName || !allowedFiles.includes(fileName)) {
        return res.status(400).json({ success: false, message: '无效或不允许的文件名' });
    }

    const filePath = path.join(__dirname, '../uploads', caseId, 'run', 'Output', fileName);
    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: `Output 文件 '${fileName}' 不存在`, path: filePath });
        }
        // Consider file size limit? These files are usually small text files.
        const content = await fsPromises.readFile(filePath, 'utf-8');
        // Send as plain text or JSON? Assuming JSON is easier for frontend.
        // If it's plain text, just send text.
        // res.type('text/plain').send(content);
        res.json({ success: true, content: content }); // Send as JSON object with content key

    } catch (error) {
        console.error(`读取 output 文件 (${filePath}) 时出错:`, error);
        res.status(500).json({ success: false, message: '读取 Output 文件失败', details: error.message });
    }
});

// 导出所有速度场 VTP 文件为 ZIP
router.get('/:caseId/export-velocity-layers', async (req, res) => {
    const { caseId } = req.params;
    const dataPath = path.join(__dirname, '../uploads', caseId, 'run', 'postProcessing', 'Data');

    if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ success: false, message: '速度场数据目录不存在' });
    }

    try {
        const files = (await fsPromises.readdir(dataPath)).filter(file => file.toLowerCase().endsWith('.vtp'));

        if (files.length === 0) {
            return res.status(404).json({ success: false, message: '未找到 VTP 文件' });
        }

        const archive = archiver('zip', { zlib: { level: 6 } }); // Compression level (6 is good balance)

        // Handle archiver errors
        archive.on('warning', function(err) {
          if (err.code === 'ENOENT') {
             console.warn(`Archiver warning (${caseId}): ${err.message}`); // Log file not found warnings
          } else {
             console.error(`Archiver error (${caseId}):`, err); // Log other errors
             // Try to send an error response if headers not sent
              if (!res.headersSent) {
                 res.status(500).json({ success: false, message: '创建 ZIP 文件时出错 (archiver error)' });
              }
          }
        });
        archive.on('error', function(err) {
           console.error(`Fatal Archiver error (${caseId}):`, err);
           if (!res.headersSent) {
             res.status(500).json({ success: false, message: '创建 ZIP 文件时发生严重错误' });
           }
        });


        // Set headers for download - Use encodeURIComponent for robustness
         const safeCaseId = encodeURIComponent(caseId);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeCaseId}_velocity_layers.zip"; filename*=UTF-8''${safeCaseId}_velocity_layers.zip`);


        // Pipe archive data to the response
        archive.pipe(res);

        // Add files to the archive asynchronously? No, append is synchronous.
        console.log(`Archiving ${files.length} VTP files for ${caseId}...`);
        for (const file of files) {
            const filePath = path.join(dataPath, file);
            // Check if file still exists before adding (might be deleted during process?)
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file }); // Add file with its original name
            } else {
                 console.warn(`File disappeared before archiving: ${filePath}`);
            }
        }

        // Finalize the archive (triggers writing and sending)
        // This is asynchronous.
        await archive.finalize();
        console.log(`ZIP archive finalized and sent for ${caseId}.`);

    } catch (error) {
        console.error(`创建速度层 ZIP (${caseId}) 失败:`, error);
        // Ensure response isn't sent twice
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: '创建 ZIP 文件失败', error: error.message });
        } else {
            // If headers sent, the stream failed. Client might get partial file.
            console.error(`Error occurred after headers sent for ZIP (${caseId}).`);
        }
    }
});


// 服务器端 PDF 报告生成
router.post('/:caseId/generate-pdf-report', async (req, res) => {
    const { caseId } = req.params;
    console.log(`收到工况 ${caseId} 的 PDF 生成请求`);

    try {
        // Log received chart data URIs (optional, be careful with large data)
         // console.log('前端图表键:', Object.keys(req.body.charts || {}));

        const frontendCharts = req.body.charts || {};

        // 1. Prepare data (fetches from files, potentially generates server-side charts)
        console.log(`[PDF Report ${caseId}] Preparing data...`);
        const pdfData = await pdfDataService.prepareDataForPDF(caseId);
        console.log(`[PDF Report ${caseId}] Data prepared. Case name: ${pdfData.caseName}`);

        // 2. Merge frontend charts (overwriting or using as fallback)
        // Be explicit about which charts are expected from frontend vs server
        pdfData.charts = {
            // Charts potentially generated server-side (can be overwritten)
            speedComparisonServer: pdfData.charts?.speedComparisonServer, // Example name
            powerComparisonServer: pdfData.charts?.powerComparisonServer, // Example name

            // Charts expected primarily from frontend
            speedComparison: frontendCharts.speedComparison, // Assume frontend provides this
            powerComparison: frontendCharts.powerComparison, // Assume frontend provides this
            performanceChange: frontendCharts.performanceChange, // Assume frontend provides this
        };

        // Optional: Validate essential data URIs before passing to template
         const requiredCharts = ['speedComparison', 'powerComparison', 'performanceChange'];
         let missingCharts = [];
         for (const key of requiredCharts) {
             const value = pdfData.charts[key];
             if (!value || typeof value !== 'string' || !value.startsWith('data:image/')) {
                 console.warn(`[PDF Report ${caseId}] 图表 '${key}' 数据无效或缺失.`);
                 missingCharts.push(key);
                 // Provide a placeholder? Or fail? For now, let template handle missing data.
                 // pdfData.charts[key] = PLACEHOLDER_IMAGE_DATA_URI;
             }
         }
        // If critical charts are missing, maybe return an error?
        // if (missingCharts.length > 0) {
        //      return res.status(400).json({ success: false, message: `缺少必要的图表数据: ${missingCharts.join(', ')}` });
        // }

        // 3. Generate PDF buffer using the service
        console.log(`[PDF Report ${caseId}] Generating PDF buffer...`);
        const pdfBuffer = await pdfDataService.generatePDF(caseId, pdfData);
        console.log(`[PDF Report ${caseId}] PDF buffer generated (${pdfBuffer.length} bytes).`);

        // 4. Send PDF response
        const safeCaseName = encodeURIComponent(pdfData.caseName || caseId);
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="${safeCaseName}_report.pdf"; filename*=UTF-8''${safeCaseName}_report.pdf`
        });
        res.end(pdfBuffer);
        console.log(`成功生成并发送了工况 ${caseId} 的 PDF 报告。`);

    } catch (error) {
        console.error(`生成 PDF 报告 (${caseId}) 时出错:`, error);
        // Send JSON error only if headers haven't been sent
        if (!res.headersSent) {
            // Provide more context if it's a data preparation error vs PDF generation error
            let message = '生成 PDF 报告失败';
            if (error.message.includes('prepareDataForPDF')) { // Check if error originated in data prep
                 message = `准备报告数据时出错: ${error.message}`;
            } else if (error.message.includes('generatePDF')) { // Check if error originated in PDF generation
                 message = `PDF 生成过程中出错: ${error.message}`;
            }

            res.status(500).json({
                success: false,
                message: message,
                // Avoid sending full stack trace to client in production
                error: process.env.NODE_ENV === 'development' ? error.stack : error.message
            });
        } else {
            // If headers were sent, the connection might be broken or PDF generation failed mid-stream
            console.error(`Error occurred after headers sent for PDF report (${caseId}).`);
            res.end(); // Attempt to close the response gracefully
        }
    }
});


// --- 嵌套风机路由 ---
router.use("/:caseId/wind-turbines", windTurbinesRouter);

// --- 导出路由 ---
module.exports = router;
```

---

### 4. `AdmFoam` (C++ 求解器)

您提供的求解器代码 **无需修改**。它的 `read_U_P_Ct` 函数已经从 `Input/` 目录动态读取 `1-U-P-Ct.txt`, `2-U-P-Ct.txt` 等文件。我们的后端修改恰好将用户上传的文件放到了这个位置，因此求解器可以无缝地使用这些新文件。

---

### 总结

以上修改完成了您提出的所有要求。现在，用户可以在“参数设置”页面上传他们的风机性能曲线文件，这些文件将被发送到服务器并放置在正确的计算目录中，供 OpenFOAM 求解器在下次计算时使用。整个流程实现了前后端的数据打通，功能完整。