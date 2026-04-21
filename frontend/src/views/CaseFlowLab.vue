<template>
  <div class="flow-lab-page">
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="hero-kicker">Wind Field Studio</div>
        <h1>三维风场工作台</h1>
        <p>
          面向工况 <strong>{{ props.caseId }}</strong> 的独立风场沙盒。
          这里不再把旧切片页、旧流线页直接拼在一起，而是围绕
          <code>internal.vtu / .foam -&gt; 服务端规则体缓存 -&gt; Web 三维表达</code>
          重新组织主链路。
        </p>
      </div>

      <div class="hero-metrics">
        <div class="metric-card">
          <span>工况</span>
          <strong>{{ props.caseId }}</strong>
          <small>当前实验对象</small>
        </div>
        <div class="metric-card">
          <span>主路径</span>
          <strong>体缓存优先</strong>
          <small>先看新链路，再看旧对照</small>
        </div>
        <div class="metric-card">
          <span>默认模式</span>
          <strong>风场舞台</strong>
          <small>粒子云团 + 风矢雕塑</small>
        </div>
        <div class="metric-card metric-card--route">
          <span>入口</span>
          <strong>{{ flowLabRoute }}</strong>
          <small>隔离实验，不改正式结果页</small>
        </div>
      </div>
    </section>

    <section class="studio-grid">
      <aside class="mode-rail">
        <div class="rail-card">
          <div class="rail-card__header">
            <span class="rail-kicker">Primary</span>
            <h2>主舞台</h2>
            <p>先看真正偏离旧工作流的新表达，只保留 4 条最值得继续推的路线。</p>
          </div>

          <button
            v-for="mode in primaryModes"
            :key="mode.name"
            type="button"
            class="mode-button"
            :class="{ 'mode-button--active': activeMode === mode.name }"
            @click="activeMode = mode.name"
          >
            <span class="mode-button__eyebrow">{{ mode.eyebrow }}</span>
            <strong>{{ mode.title }}</strong>
            <small>{{ mode.summary }}</small>
          </button>
        </div>

        <div class="rail-card rail-card--secondary">
          <div class="rail-card__header">
            <span class="rail-kicker">Archive</span>
            <h2>对照库</h2>
            <p>旧链路、分析图和开源试验收进次级区，只在需要时展开对比。</p>
          </div>

          <div class="archive-grid">
            <button
              v-for="mode in archiveModes"
              :key="mode.name"
              type="button"
              class="archive-chip"
              :class="{ 'archive-chip--active': activeMode === mode.name }"
              @click="activeMode = mode.name"
            >
              {{ mode.title }}
            </button>
          </div>
        </div>
      </aside>

      <main class="stage-column">
        <section class="stage-panel">
          <header class="stage-panel__header">
            <div>
              <span class="stage-panel__eyebrow">{{ activeModeMeta.eyebrow }}</span>
              <h2>{{ activeModeMeta.title }}</h2>
              <p>{{ activeModeMeta.summary }}</p>
            </div>
            <div class="stage-panel__badges">
              <div class="stage-badge">
                <span>分组</span>
                <strong>{{ activeGroupLabel }}</strong>
              </div>
              <div class="stage-badge">
                <span>数据口径</span>
                <strong>{{ activeModeMeta.data }}</strong>
              </div>
              <div class="stage-badge">
                <span>定位</span>
                <strong>{{ activeModeMeta.positioning }}</strong>
              </div>
            </div>
          </header>

          <div class="stage-panel__body">
            <component :is="currentComponent" :case-id="props.caseId" />
          </div>
        </section>
      </main>

      <aside class="brief-column">
        <section class="brief-card brief-card--focus">
          <span class="brief-card__eyebrow">Focus</span>
          <h3>当前模式在验证什么</h3>
          <p>{{ activeModeMeta.goal }}</p>
        </section>

        <section class="brief-card">
          <span class="brief-card__eyebrow">Workflow</span>
          <h3>链路定位</h3>
          <ul class="brief-list">
            <li v-for="item in activeModeMeta.checks" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section class="brief-card">
          <span class="brief-card__eyebrow">Why This</span>
          <h3>为什么保留它</h3>
          <p>{{ activeModeMeta.why }}</p>
        </section>
      </aside>
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
  particleCloud: FlowParticleCloudLabViewer,
  corridor: FlowVolumeCorridorLabViewer,
  serverVolume: FlowServerVolumeLabViewer,
  vtkVolume: FlowVtkVolumeLabViewer,
  serverSlice: FlowServerSliceLabViewer,
  stack3d: FlowVolumeStackLabViewer,
  grid: FlowGridParticleLabViewer,
  deck: FlowDeckSliceLabViewer,
  meshline: FlowMeshlineLabViewer,
  feather: FlowFeatherFieldLabViewer,
  lic: FlowSurfaceLicLabViewer,
  vtk: FlowParticleLabViewer,
};

