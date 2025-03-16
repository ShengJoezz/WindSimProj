<!--
 * @Author: joe 847304926@qq.com
 * @Date: 2025-03-16 19:08:49
 * @LastEditors: joe 847304926@qq.com
 * @LastEditTime: 2025-03-16 19:10:22
 * @FilePath: \\wsl.localhost\Ubuntu-22.04\home\joe\wind_project\WindSimProj\frontend\src\views\Home.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by joe, All Rights Reserved.
-->

<template>
  <div class="home-container">
    <div class="banner" ref="banner">
      <div class="wave-container">
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="wave"></div>
      </div>
      <div id="particles-js"></div>
      <!-- LOGO -->
      <div class="logo-container">
        <img src="/HUST_LOGO.png" alt="HUST Logo" class="logo" />
      </div>
      <div class="title-group">
        <h1 class="title" data-text="风流场模拟平台">风流场模拟平台</h1>
        <h2 class="subtitle">华中科技大学 刘震卿教授课题组</h2>
      </div>
      <p class="description">
        致力于前沿技术研究，提供高效、精准的复杂地形风流场仿真解决方案。
      </p>
      <div class="scroll-down" @click="scrollToIntro">
        <i class="fas fa-chevron-down"></i>
      </div>
    </div>
    <div class="content-section">
      <div v-if="caseId" class="map-section" ref="mapSection">
        <TerrainMap :caseId="caseId" />
      </div>
      <div v-else class="intro-section" ref="introSection">
        <div class="intro-card" v-for="(item, index) in features" :key="index">
          <div class="intro-icon-wrapper">
            <i :class="item.icon"></i>
          </div>
          <h4 class="intro-title">{{ item.title }}</h4>
          <p class="intro-text">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');

.home-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  font-family: 'Segoe UI', 'PingFang SC', '微软雅黑', sans-serif;
}

.banner {
  height: 90vh;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  text-align: center;
  background: linear-gradient(135deg, #213462 0%, #102040 100%);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.logo-container {
  position: relative;
  z-index: 10;
  margin-bottom: 20px;
  margin-top: -20px;
  animation: fadeIn 1.2s ease-out;
}

.logo {
  width: 200px;
  height: auto;
  z-index: 2;
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.02);
}

.wave-container {
  position: absolute;
  width: 100%;
  height: 100%;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 200%;
  height: 100%;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="rgba(255,255,255,0.05)" d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,112C672,107,768,149,864,165.3C960,181,1056,171,1152,144C1248,117,1344,75,1392,53.3L1440,32L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>') repeat-x;
  animation: wave 25s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite;
  transform-origin: center bottom;
  opacity: 0.3;
}

.wave:nth-of-type(2) {
  animation: wave 20s cubic-bezier(0.36, 0.45, 0.63, 0.53) -.125s infinite, swell 7s ease -1.25s infinite;
  opacity: 0.2;
}

.wave:nth-of-type(3) {
  animation: wave 15s cubic-bezier(0.36, 0.45, 0.63, 0.53) -.25s infinite, swell 7s ease -2.5s infinite;
  opacity: 0.1;
}

@keyframes wave {
  0% { transform: translateX(0); }
  50% { transform: translateX(-25%); }
  100% { transform: translateX(-50%); }
}

@keyframes swell {
  0%, 100% { transform: translateY(-5px); }
  50% { transform: translateY(5px); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

#particles-js {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 0;
}

.title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
  margin-bottom: 10px;
}

.title {
  font-size: 3.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #ffffff, #e6f0ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 10px rgba(255,255,255,0.15);
  position: relative;
  display: inline-block;
  letter-spacing: 0.5px;
}

.title::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  top: 0;
  color: rgba(255,255,255,0.8);
  text-shadow: 0 0 5px rgba(255,255,255,0.15),
              0 0 10px rgba(255,255,255,0.15);
  z-index: -1;
  filter: blur(3px);
}

.subtitle {
  font-size: 1.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2rem;
  opacity: 0;
  animation: fadeInUp 1s ease forwards;
  animation-delay: 0.5s;
}

