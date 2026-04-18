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
        description="它直接读取已有的 VTP 结果文件，验证真实数据驱动的 tube 流线、粒子头部动画和底部水平 JET 色带，不去改你的现有主页面渲染逻辑。"
      />
    </el-card>

    <div class="content-grid">
      <div class="viewer-column">
        <FlowParticleLabViewer :case-id="caseId" />
      </div>

      <div class="notes-column">
        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>适配结论</strong>
          </template>
          <ul class="note-list">
            <li><code>VTK.js</code> 最适合继续作为主引擎，因为你现在的结果链路本身就是 <code>.vtp/.vtu</code>。</li>
            <li><code>Three.js</code> 更适合后续叠加 GPU 粒子、光晕和拖尾，但不适合先替掉 VTK 读取层。</li>
            <li><code>webgl-wind</code>、<code>wind-gl</code>、<code>cesium-wind</code> 更偏规则网格或地图风场，不适合直接做你的复杂地形 CFD 主链路。</li>
          </ul>
        </el-card>

        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>本页验证内容</strong>
          </template>
          <ul class="note-list">
            <li>直接读取 <code>/uploads/&lt;caseId&gt;/run/postProcessing/Data/*.vtp</code> 作为切片面。</li>
            <li>直接读取 <code>/uploads/&lt;caseId&gt;/run/VTK/processed/internal_*m_web.vtp</code> 作为流线数据。</li>
            <li>使用真实流线几何做采样渲染，而不是 PNG 假平滑，也不是切片贴图动画。</li>
            <li>色带固定为底部水平 JET，先避免遮挡，再决定是否做可拖拽图例。</li>
          </ul>
        </el-card>

        <el-card class="note-card" shadow="never">
          <template #header>
            <strong>下一步建议</strong>
          </template>
          <ul class="note-list">
            <li>如果这个实验页的观感和性能都稳定，再把其中一部分能力逐步迁回正式页面。</li>
            <li>正式页面要不要引入 Three.js 增强层，应当建立在现有 VTK 结果口径已经稳定一致的前提上。</li>
            <li>如果后续要做更密集的粒子场，最好先把流线生成密度、点数和文件体积口径统一下来。</li>
          </ul>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import FlowParticleLabViewer from '@/components/experimental/FlowParticleLabViewer.vue';

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
