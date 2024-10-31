<!-- WindTurbineUpload.vue -->
<template>
  <div>
    <h3>上传风机数据</h3>
    <form @submit.prevent="uploadFile">
      <input type="file" @change="handleFileChange" accept=".csv, .txt" />
      <button type="submit">上传</button>
    </form>
    <div v-if="message">{{ message }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { uploadWindTurbines } from '../api/windTurbines'
import { useMapStore } from '../store/mapStore'

const file = ref(null)
const message = ref('')
const mapStore = useMapStore()

const handleFileChange = (event) => {
  file.value = event.target.files[0]
}

const uploadFile = async () => {
  if (!file.value) {
    message.value = '请先选择文件'
    return
  }
  const formData = new FormData()
  formData.append('file', file.value)
  try {
    const res = await uploadWindTurbines(formData)
    if (res.success) {
      message.value = '上传成功'
      mapStore.refreshWindTurbines() // 触发地图更新
    } else {
      message.value = '上传失败'
    }
  } catch (error) {
    message.value = '上传出错'
  }
}
</script>