const modeDefinitions = [
  {
    name: 'particleCloud',
    title: '风场舞台',
    eyebrow: 'Field Stage',
    summary: '服务端矢量体缓存驱动的主展示，默认用粒子云团和风矢雕塑承接整个空间流场。',
    data: 'internal.vtu /.foam -> 粒子缓存',
    positioning: '新主链路',
    goal: '验证“真实三维向量场能否不用旧切片和旧流线，也做出有工程判断力的主视图”。',
    why: '它最有机会成长成正式页面，因为底层已经不依赖旧的 .vtp 切面结果。',
    checks: [
      '是否能直接承接服务端规则体缓存',
      '是否可以同时表达空间结构和速度大小',
      '是否值得继续扩展成正式三维后处理页',
    ],
    group: 'primary',
  },
  {
    name: 'corridor',
    title: '体积风廊',
    eyebrow: 'Volume Corridor',
    summary: '把规则体缓存做成体感更强的风速走廊，重点看空间通道与遮挡关系。',
    data: '规则体缓存 -> 3D texture',
    positioning: '新主链路',
    goal: '验证浏览器端是否能承受更接近体绘制语义的“风速雾场 / 风廊”效果。',
    why: '它不强调单点数值，而强调复杂地形中的风速通道和空间层次。',
    checks: [
      '体速度分布是否比切片更容易看整体路径',
      '浏览器性能是否可接受',
      '是否值得继续深挖 transfer function 和裁剪面',
    ],
    group: 'primary',
  },
  {
    name: 'serverVolume',
    title: '服务端体显示',
    eyebrow: 'Server Volume',
    summary: 'Three.js 直接吃服务端重采样后的体缓存，用更轻量的方式靠近体后处理。',
    data: '规则体缓存 -> Volume shader',
    positioning: '新主链路',
    goal: '验证轻量 web volume 方案在你当前项目里是否比传统切片链更值得投入。',
    why: '如果它足够稳，就可能成为速度场分析页的真正下一代基础。',
    checks: [
      '体缓存尺寸与首帧速度',
      '颜色映射和遮挡是否可读',
      '与 VTK 体渲染相比是否更轻更稳',
    ],
    group: 'primary',
  },
  {
    name: 'vtkVolume',
    title: 'VTK 体渲染',
    eyebrow: 'VTK Volume',
    summary: '用同一份规则体缓存回到 VTK.js 体渲染口径，更接近 ParaView 的后处理语义。',
    data: '规则体缓存 -> vtkImageData',
    positioning: '新主链路',
    goal: '验证“更像 ParaView”的浏览体验是不是值得在 web 端继续追。',
    why: '它是最接近桌面后处理逻辑的路线，也最适合作为严谨基线。',
    checks: [
      '首帧稳定性与交互负载',
      '体渲染视觉是否接近桌面后处理',
      '与 Three.js 方案相比谁更适合长期演进',
    ],
    group: 'primary',
  },
  {
    name: 'serverSlice',
    title: '服务端剖切',
    eyebrow: 'Server Slice',
    summary: '把重型源数据留在服务端，只向浏览器发任意平面切面结果。',
    data: '规则体缓存 -> 按需切面',
    positioning: '对照库',
    goal: '验证任意面剖切是否足够稳定和灵活。',
    why: '它是后续做工程分析工具最稳的一条工作流基础。',
    checks: [
      '任意面切片的正确性',
      '前后端参数是否一致',
      '是否适合挂更多分析控件',
    ],
    group: 'archive',
  },
  {
    name: 'stack3d',
    title: '3D 叠层实验',
    eyebrow: 'Layer Stack',
    summary: '多高度切片叠层，偏浏览器友好的折中路线。',
    data: '多高度 .vtp',
    positioning: '对照库',
    goal: '验证轻量三维感是否足以支持快速浏览。',
    why: '它是性能和空间感之间的折中参照。',
    checks: [
      '多高度切片叠层是否可读',
      '是否比单纯切片更有空间感',
      '是否值得作为低配模式保留',
    ],
    group: 'archive',
  },
  {
    name: 'grid',
    title: 'ParaView 风格',
    eyebrow: 'Analysis Grid',
    summary: '更偏工程分析的规则网格视图，强调色标、glyph 和范围重标定。',
    data: '切面重采样网格',
    positioning: '对照库',
    goal: '验证你常用的后处理口径是否能在前端复现。',
    why: '它对“是否符合工程习惯”很有参考价值。',
    checks: [
      '色标和范围是否工程化',
      'glyph 叠加是否清楚',
      '是否更接近 ParaView 的思路',
    ],
    group: 'archive',
  },
  {
    name: 'deck',
    title: 'Deck 分析图',
    eyebrow: 'Deck Analysis',
    summary: '偏二维分析投影的切片视图，用来验证图层式工作流。',
    data: '切面 / 流线数组图层',
    positioning: '对照库',
    goal: '验证 deck.gl 这类图层化分析是否更适合风场诊断。',
    why: '它适合保留给分析向页面，而不是主三维舞台。',
    checks: [
      '切片叠加是否更轻便',
      '图层控制是否清晰',
      '是否适合作为分析页分支',
    ],
    group: 'archive',
  },
  {
    name: 'meshline',
    title: '开源实验',
    eyebrow: 'Open Source Lab',
    summary: '偏向线条和发光风格的试验台。',
    data: '真实轨迹 + 开源渲染库',
    positioning: '对照库',
    goal: '继续探索开源可视化库的上限。',
    why: '它适合作为灵感库，但不应该抢主舞台。',
    checks: [
      '视觉表现是否足够独特',
      '是否脱离旧流线气质',
      '性能成本是否合理',
    ],
    group: 'archive',
  },
  {
    name: 'feather',
    title: '风羽矢量场',
    eyebrow: 'Feather Field',
    summary: '以切片上的局部速度方向做刷痕式表达。',
    data: '切片矢量场',
    positioning: '对照库',
    goal: '验证“大胆但不失真”的切片表达。',
    why: '它更像一个风向风速诊断层，而不是主场景。',
    checks: [
      '局部方向是否清楚',
      '刷痕密度是否恰当',
      '是否适合作为辅助手段',
    ],
    group: 'archive',
  },
  {
    name: 'lic',
    title: 'LIC 面纹理',
    eyebrow: 'Surface LIC',
    summary: '保留一条更接近 VTK/ParaView 诊断纹理的路线。',
    data: '切片矢量纹理',
    positioning: '对照库',
    goal: '验证 LIC 这种经典后处理语义在前端的价值。',
    why: '它更偏专家诊断视图，不适合做首页主视图。',
    checks: [
      '局部流向是否连续',
      '纹理噪声是否可控',
      '是否值得保留为专业分析工具',
    ],
    group: 'archive',
  },
  {
    name: 'vtk',
    title: 'VTK 基线对照',
    eyebrow: 'VTK Baseline',
    summary: '保留一条最传统的 VTK.js 基线，便于校对。',
    data: '.vtp /.vtu 基线读取',
    positioning: '对照库',
    goal: '作为旧口径基准，检查新实验有没有跑偏。',
    why: '没有它，很多新实验会失去校对标尺。',
    checks: [
      '结果是否和已有基线一致',
      '新页面是否出现口径漂移',
      '性能差异是否可接受',
    ],
    group: 'archive',
  },
];

