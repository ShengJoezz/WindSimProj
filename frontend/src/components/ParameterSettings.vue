<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-04-01 18:51:11
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-07-23 21:01:26
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\ParameterSettings.vue
 * @Description: 参数设置组件，支持按需加载和预览已存在的性能曲线文件，并支持粗糙度文件上传。
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
        <!-- 前面的表单项保持不变... -->
        <el-form-item label="计算域" class="parent-form-item">
          <el-form-item label="计算域长度 (m)" prop="calculationDomain.width" :inline="true" class="child-form-item">
            <div class="input-with-hint">
              <el-input-number v-model="caseStore.parameters.calculationDomain.width" :min="0" class="input-number" :disabled="caseStore.infoExists" style="width: 100%;"/>
              <div v-if="showDomainSizeHint" class="form-item-hint"> <el-icon><InfoFilled /></el-icon> <span>{{ domainSizeHintText }}</span> </div>
            </div>
          </el-form-item>
          <el-form-item label="计算域高度 (m)" prop="calculationDomain.height" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.calculationDomain.height" :min="0" class="input-number" :disabled="caseStore.infoExists"/>
          </el-form-item>
        </el-form-item>
        <el-form-item label="工况" class="parent-form-item">
          <el-form-item label="风向角 (°)" prop="conditions.windDirection" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.conditions.windDirection" :min="0" :max="360" class="input-number" :disabled="caseStore.infoExists"/>
          </el-form-item>
          <el-form-item label="入口风速 (m/s)" prop="conditions.inletWindSpeed" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.conditions.inletWindSpeed" :min="0" class="input-number" :disabled="caseStore.infoExists"/>
          </el-form-item>
        </el-form-item>
        <el-form-item label="网格" class="parent-form-item">
          <div class="grid-section">
            <el-form-item label="粗糙层高度 (m)" prop="grid.encryptionHeight" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.encryptionHeight" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="粗糙层层数" prop="grid.encryptionLayers" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.encryptionLayers" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="纵向网格生长率" prop="grid.gridGrowthRate" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.gridGrowthRate" :step="0.1" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="最大网格尺寸 (m)" prop="grid.maxExtensionLength" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.maxExtensionLength" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="最小网格尺寸 (m)" prop="grid.encryptionRadialLength" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.encryptionRadialLength" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="尾流区径向长度 (m)" prop="grid.downstreamRadialLength" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.downstreamRadialLength" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="网格加密区半径（内）(m)" prop="grid.encryptionRadius" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.encryptionRadius" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="网格加密区半径（外）(m)" prop="grid.encryptionTransitionRadius" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.encryptionTransitionRadius" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="地形区域半径（内）(m)" prop="grid.terrainRadius" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.terrainRadius" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="地形区域半径（外）(m)" prop="grid.terrainTransitionRadius" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.terrainTransitionRadius" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="尾流区加密长度 (m)" prop="grid.downstreamLength" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.downstreamLength" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <el-form-item label="尾流区加密宽度 (m)" prop="grid.downstreamWidth" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.downstreamWidth" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
            <!-- <el-form-item label="缩尺比" prop="grid.scale" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.grid.scale" :step="0.001" :min="0" :max="1" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>-->
          </div>
        </el-form-item>

        <!-- 植被与粗糙度部分 -->
        <el-form-item label="植被与粗糙度" class="parent-form-item">
          <el-form-item label="植被拖曳系数 (Cd)" prop="roughness.Cd" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.roughness.Cd" :step="0.01" :min="0" :disabled="caseStore.infoExists"/>
          </el-form-item>
          <el-form-item label="最大叶面积密度" prop="roughness.lad_max" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.roughness.lad_max" :step="0.1" :min="0" :disabled="caseStore.infoExists"/>
          </el-form-item>
          <el-form-item label="植被高度缩放系数" prop="roughness.vege_times" :inline="true" class="child-form-item">
            <el-input-number v-model="caseStore.parameters.roughness.vege_times" :step="0.1" :min="0" :disabled="caseStore.infoExists"/>
          </el-form-item>

          <!-- ======================= [ 修改后的代码 ] ======================= -->
          <el-form-item label="粗糙度数据文件 (.rou)" prop="roughnessFile">
            <div class="roughness-upload-section">
              <!-- 新增：rou文件格式指导 -->
              <div class="roughness-input-guidance">
                <el-alert title=".rou 文件格式要求" type="info" :closable="false" show-icon>
                  <template #default>
                    <div class="guidance-content">
                      <p><strong>文件结构：</strong></p>
                      <ul>
                        <li><strong>文件头：</strong> 前4行为描述信息（会被自动跳过）</li>
                        <li><strong>数据块：</strong> 每个数据块代表一条等值线，由块头和坐标点组成</li>
                      </ul>
                      
                      <p><strong>块头格式：</strong> <code>[任意值] [粗糙度长度(m)] [点的数量]</code></p>
                      <div class="format-example">
                        <span class="example-label">示例：</span>
                        <code>0.1         0.3         7</code>
                        <span class="example-note">（粗糙度0.3米，后面有7个坐标点）</span>
                      </div>
                      
                      <p><strong>坐标点格式：</strong> <code>[X坐标] [Y坐标]</code>（UTM坐标系）</p>
                      <div class="format-example">
                        <span class="example-label">示例：</span>
                        <code>33666696.000 2814962.500</code>
                      </div>
                      
                      <div class="important-notes">
                        <p><strong>重要提示：</strong></p>
                        <ul>
                          <li>坐标必须使用 <strong>UTM坐标系</strong></li>
                          <li>数据用空格或制表符分隔</li>
                          <li>可包含多个数据块（多条等值线）</li>
                          <li>文件为纯文本格式，编码建议使用UTF-8</li>
                        </ul>
                      </div>
                    </div>
                  </template>
                </el-alert>
              </div>

              <el-upload
                  ref="roughnessUploader"
                  drag
                  action="#"
                  :auto-upload="false"
                  :limit="1"
                  :file-list="roughnessFileList"
                  :on-change="handleRoughnessFileChange"
                  :on-remove="handleRoughnessFileRemove"
                  :disabled="caseStore.infoExists"
                  accept=".txt,.dat,.rou"
                  class="roughness-uploader"
              >
                  <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                  <div class="el-upload__text">
                      将 <strong>.rou</strong> 粗糙度文件拖到此处，或<em>点击上传</em>
                  </div>

                  <template #tip>
                      <div class="el-upload__tip">
                          请上传符合上述格式要求的 .rou 文件。如未上传，将使用内置粗糙度计算。
                          <span v-if="caseStore.infoExists" style="color: #E6A23C; margin-left: 10px;">
                              <el-icon><Warning /></el-icon> 如需修改，请先解锁参数。
                          </span>
                      </div>
                  </template>
              </el-upload>

              <!-- 显示已存在的文件信息 -->
              <div v-if="!roughnessFileList.length && existingRoughnessFile" class="existing-file-info">
                  <el-icon><Document /></el-icon>
                  <span>已存在文件: <strong>{{ existingRoughnessFile.name }}</strong> ({{ (existingRoughnessFile.size / 1024).toFixed(2) }} KB)</span>
                  <el-button
                      type="danger"
                      size="small"
                      plain
                      @click="deleteExistingRoughnessFile"
                      :disabled="caseStore.infoExists"
                      title="删除已存在的粗糙度文件"
                      style="margin-left: 15px;"
                  >
                      <el-icon><Delete /></el-icon> 删除
                  </el-button>
              </div>
            </div>
          </el-form-item>
          <!-- ======================================================== -->
        </el-form-item>

        <el-form-item label="仿真" class="parent-form-item">
          <el-form-item label="核" prop="simulation.cores" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.simulation.cores" :min="1" class="input-number" /> </el-form-item>
          <el-form-item label="步数" prop="simulation.steps" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.simulation.steps" :min="1" class="input-number" /> </el-form-item>
          <el-form-item label="时间步长" prop="simulation.deltaT" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.simulation.deltaT" :min="0.001" class="input-number" /> </el-form-item>
        </el-form-item>
        <el-form-item label="后处理" class="parent-form-item">
          <el-form-item label="结果层数" prop="postProcessing.resultLayers" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.postProcessing.resultLayers" :min="1" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
          <el-form-item label="层数间距 (m)" prop="postProcessing.layerSpacing" :inline="true" class="child-form-item"> <el-input-number v-model="caseStore.parameters.postProcessing.layerSpacing" :min="0" class="input-number" :disabled="caseStore.infoExists" /> </el-form-item>
        </el-form-item>

        <!-- 风机性能曲线 - 最终修复版 -->
        <el-form-item label="风机性能曲线" class="parent-form-item">
          <div class="performance-curve-section">
            <!-- 输入指导 -->
            <div class="curve-input-guidance">
              <el-alert title="性能曲线数据格式要求" type="info" :closable="false" show-icon>
                 <template #default>
                  <div class="guidance-content">
                    <p><strong>文件命名格式：</strong> 1-U-P-Ct.txt, 2-U-P-Ct.txt, ...</p>
                    <p><strong>文件内容格式：</strong> 制表符或空格分隔的三列数据</p>
                    <ul>
                      <li>第1列：风速 (m/s)</li>
                      <li>第2列：功率 (kW)</li>
                      <li>第3列：推力系数 (Ct)</li>
                    </ul>
                  </div>
                </template>
              </el-alert>
            </div>

            <!-- 文件上传与预览区域 -->
            <div class="curve-input-area">
              <div class="input-left">
                <el-upload drag ref="curveUploader" :auto-upload="false" :limit="10" :file-list="curveFileList" :on-remove="handleCurveRemove" :on-change="handleCurveAdd" accept=".txt,.csv" multiple :disabled="caseStore.infoExists">
                  <el-icon><UploadFilled /></el-icon>
                  <div class="el-upload__text">将 <b>1-U-P-Ct.txt</b> 等文件拖到此处，或<em>点击上传</em></div>
                  <template #tip>
                    <div class="el-upload__tip" v-if="caseStore.infoExists">
                      <el-icon><Warning /></el-icon> 如需修改，请先点击下方的"修改参数"按钮。
                    </div>
                  </template>
                </el-upload>

                <!-- 组合文件列表 -->
                <div v-if="allCurveData.length" class="uploaded-files-list">
                  <div class="files-header">
                    <h4>性能曲线文件:</h4>
                    <div class="header-actions">
                      <el-button
                        v-if="hasPreviewedFiles"
                        @click="clearAllPreviews"
                        size="small"
                        type="warning"
                        plain
                      >
                        清空预览
                      </el-button>
                    </div>
                  </div>
                  <el-table :data="allCurveData" size="small" style="width: 100%">
                    <el-table-column label="文件名" width="200">
                      <template #default="scope">
                        <div class="filename-cell">
                          <span
                            :class="['filename', {
                              'clickable': !scope.row.isNew && !scope.row.isPreviewed,
                              'previewed': scope.row.isPreviewed,
                              'new-file': scope.row.isNew
                            }]"
                            @click="handleFilenameClick(scope.row)"
                            :title="scope.row.isNew ? '新上传文件' : scope.row.isPreviewed ? '点击取消预览' : '点击预览文件内容'"
                          >
                            {{ scope.row.filename }}
                          </span>
                          <el-icon v-if="previewingFiles.has(scope.row.filename)" class="loading-icon is-loading"><Loading /></el-icon>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column prop="dataPoints" label="数据点" width="80">
                      <template #default="scope">
                        <span v-if="scope.row.dataPoints === 'N/A'" class="na-hint">点击文件名查看</span>
                        <span v-else>{{ scope.row.dataPoints }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="windSpeedRange" label="风速范围(m/s)">
                      <template #default="scope">
                        <span v-if="scope.row.windSpeedRange === 'N/A'" class="na-hint">点击文件名查看</span>
                        <span v-else>{{ scope.row.windSpeedRange }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="maxPower" label="最大功率(kW)">
                      <template #default="scope">
                        <span v-if="scope.row.maxPower === 'N/A'" class="na-hint">点击文件名查看</span>
                        <span v-else>{{ scope.row.maxPower }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="状态" width="80">
                      <template #default="scope">
                        <el-tag :type="getStatusTagType(scope.row)" size="small">
                          {{ getStatusText(scope.row) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="100">
                      <template #default="scope">
                        <div class="file-actions">
                          <el-button
                            v-if="!scope.row.isNew"
                            @click="deleteExistingFile(scope.row.filename)"
                            size="small"
                            type="danger"
                            plain
                            :disabled="caseStore.infoExists"
                            title="删除文件"
                          >
                            <el-icon><Delete /></el-icon>
                          </el-button>
                          <el-button
                            v-if="scope.row.isPreviewed"
                            @click="cancelPreview(scope.row.filename)"
                            size="small"
                            type="warning"
                            plain
                            title="取消预览"
                          >
                            <el-icon><Hide /></el-icon>
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>

              <div class="preview-right">
                <div class="chart-preview">
                  <div class="chart-header">
                    <h4>性能曲线预览</h4>
                    <el-radio-group v-model="chartDisplayMode" size="small" v-if="currentChartData.datasets.length">
                      <el-radio-button label="power">功率曲线</el-radio-button>
                      <el-radio-button label="thrust">推力系数</el-radio-button>
                      <el-radio-button label="both">双轴显示</el-radio-button>
                    </el-radio-group>
                  </div>

                  <div v-if="!currentChartData.datasets.length" class="no-preview">
                    <el-icon><PieChart /></el-icon>
                    <p>请上传新文件或点击文件名预览</p>
                    <p v-if="existingFilesList.length" class="existing-files-hint">
                      点击左侧列表中的文件名可加载预览
                    </p>
                  </div>
                  <div v-else class="chart-container">
                    <Line ref="chartRef" :data="currentChartData" :options="currentChartOptions" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- 按钮区域保持不变... -->
        <el-form-item class="form-actions">
           <el-button type="primary" @click="handleGenerateClick" :disabled="isSubmitting || caseStore.infoExists || !hasTurbines" class="submit-button">
            <template v-if="isSubmitting && !caseStore.infoExists"> <el-icon class="is-loading"><Loading /></el-icon> <span>提交中...</span> </template>
            <span v-else>提交参数</span>
          </el-button>
          <template v-if="caseStore.infoExists">
            <el-button type="warning" @click="handleModifyClick" :disabled="isSubmitting" class="modify-button">
              <template v-if="isSubmitting"> <el-icon class="is-loading"><Loading /></el-icon> <span>解锁中...</span> </template>
              <span v-else>修改参数</span>
            </el-button>
            <el-button type="success" @click="handleDownloadClick" class="download-button"> 下载 info.json </el-button>
          </template>
        </el-form-item>
        <div v-if="submissionMessage" :class="['message-box', submissionSuccess ? 'success-message' : 'error-message']">
          {{ submissionMessage }}
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick } from "vue";
import { InfoFilled, UploadFilled, Loading, Warning, PieChart, Delete, Hide, FolderOpened, Document } from '@element-plus/icons-vue'; // 新增 icons
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute } from "vue-router";
import { useCaseStore } from "../store/caseStore";
import { storeToRefs } from 'pinia';
import axios from 'axios';

// Chart.js imports
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
);

const route = useRoute();
const caseStore = useCaseStore();
const { infoExists, geographicSize, windTurbines } = storeToRefs(caseStore);

// 响应式变量
const formRef = ref(null);
const chartRef = ref(null);
const curveFileList = reactive([]);
const parsedCurveData = ref([]); // 新上传文件的解析数据
const existingParsedData = ref([]); // 已存在文件的解析数据
const existingFilesList = ref([]); // 已存在文件的元数据
const chartDisplayMode = ref('both');
const isLoading = ref(true);
const isSubmitting = ref(false);
const submissionMessage = ref("");
const submissionSuccess = ref(true);
const previewingFiles = ref(new Set()); // 跟踪正在预览的文件

// ======================= [ 新增 ] =======================
// Ref for roughness file upload
const roughnessUploader = ref(null);
const roughnessFileList = reactive([]); // 用于管理 el-upload 组件的文件列表
const existingRoughnessFile = ref(null); // 用于显示服务器上已存在的文件信息

// 处理粗糙度文件选择/变化
const handleRoughnessFileChange = (file, fileList) => {
  // 保证列表里只有一个文件
  if (fileList.length > 1) {
    fileList.splice(0, 1);
  }
  roughnessFileList.splice(0, roughnessFileList.length, ...fileList);
  // 将文件对象存入 store，以便提交时使用
  caseStore.setRoughnessFile(file.raw);
};

// 处理粗糙度文件移除
const handleRoughnessFileRemove = (file, fileList) => {
  roughnessFileList.splice(0, roughnessFileList.length, ...fileList);
  // 从 store 中清除文件对象
  caseStore.setRoughnessFile(null);
};

// 删除服务器上已存在的粗糙度文件
const deleteExistingRoughnessFile = async () => {
    try {
        await ElMessageBox.confirm(
            `确定要删除已存在的粗糙度文件 (${existingRoughnessFile.value.name}) 吗？此操作将无法恢复。`,
            '删除确认',
            { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
        );
        await caseStore.deleteRoughnessFile(); // 假设 store 中有这个 action
        existingRoughnessFile.value = null; // 更新UI
        ElMessage.success('已存在的粗糙度文件删除成功。');
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error(`删除文件失败: ${error.message}`);
        }
    }
};

// 用于在页面加载时检查服务器上是否已存在 rou 文件
const loadExistingRoughnessFile = async () => {
  if (!caseStore.caseId) return;
  try {
    const response = await axios.get(`/api/cases/${caseStore.caseId}/roughness-file-exists`);
    if (response.data.exists) {
      existingRoughnessFile.value = response.data.file;
    }
  } catch (error) {
    // 404 是正常情况，表示文件不存在
    if (error.response?.status !== 404) {
      console.warn('检查已存在的粗糙度文件失败:', error);
    }
  }
};
// ========================================================

const colorPalette = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#17a2b8', '#6f42c1', '#fd7e14', '#28a745', '#dc3545'
];

// 计算属性：是否有预览的文件
const hasPreviewedFiles = computed(() => {
  return existingParsedData.value.length > 0;
});

// 文件处理逻辑
const handleCurveAdd = async (file, fileList) => {
  curveFileList.splice(0, curveFileList.length, ...fileList);
  const newFiles = fileList.filter(f => f.raw instanceof File);
  caseStore.setCurveFiles(newFiles.map(f => f.raw));
  await parseNewFiles(newFiles);
};

const handleCurveRemove = async (file, fileList) => {
  curveFileList.splice(0, curveFileList.length, ...fileList);
  const newFiles = fileList.filter(f => f.raw instanceof File);
  caseStore.setCurveFiles(newFiles.map(f => f.raw));
  await parseNewFiles(newFiles);
};

const parseNewFiles = async (fileList) => {
  const parsed = [];
  for (const file of fileList) {
    if (!file.raw || !(file.raw instanceof File)) continue;
    try {
      const data = await parseFile(file.raw);
      parsed.push(createParsedDataObject(file.name, data, true));
    } catch (error) {
      ElMessage.error(`文件 ${file.name} 格式错误: ${error.message}`);
    }
  }
  parsedCurveData.value = parsed.sort((a, b) => a.filename.localeCompare(b.filename));
};

// 按需预览已存在的文件
const previewExistingFile = async (filename) => {
  if (previewingFiles.value.has(filename)) return;
  previewingFiles.value.add(filename);
  try {
    const response = await axios.get(`/api/cases/${caseStore.caseId}/curve-files/${filename}`);
    if (response.data.success) {
      const data = parseTextData(response.data.content);
      const parsedObj = createParsedDataObject(filename, data, false);
      const existingIndex = existingParsedData.value.findIndex(item => item.filename === filename);
      if (existingIndex >= 0) existingParsedData.value[existingIndex] = parsedObj;
      else existingParsedData.value.push(parsedObj);

      const fileInfoIndex = existingFilesList.value.findIndex(item => item.filename === filename);
      if (fileInfoIndex >= 0) {
        existingFilesList.value[fileInfoIndex] = {
          ...existingFilesList.value[fileInfoIndex],
          dataPoints: data.points.length,
          windSpeedRange: `${data.minWindSpeed.toFixed(1)} - ${data.maxWindSpeed.toFixed(1)}`,
          maxPower: data.maxPower.toFixed(1),
          status: data.warnings.length > 0 ? 'warning' : 'valid',
          isPreviewed: true
        };
      }
      ElMessage.success(`已加载文件 ${filename} 的预览`);
    }
  } catch (error) {
    ElMessage.error(`预览文件 ${filename} 失败: ${error.response?.data?.message || error.message}`);
  } finally {
    previewingFiles.value.delete(filename);
  }
};

// 新增：删除已存在的文件
const deleteExistingFile = async (filename) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 ${filename} 吗？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );

    const response = await axios.delete(`/api/cases/${caseStore.caseId}/curve-files/${filename}`);
    if (response.data.success) {
      // 从列表中移除
      existingFilesList.value = existingFilesList.value.filter(file => file.filename !== filename);
      existingParsedData.value = existingParsedData.value.filter(file => file.filename !== filename);
      ElMessage.success(`文件 ${filename} 删除成功`);
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`删除文件 ${filename} 失败: ${error.response?.data?.message || error.message}`);
    }
  }
};