.description {
  font-size: 1.2rem;
  line-height: 1.8;
  max-width: 800px;
  margin: 0 auto;
  color: rgba(255, 255, 255, 0.9);
  padding: 0 2rem;
  opacity: 0;
  animation: fadeInUp 1s ease forwards;
  animation-delay: 1s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.content-section {
  padding: 5rem 0;
  background: #f5f7fa;
}

.intro-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.intro-card {
  background: white;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  opacity: 0;
  animation: fadeInUp 1s ease forwards;
  border: 1px solid rgba(230, 235, 245, 0.7);
}

.intro-card:nth-child(1) { animation-delay: 0.3s; }
.intro-card:nth-child(2) { animation-delay: 0.6s; }
.intro-card:nth-child(3) { animation-delay: 0.9s; }

.intro-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
}

.intro-icon-wrapper {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #213462, #304b7a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  transition: transform 0.3s ease;
  animation: float 3s ease-in-out infinite;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
}

.intro-icon-wrapper i {
  font-size: 2rem;
  color: white;
}

.intro-title {
  color: #213462;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  position: relative;
  padding-bottom: 0.5rem;
}

.intro-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 2px;
  background: #213462;
  border-radius: 2px;
}

.intro-text {
  color: #4a5568;
  line-height: 1.8;
  font-size: 1rem;
}

.scroll-down {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 2;
  animation: bounce 2s infinite;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.scroll-down:hover {
  background: rgba(255, 255, 255, 0.2);
}

.scroll-down i {
  font-size: 20px;
  color: white;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  40% {
    transform: translateX(-50%) translateY(-10px);
  }
  60% {
    transform: translateX(-50%) translateY(-5px);
  }
}

html {
  scroll-behavior: smooth;
}

.intro-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at var(--x) var(--y),
              rgba(255,255,255,0.3) 0%,
              rgba(255,255,255,0) 50%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.intro-card:hover::after {
  opacity: 1;
}

@media (max-width: 768px) {
  .banner {
    height: 100vh;
  }
  
  .title {
    font-size: 2.5rem;
  }

  .subtitle {
    font-size: 1.5rem;
  }
  
  .description {
    font-size: 1.1rem;
    padding: 0 1.5rem;
  }

  .intro-section {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 0 1.5rem;
  }
  
  .intro-card {
    padding: 2rem 1.5rem;
  }
  
  .logo {
    width: 180px;
  }
  
  .content-section {
    padding: 4rem 0;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 2.2rem;
  }
  
  .subtitle {
    font-size: 1.3rem;
  }
  
  .description {
    font-size: 1rem;
    padding: 0 1rem;
  }
}
</style>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import TerrainMap from '../components/TerrainMap/TerrainMap.vue';


const route = useRoute();
const caseId = computed(() => route.params.caseId || null);
const banner = ref(null);
const mapSection = ref(null);
const introSection = ref(null);

const features = [
  {
    icon: 'fas fa-cogs',
    title: '高效计算',
    description: '利用先进的计算流体力学 (CFD) 技术，提供快速、准确的模拟结果.'
  },
  {
    icon: 'fas fa-mountain',
    title: '复杂地形',
    description: '精确模拟各种复杂地形条件下的风流场，包括山脉、峡谷、城市等.'
  },
  {
    icon: 'fas fa-chart-line',
    title: '数据可视化',
    description: '提供丰富的数据可视化工具，帮助用户直观地理解模拟结果.'
  }
];

onMounted(() => {
  // 配置particles.js
  window.particlesJS && window.particlesJS('particles-js', {
    particles: {
      number: { value: 80, density: { enable: true, value_area: 800 } },
      color: { value: '#ffffff' },
      shape: { type: 'circle' },
      opacity: {
        value: 0.5,
        random: true,
        anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false }
      },
      size: {
        value: 3,
        random: true,
        anim: { enable: false }
      },
      line_linked: {
        enable: true,
        distance: 150,
        color: '#ffffff',
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 2,
        direction: 'none',
        random: false,
        straight: false,
        out_mode: 'out',
        bounce: false
      }
    },
    interactivity: {
      detect_on: 'canvas',
      events: {
        onhover: { enable: true, mode: 'grab' },
        onclick: { enable: true, mode: 'push' },
        resize: true
      }
    },
    retina_detect: true
  });
  const cards = document.querySelectorAll('.intro-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--x', `${x}px`);
        card.style.setProperty('--y', `${y}px`);
      });
    });
});

const scrollToMap = () => {
  mapSection.value?.scrollIntoView({ behavior: 'smooth' });
};
const scrollToIntro = () => {
    introSection.value?.scrollIntoView({ behavior: 'smooth' });
};
</script>