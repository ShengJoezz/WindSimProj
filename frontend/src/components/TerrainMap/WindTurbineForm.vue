<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 17:39:11
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-10 17:39:16
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\WindTurbineForm.vue
 * @Description: 
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
            v-model.number="turbineForm.longitude"
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
            v-model.number="turbineForm.latitude"
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
        <el-form-item label="桅杆高度 (m)" prop="hubHeight">
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
        <el-form-item label="转子直径 (m)" prop="rotorDiameter">
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
 * 添加风机的表单组件。
 */

import { ref } from "vue";
import { ElMessage } from "element-plus";
import { generateUUID } from '../../utils/uuid';

const emit = defineEmits(["add-turbine"]);

const turbineForm = ref({
  name: "",
  latitude: "",
  longitude: "",
  hubHeight: 120, // 默认值
  rotorDiameter: 116, // 默认值
});
const isSubmitting = ref(false);
const turbineRules = {
  name: [
    { required: true, message: "请输入风机名称", trigger: "blur" },
    { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" },
  ],
  latitude: [
    { required: true, message: "请输入纬度", trigger: "blur" },
    { type: "number", message: "纬度必须为数字", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value === null || value === undefined) {
          callback(new Error("请输入纬度"));
        } else if (value < -90 || value > 90) {
          callback(new Error("纬度必须在 -90 到 90 之间"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  longitude: [
    { required: true, message: "请输入经度", trigger: "blur" },
    { type: "number", message: "经度必须为数字", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value === null || value === undefined) {
          callback(new Error("请输入经度"));
        } else if (value < -180 || value > 180) {
          callback(new Error("经度必须在 -180 到 180 之间"));
        } else {
          callback();
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
};

const turbineFormRef = ref(null);

const submitForm = () => {
    isSubmitting.value = true;
  turbineFormRef.value.validate((valid) => {
    if (valid) {
      const newTurbine = { ...turbineForm.value, id: generateUUID() };
      emit("add-turbine", newTurbine);
      ElMessage.success("风机添加成功");
      turbineFormRef.value.resetFields();
    } else {
      ElMessage.warning("请正确填写所有必填项");
    }
      isSubmitting.value = false;
  });
};
</script>

<style scoped>
.turbine-form {
  padding: 10px 20px 20px 20px;
}

.submit-button {
  width: 100%;
  height: 40px;
  background-color: #409eff; /* 主蓝色 */
  border-color: #409eff;
  color: white;
  transition: background-color 0.3s, border-color 0.3s;
}

.submit-button:hover {
  background-color: #66b1ff; /* 悬停时稍深的蓝色 */
  border-color: #66b1ff;
}
</style>