// 新增：取消单个文件预览
const cancelPreview = (filename) => {
  existingParsedData.value = existingParsedData.value.filter(file => file.filename !== filename);
  const fileInfoIndex = existingFilesList.value.findIndex(item => item.filename === filename);
  if (fileInfoIndex >= 0) {
    existingFilesList.value[fileInfoIndex] = {
      ...existingFilesList.value[fileInfoIndex],
      dataPoints: 'N/A',
      windSpeedRange: 'N/A',
      maxPower: 'N/A',
      status: 'existing',
      isPreviewed: false
    };
  }
  ElMessage.info(`已取消文件 ${filename} 的预览`);
};

// 新增：清空所有预览
const clearAllPreviews = () => {
  existingParsedData.value = [];
  existingFilesList.value.forEach(file => {
    if (file.isPreviewed) {
      file.dataPoints = 'N/A';
      file.windSpeedRange = 'N/A';
      file.maxPower = 'N/A';
      file.status = 'existing';
      file.isPreviewed = false;
    }
  });
  ElMessage.info('已清空所有文件预览');
};

const handleFilenameClick = (fileInfo) => {
  if (fileInfo.isNew) {
    // 新上传的文件，不需要处理
    return;
  }

  if (fileInfo.isPreviewed) {
    // 已预览的文件，点击取消预览
    cancelPreview(fileInfo.filename);
  } else {
    // 未预览的文件，点击预览
    previewExistingFile(fileInfo.filename);
  }
};

