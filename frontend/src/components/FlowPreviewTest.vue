<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-05-17 18:55:39
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-05-17 22:23:43
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\FlowPreviewTest.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="viewer-panel">
      <select v-model="current" @change="loadVtp">
        <option v-for="f in fileList" :key="f" :value="f">{{ f }}</option>
      </select>
  
      <div ref="vtkDiv" class="vtk-box" />
      <div v-if="loading" class="loading">loading…</div>
      <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import axios from 'axios'
  
  // 导入最基本的VTK.js模块
  import '@kitware/vtk.js/Rendering/Profiles/Geometry'
  import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow'
  import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader'
  import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper'
  import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor'
  import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction'
  import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor'
  import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray'
  // 单独导入颜色映射模块
  import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps'
  
  /* ---- 修改URL为完整的后端路径 ---- */
  const BASE_URL = 'http://localhost:5000/uploads/5/run/postProcessing/Data/'
  const fileList = ['120.vtp', '140.vtp', '160.vtp']
  /* -------------------------------- */
  
  const vtkDiv = ref(null)
  const current = ref(fileList[0])
  const loading = ref(false)
  const errorMsg = ref('')
  
  // VTK渲染相关变量
  let fullScreenRenderer = null
  let renderer = null
  let renderWindow = null
  let scalarBar = null
  let actors = []
  
  function initRenderer() {
    try {
      console.log('初始化渲染器')
      
      // 清理旧的实例
      if (fullScreenRenderer) {
        fullScreenRenderer.delete()
      }
      
      // 更安全的方式：使用官方的全屏渲染窗口
      fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
        container: vtkDiv.value,
        background: [0.1, 0.1, 0.1],
        // 禁用默认的全屏功能
        rootContainer: vtkDiv.value,
        containerStyle: { height: '100%', width: '100%' }
      })
      
      // 获取主要组件
      renderWindow = fullScreenRenderer.getRenderWindow()
      renderer = fullScreenRenderer.getRenderer()
      
      return true
    } catch (error) {
      console.error('渲染器初始化失败:', error)
      errorMsg.value = `渲染器初始化失败: ${error.message}`
      return false
    }
  }
  
  function clearScene() {
    if (!renderer) return
    
    // 移除所有Actor
    actors.forEach(actor => {
      renderer.removeActor(actor)
    })
    actors = []
    
    // 移除颜色条
    if (scalarBar) {
      renderer.removeActor(scalarBar)
      scalarBar = null
    }
  }
  
  async function loadVtp() {
    loading.value = true
    errorMsg.value = ''
    console.log('开始加载VTP文件')
    
    try {
      // 1. 确保渲染器已初始化
      if (!fullScreenRenderer) {
        const success = initRenderer()
        if (!success) {
          throw new Error('无法初始化渲染器')
        }
      }
      
      // 清理场景
      clearScene()
      
      // 2. 下载VTP文件
      const url = BASE_URL + current.value
      console.log('尝试下载文件:', url)
      
      let response
      try {
        response = await axios.get(url, { 
          responseType: 'arraybuffer',
          headers: { 'Cache-Control': 'no-cache' }
        })
        console.log('文件下载成功:', response.data.byteLength, '字节')
      } catch (downloadErr) {
        console.error('文件下载失败:', downloadErr)
        errorMsg.value = `文件下载失败: ${downloadErr.message}`
        throw downloadErr
      }
      
      // 3. 解析VTP文件
      console.log('解析VTP文件')
      let poly = null
      
      try {
        const reader = vtkXMLPolyDataReader.newInstance()
        reader.parseAsArrayBuffer(response.data)
        poly = reader.getOutputData(0)
        
        if (!poly) {
          errorMsg.value = '解析VTP失败: 未获取到数据'
          throw new Error('解析VTP失败: 未获取到数据')
        }
        console.log('VTP文件解析成功')
      } catch (parseErr) {
        console.error('解析VTP文件出错:', parseErr)
        errorMsg.value = `解析VTP文件出错: ${parseErr.message}`
        throw parseErr
      }
      
      // 4. 列出所有可用的数据数组
      console.log('检查可用的数据数组')
      const pointData = poly.getPointData()
      const cellData = poly.getCellData()
      
      console.log('点数据数组:')
      if (pointData) {
        const numArrays = pointData.getNumberOfArrays()
        for (let i = 0; i < numArrays; i++) {
          const array = pointData.getArray(i)
          console.log(`  - ${array.getName()} (${array.getNumberOfComponents()} 组件)`)
        }
      } else {
        console.log('  无点数据')
      }
      
      console.log('单元数据数组:')
      if (cellData) {
        const numArrays = cellData.getNumberOfArrays()
        for (let i = 0; i < numArrays; i++) {
          const array = cellData.getArray(i)
          console.log(`  - ${array.getName()} (${array.getNumberOfComponents()} 组件)`)
        }
      } else {
        console.log('  无单元数据')
      }
      
      // 5. 处理速度场数据
      console.log('处理速度场数据')
      let range = [0, 1]
      let vecU = null
      let usingCellData = false
      
      // 先尝试从点数据获取
      if (pointData) {
        vecU = pointData.getArrayByName('U')
        if (!vecU) vecU = pointData.getArrayByName('Velocity')
        if (!vecU) vecU = pointData.getArrayByName('velocity')
      }
      
      // 如果点数据中没有，尝试从单元数据获取
      if (!vecU && cellData) {
        vecU = cellData.getArrayByName('U')
        if (vecU) usingCellData = true;
        if (!vecU) {
          vecU = cellData.getArrayByName('Velocity')
          if (vecU) usingCellData = true;
        }
        if (!vecU) {
          vecU = cellData.getArrayByName('velocity')
          if (vecU) usingCellData = true;
        }
      }
      
      // 如果找到了速度场数据
      if (vecU) {
        console.log(`找到速度场数据: ${vecU.getName()}${usingCellData ? ' (在单元数据中)' : ' (在点数据中)'}`)
        
        const data = vecU.getData()
        const numValues = data.length / 3
        const magValues = new Float32Array(numValues)
        
        let min = Number.MAX_VALUE
        let max = Number.MIN_VALUE
        
        for (let i = 0; i < numValues; i++) {
          const idx = i * 3
          const mag = Math.sqrt(
            data[idx] * data[idx] + 
            data[idx+1] * data[idx+1] + 
            data[idx+2] * data[idx+2]
          )
          
          magValues[i] = mag
          min = Math.min(min, mag)
          max = Math.max(max, mag)
        }
        
        range = [min, max]
        console.log(`速度场范围: [${min.toFixed(3)}, ${max.toFixed(3)}]`)
        
        // 添加模值数组
        const magArray = vtkDataArray.newInstance({
          name: 'U_magnitude',
          values: magValues
        })
        
        // 添加到相应的数据集
        if (usingCellData) {
          cellData.addArray(magArray)
          cellData.setActiveScalars('U_magnitude')
        } else {
          pointData.addArray(magArray)
          pointData.setActiveScalars('U_magnitude')
        }
      } else {
        console.log('未找到速度场数据，使用默认颜色显示几何体')
      }
      
      // 6. 创建颜色映射和可视化管线
      console.log('创建可视化管线')
      
      // 颜色映射
      const lookupTable = vtkColorTransferFunction.newInstance()
      
      // 使用正确导入的颜色映射模块
      try {
        // 尝试获取预设颜色映射
        const preset = vtkColorMaps.getPresetByName('Cool to Warm')
        if (preset) {
          lookupTable.applyColorMap(preset)
          console.log('应用颜色映射: Cool to Warm')
        } else {
          // 如果预设不可用，手动创建颜色映射
          console.log('预设颜色映射不可用，使用手动颜色映射')
          lookupTable.addRGBPoint(range[0], 0, 0, 1) // 蓝色
          lookupTable.addRGBPoint((range[0] + range[1]) / 2, 1, 1, 1) // 白色
          lookupTable.addRGBPoint(range[1], 1, 0, 0) // 红色
        }
      } catch (colorMapError) {
        console.warn('应用颜色映射出错，使用默认颜色映射:', colorMapError)
        // 手动创建一个简单的颜色映射
        lookupTable.addRGBPoint(range[0], 0, 0, 1)
        lookupTable.addRGBPoint(range[1], 1, 0, 0)
      }
      
      lookupTable.setMappingRange(...range)
      
      // Mapper
      const mapper = vtkMapper.newInstance({
        scalarRange: range,
        useLookupTableScalarRange: true,
      })
      mapper.setInputData(poly)
      mapper.setLookupTable(lookupTable)
      mapper.setScalarVisibility(true)
      
      // 如果使用单元数据，需要设置mapper的scalarMode
      if (usingCellData) {
        mapper.setScalarMode(2) // 使用单元数据
      }
      
      // Actor
      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)
      
      // 保存Actor以便清理
      actors.push(actor)
      renderer.addActor(actor)
      
      // 7. 添加颜色条 - 使用直接设置state的方式
      if (vecU) {  
        try {
          console.log('创建颜色条')
          scalarBar = vtkScalarBarActor.newInstance()
          scalarBar.setScalarsToColors(lookupTable)
          
          // 直接设置state而不使用setPosition方法
          const state = scalarBar.getState()
          state.title = 'U (m/s)'
          state.vertical = true
          state.boxPosition = 0.88
          state.position = [0.88, 0.1]  // 尝试不同格式
          state.width = 0.1
          state.height = 0.8
          
          console.log('颜色条状态:', state)
          
          // 确保更新
          scalarBar.modified()
          
          renderer.addActor(scalarBar)
          console.log('颜色条已添加')
        } catch(barError) {
          console.error('创建颜色条时出错:', barError)
          // 如果颜色条失败，继续而不中断渲染
        }
      }
      
      // 8. 重置相机并渲染
      console.log('渲染场景')
      renderer.resetCamera()
      renderWindow.render()
      
      console.log('渲染完成')
    } catch (err) {
      console.error('加载过程中出错:', err)
      if (!errorMsg.value) {
        errorMsg.value = `出错: ${err.message}`
      }
    } finally {
      loading.value = false
    }
  }
  
  // 窗口大小变化处理
  function handleResize() {
    if (fullScreenRenderer) {
      fullScreenRenderer.resize()
    }
  }
  
  onMounted(() => {
    console.log('组件已挂载, vtkDiv:', vtkDiv.value ? '可用' : '不可用')
    if (vtkDiv.value) {
      window.addEventListener('resize', handleResize)
      
      // 延迟初始化确保DOM已就绪
      setTimeout(() => {
        loadVtp()
      }, 100)
    } else {
      errorMsg.value = 'VTK容器不可用'
    }
  })
  
  onBeforeUnmount(() => {
    console.log('组件卸载，清理资源')
    window.removeEventListener('resize', handleResize)
    
    // 清理资源
    if (fullScreenRenderer) {
      fullScreenRenderer.delete()
      fullScreenRenderer = null
    }
  })
  </script>
  
  <style scoped>
  .viewer-panel { 
    width: 100%; 
    height: 100%; 
    position: relative; 
    overflow: hidden;
  }
  select {
    position: absolute; 
    left: 12px; 
    top: 12px; 
    z-index: 10;
    padding: 4px 8px; 
    border-radius: 4px; 
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.8);
    border: 1px solid #ccc;
  }
  .vtk-box { 
    width: 100%; 
    height: 100%; 
    position: absolute;
    top: 0;
    left: 0;
  }
  .loading { 
    position: absolute; 
    left: 50%; 
    top: 50%;
    transform: translate(-50%, -50%); 
    color: #eee;
    background: rgba(0,0,0,0.5);
    padding: 10px 20px;
    border-radius: 4px;
  }
  .error-message {
    position: absolute; 
    left: 50%; 
    top: 60%;
    transform: translate(-50%, -50%); 
    color: #ff6b6b; 
    background: rgba(0,0,0,0.7);
    padding: 8px 16px;
    border-radius: 4px;
    max-width: 80%;
    text-align: center;
  }
  </style>