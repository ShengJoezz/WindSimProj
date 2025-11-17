
<template>
  <div class="rou-downloader-container">
    <h3>ROU 文件生成器</h3>
    <p>根据中心点坐标和半径，生成并下载粗糙度 (rou) 文件。</p>
    
    <div class="input-group">
      <label for="latitude">中心点纬度:</label>
      <input id="latitude" type="number" v-model.number="lat" placeholder="例如: 30.5" />
    </div>

    <div class="input-group">
      <label for="longitude">中心点经度:</label>
      <input id="longitude" type="number" v-model.number="lon" placeholder="例如: 114.3" />
    </div>

    <div class="input-group">
      <label for="radius">半径 (米):</label>
      <input id="radius" type="number" v-model.number="radius" placeholder="例如: 5000" />
    </div>

    <button @click="handleDownloadRou" :disabled="isLoading">
      <span v-if="isLoading">正在生成...</span>
      <span v-else>生成并下载 ROU 文件</span>
    </button>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'RouDownloader',
  data() {
    return {
      lat: null,
      lon: null,
      radius: 5000, // 默认半径5000米
      isLoading: false,
      errorMessage: ''
    };
  },
  methods: {
    async handleDownloadRou() {
      this.errorMessage = '';
      if (this.lat === null || this.lon === null || this.radius === null) {
        this.errorMessage = '请输入完整的纬度、经度和半径。';
        return;
      }

      this.isLoading = true;

      try {
        const response = await axios.post('/api/rou/download-by-coords', {
          lat: this.lat,
          lon: this.lon,
          radius: this.radius
        }, {
          responseType: 'blob' // 关键：接收二进制文件数据
        });

        // 创建一个临时的URL用于下载
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'roughness.rou'); // 设置下载文件名
        document.body.appendChild(link);
        link.click();

        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

      } catch (error) {
        console.error('下载rou文件时出错:', error);
        if (error.response && error.response.data) {
            // 尝试将blob错误数据转换为JSON文本
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const errorJson = JSON.parse(reader.result);
                    this.errorMessage = `生成失败: ${errorJson.message || '未知错误'}`;
                } catch (e) {
                    this.errorMessage = '生成失败，无法解析错误信息。';
                }
            };
            reader.onerror = () => {
                this.errorMessage = '生成失败，且无法读取错误响应。';
            };
            reader.readAsText(error.response.data);
        } else {
            this.errorMessage = '生成失败，请检查网络连接或联系管理员。';
        }
      } finally {
        this.isLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.rou-downloader-container {
  border: 1px solid #ccc;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  max-width: 400px;
}

h3 {
  margin-top: 0;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
}

.input-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 10px 15px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  background-color: #0056b3;
}

.error-message {
  margin-top: 15px;
  color: #d9534f;
}
</style>
