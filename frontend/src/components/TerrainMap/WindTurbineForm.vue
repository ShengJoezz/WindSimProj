<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-12 20:11:08
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-14 19:46:02
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\WindTurbineForm.vue
 * @Description: 风机表单组件，支持手动添加风机并指定模型类型
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <el-form
    :model="turbineForm"
    :rules="turbineRules"
    ref="turbineFormRef"
    label-position="top"
    class="turbine-form"
  >
    <el-form-item label="风机名称" prop="name">
      <el-input
        v-model="turbineForm.name"
        placeholder="请输入风机名称"
        clearable
        class="stylish-input"
      />
    </el-form-item>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="经度" prop="longitude">
          <el-input
            v-model="turbineForm.longitude"
            type="number"
            step="0.000001"
            placeholder="输入经度 (-180 ~ 180)"
            clearable
            class="stylish-input"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="纬度" prop="latitude">
          <el-input
            v-model="turbineForm.latitude"
            type="number"
            step="0.000001"
            placeholder="输入纬度 (-90 ~ 90)"
            clearable
            class="stylish-input"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="轮毂高度 (m)" prop="hubHeight">
          <el-input
            v-model.number="turbineForm.hubHeight"
            type="number"
            placeholder="输入高度"
            clearable
            class="stylish-input"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="叶轮直径 (m)" prop="rotorDiameter">
          <el-input
            v-model.number="turbineForm.rotorDiameter"
            type="number"
            placeholder="输入直径"
            clearable
            class="stylish-input"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <!-- 新增：风机模型ID字段 -->
    <el-form-item label="风机模型ID" prop="turbineModelId" class="model-id-section">
      <div class="model-id-input-wrapper">
        <el-input
          v-model="turbineForm.turbineModelId"
          type="number"
          min="1"
          max="10"
          placeholder="输入模型ID (1-10)"
          clearable
          class="stylish-input model-id-input"
        >
          <template #suffix>
            <el-tooltip
              content="输入风机模型的数字ID，对应后续步骤中设置的性能曲线文件。例如：模型ID为1时，将使用1-U-P-Ct.txt性能曲线文件。如果留空，将自动设为模型1。"
              placement="top"
              :show-arrow="false"
            >
              <el-icon class="info-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-input>
        <div class="model-id-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>对应性能曲线文件编号，留空默认为1</span>
        </div>
      </div>
    </el-form-item>

    <el-form-item>
      <el-button
        type="primary"
        @click="submitForm"
        class="submit-button"
        :disabled="isSubmitting"
        block
      >
        <span v-if="isSubmitting">提交中...</span>
        <span v-else>添加风机</span>
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
/**
 * WindTurbineForm.vue
 *
 * 添加风机的表单组件，支持指定风机模型ID。
 */

import { ref } from "vue";
import { ElMessage } from "element-plus";
import { QuestionFilled, InfoFilled } from '@element-plus/icons-vue';
import { generateUUID } from '../../utils/uuid';

const emit = defineEmits(["add-turbine"]);

const turbineForm = ref({
  name: "",
  latitude: "",
  longitude: "",
  hubHeight: 120, // 默认值
  rotorDiameter: 116, // 默认值
  turbineModelId: "", // 新增：风机模型ID字段
});

const isSubmitting = ref(false);

