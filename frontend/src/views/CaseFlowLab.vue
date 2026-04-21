<template>
  <div class="flow-lab-page">
    <header class="topbar">
      <div class="topbar__title">
        <h1>风场后处理</h1>
      </div>
      <div class="topbar__meta">
        <div class="meta-chip">
          <span>工况</span>
          <strong>{{ props.caseId }}</strong>
        </div>
        <div class="meta-chip">
          <span>当前</span>
          <strong>{{ activeModeMeta.title }}</strong>
        </div>
        <div class="meta-chip">
          <span>数据</span>
          <strong>{{ activeModeMeta.data }}</strong>
        </div>
      </div>
    </header>

    <section class="workspace">
      <aside class="mode-panel">
        <section
          v-for="section in sections"
          :key="section.key"
          class="mode-section"
        >
          <header class="mode-section__header">
            <span>{{ section.title }}</span>
          </header>

          <div class="mode-section__body">
            <button
              v-for="mode in section.modes"
              :key="mode.name"
              type="button"
              class="mode-button"
              :class="{ 'mode-button--active': activeMode === mode.name }"
              @click="activeMode = mode.name"
            >
              <strong>{{ mode.title }}</strong>
              <small>{{ mode.data }}</small>
            </button>
          </div>
        </section>
      </aside>

      <main class="stage-panel">
        <header class="stage-panel__header">
          <div class="stage-title">
            <h2>{{ activeModeMeta.title }}</h2>
          </div>

          <div class="stage-badges">
            <div class="stage-badge">
              <span>分组</span>
              <strong>{{ activeModeMeta.sectionTitle }}</strong>
            </div>
            <div class="stage-badge">
              <span>数据</span>
              <strong>{{ activeModeMeta.data }}</strong>
            </div>
          </div>
        </header>

        <div class="stage-panel__body">
          <component :is="currentComponent" :case-id="props.caseId" />
        </div>
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue';

const props = defineProps({
  caseId: {
    type: String,
    required: true,
  },
});

const FlowParticleCloudLabViewer = defineAsyncComponent(() => import('@/components/experimental/FlowParticleCloudLabViewer.vue'));
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

const componentMap = {
  serverSlice: FlowServerSliceLabViewer,
  grid: FlowGridParticleLabViewer,
  deck: FlowDeckSliceLabViewer,
  serverVolume: FlowServerVolumeLabViewer,
  vtkVolume: FlowVtkVolumeLabViewer,
  corridor: FlowVolumeCorridorLabViewer,
  vtk: FlowParticleLabViewer,
  stack3d: FlowVolumeStackLabViewer,
  particleCloud: FlowParticleCloudLabViewer,
  feather: FlowFeatherFieldLabViewer,
  lic: FlowSurfaceLicLabViewer,
  meshline: FlowMeshlineLabViewer,
};

const sections = [
  {
    key: 'slice',
    title: '剖面',
    modes: [
      { name: 'serverSlice', title: '标准剖面', data: '规则体缓存 -> 按需切面' },
      { name: 'grid', title: '规则网格', data: '切面重采样网格' },
      { name: 'deck', title: '分析图', data: '切面 / 流线数组图层' },
    ],
  },
  {
    key: 'volume',
    title: '体',
    modes: [
      { name: 'serverVolume', title: '服务端体浏览', data: '规则体缓存 -> Volume shader' },
      { name: 'vtkVolume', title: 'VTK 体浏览', data: '规则体缓存 -> vtkImageData' },
      { name: 'corridor', title: '体速度走廊', data: '规则体缓存 -> 3D texture' },
    ],
  },
  {
    key: 'baseline',
    title: '校核',
    modes: [
      { name: 'vtk', title: 'VTK 基线', data: '.vtp /.vtu' },
      { name: 'stack3d', title: '多高度叠层', data: '多高度 .vtp' },
    ],
  },
  {
    key: 'lab',
    title: '实验',
    modes: [
      { name: 'particleCloud', title: '粒子场', data: '粒子缓存' },
      { name: 'feather', title: '风羽', data: '切片矢量场' },
      { name: 'lic', title: 'LIC', data: '切片矢量纹理' },
      { name: 'meshline', title: '线型实验', data: '真实轨迹 + 渲染库' },
    ],
  },
];

const flatModes = sections.flatMap((section) => (
  section.modes.map((mode) => ({
    ...mode,
    sectionKey: section.key,
    sectionTitle: section.title,
  }))
));

const activeMode = ref('serverSlice');

const activeModeMeta = computed(() => (
  flatModes.find((mode) => mode.name === activeMode.value) || flatModes[0]
));

const currentComponent = computed(() => (
  componentMap[activeModeMeta.value.name] || FlowServerSliceLabViewer
));
</script>

<style scoped>
.flow-lab-page {
  --flow-bg-1: #06111f;
  --flow-bg-2: #0b1f31;
  --flow-panel: rgba(7, 16, 26, 0.8);
  --flow-line: rgba(124, 182, 255, 0.16);
  --flow-text: #e2ecfb;
  --flow-text-muted: rgba(195, 210, 233, 0.75);
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background:
    radial-gradient(circle at 12% 10%, rgba(56, 189, 248, 0.16), transparent 22%),
    radial-gradient(circle at 82% 14%, rgba(249, 115, 22, 0.12), transparent 20%),
    linear-gradient(180deg, var(--flow-bg-1) 0%, var(--flow-bg-2) 100%);
  color: var(--flow-text);
}

.topbar,
.mode-panel,
.stage-panel {
  border: 1px solid var(--flow-line);
  background: var(--flow-panel);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.topbar {
  border-radius: 24px;
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.topbar__title h1 {
  margin: 0;
  font-size: 28px;
  color: #f8fbff;
}

.topbar__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-chip,
.stage-badge {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(8, 21, 34, 0.88);
  border: 1px solid rgba(125, 211, 252, 0.1);
}

.meta-chip span,
.stage-badge span,
.mode-section__header span {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(125, 211, 252, 0.82);
}

.meta-chip strong,
.stage-badge strong {
  display: block;
  margin-top: 6px;
  color: #f8fbff;
}

.workspace {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.mode-panel {
  position: sticky;
  top: 20px;
  border-radius: 24px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-section__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-button {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(125, 211, 252, 0.1);
  border-radius: 16px;
  background: rgba(10, 24, 38, 0.74);
  color: var(--flow-text);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.mode-button:hover,
.archive-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.28);
}

.mode-button--active {
  border-color: rgba(125, 211, 252, 0.42);
  background: rgba(12, 29, 45, 0.92);
}

.mode-button strong {
  display: block;
  font-size: 16px;
  color: #f8fbff;
}

.mode-button small {
  display: block;
  margin-top: 8px;
  color: var(--flow-text-muted);
  line-height: 1.5;
}

.archive-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.archive-chip {
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 252, 0.12);
  background: rgba(9, 22, 34, 0.72);
  color: rgba(226, 236, 251, 0.82);
  cursor: pointer;
}

.archive-chip--active {
  border-color: rgba(249, 115, 22, 0.42);
  color: #fff0e7;
  background: rgba(54, 25, 10, 0.58);
}

.stage-panel {
  border-radius: 24px;
  overflow: hidden;
}

.stage-panel__header {
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  border-bottom: 1px solid rgba(125, 211, 252, 0.08);
}

.stage-title h2 {
  margin: 0;
  color: #f8fbff;
}

.stage-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stage-panel__body {
  padding: 18px;
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .mode-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .flow-lab-page {
    padding: 16px;
  }

  .topbar,
  .stage-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
