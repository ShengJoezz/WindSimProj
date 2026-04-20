<template>
  <div class="flow-lab-page">
    <el-card class="hero-card" shadow="hover">
      <template #header>
        <div class="hero-header">
          <div>
            <h2>流线与粒子实验页</h2>
            <p>工况 {{ caseId }} 的独立可视化沙盒，不替换现有结果页面</p>
          </div>
          <div class="hero-badge">/cases/{{ caseId }}/flow-lab</div>
        </div>
      </template>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="这个页面只做实验验证"
        description="它直接读取已有的 VTP 结果文件，对照 VTK 基线，并在隔离实验区里试验 Three.js + GitHub 开源流线方案，不去改你的现有主页面渲染逻辑。"
      />
    </el-card>

    <div class="content-grid">
      <div class="viewer-column">
        <el-card class="viewer-card" shadow="never">
          <template #header>
            <div class="viewer-header">
              <strong>实验对比</strong>
              <span>真实 VTP 数据，不改正式页面</span>
            </div>
          </template>

          <el-tabs v-model="activeTab" class="viewer-tabs">
            <el-tab-pane label="体积风廊" name="corridor">
              <FlowVolumeCorridorLabViewer v-if="activeTab === 'corridor'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="服务端剖切" name="serverSlice">
              <FlowServerSliceLabViewer v-if="activeTab === 'serverSlice'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="服务端体显示" name="serverVolume">
              <FlowServerVolumeLabViewer v-if="activeTab === 'serverVolume'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="VTK 体渲染" name="vtkVolume">
              <FlowVtkVolumeLabViewer v-if="activeTab === 'vtkVolume'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="3D 叠层实验" name="stack3d">
              <FlowVolumeStackLabViewer v-if="activeTab === 'stack3d'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="ParaView 风格" name="grid">
              <FlowGridParticleLabViewer v-if="activeTab === 'grid'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="Deck 分析图" name="deck">
              <FlowDeckSliceLabViewer v-if="activeTab === 'deck'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="开源实验" name="meshline">
              <FlowMeshlineLabViewer v-if="activeTab === 'meshline'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="风羽矢量场" name="feather">
              <FlowFeatherFieldLabViewer v-if="activeTab === 'feather'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="LIC 面纹理" name="lic">
              <FlowSurfaceLicLabViewer v-if="activeTab === 'lic'" :case-id="caseId" />
            </el-tab-pane>
            <el-tab-pane label="VTK 基线对照" name="vtk">
              <FlowParticleLabViewer v-if="activeTab === 'vtk'" :case-id="caseId" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>

      <div class="notes-column">
        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>适配结论</strong>
          </template>
          <ul class="note-list">
            <li><code>VTK.js</code> 仍然最适合做你现有 <code>.vtp/.vtu</code> 主链路的严谨读取和基线对照。</li>
            <li><code>体积风廊</code> 会把多高度真实切片重建成浏览器可承受的 <code>3D texture</code>，用 ray-marching 直接看空间风速体，而不是继续堆二维贴片。</li>
            <li><code>服务端剖切</code> 直接从原始 CFD 结果构建服务端矢量体缓存，再按需切任意平面，是更接近真实后处理工作流的路线。</li>
            <li><code>服务端体显示</code> 则更进一步，直接把服务端缓存后的体数据送进浏览器 3D volume，不再把“切面”当成唯一表达方式。</li>
            <li><code>VTK 体渲染</code> 用同一套服务端规则体缓存回到 <code>vtkImageData + VolumeMapper</code> 这条路，观感和交互会更接近 ParaView 的体后处理逻辑。</li>
            <li><code>3D 叠层实验</code> 会把多个高度切片和对应流线按真实高度叠起来，再加上地形和网格外壳，让你先看到浏览器可承受的三维风场质感。</li>
            <li><code>ParaView 风格</code> 这一页会优先模拟 ParaView 常见的切片后处理能力，比如色标预设、范围重标定、等值线和 glyph 叠加。</li>
            <li><code>deck.gl</code> 更适合做正投影切片分析图，尤其是“轮廓面 + 稀疏采样点 + 流线叠加”这种分析型后处理视图。</li>
            <li><code>pmndrs/meshline</code> 这类 GitHub 开源库更适合拿来做更自然的粗线、发光和脉冲流向实验。</li>
            <li><code>风羽矢量场</code> 更适合做“大胆但不失真”的切片表达，它直接把真实速度向量铺成刷痕式风羽层。</li>
            <li><code>Surface LIC</code> 更像 ParaView/VTK 里的诊断纹理；在这个实验页里，我会先把切片面的 <code>CellData.U</code> 局部平均成 <code>PointData</code> 再驱动 LIC。</li>
            <li><code>three.quarks</code>、<code>three-nebula</code> 更偏特效发射器，后续可以试，但不适合作为你复杂地形 CFD 主线的第一渲染层。</li>
          </ul>
        </el-card>

        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>本页验证内容</strong>
          </template>
          <ul class="note-list">
            <li><code>3D 叠层实验</code> 当前优先走多高度 <code>.vtp</code> 叠层，不直接硬读完整 <code>internal.vtu</code>，这样更贴近浏览器端的真实承载能力。</li>
            <li><code>服务端剖切</code> 用服务端缓存承接 <code>.foam / internal.vtu</code> 这类重型源数据，浏览器只吃轻量切面 JSON。</li>
            <li><code>服务端体显示</code> 用同一套服务端缓存输出轻量 3D 纹理文件，重点验证“更接近原始体数据”的三维浏览是否值得继续深挖。</li>
            <li><code>VTK 体渲染</code> 则验证“同样的规则体缓存交给 VTK.js 是否更接近 ParaView”的问题，重点看体感、交互和浏览器负载。</li>
            <li><code>ParaView 风格</code> 的底层仍然是“非结构切片先重采样到规则网格”，这样颜色映射和粒子随流都挂在同一张插值场上。</li>
            <li><code>Deck 分析图</code> 直接把切片和流线转成数组图层，不走 <code>VTK</code> 前端渲染器。</li>
            <li>直接读取 <code>/uploads/&lt;caseId&gt;/run/postProcessing/Data/*.vtp</code> 作为切片面。</li>
            <li>直接读取 <code>/uploads/&lt;caseId&gt;/run/VTK/processed/internal_*m_web.vtp</code> 作为流线数据。</li>
            <li>实验视图里的流线来自真实轨迹采样，不走 PNG 假平滑，也不是切片贴图动画。</li>
            <li>底部保留水平 JET 色带，切片面继续用真实速度标量着色，便于和基线互相校对。</li>
          </ul>
        </el-card>

        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>下一步建议</strong>
          </template>
          <ul class="note-list">
            <li>如果这版 <code>3D 叠层实验</code> 方向对，你下一步就可以决定是继续做更强的三维浏览，还是再专门推进 <code>vtu -&gt; 轻量化 web 数据</code> 这条链。</li>
            <li>如果这组 ParaView 风格功能更接近你的工作习惯，我们就优先沿这条链继续做，而不是继续堆特效型流线。</li>
            <li>先优先看 <code>Deck 分析图</code> 是否更像你心里的工程后处理口径，再决定要不要继续扩成正式分析页。</li>
            <li>先比较开源实验和 VTK 基线的观感、交互和浏览器负载，再决定哪些能力值得迁回正式页面。</li>
            <li>如果后续要做更密集的粒子场，最好先统一流线生成密度、点数和文件体积口径。</li>
            <li>如果你认可这个方向，我下一轮可以继续把 <code>three.quarks</code> 做成只挂在实验页的“尾迹粒子层”。</li>
          </ul>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent, ref } from 'vue';

const FlowVolumeCorridorLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowVolumeCorridorLabViewer.vue'));
const FlowServerSliceLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowServerSliceLabViewer.vue'));
const FlowServerVolumeLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowServerVolumeLabViewer.vue'));
const FlowVtkVolumeLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowVtkVolumeLabViewer.vue'));
const FlowVolumeStackLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowVolumeStackLabViewer.vue'));
const FlowGridParticleLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowGridParticleLabViewer.vue'));
const FlowDeckSliceLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowDeckSliceLabViewer.vue'));
const FlowFeatherFieldLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowFeatherFieldLabViewer.vue'));
const FlowMeshlineLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowMeshlineLabViewer.vue'));
const FlowParticleLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowParticleLabViewer.vue'));
const FlowSurfaceLicLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowSurfaceLicLabViewer.vue'));

const activeTab = ref('serverVolume');

defineProps({
  caseId: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.flow-lab-page {
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 28%),
    linear-gradient(180deg, #f6f9fc 0%, #edf3f8 100%);
}

.hero-card {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.hero-header h2 {
  margin: 0 0 6px;
  font-size: 28px;
  color: #0f172a;
}

.hero-header p {
  margin: 0;
  color: #64748b;
}

.hero-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 20px;
  align-items: start;
}

.viewer-column,
.notes-column {
  min-width: 0;
}

.viewer-card {
  border-radius: 22px;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.viewer-header span {
  font-size: 13px;
  color: #64748b;
}

:deep(.viewer-tabs > .el-tabs__header) {
  margin-bottom: 18px;
}

.notes-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.note-card {
  border-radius: 20px;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.note-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #334155;
  line-height: 1.7;
}

.note-list code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.05);
}

@media (max-width: 1320px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .flow-lab-page {
    padding: 16px;
  }

  .hero-header {
    flex-direction: column;
  }

  .hero-header h2 {
    font-size: 24px;
  }
}
</style>
