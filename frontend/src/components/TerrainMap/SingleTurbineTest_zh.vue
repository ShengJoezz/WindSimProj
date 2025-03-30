<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-30 14:50:03
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-30 14:53:49
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\components\TerrainMap\SingleTurbineTest_zh.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
    <div class="test-wrapper-zh">
      <div class="controls-zh">
        <h3>风机测试控制器</h3>
        <div v-if="isLoading">正在加载模型...</div>
        <div v-if="errorMsg" class="error-zh">{{ errorMsg }}</div>
  
        <div v-if="!isLoading && !errorMsg">
          <el-form label-position="top">
             <el-form-item label="启用旋转">
               <el-switch v-model="rotationEnabled" />
             </el-form-item>
             <el-form-item label="旋转速度">
               <el-slider v-model="rotationSpeed" :min="0" :max="5" :step="0.1" show-input />
             </el-form-item>
             <el-form-item label="旋转轴">
               <el-radio-group v-model="rotationAxis">
                 <el-radio label="x">X 轴</el-radio>
                 <el-radio label="y">Y 轴</el-radio>
                 <el-radio label="z">Z 轴</el-radio>
               </el-radio-group>
               <small> (模型局部坐标系选择 - 你已确认 Y 轴正确)</small>
             </el-form-item>
             <el-divider />
             <h4>组件可见性 (用于调试重叠问题)</h4>
             <el-form-item label="主单元可见 (Main Unit)">
               <el-switch v-model="mainUnitVisible" @change="toggleVisibility('main', $event)" />
               <!-- !! 确保这个常量与模型实际名称一致 !! -->
               <small> (模型名: {{ MAIN_UNIT_NAME }})</small>
             </el-form-item>
             <el-form-item label="叶片可见 (Blades)">
               <el-switch v-model="bladesVisible" @change="toggleVisibility('blades', $event)" />
               <!-- !! 确保这个常量与模型实际名称一致 !! -->
               <small> (模型名: {{ BLADES_NAME }})</small>
             </el-form-item>
             <el-divider />
              <el-button @click="resetRotation">重置叶片旋转</el-button>
              <el-button type="primary" @click="logCurrentState">记录当前状态到控制台</el-button>
              <el-button type="warning" @click="printCurrentModelStructure">打印当前实例结构</el-button> <!-- 新增按钮 -->
          </el-form>
        </div>
      </div>
      <div class="renderer-container-zh" ref="containerRef"></div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount, watch, shallowRef, nextTick } from 'vue'; // 引入 nextTick
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
  import { ElSwitch, ElSlider, ElRadioGroup, ElRadio, ElForm, ElFormItem, ElDivider, ElButton } from 'element-plus';
  
  // --- 配置项 ---
  const MODEL_PATH = '/models/wind_turbine/scene.gltf';
  const INITIAL_SCALE = 0.1;
  // !!! 请再次确认这两个名称与你在控制台看到的模型结构日志完全一致 !!!
  const MAIN_UNIT_NAME = 'Main_Unit_WindTurbine_PBR_0';
  const BLADES_NAME = 'Blades_WindTurbine_PBR_0';
  
  // --- UI 控制相关的 Ref ---
  const rotationEnabled = ref(true);
  const rotationSpeed = ref(1.0);
  const rotationAxis = ref('y'); // 已确认 Y 轴正确
  const mainUnitVisible = ref(true);
  const bladesVisible = ref(true);
  const isLoading = ref(true);
  const errorMsg = ref('');
  
  // --- Three.js 相关的 Ref ---
  const containerRef = ref(null);
  let scene, camera, renderer, controls;
  let turbineInstance = null;
  let bladeComponents = shallowRef([]);
  let loadedModelTemplate = null;
  let animationFrameId = null;
  // 修改：不再在 optimize 函数中赋值，改为在 addTurbineInstance 中使用 traverse 获取
  let mainUnitObject = null;
  let bladesObject = null;
  
  // --- 日志助手 ---
  const log = (...args) => console.log('[风机测试]', ...args);
  
  // --- 核心 Three.js 函数 (initThree 不变) ---
  const initThree = () => {
    if (!containerRef.value) {
        log('错误：渲染容器尚未准备好。');
        return;
    }
    log('初始化 Three.js 场景...');
    // ... (initThree 的其余代码保持不变) ...
     const width = containerRef.value.clientWidth;
      const height = containerRef.value.clientHeight;
        // 场景
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xcccccc); // 设置一个中性的背景色
      log('场景已创建');
        // 相机
      camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
      // 稍微调整相机位置和目标点，确保能看到原点附近的物体
      const cameraDist = 15 / INITIAL_SCALE; // 根据缩放调整距离
      camera.position.set(cameraDist * 0.7, cameraDist * 0.5, cameraDist);
      camera.lookAt(0, 5 / INITIAL_SCALE * 0.5, 0); // 稍微抬高视点，看向模型中部
      log('相机已创建并定位');
        // 渲染器
      renderer = new THREE.WebGLRenderer({ antialias: true }); // 开启抗锯齿
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio); // 适配高分屏
      containerRef.value.appendChild(renderer.domElement);
      log('渲染器已创建并添加到容器');
        // 控制器 (用于鼠标交互)
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; // 开启阻尼效果，使旋转更平滑
      controls.dampingFactor = 0.1;
      controls.screenSpacePanning = false; // 通常设置为 false
      // controls.target.set(0, 5 / INITIAL_SCALE * 0.5, 0); // 让控制器也围绕模型中部旋转
      log('轨道控制器已创建');
        // 光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 环境光，整体提亮
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // 平行光，模拟太阳光
      directionalLight.position.set(50, 100, 50); // 设置光源位置
      scene.add(directionalLight);
      log('光照已添加');
        // 坐标轴助手 (非常重要，用于调试旋转!)
      // 红: X轴, 绿: Y轴, 蓝: Z轴
      const axesHelper = new THREE.AxesHelper(10); // 坐标轴长度为 10 个单位
      scene.add(axesHelper);
      log('世界坐标轴助手已添加 (红=X, 绿=Y, 蓝=Z)');
        log('Three.js 初始化完成。');
  };
  
  
  // --- 模型加载与处理 ---
  
  /**
   * @description: 遍历模型，设置初始可见性，并检查重叠问题（不再负责获取 mainUnitObject/bladesObject 的持久引用）
   * @param {THREE.Group} modelGroup - 克隆后的模型实例
   */
  const setupInitialVisibilityAndCheckOverlap = (modelGroup) => {
    log('[模型设置] 开始遍历设置初始可见性并检查重叠...');
    let foundMainUnitInTraverse = false;
    let foundBladesInTraverse = false;
  
    modelGroup.traverse((child) => {
      // 打印遍历到的对象名称，用于核对
      log(`[模型设置] Traversing: ${child.name} (类型: ${child.type})`);
  
      // 设置叶片初始可见性
      if (child.name === BLADES_NAME) {
          log(`[模型设置] > 找到叶片组件: ${child.name}，设置初始可见性为: ${bladesVisible.value}`);
          child.visible = bladesVisible.value;
          foundBladesInTraverse = true;
      }
      // 设置主单元初始可见性，并检查重叠
      else if (child.name === MAIN_UNIT_NAME) {
          log(`[模型设置] > 找到主单元组件: ${child.name}，设置初始可见性为: ${mainUnitVisible.value}`);
          child.visible = mainUnitVisible.value;
          foundMainUnitInTraverse = true;
  
          // 重叠检查逻辑保持不变
          if (child.isMesh && child.geometry.attributes.position.count > 1000) {
               log(`[模型设置] >> 警告: 主单元 "${child.name}" 顶点数 (${child.geometry.attributes.position.count}) > 1000，可能包含静态叶片！`);
               // 在这里根据需要取消注释调试选项 (强制隐藏或半透明)
               // child.visible = false; // 强制隐藏测试
               // if(child.material){ ... child.material.transparent = true; ... } // 半透明测试
          } else if (child.isMesh) {
               log(`[模型设置] > 主单元 "${child.name}" 顶点数 (${child.geometry.attributes.position.count}) <= 1000`);
          }
      }
      // 设置阴影
      if(child.isMesh){
          child.castShadow = true;
          child.receiveShadow = true;
      }
    });
  
    // 检查遍历结果
    if (!foundMainUnitInTraverse) {
        log(`[模型设置] >> 警告: 在遍历过程中未能找到名称为 "${MAIN_UNIT_NAME}" 的对象！`);
    }
    if (!foundBladesInTraverse) {
        log(`[模型设置] >> 警告: 在遍历过程中未能找到名称为 "${BLADES_NAME}" 的对象！`);
    }
    log('[模型设置] 遍历设置完毕。');
    // 注意：这个函数不再返回 modelGroup，因为它直接修改传入的对象
  };
  
  
  // findBladeComponents 函数保持不变，因为它仍然需要找到用于旋转的组件
  const findBladeComponents = (model) => {
    // ... (findBladeComponents 代码不变) ...
     log('[查找叶片] 开始在模型中查找叶片组件...');
      const blades = [];
      model.traverse((child) => {
        // 主要通过精确名称查找
        if (child.name === BLADES_NAME) {
          log(`[查找叶片] >> 找到匹配名称的组件: ${child.name}`);
          blades.push(child);
        }
        // 可选: 如果名称不确定，可以添加其他检查逻辑，比如检查名称模式或对象类型
        // else if (child.isMesh && child.name.toLowerCase().includes('blade')) { ... }
      });
      if (blades.length === 0) {
           log(`[查找叶片] >> 警告: 未找到名称为 "${BLADES_NAME}" 的叶片组件！旋转可能无法工作。`);
      } else {
           log(`[查找叶片] 成功找到 ${blades.length} 个叶片组件。`);
      }
      return blades;
  };
  
  // loadModel 函数保持不变
  const loadModel = () => {
    // ... (loadModel 代码不变) ...
    return new Promise((resolve, reject) => {
        // 如果已经加载过，直接使用缓存的模板
        if (loadedModelTemplate) {
          log('[加载模型] 使用已缓存的模型模板。');
          resolve(loadedModelTemplate);
          return;
        }
  
        log(`[加载模型] 开始从路径加载模型: ${MODEL_PATH}`);
        const loader = new GLTFLoader();
        loader.load(
          MODEL_PATH,
          // 加载成功回调
          (gltf) => {
            log('[加载模型] 模型 GLTF 文件加载成功！');
            loadedModelTemplate = gltf.scene; // 存储模板供后续克隆
  
            // --- 关键日志：打印加载后的模型结构 ---
            log('[加载模型] --- 打印原始模型结构 ---');
            let hierarchy = '';
            loadedModelTemplate.traverse((child) => {
                let indent = '';
                let current = child;
                // 修正缩进逻辑
                let depth = 0;
                while(current.parent && current.parent !== loadedModelTemplate.parent ) { // 找到根节点为止
                     depth++;
                     current = current.parent;
                }
                 indent = '  '.repeat(depth);
  
                hierarchy += `${indent}- ${child.name || '[未命名]'} (${child.type})`;
                if (child.isMesh) {
                     hierarchy += ` [顶点数: ${child.geometry.attributes.position.count}]\n`;
                } else {
                     hierarchy += '\n';
                }
            });
            console.log(hierarchy); // 使用 console.log 避免被自定义 log 函数截断
            log('[加载模型] --- 原始模型结构打印完毕 ---');
            // -------------------------------------
  
            resolve(loadedModelTemplate);
          },
          // 加载进度回调 (可选)
          (xhr) => {
             const percent = Math.round(xhr.loaded / xhr.total * 100);
             if (percent % 25 === 0 && percent < 100) { // 避免打印 100%
                 log(`[加载模型] 加载进度: ${percent}%`);
             }
          },
          // 加载错误回调
          (error) => {
            log('[加载模型] !!! GLTF 模型加载失败:', error);
            errorMsg.value = `模型加载失败: ${error.message || '未知错误'}`;
            isLoading.value = false;
            reject(error);
          }
        );
      });
  };
  
  /**
   * @description: 克隆模型模板，进行设置，并添加到场景中
   */
  const addTurbineInstance = () => {
      if (!loadedModelTemplate) { /* ...错误处理不变... */ return; }
      if (turbineInstance) { /* ...移除旧实例不变... */
           log('[添加实例] 警告: 已存在风机实例，正在移除旧实例...');
           // 确保清理 BoxHelper
            const helpersToRemove = [];
            scene.traverse(obj => {
                if (obj.isBoxHelper && obj.object && (obj.object === bladesObject || obj.object === mainUnitObject)) {
                    helpersToRemove.push(obj);
                }
            });
             helpersToRemove.forEach(helper => scene.remove(helper));
  
            scene.remove(turbineInstance);
            mainUnitObject = null;
            bladesObject = null;
            bladeComponents.value = []; // 清空叶片组件数组
      }
  
      log('[添加实例] 正在克隆模型模板...');
      turbineInstance = loadedModelTemplate.clone();
      log('[添加实例] 模型克隆完成。');
  
      log('[添加实例] 设置实例的初始缩放、位置和旋转...');
      turbineInstance.scale.set(INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE);
      turbineInstance.position.set(0, 0, 0);
      turbineInstance.rotation.set(0, 0, 0);
      log(`[添加实例] > 缩放: ${INITIAL_SCALE}, 位置: (0,0,0), 旋转: (0,0,0)`);
  
      // --- 修改点：在添加到场景之前，先遍历查找对象引用 ---
      log('[添加实例] 开始遍历实例以查找主单元和叶片对象...');
      mainUnitObject = null; // 重置引用
      bladesObject = null;  // 重置引用
      let foundMain = false;
      let foundBlades = false;
  
      turbineInstance.traverse((child) => {
          // 打印遍历到的对象名称，用于确认
          // log(`[添加实例] Traversing: ${child.name} (${child.type})`); // 可以取消注释详细查看
  
          if (!foundMain && child.name === MAIN_UNIT_NAME) {
              mainUnitObject = child;
              foundMain = true; // 找到后停止查找，避免重复赋值
              log(`[添加实例] > 成功在遍历中找到 mainUnitObject: "${mainUnitObject.name}"`);
          }
          if (!foundBlades && child.name === BLADES_NAME) {
              bladesObject = child;
              foundBlades = true; // 找到后停止查找
              log(`[添加实例] > 成功在遍历中找到 bladesObject: "${bladesObject.name}"`);
          }
          // 如果两个都找到了，可以提前结束遍历（可选优化）
          // if (foundMain && foundBlades) {
          //    // throw new Error('Found both, stop traverse'); // 简单粗暴的方式，或者设置标志位
          // }
      });
  
      // 检查查找结果
      if (!mainUnitObject) {
           log(`[添加实例] >> 警告: 遍历结束后未能找到主单元对象 "${MAIN_UNIT_NAME}"！请再次核对名称和结构。`);
      }
      if (!bladesObject) {
           log(`[添加实例] >> 警告: 遍历结束后未能找到叶片对象 "${BLADES_NAME}"！旋转功能可能失效。`);
           bladeComponents.value = [];
      } else {
           // 如果找到了叶片对象，调用 findBladeComponents (尽管此时 bladeComponents 可能就是 [bladesObject])
           bladeComponents.value = findBladeComponents(turbineInstance); // 或者直接 bladeComponents.value = [bladesObject];
      }
  
  
      // --- 现在可以将实例添加到场景 ---
      scene.add(turbineInstance);
      log('[添加实例] 风机实例已添加到场景。');
  
  
      // --- 添加 BoxHelper (使用已经获取到的引用) ---
      if (mainUnitObject) {
          const mainUnitBoxHelper = new THREE.BoxHelper(mainUnitObject, 0x00ffff); // 青色
          mainUnitBoxHelper.name = "MainUnitBoxHelper"; // 给 Helper 也起个名字
          scene.add(mainUnitBoxHelper);
          log(`[添加实例] 已为主单元组件添加青色 BoxHelper。`);
      }
      if (bladesObject) {
          const bladeBoxHelper = new THREE.BoxHelper(bladesObject, 0xffff00); // 黄色
          bladeBoxHelper.name = "BladesBoxHelper"; // 给 Helper 也起个名字
          scene.add(bladeBoxHelper);
          log(`[添加实例] 已为叶片组件添加黄色 BoxHelper。`);
      }
  
      // --- 设置初始可见性和检查重叠 ---
      // 这个函数现在可以正确工作，因为它依赖的 mainUnitObject 和 bladesObject 应该有值了
      setupInitialVisibilityAndCheckOverlap(turbineInstance); // 确保这个函数内部不再尝试赋值
  
      log('[添加实例] 风机实例设置和添加到场景流程完毕。');
  };
  
  // --- 动画循环 (animate 函数不变) ---
  let frameCounter = 0;
  const animate = () => {
    // ... (animate 代码不变) ...
     animationFrameId = requestAnimationFrame(animate);
      frameCounter++;
  
      controls.update(); // 更新轨道控制器状态
  
      // --- 旋转逻辑 ---
      // 确保 bladesObject 存在才进行旋转
      if (rotationEnabled.value && bladesObject && bladeComponents.value.length > 0) {
        const deltaRotation = 0.01 * rotationSpeed.value;
  
        // 对找到的所有叶片组件应用旋转
        // 通常 bladeComponents 数组里只有一个元素，即 bladesObject
        bladeComponents.value.forEach(blade => {
          switch (rotationAxis.value) {
            case 'x': blade.rotation.x += deltaRotation; break;
            case 'y': blade.rotation.y += deltaRotation; break;
            case 'z': blade.rotation.z += deltaRotation; break;
          }
        });
  
        // 限制频率的日志
        if (frameCounter % 120 === 0) {
            log(`[动画循环] 正在绕 ${rotationAxis.value.toUpperCase()} 轴旋转叶片 "${bladesObject.name}"。 ` +
                `欧拉角(rad): x=${bladesObject.rotation.x.toFixed(2)}, y=${bladesObject.rotation.y.toFixed(2)}, z=${bladesObject.rotation.z.toFixed(2)}`);
        }
      } else if (rotationEnabled.value && !bladesObject) {
           if (frameCounter % 120 === 0) { // 避免频繁打印
              log(`[动画循环] 警告: 旋转已启用，但未找到叶片对象 (bladesObject)，无法旋转。`);
           }
      }
  
      renderer.render(scene, camera);
  };
  
  // --- UI 交互函数 ---
  
  // toggleVisibility 函数现在应该可以正常工作了，因为它依赖的 mainUnitObject 和 bladesObject
  // 是在 addTurbineInstance 中通过 traverse 获取的
  const toggleVisibility = (componentType, isVisible) => {
      // ... (toggleVisibility 代码基本不变，但现在 mainUnitObject/bladesObject 应该有值了) ...
       if (!turbineInstance) {
            log('[切换可见性] 错误: 风机实例不存在。');
            return;
        }
        const targetName = componentType === 'main' ? MAIN_UNIT_NAME : BLADES_NAME;
        // **使用已经获取的引用**
        const targetObject = componentType === 'main' ? mainUnitObject : bladesObject;
  
        log(`[切换可见性] 用户操作: 将 "${targetName}" 的可见性设置为: ${isVisible}`);
  
        if (targetObject) {
            targetObject.visible = isVisible;
            log(`[切换可见性] > 成功将对象 "${targetObject.name}" 的 visible 属性设置为 ${isVisible}`);
            // 更新 BoxHelper 可见性
            scene.traverse(obj => {
                if (obj.isBoxHelper && obj.object === targetObject) {
                    obj.visible = isVisible;
                    log(`[切换可见性] > 同时更新了 "${targetObject.name}" 的 BoxHelper 可见性`);
                }
            });
        } else {
             // 如果 traverse 查找仍然失败了，这里仍然会是 null
            log(`[切换可见性] >> 警告: 仍然未能获取 "${targetName}" 的对象引用，无法切换可见性。请检查名称或使用 '打印当前实例结构' 按钮。`);
        }
  };
  
  
  // resetRotation 函数不变
  const resetRotation = () => {
      // ... (resetRotation 代码不变) ...
       // **依赖 bladesObject**
      if (bladesObject && bladeComponents.value.length > 0) {
            log('[重置旋转] 用户操作: 重置叶片旋转');
            // 通常我们直接重置 bladesObject 的旋转即可
            bladesObject.rotation.set(0, 0, 0);
            log(`[重置旋转] > 已重置叶片对象 "${bladesObject.name}" 的 rotation`);
            // 如果 bladeComponents 包含多个对象，也需要重置
            bladeComponents.value.forEach((blade, index) => {
                if (blade !== bladesObject) { // 避免重复重置
                   blade.rotation.set(0, 0, 0);
                   log(`[重置旋转] > (额外) 已重置第 ${index + 1} 个叶片组件 "${blade.name}" 的 rotation`);
                }
            });
        } else {
            log('[重置旋转] 警告: 未找到叶片对象或组件，无法重置旋转。');
        }
  };
  
  // logCurrentState 函数不变
  const logCurrentState = () => {
      // ... (logCurrentState 代码不变) ...
       log('--- 记录当前状态 ---');
        log('UI 控制状态:');
        log(`  > 启用旋转: ${rotationEnabled.value}`);
        log(`  > 旋转速度: ${rotationSpeed.value}`);
        log(`  > 旋转轴: ${rotationAxis.value}`);
        log(`  > 主单元可见 (UI): ${mainUnitVisible.value}`);
        log(`  > 叶片可见 (UI): ${bladesVisible.value}`);
        log('Three.js 状态:');
        if (turbineInstance) {
            log(`  > 风机实例 (turbineInstance):`, turbineInstance); // 可以展开查看对象详情
            log(`  > 主单元对象引用 (mainUnitObject):`, mainUnitObject); // 现在应该有值了
            if(mainUnitObject){
                 log(`    >> 主单元实际可见性 (mainUnitObject.visible): ${mainUnitObject.visible}`);
            } else {
                 log(`    >> 主单元对象引用为 null!`);
            }
            log(`  > 叶片对象引用 (bladesObject):`, bladesObject); // 现在应该有值了
             if(bladesObject){
                 log(`    >> 叶片实际可见性 (bladesObject.visible): ${bladesObject.visible}`);
                 log(`    >> 叶片当前旋转 (欧拉角): x=${bladesObject.rotation.x.toFixed(3)}, y=${bladesObject.rotation.y.toFixed(3)}, z=${bladesObject.rotation.z.toFixed(3)}`);
             } else {
                 log(`    >> 叶片对象引用为 null!`);
             }
            log(`  > 找到的叶片组件数组 (bladeComponents):`, bladeComponents.value.map(b=>b.name));
  
        } else {
            log('  > 风机实例 (turbineInstance): 尚未添加或已被移除。');
        }
        log('---------------------');
  };
  
  // --- 新增：打印当前 turbineInstance 的结构 ---
  const printCurrentModelStructure = () => {
      if (!turbineInstance) {
          log('[打印结构] 错误: 当前没有风机实例 (turbineInstance 为 null)。');
          return;
      }
      log('[打印结构] --- 打印当前风机实例 (turbineInstance) 的结构 ---');
      let hierarchy = '';
      turbineInstance.traverse((child) => {
          let indent = '';
          let current = child;
          let depth = 0;
          while(current.parent && current !== turbineInstance.parent) { // 修正：遍历到实例的父节点（即 scene）为止
               depth++;
               current = current.parent;
               if (depth > 20) break; // 防止无限循环
          }
           indent = '  '.repeat(depth);
  
          hierarchy += `${indent}- ${child.name || '[未命名]'} (${child.type})`;
          if (child.isMesh) {
               hierarchy += ` [顶点数: ${child.geometry?.attributes?.position?.count || 'N/A'}]`; // 添加安全检查
          }
          // 可以添加更多信息，例如可见性
          hierarchy += ` [可见: ${child.visible}]`;
          hierarchy += '\n';
      });
      console.log(hierarchy);
      log('[打印结构] --- 当前实例结构打印完毕 ---');
  };
  
  
  // --- Vue 生命周期钩子 (onMounted, onBeforeUnmount 基本不变) ---
  onMounted(async () => {
      // ... (确保 DOM 容器存在) ...
      if (!containerRef.value) {
          await nextTick();
      }
        if (!containerRef.value) {
          errorMsg.value = "无法找到渲染容器 DOM 元素。";
          isLoading.value = false;
          return;
      }
  
      initThree();
  
      try {
        await loadModel();
        addTurbineInstance(); // 调用修改后的添加实例函数
        isLoading.value = false;
        log('测试组件挂载完成，开始动画循环。');
        animate();
      } catch (err) {
        log('在 onMounted 过程中发生错误。');
        isLoading.value = false;
      }
  });
  
  onBeforeUnmount(() => {
      // ... (清理逻辑不变) ...
       log('[生命周期] 组件即将卸载，开始清理 Three.js 资源...');
      // 1. 停止动画循环
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        log('> 动画循环已停止');
      }
      // 2. 销毁控制器
      if (controls) {
        controls.dispose();
        controls = null;
        log('> 控制器已销毁');
      }
      // 3. 深度清理场景中的对象和几何体/材质
      if (scene) {
        log('> 开始清理场景对象...');
        // 移除并销毁包围盒助手
        const helpersToRemove = [];
        scene.traverse(obj => {
            // **修改：通过名字或类型清理**
            if (obj.isBoxHelper || obj.name === "MainUnitBoxHelper" || obj.name === "BladesBoxHelper") {
                helpersToRemove.push(obj);
            }
        });
        helpersToRemove.forEach(helper => {
             if (helper.parent) helper.parent.remove(helper); // 从父节点移除
             // BoxHelper 通常不需要 dispose
             log('  >> 移除了 BoxHelper');
          });
          // ... 其他场景清理 ...
           // 移除并销毁风机实例
          if (turbineInstance) { /* ... */ scene.remove(turbineInstance); /* ... */ }
          scene = null;
      }
      // ... 其他清理 ...
  });
  
  </script>
  
  <style scoped>
  /* 样式保持不变 */
  /* ... */
  .test-wrapper-zh { display: flex; width: 100%; height: 100vh; overflow: hidden; border: 2px solid blue;}
  .controls-zh { width: 320px; padding: 20px; border-right: 1px solid #ccc; overflow-y: auto; background-color: #f8f8f8; box-sizing: border-box;}
  .controls-zh h3, .controls-zh h4 { margin-top: 0; margin-bottom: 15px; color: #333;}
  .renderer-container-zh { flex-grow: 1; height: 100%; position: relative; background-color: #e0e0e0;}
  .error-zh { color: #F56C6C; font-weight: bold; margin-top: 10px; padding: 8px; background-color: #fef0f0; border: 1px solid #fbc4c4; border-radius: 4px;}
  .el-form-item { margin-bottom: 10px;}
  .el-form-item small { color: #909399; font-size: 12px; line-height: 1.5; display: block; margin-top: 2px;}
  .el-divider { margin: 16px 0;}
  :deep(.renderer-container-zh canvas) { display: block; width: 100%; height: 100%;}
  </style>