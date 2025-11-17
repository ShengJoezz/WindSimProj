<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 21:09:43
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-07 12:09:45
 * @FilePath: frontend/src/components/WindMast/WindMastResultDetail.vue
 * @Description: Displays detailed results of a wind mast analysis run, including image browsing.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 -->

 <template>
  <div class="wind-mast-result-detail">
    <!-- 在结果页面添加临时调试信息 -->
    <el-card style="margin-bottom: 16px;" v-if="false"> <!-- 调试时改为 true -->
      <h4>调试信息</h4>
      <p>Analysis ID: {{ analysisId }}</p>
      <p>Results loaded: {{ !!results }}</p>
      <p>Images loaded: {{ imagesLoaded }}</p>
      <p>Available images: {{ Object.keys(availableImages.byType).length }}</p>
      <p>Results status: {{ results?.status }}</p>
    </el-card>

    <!-- 加载状态 -->
    <el-skeleton :rows="10" animated v-if="loading" />

    <!-- 错误状态 -->
    <el-result
      v-else-if="error"
      icon="error"
      :title="error.title || '加载结果失败'"
      :sub-title="error.message || '未能获取分析结果数据'"
    >
      <template #extra>
        <el-button type="primary" @click="$router.push('/windmast/results')">
          返回结果列表
        </el-button>
        <el-button @click="loadResults">重试</el-button>
      </template>
    </el-result>

    <!-- 无结果状态 -->
    <el-empty
      v-else-if="!results"
      description="暂无分析结果数据"
    >
      <el-button type="primary" @click="$router.push('/windmast/results')">
        返回结果列表
      </el-button>
    </el-empty>

    <!-- 结果内容 -->
    <template v-else>
      <!-- 分析信息卡片 -->
      <el-card class="result-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>{{ results.analysisName || '未命名分析' }}</h2>
            <el-button-group>
              <el-button @click="$router.push('/windmast/results')" type="info" plain>
                <el-icon><Back /></el-icon> 返回列表
              </el-button>
              <el-button type="primary" @click="downloadResults" :loading="downloading">
                <el-icon><Download /></el-icon> 下载结果
              </el-button>
            </el-button-group>
          </div>
        </template>

        <div class="analysis-meta">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="分析ID">{{ analysisId }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(results.startTime) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatDate(results.endTime) }}</el-descriptions-item>
            <el-descriptions-item label="处理状态">
              <el-tag :type="getStatusType(results.status)">{{ getStatusText(results.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="总处理时间">{{ formatDuration(results.totalDurationSec) }}</el-descriptions-item>
            <el-descriptions-item label="处理文件数">{{ results.files_processed || 0 }} / {{ results.files_requested || 0 }}</el-descriptions-item>
            <el-descriptions-item label="分析描述" :span="2">{{ results.description || '无描述' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="results.parameters" class="parameters-section">
            <h3>分析参数</h3>
            <el-descriptions :column="2" border>
              <el-descriptions-item v-if="results.parameters.enableFiltering !== undefined" label="异常值过滤">
                {{ results.parameters.enableFiltering ? '启用' : '禁用' }}
                <template v-if="results.parameters.enableFiltering && results.parameters.threshold !== undefined">
                  (阈值: {{ results.parameters.threshold }})
                </template>
              </el-descriptions-item>
              <el-descriptions-item v-if="results.parameters.method" label="处理方法">
                {{ getMethodText(results.parameters.method) }}
              </el-descriptions-item>
              <el-descriptions-item v-if="results.parameters.chartTypes && results.parameters.chartTypes.length" label="图表类型" :span="2">
                <el-tag
                  v-for="type in results.parameters.chartTypes"
                  :key="type"
                  style="margin-right: 8px; margin-bottom: 8px"
                >
                  {{ getChartTypeText(type) }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </el-card>

      <!-- 状态汇总卡片 -->
<!-- Status Summary Card - 修改为水平排列 -->
<el-card class="result-card" shadow="hover">
  <template #header>
    <div class="card-header">
      <h3>处理结果汇总</h3>
    </div>
  </template>

  <!-- 修改为水平Flex布局 -->
  <div class="status-summary-horizontal">
    <!-- 统计数据部分 -->
    <div class="status-metrics">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8">
          <el-statistic title="成功" :value="results.success_files || 0">
            <template #suffix>
              <el-tag type="success" effect="plain">文件</el-tag>
            </template>
          </el-statistic>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic title="警告" :value="results.warning_files || 0">
            <template #suffix>
              <el-tag type="warning" effect="plain">文件</el-tag>
            </template>
          </el-statistic>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-statistic title="失败" :value="results.error_files || 0">
            <template #suffix>
              <el-tag type="danger" effect="plain">文件</el-tag>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
    </div>

    <!-- 风电场信息部分 - 如果存在 -->
    <div v-if="results.unique_farm_ids && results.unique_farm_ids.length" class="farms-section">
      <h4>涉及的风电场</h4>
      <div class="farm-tags">
        <el-tag
          v-for="farmId in results.unique_farm_ids"
          :key="farmId"
          type="info"
          effect="plain"
          style="margin-right: 8px; margin-bottom: 8px"
        >
          {{ farmId }}
        </el-tag>
      </div>
    </div>
  </div>

  <!-- 错误和警告部分 -->
  <div class="errors-warnings-section">
    <div v-if="hasErrors" class="errors-section">
      <el-alert
        title="处理过程中出现错误"
        type="error"
        :closable="false"
        show-icon
      >
        <div class="errors-list">
          <p>以下文件处理失败：</p>
          <ul>
            <li v-for="(file, index) in errorFiles" :key="index">
              {{ file.file }}: {{ file.error || '未知错误' }}
            </li>
          </ul>
        </div>
      </el-alert>
    </div>

    <div v-if="hasWarnings" class="warnings-section">
      <el-alert
        title="处理过程中出现警告"
        type="warning"
        :closable="false"
        show-icon
      >
        <div class="warnings-list">
          <p>以下文件处理有警告：</p>
          <ul>
            <li v-for="(file, index) in warningFiles" :key="index">
              {{ file.file }}
              <ul v-if="file.warnings && file.warnings.length">
                <li v-for="(warning, wIndex) in file.warnings" :key="wIndex">
                  {{ warning }}
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </el-alert>
    </div>
  </div>
</el-card>

      <!-- 处理文件详情卡片 -->
      <el-card class="result-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h3>处理文件详情</h3>
            <el-input
              v-model="fileSearchQuery"
              placeholder="搜索文件名或风场ID"
              style="max-width: 250px;"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </template>

        <el-table
          :data="filteredProcessedFiles"
          style="width: 100%"
          :default-sort="{ prop: 'status', order: 'ascending' }"
          border
          stripe
          max-height="500"
        >
          <!-- 展开列，显示详情/图表 -->
          <el-table-column type="expand">
            <template #default="props">
              <div class="file-detail-expand">
                <!-- 警告和错误信息保持不变 -->

                <!-- 简化的图表预览 -->
                <div v-if="availableImages.byFarmId[props.row.farm_id]?.length > 0" class="plots-preview">
                  <h4>图表预览</h4>
                  <div class="simple-plots-grid">
                    <div
                      v-for="(imagePath, index) in availableImages.byFarmId[props.row.farm_id]"
                      :key="index"
                      class="simple-plot-item"
                    >
                      <el-image
                        :src="getImageUrl(imagePath)"
                        fit="contain"
                        lazy
                        :preview-src-list="availableImages.byFarmId[props.row.farm_id].map(p => getImageUrl(p))"
                        :initial-index="index"
                        preview-teleported="true"
                        hide-on-click-modal
                        style="width: 100px; height: 75px; cursor: pointer; border: 1px solid #eee; border-radius: 4px;"
                      >
                        <template #placeholder>
                          <div class="image-slot-placeholder">
                            <el-icon><Picture /></el-icon>
                          </div>
                        </template>
                        <template #error>
                          <div class="image-slot-error">加载失败</div>
                        </template>
                      </el-image>
                      <div class="plot-name">{{ getImageDisplayName(imagePath, true) }}</div>
                    </div>
                  </div>
                </div>
                <!-- 其他提示信息保持不变 -->
              </div>
            </template>
          </el-table-column>

          <!-- 表格列 -->
          <el-table-column prop="file" label="源文件名" sortable min-width="250"></el-table-column>
          <el-table-column prop="farm_id" label="风电场ID" width="150" sortable></el-table-column>
          <el-table-column prop="status" label="状态" width="100" sortable>
            <template #default="scope">
              <el-tag :type="getFileStatusType(scope.row.status)">
                {{ getFileStatusText(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="processing_time_sec" label="处理时间" width="120" sortable>
            <template #default="scope">
              {{ scope.row.processing_time_sec || 0 }} 秒
            </template>
          </el-table-column>
          <el-table-column prop="rows_processed" label="数据量" width="120" sortable>
            <template #default="scope">
              {{ scope.row.rows_processed || 0 }} 行
            </template>
          </el-table-column>
          <el-table-column prop="plots_created" label="生成图表" width="120">
            <template #default="scope">
              {{ scope.row.plots_created?.length || 0 }} 个
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="scope">
              <!-- 查看详情按钮保持不变 -->
              <el-button
                v-if="scope.row.warnings?.length > 0 || scope.row.error"
                type="warning"
                size="small"
                @click="showFileDetails(scope.row)"
                text
              >
                查看详情
              </el-button>

              <!-- 占位符 -->
              <span v-if="!(availableImages.byFarmId[scope.row.farm_id]?.length > 0) && !(scope.row.warnings?.length > 0 || scope.row.error)">-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 图表概览卡片（新增） -->
      <el-card v-if="imagesLoaded" class="result-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h3>图表概览</h3>
            <el-radio-group v-model="galleryViewMode" size="small">
                <el-radio-button value="byType">按类型</el-radio-button>
                <el-radio-button value="byHeight">按高度</el-radio-button>
                <el-radio-button value="byFarm">按风场</el-radio-button>
              </el-radio-group>
          </div>
        </template>

        <!-- 按类型分组视图 -->
        <div v-if="galleryViewMode === 'byType'" class="gallery-container">
          <div v-for="(images, type) in availableImages.byType" :key="type" class="gallery-section">
            <h4 class="gallery-section-title">{{ type }}</h4>
            <div class="gallery-grid">
              <!-- 循环所有图片，不再有数量限制 -->
              <div v-for="(imagePath, index) in images" :key="index" class="gallery-item">
                <el-image
                  :src="getImageUrl(imagePath)"
                  fit="cover"
                  lazy
                  :preview-src-list="images.map(p => getImageUrl(p))"
                  :initial-index="index"
                  preview-teleported="true"
                  hide-on-click-modal
                  class="gallery-image"
                >
                  <template #placeholder>
                    <div class="image-slot-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                  <template #error>
                    <div class="image-slot-error">加载失败</div>
                  </template>
                </el-image>
                <div class="gallery-item-info">
                  <el-tooltip :content="getImageDisplayName(imagePath)" placement="top">
                    <span class="gallery-item-name">{{ getImageDisplayName(imagePath, true) }}</span>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按高度分组视图 -->
        <div v-else-if="galleryViewMode === 'byHeight'" class="gallery-container">
          <div v-for="(images, height) in availableImages.byHeight" :key="height" class="gallery-section">
            <h4 class="gallery-section-title">{{ height }} 高度</h4>
            <div class="gallery-grid">
              <div v-for="(imagePath, index) in images" :key="index" class="gallery-item">
                <el-image
                  :src="getImageUrl(imagePath)"
                  fit="cover"
                  lazy
                  :preview-src-list="images.map(p => getImageUrl(p))"
                  :initial-index="index"
                  preview-teleported="true"
                  hide-on-click-modal
                  class="gallery-image"
                >
                  <template #placeholder>
                    <div class="image-slot-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                  <template #error>
                    <div class="image-slot-error">加载失败</div>
                  </template>
                </el-image>
                <div class="gallery-item-info">
                  <el-tooltip :content="getImageDisplayName(imagePath)" placement="top">
                    <span class="gallery-item-name">{{ getImageDisplayName(imagePath, true) }}</span>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按风场分组视图 -->
        <div v-else-if="galleryViewMode === 'byFarm'" class="gallery-container">
          <div v-for="(images, farmId) in availableImages.byFarmId" :key="farmId" class="gallery-section">
            <h4 class="gallery-section-title">风场: {{ farmId }}</h4>
            <div class="gallery-grid">
              <div v-for="(imagePath, index) in images" :key="index" class="gallery-item">
                <el-image
                  :src="getImageUrl(imagePath)"
                  fit="cover"
                  lazy
                  :preview-src-list="images.map(p => getImageUrl(p))"
                  :initial-index="index"
                  preview-teleported="true"
                  hide-on-click-modal
                  class="gallery-image"
                >
                  <template #placeholder>
                    <div class="image-slot-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                  <template #error>
                    <div class="image-slot-error">加载失败</div>
                  </template>
                </el-image>
                <div class="gallery-item-info">
                  <el-tooltip :content="getImageDisplayName(imagePath)" placement="top">
                    <span class="gallery-item-name">{{ getImageDisplayName(imagePath, true) }}</span>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 无图片时显示 -->
        <el-empty v-if="Object.keys(availableImages.byType).length === 0" description="未找到任何图表">
          <template #image>
            <el-icon style="font-size: 60px"><PictureFilled /></el-icon>
          </template>
        </el-empty>
      </el-card>

      <!-- File Details Dialog - 保持不变 -->
      <el-dialog
        v-model="showFileDetailsDialog"
        title="文件处理详情"
        width="60%"
        top="10vh"
      >
        <div v-if="selectedFile" class="file-details-dialog">
          <el-descriptions :column="1" border direction="vertical">
            <el-descriptions-item label="源文件名">{{ selectedFile.file }}</el-descriptions-item>
            <el-descriptions-item label="风电场ID">{{ selectedFile.farm_id }}</el-descriptions-item>
            <el-descriptions-item label="处理状态">
              <el-tag :type="getFileStatusType(selectedFile.status)">
                {{ getFileStatusText(selectedFile.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="处理时间">{{ selectedFile.processing_time_sec || 0 }} 秒</el-descriptions-item>
            <el-descriptions-item label="数据量">{{ selectedFile.rows_processed || 0 }} 行</el-descriptions-item>
          </el-descriptions>

          <div v-if="selectedFile.warnings && selectedFile.warnings.length" class="detail-warnings">
            <h4>警告信息</h4>
            <el-alert
              v-for="(warning, index) in selectedFile.warnings"
              :key="`warn-${index}`"
              :title="warning"
              type="warning"
              :closable="false"
              show-icon
              style="margin-bottom: 8px"
            />
          </div>

          <div v-if="selectedFile.error" class="detail-error">
            <h4>错误信息</h4>
            <el-alert
              :title="selectedFile.error"
              type="error"
              :description="selectedFile.error_details || ''"
              :closable="false"
              show-icon
            />
          </div>
        </div>
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindMastStore } from '@/store/windMastStore';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Back, Download, Search, PictureFilled, Picture, More, Loading,
  ArrowLeft, ArrowRight
} from '@element-plus/icons-vue';

// Backend Base URL
const backendBaseUrl = 'http://localhost:5000';

// Component State
const route = useRoute();
const router = useRouter();
const store = useWindMastStore();
const analysisId = ref(route.params.analysisId);
const results = ref(null);
const loading = ref(true);
const error = ref(null);
const fileSearchQuery = ref('');
const downloading = ref(false);
const showFileDetailsDialog = ref(false);
const selectedFile = ref(null);
// --- 【核心修改】在这里补上缺失的变量声明 ---
const imagesLoaded = ref(false); // <--- 新增
const galleryViewMode = ref('byType'); // <--- 新增
const imageBaseUrl = ref(''); // <--- 新增

// 用 reactive 更适合这种嵌套对象
const availableImages = ref({  // <--- 新增，用 ref 包裹
  byType: {},
  byFarmId: {},
  byHeight: {},
  all: []
});
// --- 数据加载 ---
onMounted(async () => {
  loadResults();
});

watch(() => route.params.analysisId, (newId) => {
  if (newId && newId !== analysisId.value) {
    analysisId.value = newId;
    loadResults();
  }
});

const loadResults = async () => {
  if (!analysisId.value) {
    router.push('/windmast/results');
    return;
  }

  loading.value = true;
  error.value = null;
  results.value = null;

  try {
    // 加载分析结果
    const data = await store.fetchResults(analysisId.value);
    if (data) {
      results.value = data;
      if (!Array.isArray(results.value.processed_files_details)) {
        results.value.processed_files_details = [];
        console.warn("API returned invalid 'processed_files_details', defaulting to empty array.");
      }

      // 加载图片列表
      try {
        const imagesResponse = await fetch(`/api/windmast/images/${analysisId.value}`); 
        
        // 【新增】打印最原始的响应对象
        console.log('Raw imagesResponse from fetch:', imagesResponse);

        if (imagesResponse.ok) {
          const imagesData = await imagesResponse.json();

          // 【新增】打印解析后的JSON数据
          console.log('Raw imagesData (JSON parsed):', imagesData);

          if (imagesData.success) {
            availableImages.value = imagesData.images;
            imageBaseUrl.value = imagesData.baseUrl;
            imagesLoaded.value = true;
            console.log("Images loaded successfully into component state."); // 修改日志内容，确认执行到这里
          } else {
             // 如果后端返回 { success: false }
             console.warn("API reported failure:", imagesData.message);
             imagesLoaded.value = false;
          }
        } else {
            // 如果HTTP状态码不是2xx
            console.error("Fetch returned a non-OK status:", imagesResponse.status, imagesResponse.statusText);
            imagesLoaded.value = false;
        }
      } catch (imagesErr) {
        // 如果fetch本身失败或 .json() 解析失败
        console.error("Failed to load or parse images JSON:", imagesErr);
        imagesLoaded.value = false;
      }
    } else {
      error.value = { title: '获取结果失败', message: '服务器未返回有效数据或分析不存在' };
    }
  } catch (err) {
    console.error('获取分析结果失败:', err);
    error.value = { title: '获取结果失败', message: err.message || '无法从服务器加载结果' };
  } finally {
    loading.value = false;
  }
};

// --- 图片处理工具 ---
const getImageUrl = (filename) => {
  if (!filename) return '';
  // 使用从API返回的baseUrl，如果没有则使用相对路径
  return imageBaseUrl.value ? `${imageBaseUrl.value}${filename}` : `/api/windmast/image/${analysisId.value}/${filename}`;
};

const getImageDisplayName = (filename, short = false) => {
  if (!filename) return '';

  // 提取信息
  const parts = filename.split('_');
  if (parts.length < 3) return filename;

  const farmId = parts[0];
  const dateStr = parts[1];

  // 确定图表类型
  let chartType = '';
  let height = '';

  const lastPart = parts[parts.length - 1];
  const heightMatch = lastPart.match(/(\d+)m\.(png|jpg|jpeg|gif|svg)$/i);

  if (heightMatch) {
    height = heightMatch[1] + 'm';
    chartType = parts[parts.length - 2];
  } else if (lastPart.startsWith('distribution')) {
    chartType = '稳定度分布';
  } else {
    chartType = parts[parts.length - 2];
  }

  // 图表类型转换为中文
  chartType = getChartTypeText(chartType);

  // 根据短/长格式返回
  if (short) {
    return `${chartType}${height ? ' ' + height : ''}`;
  } else {
    // 格式化日期
    let formattedDate = dateStr;
    if (dateStr.length === 13) { // Unix 时间戳
      try {
        const date = new Date(parseInt(dateStr));
        formattedDate = date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) { /* 使用原始日期字符串 */ }
    }

    return `${farmId} - ${chartType}${height ? ' ' + height : ''} - ${formattedDate}`;
  }
};

const getChartTypeText = (type) => {
  switch (type) {
    case 'wind_rose':
    case 'windrose': return '风玫瑰图';
    case 'wind_frequency': return '风速频率';
    case 'wind_energy': return '风能分布';
    case 'stability_distribution': return '稳定度分布';
    case 'diurnal_pattern': return '日变化模式';
    case 'time_series': return '时间序列';
    case 'correlation': return '相关性分析';
    default: return type;
  }
};

// 分析图片信息
const analyzeImageInfo = (filename) => {
  if (!filename) return null;

  const parts = filename.split('_');
  if (parts.length < 3) return null;

  const farmId = parts[0];

  // 确定图表类型和高度
  let type = '';
  let height = null;

  const lastPart = parts[parts.length - 1];
  const heightMatch = lastPart.match(/(\d+)m\.(png|jpg|jpeg|gif|svg)$/i);

  if (heightMatch) {
    height = heightMatch[1] + 'm';
    type = getChartTypeText(parts[parts.length - 2]);
  } else if (lastPart.startsWith('distribution')) {
    type = '稳定度分布';
  } else {
    type = getChartTypeText(parts[parts.length - 2]);
  }

  return { farmId, type, height };
};

// --- 文件相关图片函数 ---
const hasImagesForFile = (file) => {
  if (!file || !file.farm_id || !imagesLoaded.value) return false;
  return availableImages.value.byFarmId[file.farm_id]?.length > 0;
};

// 保留其他原有函数
const downloadResults = async () => {
  if (!analysisId.value) {
    ElMessage.warning('无效的分析ID');
    return;
  }
  downloading.value = true;
  ElMessage.info('开始准备下载...');
  // Directly open the download link in a new tab/window
  // The backend route '/api/windmast/download/:analysisId' handles the zip creation and download headers.
  window.open(`/api/windmast/download/${analysisId.value}`, '_blank');
  // Set a short timeout to reset the downloading state, as we don't get direct feedback
  setTimeout(() => {
    downloading.value = false;
    ElMessage.success('下载链接已打开，请检查浏览器下载。');
  }, 1500);
};

const showFileDetails = (file) => {
  selectedFile.value = file;
  showFileDetailsDialog.value = true;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('zh-CN');
  } catch (e) { return dateString; }
};
const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} 分 ${remainingSeconds} 秒`;
};
const getStatusType = (status) => {
  switch (status) {
    case 'completed': return 'success';
    case 'completed_with_warnings': return 'warning';
    case 'pending': case 'running': return 'info';
    case 'failed': case 'error': return 'danger';
    default: return 'info';
  }
};
const getStatusText = (status) => {
  switch (status) {
    case 'completed': return '成功完成';
    case 'completed_with_warnings': return '完成 (有警告)';
    case 'pending': return '排队中';
    case 'running': return '处理中';
    case 'failed': case 'error': return '失败';
    default: return status || '未知';
  }
};
const getFileStatusType = (status) => {
  switch (status) {
    case 'success': return 'success';
    case 'warning': return 'warning';
    case 'processing': return 'info';
    case 'error': return 'danger';
    default: return 'info';
  }
};
const getFileStatusText = (status) => {
  switch (status) {
    case 'success': return '成功';
    case 'warning': return '警告';
    case 'processing': return '处理中';
    case 'error': return '错误';
    default: return status || '未知';
  }
};
const getMethodText = (method) => {
  switch (method) {
    case 'standard': return '标准处理';
    case 'high_precision': return '高精度模式';
    case 'fast': return '快速模式';
    default: return method;
  }
};

const processedFiles = computed(() => {
  return results.value?.processed_files_details || [];
});

const filteredProcessedFiles = computed(() => {
  if (!processedFiles.value) return [];
  if (!fileSearchQuery.value) {
    return processedFiles.value;
  }
  const query = fileSearchQuery.value.toLowerCase();
  return processedFiles.value.filter(file =>
    file.file?.toLowerCase().includes(query) ||
    file.farm_id?.toLowerCase().includes(query)
  );
});

const errorFiles = computed(() => {
  return processedFiles.value.filter(file => file.status === 'error');
});

const warningFiles = computed(() => {
  return processedFiles.value.filter(file => file.status === 'warning');
});

const hasErrors = computed(() => errorFiles.value.length > 0);
const hasWarnings = computed(() => warningFiles.value.length > 0);

// Show plot dialog for a specific plot type (triggered from expand view)
const showFilePlot = (file, plotType) => {
  selectedFile.value = file;
  selectedPlotType.value = plotType; // Set the specific type to view
  showPlotDialog.value = true;
};

// Show plot dialog with tabs for all plot types (triggered from table action)
const showAllFilePlots = (file) => {
  selectedFile.value = file;
  selectedPlotType.value = null; // Set to null to indicate showing all plots in tabs
  showPlotDialog.value = true;
};

const getPlotImageUrl = (plotType, height) => {
  if (!analysisId.value || !selectedFile.value || !selectedFile.value.farm_id || !selectedFile.value.date_str || !plotType) {
    console.warn("getPlotImageUrl: Missing required data", {
      analysisId: analysisId.value,
      selectedFile: selectedFile.value,
      plotType: plotType,
      height: height
    });
    return '';
  }

  const currentFarmId = selectedFile.value.farm_id;
  const currentDateStr = selectedFile.value.date_str;
  let filename = '';

  if (plotType === 'stability_distribution') {
    filename = `${currentFarmId}_${currentDateStr}_stability_distribution.png`;
  } else if (height) {
    filename = `${currentFarmId}_${currentDateStr}_${plotType}_${height}m.png`;
  } else {
    console.warn(`getPlotImageUrl: Height is null/undefined for plot type '${plotType}', attempting filename without height.`);
    filename = `${currentFarmId}_${currentDateStr}_${plotType}.png`;
  }

  // 修改这里：使用相对路径，不使用硬编码的backendBaseUrl
  return `/api/windmast/image/${analysisId.value}/${filename}`;
}


</script>

<style scoped>
.wind-mast-result-detail {
  max-width: 1200px;
  margin: 20px auto;
  padding: 15px;
}

/* 图片库样式 */
.gallery-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.gallery-section {
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 20px;
}

.gallery-section-title {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: #333;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.gallery-item {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.3s;
  background-color: #fff;
  height: 200px;
  display: flex;
  flex-direction: column;
}

.gallery-item:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transform: translateY(-3px);
}

.gallery-image {
  flex: 1;
  object-fit: cover;
  max-height: 160px;
  cursor: pointer;
  background-color: #f8f8f8;
}

.gallery-item-info {
  padding: 8px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
}

.gallery-item-name {
  font-size: 0.85rem;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.view-more {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: #f0f4f9;
  color: #409eff;
}

.view-more-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.view-more .el-icon {
  font-size: 24px;
}

/* 图片占位符和错误样式 */
.image-slot-placeholder,
.image-slot-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background-color: #f5f7fa;
  color: #909399;
  gap: 10px;
}

.image-slot-placeholder .el-icon,
.image-slot-error .el-icon {
  font-size: 24px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .gallery-grid,
  .all-charts-grid,
  .gallery-expanded-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .gallery-item,
  .chart-grid-item,
  .gallery-expanded-item {
    height: 180px;
  }

  .gallery-image {
    max-height: 140px;
  }

  .gallery-item-name {
    max-width: 140px;
  }

  .image-details p {
    flex-direction: column;
    gap: 5px;
  }
}
/* 水平布局的处理结果汇总 */
.status-summary-horizontal {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.status-metrics {
  flex: 1;
  min-width: 300px;
}

.farms-section {
  flex: 1;
  min-width: 300px;
  border-left: 1px solid #ebeef5;
  padding-left: 20px;
}

.farms-section h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 1.1em;
  color: #303133;
}

.farm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.errors-warnings-section {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.errors-section,
.warnings-section {
  margin-bottom: 16px;
}

.errors-section:last-child,
.warnings-section:last-child {
  margin-bottom: 0;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .status-summary-horizontal {
    flex-direction: column;
    gap: 20px;
  }
  
  .farms-section {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid #ebeef5;
    padding-top: 20px;
  }
}
</style>