// 状态显示辅助函数
const getStatusTagType = (row) => {
  if (row.status === 'valid') return 'success';
  if (row.status === 'warning') return 'warning';
  if (row.isNew) return 'primary';
  return 'info';
};

const getStatusText = (row) => {
  if (row.status === 'valid') return '正常';
  if (row.status === 'warning') return '警告';
  if (row.isNew) return '新上传';
  if (row.isPreviewed) return '已预览';
  return '未预览';
};

// 辅助函数与解析（保持不变）
const createParsedDataObject = (filename, data, isNew) => ({
  filename, data: data.points, dataPoints: data.points.length,
  windSpeedRange: `${data.minWindSpeed.toFixed(1)} - ${data.maxWindSpeed.toFixed(1)}`,
  maxPower: data.maxPower.toFixed(1),
  status: data.warnings.length > 0 ? 'warning' : 'valid',
  warnings: data.warnings, turbineType: extractTurbineTypeFromFilename(filename),
  isNew, isPreviewed: !isNew
});

const parseFile = async (file) => {
  if (!(file instanceof Blob)) throw new Error('无效的文件对象类型');
  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
  return parseTextData(text);
};

const extractTurbineTypeFromFilename = (filename) => {
  const match = filename.match(/^(\d+)-U-P-Ct\./);
  return match ? `风机类型 ${match[1]}` : filename;
};

