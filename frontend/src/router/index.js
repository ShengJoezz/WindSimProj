// frontend/src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import NewCase from '../views/NewCase.vue';
import Cases from '../views/Cases.vue';
import ParameterSettings from '../components/ParameterSettings.vue';
import CalculationOutput from '../components/CalculationOutput.vue';
import ResultsDisplay from '../components/ResultsDisplay.vue';

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

export default router;