const primaryModes = modeDefinitions.filter((mode) => mode.group === 'primary');
const archiveModes = modeDefinitions.filter((mode) => mode.group === 'archive');
const activeMode = ref('particleCloud');

const activeModeMeta = computed(() => (
  modeDefinitions.find((mode) => mode.name === activeMode.value) || modeDefinitions[0]
));

const activeGroupLabel = computed(() => (
  activeModeMeta.value.group === 'primary' ? '主舞台' : '对照库'
));

const currentComponent = computed(() => (
  componentMap[activeModeMeta.value.name] || FlowParticleCloudLabViewer
));

const flowLabRoute = computed(() => `/cases/${props.caseId}/flow-lab`);
</script>

<style scoped>
.flow-lab-page {
  --flow-bg-1: #06111f;
  --flow-bg-2: #0b1f31;
  --flow-panel: rgba(7, 16, 26, 0.8);
  --flow-panel-soft: rgba(10, 23, 37, 0.64);
  --flow-line: rgba(124, 182, 255, 0.16);
  --flow-text: #e2ecfb;
  --flow-text-muted: rgba(195, 210, 233, 0.75);
  --flow-accent: #7dd3fc;
  --flow-accent-2: #f97316;
  min-height: 100%;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background:
    radial-gradient(circle at 12% 10%, rgba(56, 189, 248, 0.16), transparent 22%),
    radial-gradient(circle at 82% 14%, rgba(249, 115, 22, 0.14), transparent 20%),
    radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 28%),
    linear-gradient(180deg, var(--flow-bg-1) 0%, var(--flow-bg-2) 100%);
  color: var(--flow-text);
}