const parseTextData = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) throw new Error("文件为空或不包含有效数据");
  const points = [];
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const values = lines[i].trim().split(/\s+/).filter(v => v);
    if (values.length !== 3) throw new Error(`第 ${i + 1} 行: 应有3列数据，当前为 ${values.length} 列`);
    const [windSpeed, power, thrustCoeff] = values.map(parseFloat);
    if ([windSpeed, power, thrustCoeff].some(isNaN)) throw new Error(`第 ${i + 1} 行: 包含非数字数据`);
    if (windSpeed < 0) throw new Error(`第 ${i + 1} 行: 风速不能为负`);
    if (power < 0) warnings.push(`第 ${i + 1} 行: 功率为负 (${power} kW)`);
    if (thrustCoeff < 0 || thrustCoeff > 3) warnings.push(`第 ${i + 1} 行: 推力系数 ${thrustCoeff} 超出常规范围 [0, 3]`);
    points.push({ windSpeed, power, thrustCoeff });
  }
  points.sort((a, b) => a.windSpeed - b.windSpeed);
  const windSpeeds = points.map(p => p.windSpeed);
  const powers = points.map(p => p.power);
  return {
    points, warnings,
    minWindSpeed: Math.min(...windSpeeds), maxWindSpeed: Math.max(...windSpeeds),
    maxPower: Math.max(...powers)
  };
};

