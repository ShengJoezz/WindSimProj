import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import NewCase from "../views/NewCase.vue";
import Cases from "../views/Cases.vue";
import { ElMessage } from 'element-plus';
import { useCaseStore } from "../store/caseStore";

const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/new", name: "NewCase", component: NewCase },
  { path: "/cases", name: "Cases", component: Cases },
  {
    path: "/cases/:caseId",
    name: "CaseDetails",
    component: () => import("../views/CaseDetails.vue"),
    redirect: (to) => ({
      name: "TerrainView", // 改为首先重定向到地形视图
      params: { caseId: to.params.caseId },
    }),
    children: [
      {
        path: "terrain", // 添加地形视图路由
        name: "TerrainView",
        component: () => import("../components/TerrainMap/TerrainMap.vue"),
      },
      {
        path: "parameters",
        name: "ParameterSettings",
        component: () => import("../components/ParameterSettings.vue"),
      },
      {
        path: "calculation",
        name: "CalculationOutput",
        component: () => import("../components/CalculationOutput.vue"),
      },
      {
        path: "results",
        name: "ResultsDisplay",
        component: () => import("../components/ResultsDisplay.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const caseStore = useCaseStore();

  if (to.name === "CalculationOutput") {
    await caseStore.fetchCalculationStatus();

    if (caseStore.calculationStatus.value === "completed") {
      next(); // Allow navigation to CalculationOutput if calculation is completed
    } else if (caseStore.calculationStatus.value === "running") {
      // If the user is already on the page, allow staying on it, but show warning if coming from a different route
      if (from.name === "CalculationOutput") {
        next();
      } else {
        ElMessage.warning("Calculation is already running.");
        next(false);
      }
    } else {
      // Allow if not started or failed, but make sure user is informed if it's not completed
      if (caseStore.calculationStatus.value !== 'not_started') {
        ElMessage.info("Calculation status is not 'completed'. Starting a new calculation might be possible.");
      }
      next();
    }
  } else if (from.name === "CalculationOutput" && caseStore.calculationStatus.value === "running") {
      ElMessage.warning("Calculation is in progress. Please wait or reset.");
      next(false);
  } else {
    next();
  }
});

export default router;