.hero-panel,
.rail-card,
.stage-panel,
.brief-card {
  border: 1px solid var(--flow-line);
  background: var(--flow-panel);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.hero-panel {
  border-radius: 28px;
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.85fr);
  gap: 18px;
  align-items: stretch;
}

.hero-kicker,
.rail-kicker,
.brief-card__eyebrow,
.stage-panel__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(125, 211, 252, 0.9);
}

.hero-copy h1 {
  margin: 12px 0 10px;
  font-size: clamp(34px, 4vw, 52px);
  line-height: 1.04;
  letter-spacing: -0.04em;
  color: #f8fbff;
}

.hero-copy p {
  margin: 0;
  max-width: 780px;
  color: var(--flow-text-muted);
  line-height: 1.8;
  font-size: 15px;
}

.hero-copy code {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(125, 211, 252, 0.08);
  color: #d8f4ff;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  padding: 16px 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(12, 27, 44, 0.92) 0%, rgba(8, 20, 32, 0.86) 100%);
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.metric-card span,
.stage-badge span {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(125, 211, 252, 0.82);
}

.metric-card strong,
.stage-badge strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  color: #f8fbff;
}

.metric-card small {
  display: block;
  margin-top: 10px;
  color: rgba(195, 210, 233, 0.72);
  line-height: 1.6;
}

.metric-card--route strong {
  font-size: 15px;
  word-break: break-all;
}

.studio-grid {
  display: grid;
  grid-template-columns: minmax(260px, 300px) minmax(0, 1fr) minmax(280px, 320px);
  gap: 18px;
  align-items: start;
}

.mode-rail,
.brief-column {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rail-card,
.brief-card,
.stage-panel {
  border-radius: 24px;
}

.rail-card {
  padding: 18px;
}

.rail-card__header h2,
.brief-card h3,
.stage-panel__header h2 {
  margin: 10px 0 6px;
  color: #f8fbff;
}

.rail-card__header p,
.brief-card p,
.stage-panel__header p {
  margin: 0;
  color: var(--flow-text-muted);
  line-height: 1.7;
}

.mode-button {
  width: 100%;
  margin-top: 12px;
  padding: 16px;
  border: 1px solid rgba(125, 211, 252, 0.1);
  border-radius: 18px;
  background: rgba(10, 24, 38, 0.7);
  text-align: left;
  color: var(--flow-text);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.mode-button:hover,
.archive-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.28);
}

.mode-button--active {
  border-color: rgba(125, 211, 252, 0.42);
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 35%),
    rgba(12, 29, 45, 0.92);
  box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.08);
}

.mode-button__eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(125, 211, 252, 0.72);
}

.mode-button strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  color: #f8fbff;
}

.mode-button small {
  display: block;
  margin-top: 8px;
  color: rgba(195, 210, 233, 0.72);
  line-height: 1.6;
}

.rail-card--secondary {
  background: var(--flow-panel-soft);
}

.archive-grid {
  margin-top: 14px;
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
  transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.archive-chip--active {
  border-color: rgba(249, 115, 22, 0.42);
  color: #fff0e7;
  background: rgba(54, 25, 10, 0.58);
}

.stage-column {
  min-width: 0;
}

.stage-panel {
  overflow: hidden;
}

.stage-panel__header {
  padding: 22px 24px 18px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  border-bottom: 1px solid rgba(125, 211, 252, 0.08);
}

.stage-panel__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.stage-badge {
  min-width: 120px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(8, 21, 34, 0.88);
  border: 1px solid rgba(125, 211, 252, 0.1);
}

.stage-panel__body {
  padding: 20px;
}

.brief-column {
  min-width: 0;
}

.brief-card {
  padding: 18px;
}

.brief-card--focus {
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 34%),
    rgba(8, 18, 28, 0.84);
}

.brief-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--flow-text-muted);
  line-height: 1.75;
}

@media (max-width: 1480px) {
  .studio-grid {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .brief-column {
    grid-column: 1 / -1;
    position: static;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .hero-panel,
  .studio-grid {
    grid-template-columns: 1fr;
  }

  .mode-rail,
  .brief-column {
    position: static;
  }

  .brief-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .flow-lab-page {
    padding: 16px;
  }

  .hero-panel {
    padding: 20px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .stage-panel__header {
    flex-direction: column;
  }

  .stage-panel__badges {
    justify-content: flex-start;
  }

  .stage-panel__body {
    padding: 14px;
  }
}
</style>