// 页面加载与数据组合
const loadExistingFiles = async () => {
  if (!caseStore.caseId) return;
  try {
    const response = await axios.get(`/api/cases/${caseStore.caseId}/curve-files`);
    if (response.data.success && response.data.files.length > 0) {
      existingFilesList.value = response.data.files.map(fileInfo => ({
        filename: fileInfo.name, size: fileInfo.size,
        turbineType: extractTurbineTypeFromFilename(fileInfo.name),
        status: 'existing', isNew: false, isPreviewed: false,
        dataPoints: 'N/A', windSpeedRange: 'N/A', maxPower: 'N/A'
      }));
      if (existingFilesList.value.length > 0) {
        ElMessage({ message: `发现 ${existingFilesList.value.length} 个已上传的文件，点击文件名可预览`, type: 'info', duration: 4000 });
      }
    }
  } catch (error) {
    if (error.response?.status !== 404) console.warn('加载现有性能曲线文件失败:', error);
  }
};

const allCurveData = computed(() => {
  return [...existingFilesList.value, ...parsedCurveData.value]
    .sort((a, b) => a.filename.localeCompare(b.filename));
});

// 图表配置与渲染（保持不变）
const currentChartData = computed(() => {
  const allParsedData = [...existingParsedData.value, ...parsedCurveData.value];
  if (!allParsedData.length) return { labels: [], datasets: [] };
  const allWindSpeeds = Array.from(new Set(allParsedData.flatMap(c => c.data.map(p => p.windSpeed)))).sort((a, b) => a - b);
  const datasets = [];
  allParsedData.forEach((curve, index) => {
    const color = colorPalette[index % colorPalette.length];
    const createDataset = (label, dataKey, yAxisID, borderDash = []) => {
      const data = allWindSpeeds.map(speed => curve.data.find(p => p.windSpeed === speed)?.[dataKey] ?? null);
      return { label, data, borderColor: color, backgroundColor: color + '20', tension: 0.1, spanGaps: true, yAxisID, borderDash };
    };
    if (['power', 'both'].includes(chartDisplayMode.value)) datasets.push(createDataset(`${curve.turbineType} - 功率 (kW)`, 'power', 'y'));
    if (['thrust', 'both'].includes(chartDisplayMode.value)) datasets.push(createDataset(`${curve.turbineType} - 推力系数 (Ct)`, 'thrustCoeff', chartDisplayMode.value === 'both' ? 'y1' : 'y', chartDisplayMode.value === 'both' ? [5, 5] : []));
  });
  return { labels: allWindSpeeds, datasets };
});

