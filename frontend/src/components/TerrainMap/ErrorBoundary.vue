<!-- ErrorBoundary.vue -->
<template>
  <div>
    <slot v-if="!hasError" />
    <div v-else class="error-container">
      <el-alert
        title="数据加载错误"
        type="error"
        :description="errorMessage"
        show-icon
        @close="resetError"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue';

const hasError = ref(false);
const errorMessage = ref('');

const resetError = () => {
  hasError.value = false;
  errorMessage.value = '';
};

onErrorCaptured((error) => {
  hasError.value = true;
  errorMessage.value = error.message;
  return false; // Prevent error propagation
});
</script>
<style>
</style>