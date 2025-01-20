/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-01-10 17:16:53
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-01-19 21:44:42
 * @FilePath: \\wsl.localhost\Ubuntu-18.04\home\joe\wind_project\WindSimProj\frontend\src\router\index.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */
import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import NewCase from "../views/NewCase.vue";
import Cases from "../views/Cases.vue";
import { ElMessage } from 'element-plus';
import { useCaseStore } from "../store/caseStore";
import VTKTest from '@/components/VTKTest.vue';

const routes = [
  {
    path: '/vtk-test',
    name: 'VTKTest',
    component: VTKTest
  },
  { path: "/", name: "Home", component: Home },
  { path: "/new", name: "NewCase", component: NewCase },
  { path: "/cases", name: "Cases", component: Cases },
  {
    path: "/cases/:caseId",
    name: "CaseDetails",
    component: () => import("../views/CaseDetails.vue"),
    redirect: (to) => ({
      name: "TerrainView",
      params: { caseId: to.params.caseId },
    }),
    children: [
      {
        path: "terrain",
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
    if (!caseStore.hasFetchedCalculationStatus) {
      await caseStore.fetchCalculationStatus();
      caseStore.hasFetchedCalculationStatus = true;
    }

    const status = caseStore.calculationStatus.value;

    if (status === "completed") {
      next();
    } else if (status === "running") {
      if (from.name === "CalculationOutput") {
        next();
      } else {
        ElMessage.warning("Calculation is already running.");
        next(false);
      }
    } else {
      if (status !== 'not_started') {
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