const currentChartOptions = computed(() => {
  const baseOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { title: { display: false }, legend: { position: 'top', maxHeight: 60, labels: { boxWidth: 12, padding: 8 } }, tooltip: { mode: 'index', intersect: false } },
    scales: { x: { display: true, title: { display: true, text: '风速 (m/s)' } }, y: { type: 'linear', display: true, position: 'left', title: { display: true, text: chartDisplayMode.value === 'power' ? '功率 (kW)' : chartDisplayMode.value === 'thrust' ? '推力系数 (Ct)' : '功率 (kW)' }, beginAtZero: true } },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } }
  };
  if (chartDisplayMode.value === 'both') baseOptions.scales.y1 = { type: 'linear', display: true, position: 'right', title: { display: true, text: '推力系数 (Ct)' }, grid: { drawOnChartArea: false }, beginAtZero: true };
  return baseOptions;
});

watch([parsedCurveData, existingParsedData, chartDisplayMode], async () => {
  const allParsedData = [...existingParsedData.value, ...parsedCurveData.value];
  if (allParsedData.length > 0) {
    await nextTick();
    if (chartRef.value?.chart) chartRef.value.chart.resize();
  }
}, { deep: true });

onMounted(async () => {
  const routeCaseId = route.params.caseId;
  isLoading.value = true;
  if (!routeCaseId) {
    ElMessage.error('无效的工况ID');
    isLoading.value = false; return;
  }
  try {
    await caseStore.initializeCase(routeCaseId);
    await loadExistingFiles();
    await loadExistingRoughnessFile(); // ===== [新增] 加载粗糙度文件信息 =====
  } catch (error) {
    ElMessage.error("初始化工况失败");
  } finally {
    isLoading.value = false;
  }
});

