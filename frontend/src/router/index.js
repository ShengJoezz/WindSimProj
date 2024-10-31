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
    component: () => import('../views/CaseDetails.vue'), // 新增 CaseDetails 视图
    children: [
      { path: 'parameters', name: 'ParameterSettings', component: ParameterSettings },
      { path: 'calculation', name: 'CalculationOutput', component: CalculationOutput },
      { path: 'results', name: 'ResultsDisplay', component: ResultsDisplay }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;