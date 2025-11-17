/*
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 19:29:08
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 19:49:49
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\router\windmast.routes.js
 * @Description: Routes for the Wind Mast module.
 *
 * Copyright (c) 2025 by joe, All Rights Reserved.
 */

// src/router/windmast.routes.js
export default [
    {
      path: '/windmast',
      component: () => import('@/components/WindMast/WindMastLayout.vue'),
      children: [
        {
          path: '',
          name: 'WindMastDashboard',
          component: () => import('@/components/WindMast/WindMastDashboard.vue'),
          meta: { title: '测风塔数据分析 - 概览' }
        },
        {
          path: 'upload',
          name: 'WindMastUpload',
          component: () => import('@/components/WindMast/WindMastUpload.vue'),
          meta: { title: '测风塔数据分析 - 文件上传' }
        },
        {
          path: 'analysis',
          name: 'WindMastAnalysis',
          // Corrected path if your component is directly under WindMast
          component: () => import('@/components/WindMast/WindMastAnalysis.vue'),
          // Original path provided in comments:
          // component: () => import('@/components/WindDataAnalysis/WindMastAnalysis.vue'),
          meta: { title: '测风塔数据分析 - 执行分析' }
        },
        {
          path: 'results',
          name: 'WindMastResults',
          component: () => import('@/components/WindMast/WindMastResults.vue'),
          meta: { title: '测风塔数据分析 - 结果概览' }
        },
        {
          // Specific result route needs to come before the general results route if nested differently
          // or ensure the general one doesn't accidentally catch specific IDs.
          // Order seems okay here.
          path: 'results/:analysisId',
          name: 'WindMastResultDetail',
          component: () => import('@/components/WindMast/WindMastResultDetail.vue'),
          meta: { title: '测风塔数据分析 - 详细结果' },
          props: true // Pass route params as props to the component
        },
        {
          path: 'management',
          name: 'WindMastManagement',
          component: () => import('@/components/WindMast/WindMastManagement.vue'),
          meta: { title: '测风塔数据分析 - 文件管理' }
        }
      ]
    }
  ];