// 页面控制与提交
const handleGenerateClick = async () => {
  const hasGeographicBounds = [
    caseStore.minLatitude,
    caseStore.maxLatitude,
    caseStore.minLongitude,
    caseStore.maxLongitude,
  ].every((v) => typeof v === 'number' && Number.isFinite(v));

  if (!hasGeographicBounds) {
    ElMessage.warning(
      '地理边界信息尚未加载，将使用风机中心作为 CFD 域中心（可能影响计算域定位）。' +
      '建议先打开“地形展示”页面加载地形。'
    );
  }

  if (!hasTurbines.value) return ElMessage.error("请先上传风机布局数据");
  const hasNewFiles = caseStore.curveFiles.length > 0;
  const hasExistingFiles = existingFilesList.value.length > 0;
  if (!hasNewFiles && !hasExistingFiles) return ElMessage.error("请先上传风机性能曲线文件");

  // ===== [新增] 检查粗糙度文件是否已上传 =====
  if (!caseStore.roughnessFile && !existingRoughnessFile.value) {
      ElMessage.warning('将按内置粗糙度计算。');
      // 注意：这里是警告而不是错误，因为求解器可以无此文件运行
  }

  isSubmitting.value = true;
  submissionMessage.value = "";
  try {
    await formRef.value.validate();

    // ===== [新增] 如果有新上传的粗糙度文件，则上传它 =====
    if (caseStore.roughnessFile) {
        await caseStore.uploadRoughnessFile(); // 假设 store 中有这个 action
    }

    if (hasNewFiles) await caseStore.uploadCurveFiles();

    await caseStore.submitParameters();
    await caseStore.generateInfoJson();
    submissionSuccess.value = true;
    submissionMessage.value = "参数提交成功，info.json 已生成";
  } catch (error) {
    submissionSuccess.value = false;
    submissionMessage.value = error.response?.data?.message || error.message || "参数提交失败";
  } finally {
    isSubmitting.value = false;
  }
};

const handleModifyClick = async () => {
  try {
    await ElMessageBox.confirm('修改参数将删除已生成的 info.json，可能导致现有计算结果失效。确定继续吗？', '警告', { confirmButtonText: '确定修改', cancelButtonText: '取消', type: 'warning' });
    isSubmitting.value = true;
    await caseStore.unlockParameters();
    ElMessage.success('参数已解锁，您可以重新编辑和提交。');
  } catch (error) {
    if (error !== 'cancel') console.error('解锁操作失败:', error);
    else ElMessage.info('已取消修改操作。');
  } finally {
    isSubmitting.value = false;
  }
};

const handleDownloadClick = () => caseStore.downloadInfoJson();

const recommendedDomainSize = computed(() => {
  const size = geographicSize.value;
  return size ? Math.ceil(Math.max(size.width, size.height)) : 0;
});
const showDomainSizeHint = computed(() => recommendedDomainSize.value > 0 && caseStore.parameters.calculationDomain.width < recommendedDomainSize.value);
const domainSizeHintText = computed(() => `地形尺寸 (${recommendedDomainSize.value} m)`);
const hasTurbines = computed(() => windTurbines.value?.length > 0);

const rules = reactive({
    'calculationDomain.width': [{ required: true, message: '请输入计算域长度', trigger: 'blur' }],
    'calculationDomain.height': [{ required: true, message: '请输入计算域高度', trigger: 'blur' }],
    'conditions.windDirection': [{ required: true, message: '请输入风向角', trigger: 'blur' }],
    'conditions.inletWindSpeed': [{ required: true, message: '请输入入口风速', trigger: 'blur' }],
    'grid.encryptionHeight': [{ required: true, message: '请输入粗糙层高度', trigger: 'blur' }],
    // 新增：粗糙度部分的验证规则
    'roughness.Cd': [{ required: true, message: '请输入植被拖曳系数', trigger: 'blur' }],
    'roughness.lad_max': [{ required: true, message: '请输入最大叶面积密度', trigger: 'blur' }],
    'roughness.vege_times': [{ required: true, message: '请输入植被高度缩放系数', trigger: 'blur' }],
    'simulation.cores': [{ required: true, message: '请输入核心数', trigger: 'blur' }],
    'simulation.steps': [{ required: true, message: '请输入步数', trigger: 'blur' }],
    'simulation.deltaT': [{ required: true, message: '请输入时间步长', trigger: 'blur' }],
});
</script>

