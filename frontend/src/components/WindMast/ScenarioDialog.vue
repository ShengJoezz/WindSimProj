<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:09:24
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:09:27
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\WindDataAnalysis\ScenarioDialog.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <el-dialog
      :title="dialogTitle"
      :model-value="visible"
      @update:model-value="$emit('update:visible', $event)"
      width="500px"
      center
      destroy-on-close
    >
      <el-form :model="form" ref="formRef" :rules="rules" label-width="100px">
        <el-form-item label="分析名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入分析场景名称"
            maxlength="50"
            show-word-limit
          ></el-input>
        </el-form-item>
        
        <el-form-item label="分析描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="请输入分析场景描述（选填）"
            maxlength="200"
            show-word-limit
            rows="3"
          ></el-input>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:visible', false)">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="isSubmitting">
            {{ isNew ? '保存' : '更新' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </template>
  
  <script setup>
  import { ref, computed, watch, defineProps, defineEmits } from 'vue';
  
  const props = defineProps({
    visible: Boolean,
    isNew: {
      type: Boolean,
      default: true
    },
    scenarioName: {
      type: String,
      default: ''
    }
  });
  
  const emit = defineEmits(['update:visible', 'save']);
  
  const formRef = ref(null);
  const isSubmitting = ref(false);
  
  const form = ref({
    name: props.scenarioName,
    description: ''
  });
  
  // Update form when props change
  watch(() => props.scenarioName, (newVal) => {
    form.value.name = newVal;
  });
  
  const dialogTitle = computed(() => {
    return props.isNew ? '保存分析场景' : '更新分析场景';
  });
  
  const rules = {
    name: [
      { required: true, message: '请输入分析场景名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度应为 2 到 50 个字符', trigger: 'blur' }
    ]
  };
  
  const submitForm = async () => {
    if (!formRef.value) return;
    
    try {
      isSubmitting.value = true;
      await formRef.value.validate();
      
      // Emit save event with form data
      emit('save', form.value.name, form.value.description);
      
      // Close dialog
      emit('update:visible', false);
    } catch (error) {
      console.error('Form validation failed:', error);
    } finally {
      isSubmitting.value = false;
    }
  };
  </script>
  
  <style scoped>
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  </style>