import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import NewCase from '../views/NewCase.vue';
import Cases from '../views/Cases.vue';
import ParameterSettings from '../components/ParameterSettings.vue';
import CalculationOutput from '../components/CalculationOutput.vue';
import ResultsDisplay from '../components/ResultsDisplay.vue';
import { useCaseStore } from '../store/caseStore';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/new', name: 'NewCase', component: NewCase },
  { path: '/cases', name: 'Cases', component: Cases },
  {
    path: '/cases/:caseId',
    name: 'CaseDetails',
    component: () => import('../views/CaseDetails.vue'),
    redirect: to => ({ 
      name: 'TerrainView',  // 改为首先重定向到地形视图
      params: { caseId: to.params.caseId }
    }),
    children: [
      {
        path: 'terrain',    // 添加地形视图路由
        name: 'TerrainView',
        component: () => import('../components/TerrainMap/TerrainMap.vue')
      },
      {
        path: 'parameters',
        name: 'ParameterSettings',
        component: () => import('../components/ParameterSettings.vue')
      },
      {
        path: 'calculation',
        name: 'CalculationOutput',
        component: () => import('../components/CalculationOutput.vue')
      },
      {
        path: 'results',
        name: 'ResultsDisplay',
        component: () => import('../components/ResultsDisplay.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 添加路由守卫防止重复计算
router.beforeEach(async (to, from, next) => {
    const store = useCaseStore();

    if (to.name === 'CalculationOutput') {
        await store.fetchCalculationStatus();
        const savedProgress = await store.loadCalculationProgress();

        if (savedProgress && savedProgress.isCalculating) {
           next();
        } else if (store.calculationStatus === 'completed') {
            next();
        } else {
            next();
        }
    } else if (from.name === 'CalculationOutput' && store.isComputationRunning.value) {
        // 可以选择阻止离开或者给出提示
        ElMessage.warning('计算正在进行中，请稍后离开');
        next(false); // 阻止导航
    } else {
        next();
    }
});

export default router;