<style scoped>
/* 原有样式保持不变 */
.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.files-header h4 {
  margin: 0;
  color: #303133;
  font-size: 15px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.filename.new-file {
  color: #409EFF;
  font-weight: 500;
}
.filename.clickable {
  color: #909399;
  cursor: pointer;
  text-decoration: underline;
}
.filename.clickable:hover {
  color: #409EFF;
}
.filename.previewed {
  color: #67c23a;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}
.filename.previewed:hover {
  color: #85ce61;
}
.na-hint {
  color: #c0c4cc;
  font-style: italic;
  font-size: 12px;
}
.file-actions {
  display: flex;
  gap: 4px;
}
.file-actions .el-button {
  padding: 4px 6px;
}
.parameter-settings { padding: 24px; background-color: #f9fafc; border-radius: 8px; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05); max-width: 1400px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 24px; }
.header h2 { color: #303133; font-weight: 600; margin: 0; padding-bottom: 12px; position: relative; }
.header h2::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 60px; height: 3px; background-color: #409EFF; border-radius: 3px; }
.case-info-container { margin-bottom: 20px; background-color: #f0f7ff; padding: 16px; border-radius: 6px; border-left: 4px solid #409EFF; }
.el-divider { margin: 28px 0; }
.parameter-form { --el-form-label-font-size: 14px; }
.parent-form-item { margin-bottom: 28px; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; }
.parent-form-item::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #409EFF; border-radius: 4px 0 0 4px; }
:deep(.parent-form-item > .el-form-item__label) { color: #409EFF; font-weight: 600; font-size: 16px; }
.grid-section { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px; }
.child-form-item { margin-right: 20px; margin-bottom: 10px; min-width: 300px; }
.input-number { width: 120px !important; }
.input-with-hint { display: flex; align-items: center; gap: 10px; width: 100%; }
.form-item-hint { display: flex; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; color: #E6A23C; background-color: #fdf6ec; border: 1px solid #faecd8; }
.form-item-hint .el-icon { margin-right: 5px; }
.performance-curve-section { width: 100%; }
.curve-input-guidance { margin-bottom: 20px; }
.guidance-content p { margin: 8px 0; font-size: 14px; }
.guidance-content ul { margin: 8px 0; padding-left: 20px; }
.guidance-content li { margin: 4px 0; font-size: 14px; }
.curve-input-area { display: flex; gap: 24px; min-height: 500px; max-height: 700px; }
.input-left { flex: 1.2; min-width: 400px; }
.preview-right { flex: 2; min-width: 450px; }
.uploaded-files-list { margin-top: 20px; padding: 16px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; max-height: 250px; overflow-y: auto; }
.filename-cell { display: flex; align-items: center; gap: 8px; }
.filename { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-hint, .loading-icon { color: #409EFF; font-size: 14px; }
.chart-preview { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); height: 100%; display: flex; flex-direction: column; max-height: 600px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.chart-header h4 { margin: 0; color: #303133; font-size: 16px; font-weight: 600; }
.chart-container { flex: 1; position: relative; height: 450px; max-height: 450px; overflow: hidden; }
.chart-container canvas { max-height: 100% !important; max-width: 100% !important; }
.no-preview { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #909399; gap: 12px; background-color: #f5f7fa; border-radius: 6px; text-align: center; }
.no-preview .el-icon { font-size: 48px; }
.no-preview p { margin: 0; font-size: 14px; }
.existing-files-hint { font-size: 12px; color: #909399; margin-top: 8px; }
.form-actions { display: flex; justify-content: center; margin-top: 30px; padding: 0 !important; background: none !important; box-shadow: none !important; }
.form-actions::before { display: none; }
.submit-button, .modify-button, .download-button { min-width: 150px; height: 44px; font-size: 16px; font-weight: 500; }
.modify-button, .download-button { margin-left: 16px; }
.message-box { margin-top: 24px; padding: 16px; border-radius: 6px; font-size: 14px; text-align: center; }
.success-message { background-color: #f0f9eb; color: #67c23a; border: 1px solid #c2e7b0; }
.error-message { background-color: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.loading-placeholder { padding: 24px; }
.el-upload__tip .el-icon { vertical-align: middle; margin-right: 4px; }


/* ===== [新增] 粗糙度文件格式指导样式 ===== */
.roughness-input-guidance {
  margin-bottom: 20px;
}
.roughness-input-guidance .guidance-content p {
  margin: 8px 0;
  font-size: 14px;
}
.roughness-input-guidance .guidance-content ul {
  margin: 8px 0;
  padding-left: 20px;
}
.roughness-input-guidance .guidance-content li {
  margin: 4px 0;
  font-size: 14px;
}
.format-example {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 8px 12px;
  margin: 8px 0;
  font-family: 'Courier New', monospace;
}
.example-label {
  color: #606266;
  font-weight: 500;
  margin-right: 8px;
}
.format-example code {
  background-color: transparent;
  color: #e96900;
  font-weight: 500;
  padding: 0;
}
.example-note {
  color: #909399;
  font-size: 12px;
  margin-left: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.important-notes {
  background-color: #fef7e6;
  border: 1px solid #f4d77a;
  border-radius: 4px;
  padding: 12px;
  margin-top: 12px;
}
.important-notes p {
  margin: 4px 0 8px 0 !important;
  color: #e6a23c;
  font-weight: 600;
}
.important-notes ul {
  margin: 0 !important;
}
.important-notes li {
  color: #606266;
  margin: 2px 0 !important;
}

/* ===== [修改] 粗糙度文件上传区域的样式 ===== */
.roughness-upload-section {
  display: flex;
  flex-direction: column;
  gap: 15px; /* 增加间距以容纳新的指导区域 */
  width: 100%;
}
.roughness-uploader :deep(.el-upload-dragger) {
    padding: 20px 10px;
}
.roughness-uploader .el-upload__tip {
  margin-top: 8px;
}
.existing-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f4f4f5;
  border-radius: 4px;
  color: #606266;
  font-size: 14px;
}
.existing-file-info .el-icon {
  font-size: 16px;
}


@media (max-width: 1200px) {
  .curve-input-area { flex-direction: column; max-height: none; }
  .input-left, .preview-right { min-width: unset; flex: 1; }
  .chart-container { height: 350px; }
}
</style>
