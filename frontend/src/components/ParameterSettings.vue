<template>
  <div class="parameter-settings">
    <h3>参数设置</h3>

    <!-- 工况信息展示区域 -->
    <div class="case-info">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="工况名称">
          {{ caseStore.caseName }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <el-divider />

    <el-form :model="caseStore.parameters" :rules="rules" ref="formRef" label-width="200px">
      <!-- 计算域 -->
      <el-form-item label="计算域">
        <el-form-item label="宽度 (m)" prop="calculationDomain.width" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.calculationDomain.width"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="高度 (m)" prop="calculationDomain.height" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.calculationDomain.height"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
      </el-form-item>

      <!-- 工况 -->
      <el-form-item label="工况">
        <el-form-item label="风向角 (°)" prop="conditions.windDirection" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.conditions.windDirection"
            :min="0"
            :max="360"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="入口风速 (m/s)" prop="conditions.inletWindSpeed" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.conditions.inletWindSpeed"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
      </el-form-item>

      <!-- 网格 -->
      <el-form-item label="网格">
        <el-form-item label="加密区高度 (m)" prop="grid.encryptionHeight" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.encryptionHeight"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="加密层数" prop="grid.encryptionLayers" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.encryptionLayers"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="空间网格生长率" prop="grid.gridGrowthRate" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.gridGrowthRate"
            step="0.1"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="最大待证长度 (m)" prop="grid.maxExtensionLength" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.maxExtensionLength"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="加密区径向长度 (m)" prop="grid.encryptionRadialLength" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.encryptionRadialLength"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区径向长度 (m)" prop="grid.downstreamRadialLength" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.downstreamRadialLength"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="加密半径 (m)" prop="grid.encryptionRadius" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.encryptionRadius"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="加密过渡半径 (m)" prop="grid.encryptionTransitionRadius" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.encryptionTransitionRadius"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="地形半径 (m)" prop="grid.terrainRadius" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.terrainRadius"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="地形过渡半径 (m)" prop="grid.terrainTransitionRadius" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.terrainTransitionRadius"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区长度 (m)" prop="grid.downstreamLength" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.downstreamLength"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区宽度 (m)" prop="grid.downstreamWidth" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.downstreamWidth"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="缩放比" prop="grid.scale" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.grid.scale"
            step="0.001"
            :min="0"
            :max="1"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
      </el-form-item>

      <!-- 仿真 -->
      <el-form-item label="仿真">
        <el-form-item label="核" prop="simulation.cores" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.simulation.cores"
            :min="1"
            style="width: 120px;"
          />
        </el-form-item>
        <el-form-item label="步数" prop="simulation.steps" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.simulation.steps"
            :min="1"
            style="width: 120px;"
          />
        </el-form-item>
        <el-form-item label="时间步长" prop="simulation.deltaT" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.simulation.deltaT"
            :min="0.001"
            style="width: 120px;"
          />
        </el-form-item>
      </el-form-item>

      <!-- 后处理 -->
      <el-form-item label="后处理">
        <el-form-item label="结果层数" prop="postProcessing.resultLayers" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.postProcessing.resultLayers"
            :min="1"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="层数间距 (m)" prop="postProcessing.layerSpacing" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.postProcessing.layerSpacing"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="各层数据宽度 (m)" prop="postProcessing.layerDataWidth" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.postProcessing.layerDataWidth"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
        <el-form-item label="各层数据高度 (m)" prop="postProcessing.layerDataHeight" :inline="true">
          <el-input-number
            v-model="caseStore.parameters.postProcessing.layerDataHeight"
            :min="0"
            style="width: 120px;"
            :disabled="caseStore.infoExists"
          />
        </el-form-item>
      </el-form-item>

      <!-- 添加中心经纬度展示（只读） -->
      <el-form-item label="中心经纬度">
        <el-input readonly :value="centerCoordinates" clearable />
      </el-form-item>

     <!-- 按钮区域 -->
     <el-form-item>
        <el-button
          type="primary"
          @click="handleGenerateClick"
           :disabled="caseStore.infoExists || caseStore.windTurbines.length === 0"
        >
          提交参数
        </el-button>
        <el-button
          type="success"
          @click="handleDownloadClick"
          v-if="caseStore.infoExists"
        >
          下载 info.json
        </el-button>
      </el-form-item>

      <div v-if="submissionMessage" :class="{'success-message': submissionSuccess, 'error-message': !submissionSuccess}" style="margin-top: 20px;">
        {{ submissionMessage }}
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute } from 'vue-router';
import { useCaseStore } from '../store/caseStore';

const route = useRoute();
const caseStore = useCaseStore();

const caseId = route.params.caseId;
const formRef = ref(null);
const submissionMessage = ref('');
const submissionSuccess = ref(true);

// 直接使用 caseStore 中的 caseName
const caseName = computed(() => caseStore.caseName);

// 计算中心经纬度
const centerCoordinates = computed(() => {
  if (caseStore.windTurbines.length > 0) {
    const longitudes = caseStore.windTurbines.map(turbine => turbine.longitude); // Use longitude
    const latitudes = caseStore.windTurbines.map(turbine => turbine.latitude); // Use latitude
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    return `经度: ${centerLon.toFixed(6)}, 纬度: ${centerLat.toFixed(6)}`;
  }
  return '计算中...';
});

// Initialize case in the store
const initialize = async () => {
  await caseStore.initializeCase(caseId);
};

onMounted(async () => {
  await initialize();
  console.log('参数:', caseStore.parameters);
});

// Validation rules
const rules = {
  'calculationDomain.width': [
    { required: true, message: '请输入计算域宽度', trigger: 'blur' }
  ],
  'calculationDomain.height': [
    { required: true, message: '请输入计算域高度', trigger: 'blur' }
  ],
  // 添加更多规则如需要
};

// Handle parameter submission
const handleGenerateClick = async () => {
  console.log("handleGenerateClick called!");
  if (caseStore.windTurbines.length === 0) {
    ElMessage.error('请先上传风机数据');
    return;
  }

  try {
    await formRef.value.validate();
    await caseStore.submitParameters();
    // 添加这一行，确保生成 info.json
    await caseStore.generateInfoJson();
    
    submissionSuccess.value = true;
    submissionMessage.value = '参数提交成功，info.json 已生成';
    ElMessage.success('参数提交成功，info.json 已生成');
  } catch (error) {
    submissionSuccess.value = false;
    submissionMessage.value = error.message || '参数提交失败';
    ElMessage.error(submissionMessage.value);
  }
};

// Handle info.json download
const handleDownloadClick = async () => {
  await caseStore.downloadInfoJson();
};
</script>

<style scoped>
.parameter-settings {
  padding: 20px;
}

.case-info {
  margin-bottom: 20px;
}

.el-descriptions {
  margin-top: 20px;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
}

.el-divider {
  margin: 24px 0;
}

.success-message {
  color: #67c23a;
  margin-top: 20px;
  padding: 10px;
  border-radius: 4px;
  background-color: #f0f9eb;
}

.error-message {
  color: #f56c6c;
  margin-top: 20px;
  padding: 10px;
  border-radius: 4px;
  background-color: #fef0f0;
}

:deep(.el-form-item--inline) {
  margin-right: 20px;
}

:deep(.el-input-number) {
  width: 120px;
}
</style>