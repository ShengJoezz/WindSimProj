/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 14:43:20
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-31 10:15:08
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\router\index.js
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// frontend/src/router/index.js
import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import NewCase from "../views/NewCase.vue";
import Cases from "../views/Cases.vue";
import { ElMessage } from 'element-plus';
import { useCaseStore } from "../store/caseStore"; // Keep this for calculation check
import windMastRoutes from './windmast.routes';


const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/new", name: "NewCase", component: NewCase },
  { path: "/cases", name: "Cases", component: Cases },
  { path: "/terrainTest", name: "terrainTest", component: () => import("../components/TerrainMap/SingleTurbineTest_zh.vue")},
  {
    path: "/cases/:caseId",
    name: "CaseDetails",
    component: () => import("../views/CaseDetails.vue"), // Your main case view wrapper
    // Redirect to a default child view if needed, or remove if CaseDetails has its own content
    // redirect: (to) => ({
    //   name: "TerrainView", // Or maybe 'ParameterSettings'?
    //   params: { caseId: to.params.caseId },
    // }),
    children: [
      {
        path: "terrain", // Existing
        name: "TerrainView",
        component: () => import("../components/TerrainMap/TerrainMap.vue"),
      },
      {
        path: "parameters", // Existing
        name: "ParameterSettings",
        component: () => import("../components/ParameterSettings.vue"),
      },
      {
        path: "calculation", // Existing
        name: "CalculationOutput",
        component: () => import("../components/CalculationOutput.vue"),
      },
      {
        path: "results", // Existing
        name: "ResultsDisplay",
        component: () => import("../components/ResultsDisplay.vue"),
      },
      {
        path: "wind-management", // Existing
        name: "WindManagement",
        component: () => import("../components/WindTurbineManagement.vue"),
      },
      // { // Keep test route if needed
      //   path: "terrainTest",
      //   name: "TerrainTest",
      //   component: () => import("../components/TerrainMap/SingleTurbineTest_zh.vue"),
      // },
       // *** NEW ROUTE for Wind Mast Analysis ***

    ],
    // Add beforeEnter guard if needed for CaseDetails itself
    // beforeEnter: (to, from, next) => { ... }
  },
  ...windMastRoutes
  // Add other top-level routes if any
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Keep your existing beforeEach guard for calculation status check
router.beforeEach(async (to, from, next) => {
  // This guard seems specific to preventing access/leaving CalculationOutput when running
  // It should likely remain as is, as it doesn't directly conflict with the new route.
  const caseStore = useCaseStore(); // Need caseStore instance here

  // Ensure caseStore is initialized if navigating to a case-specific route
  // This might be better handled in App.vue or the specific view's beforeEnter
  if (to.params.caseId && (!caseStore.caseId || caseStore.caseId !== to.params.caseId)) {
     console.log(`Router guard: Initializing case ${to.params.caseId}`);
     // Consider calling initializeCase here, but be mindful of async nature
     // await caseStore.initializeCase(to.params.caseId); // This might delay navigation
     // A better place might be in the CaseDetails component's setup or beforeRouteEnter
  }


  if (to.name === "CalculationOutput") {
    // ... (Keep existing logic for CalculationOutput) ...
    next(); // Simplified for brevity, keep your original logic
  } else if (from.name === "CalculationOutput" && caseStore.calculationStatus === "running") {
    // ... (Keep existing logic for leaving CalculationOutput) ...
    ElMessage.warning("CFD Calculation is in progress. Please wait or reset.");
    next(false);
  } else {
    next(); // Allow navigation for all other cases
  }
});

export default router;