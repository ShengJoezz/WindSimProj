<!-- frontend/src/components/ParameterSettings.vue -->
<template>
  <div class="parameter-settings">
    <h3>参数设置</h3>
    
    <!-- 工况信息展示区域 -->
    <div class="case-info">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="工况名称">
          {{ caseName }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <el-divider />

    <el-form :model="parameters" :rules="rules" ref="formRef" label-width="200px">
      <!-- 计算域 -->
      <el-form-item label="计算域">
        <el-form-item label="宽度 (m)" prop="calculationDomain.width" :inline="true">
          <el-input-number 
            v-model="parameters.calculationDomain.width" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists" 
          />
        </el-form-item>
        <el-form-item label="高度 (m)" prop="calculationDomain.height" :inline="true">
          <el-input-number 
            v-model="parameters.calculationDomain.height" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists" 
          />
        </el-form-item>
      </el-form-item>
        
      <!-- 工况 -->
      <el-form-item label="工况">
        <el-form-item label="风向角 (°)" prop="conditions.windDirection" :inline="true">
          <el-input-number 
            v-model="parameters.conditions.windDirection" 
            :min="0" 
            :max="360" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="入口风速 (m/s)" prop="conditions.inletWindSpeed" :inline="true">
          <el-input-number 
            v-model="parameters.conditions.inletWindSpeed" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
      </el-form-item>
        
      <!-- 网格 -->
      <el-form-item label="网格">
        <el-form-item label="加密区高度 (m)" prop="grid.encryptionHeight" :inline="true">
          <el-input-number 
            v-model="parameters.grid.encryptionHeight" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="加密层数" prop="grid.encryptionLayers" :inline="true">
          <el-input-number 
            v-model="parameters.grid.encryptionLayers" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="空间网格生长率" prop="grid.gridGrowthRate" :inline="true">
          <el-input-number 
            v-model="parameters.grid.gridGrowthRate" 
            step="0.1" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="最大待证长度 (m)" prop="grid.maxExtensionLength" :inline="true">
          <el-input-number 
            v-model="parameters.grid.maxExtensionLength" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="加密区径向长度 (m)" prop="grid.encryptionRadialLength" :inline="true">
          <el-input-number 
            v-model="parameters.grid.encryptionRadialLength" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区径向长度 (m)" prop="grid.downstreamRadialLength" :inline="true">
          <el-input-number 
            v-model="parameters.grid.downstreamRadialLength" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="加密半径 (m)" prop="grid.encryptionRadius" :inline="true">
          <el-input-number 
            v-model="parameters.grid.encryptionRadius" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="加密过渡半径 (m)" prop="grid.encryptionTransitionRadius" :inline="true">
          <el-input-number 
            v-model="parameters.grid.encryptionTransitionRadius" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="地形半径 (m)" prop="grid.terrainRadius" :inline="true">
          <el-input-number 
            v-model="parameters.grid.terrainRadius" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="地形过渡半径 (m)" prop="grid.terrainTransitionRadius" :inline="true">
          <el-input-number 
            v-model="parameters.grid.terrainTransitionRadius" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区长度 (m)" prop="grid.downstreamLength" :inline="true">
          <el-input-number 
            v-model="parameters.grid.downstreamLength" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="尾流区宽度 (m)" prop="grid.downstreamWidth" :inline="true">
          <el-input-number 
            v-model="parameters.grid.downstreamWidth" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="缩放比" prop="grid.scale" :inline="true">
          <el-input-number 
            v-model="parameters.grid.scale" 
            step="0.001" 
            :min="0" 
            :max="1" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
      </el-form-item>
        
      <!-- 仿真 -->
      <el-form-item label="仿真">
        <el-form-item label="核" prop="simulation.cores" :inline="true">
          <el-input-number 
            v-model="parameters.simulation.cores" 
            :min="1" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="步数" prop="simulation.steps" :inline="true">
          <el-input-number 
            v-model="parameters.simulation.steps" 
            :min="1" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
      </el-form-item>
        
      <!-- 后处理 -->
      <el-form-item label="后处理">
        <el-form-item label="结果层数" prop="postProcessing.resultLayers" :inline="true">
          <el-input-number 
            v-model="parameters.postProcessing.resultLayers" 
            :min="1" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="层数间距 (m)" prop="postProcessing.layerSpacing" :inline="true">
          <el-input-number 
            v-model="parameters.postProcessing.layerSpacing" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="各层数据宽度 (m)" prop="postProcessing.layerDataWidth" :inline="true">
          <el-input-number 
            v-model="parameters.postProcessing.layerDataWidth" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
        <el-form-item label="各层数据高度 (m)" prop="postProcessing.layerDataHeight" :inline="true">
          <el-input-number 
            v-model="parameters.postProcessing.layerDataHeight" 
            :min="0" 
            style="width: 120px;" 
            :disabled="infoExists"
          />
        </el-form-item>
      </el-form-item>
        
      <!-- 按钮区域 -->
      <el-form-item>
        <el-button 
          type="primary" 
          @click="infoExists ? downloadInfo : submitParameters" 
          :disabled="infoExists"
        >
          {{ infoExists ? '下载 info.json' : '提交参数' }}
        </el-button>
      </el-form-item>
    </el-form>

    <div v-if="submissionMessage" :class="{'success-message': submissionSuccess, 'error-message': !submissionSuccess}" style="margin-top: 20px;">
      {{ submissionMessage }}
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { useRoute } from 'vue-router';
import { useMapStore } from '../store/mapStore';

const route = useRoute();
const store = useMapStore();

const caseId = route.params.caseId;
const formRef = ref(null);
const submissionMessage = ref('');
const submissionSuccess = ref(true);
const caseName = ref('');

const parameters = reactive({
  calculationDomain: {
    width: 10000,
    height: 800
  },
  conditions: {
    windDirection: 0,
    inletWindSpeed: 10
  },
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
    scale: 0.001
  },
  simulation: {
    cores: 1,
    steps: 100
  },
  postProcessing: {
    resultLayers: 10,
    layerSpacing: 20,
    layerDataWidth: 1000,
    layerDataHeight: 1000
  }
});