const turbineRules = {
  name: [
    { required: true, message: "请输入风机名称", trigger: "blur" },
    { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" },
  ],
  latitude: [
    { required: true, message: "请输入纬度", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (!value && value !== 0) {
          callback(new Error("请输入纬度"));
        } else {
          const num = parseFloat(value);
          if (isNaN(num)) {
            callback(new Error("纬度必须为数字"));
          } else if (num < -90 || num > 90) {
            callback(new Error("纬度必须在 -90 到 90 之间"));
          } else {
            callback();
          }
        }
      },
      trigger: "blur",
    },
  ],
  longitude: [
    { required: true, message: "请输入经度", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (!value && value !== 0) {
          callback(new Error("请输入经度"));
        } else {
          const num = parseFloat(value);
          if (isNaN(num)) {
            callback(new Error("经度必须为数字"));
          } else if (num < -180 || num > 180) {
            callback(new Error("经度必须在 -180 到 180 之间"));
          } else {
            callback();
          }
        }
      },
      trigger: "blur",
    },
  ],
  hubHeight: [
    { required: true, message: "请输入桅杆高度", trigger: "blur" },
    { type: "number", min: 0, message: "桅杆高度必须为非负数字", trigger: "blur" },
  ],
  rotorDiameter: [
    { required: true, message: "请输入转子直径", trigger: "blur" },
    { type: "number", min: 0, message: "转子直径必须为非负数字", trigger: "blur" },
  ],
  // 新增：风机模型ID验证规则
  turbineModelId: [
    {
      validator: (rule, value, callback) => {
        // 如果为空，允许通过（将使用默认值）
        if (!value || value === '') {
          callback();
          return;
        }

        const num = parseInt(value);
        if (isNaN(num)) {
          callback(new Error("风机模型ID必须为数字"));
        } else if (num < 1 || num > 10) {
          callback(new Error("风机模型ID必须在 1 到 10 之间"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

const turbineFormRef = ref(null);

const submitForm = async () => {
  if (!turbineFormRef.value) return;

  isSubmitting.value = true;
  try {
    await turbineFormRef.value.validate();

    // 处理模型ID的默认值逻辑
    let modelId = turbineForm.value.turbineModelId;
    if (!modelId || modelId === '') {
      modelId = 1; // 默认值为1
      ElMessage.info('风机模型ID已自动设为默认值：1');
    } else {
      modelId = parseInt(modelId);
    }

    // 🔧 修复：只发送后端期望的字段，移除 turbineModelId
    const newTurbine = {
      id: generateUUID(),
      name: turbineForm.value.name,
      longitude: parseFloat(turbineForm.value.longitude),
      latitude: parseFloat(turbineForm.value.latitude),
      hubHeight: turbineForm.value.hubHeight,
      rotorDiameter: turbineForm.value.rotorDiameter,
      model: modelId.toString(), // 字符串格式，与上传组件保持一致
      type: modelId, // 数字格式，用于OpenFOAM求解器
    };

    console.log('🚀 Sending turbine data:', newTurbine); // 调试用

    emit("add-turbine", newTurbine);
    ElMessage.success(`风机添加成功，使用模型ID：${modelId}`);
    turbineFormRef.value.resetFields();
  } catch (validationError) {
    ElMessage.warning("请正确填写所有必填项");
    console.log("表单验证失败:", validationError);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.turbine-form {
  padding: 16px 20px 24px 20px;
}

.stylish-input {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.stylish-input:focus {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
  font-size: 14px;
  padding-bottom: 4px;
}

/* 新增：模型ID部分样式 */
.model-id-section {
  background: linear-gradient(135deg, #f8fafc, #f2f6fc);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  margin: 16px 0;
}

.model-id-input-wrapper {
  position: relative;
}

.model-id-input {
  margin-bottom: 8px;
}

.info-icon {
  color: #909399;
  cursor: help;
  transition: color 0.3s ease;
}

.info-icon:hover {
  color: #409EFF;
}

.model-id-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #909399;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.model-id-hint .el-icon {
  font-size: 14px;
  color: #E6A23C;
}

.submit-button {
  width: 100%;
  height: 44px;
  background-color: #409eff;
  border-color: #409eff;
  color: white;
  transition: all 0.3s ease;
  border-radius: 8px;
  font-weight: 500;
  font-size: 15px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
  margin-top: 8px;
}

.submit-button:hover:not(:disabled) {
  background-color: #66b1ff;
  border-color: #66b1ff;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.35);
}

.submit-button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.submit-button:disabled {
  background-color: #a0cfff;
  border-color: #a0cfff;
  color: rgba(255, 255, 255, 0.8);
  cursor: not-allowed;
}

:deep(.el-input__inner) {
  height: 40px;
  border-radius: 8px;
}

:deep(.el-form-item.is-error .el-input__inner) {
  border-color: #F56C6C;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.1);
}

/* 确保tooltip样式正确 */
:deep(.el-tooltip__trigger) {
  display: inline-flex;
  align-items: center;
}
</style>