const rules = {
  'calculationDomain.width': [
    { required: true, message: '请输入计算域宽度', trigger: 'blur' }
  ],
  'calculationDomain.height': [
    { required: true, message: '请输入计算域高度', trigger: 'blur' }
  ],
  // 可根据需要添加更多验证规则
};

// 初始化参数和检查 info.json 是否存在
const initializeParameters = async () => {
  try {
    // 检查 info.json 是否存在
    await store.checkInfoExists(caseId);
    console.log('infoExists 状态:', store.infoExists);  // 添加此行

    // 获取参数
    const response = await axios.get(`/api/cases/${caseId}/parameters`);
    if (response.data && response.data.parameters) {
      const { caseName: name, calculationDomain, conditions, grid, simulation, postProcessing } = response.data.parameters;
      
      // 设置工况名称
      caseName.value = name;

      // 更新其他参数
      if (calculationDomain) Object.assign(parameters.calculationDomain, calculationDomain);
      if (conditions) Object.assign(parameters.conditions, conditions);
      if (grid) Object.assign(parameters.grid, grid);
      if (simulation) Object.assign(parameters.simulation, simulation);
      if (postProcessing) Object.assign(parameters.postProcessing, postProcessing);
    }

    // 加载风机数据
    await store.loadWindTurbines(caseId);

    if (store.infoExists) {
      // 如果 info.json 已存在，可以选择从 info.json 获取参数以确保一致性
      // 这里假设参数已同步，无需额外操作
    }

  } catch (error) {
    console.error('初始化参数失败:', error);
    ElMessage({
      message: '初始化参数失败，已加载默认参数',
      type: 'warning'
    });
  }
};

// 提交参数并生成 info.json
const submitParameters = async () => {
  console.log('submitParameters 函数被调用');  // 添加此行
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    
    console.log('表单验证通过');  // 添加此行
    
    const response = await axios.post(`/api/cases/${caseId}/parameters`, parameters);
    console.log('POST /api/cases/:caseId/parameters 响应:', response.data);  // 添加此行
    
    if (response.data.success) {
      submissionSuccess.value = true;
      submissionMessage.value = '参数提交成功，已生成 info.json';
      ElMessage({
        message: '参数提交成功，已生成 info.json',
        type: 'success'
      });
      store.setParameters(parameters);
      // 生成并下载 info.json
      await store.generateInfoJson(caseId);
    } else {
      throw new Error(response.data.message || '参数提交失败');
    }
  } catch (error) {
    submissionSuccess.value = false;
    submissionMessage.value = error.response?.data?.message || '参数提交失败';
    ElMessage({
      message: submissionMessage.value,
      type: 'error'
    });
    console.error('提交参数出错:', error);  // 添加此行
  }
};

// 下载现有的 info.json
const downloadInfo = async () => {
  await store.downloadInfoJson(caseId);
};

onMounted(() => {
  initializeParameters();
});
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