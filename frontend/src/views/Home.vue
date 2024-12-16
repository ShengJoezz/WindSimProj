<template>
  <div class="home-container">
    <div class="banner" ref="banner">
      <div class="overlay"></div>
      <div id="particles-js"></div>

      <img src="/HUST_LOGO.png" alt="HUST Logo" class="logo" /> <div class="title-group">
        <h1 class="title">风流场模拟平台</h1>
        <h2 class="subtitle">华中科技大学 刘震卿教授课题组</h2>
      </div>
       <p class="description">
        致力于前沿技术研究，提供高效、精准的复杂地形风流场仿真解决方案。
      </p>
      <div class="scroll-down" @click="scrollToMap">
        <i class="fas fa-chevron-down"></i>
      </div>
    </div>
    <div v-if="caseId" class="map-section" ref="mapSection">
      <TerrainMap :caseId="caseId" />
    </div>
    <div v-else class="intro-section">
      <div class="intro-card">
        <div class="intro-icon-wrapper">
          <i class="fas fa-cogs intro-icon"></i>
        </div>
        <h4 class="intro-title">高效计算</h4>
        <p class="intro-text">
          利用先进的计算流体力学 (CFD) 技术，提供快速、准确的模拟结果。
        </p>
      </div>
      <div class="intro-card">
        <div class="intro-icon-wrapper">
          <i class="fas fa-mountain intro-icon"></i>
        </div>
        <h4 class="intro-title">复杂地形</h4>
        <p class="intro-text">
          精确模拟各种复杂地形条件下的风流场，包括山脉、峡谷、城市等。
        </p>
      </div>
      <div class="intro-card">
        <div class="intro-icon-wrapper">
          <i class="fas fa-chart-line intro-icon"></i>
        </div>
        <h4 class="intro-title">数据可视化</h4>
        <p class="intro-text">
          提供丰富的数据可视化工具，帮助用户直观地理解模拟结果。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import TerrainMap from '../components/TerrainMap/TerrainMap.vue';
import { gsap } from 'gsap';

const route = useRoute();
const caseId = computed(() => route.params.caseId || null);
const banner = ref(null);
const mapSection = ref(null);

onMounted(() => {
  // Banner 动画
  gsap.from(banner.value, {
    duration: 1.5,
    opacity: 0,
    y: -50,
    ease: 'power3.out',
  });

  gsap.from('.logo', {
    duration: 1,
    opacity: 0,
    y: -50,
    delay: 0.5,
    ease: 'power3.out',
  });

  gsap.from('.title', {
    duration: 1,
    opacity: 0,
    x: -50,
    delay: 0.8,
    ease: 'power3.out',
  });

  gsap.from('.subtitle', {
    duration: 1,
    opacity: 0,
    x: 50,
    delay: 1.1,
    ease: 'power3.out',
  });

  gsap.from('.hust-name', {
    duration: 1,
    opacity: 0,
    y: 50,
    delay: 1.4,
    ease: 'power3.out',
  });

  gsap.from('.description', {
    duration: 1,
    opacity: 0,
    delay: 1.7,
    ease: 'power3.out',
  });

  // Intro Section 动画
  gsap.from('.intro-card', {
    duration: 0.8,
    opacity: 0,
    y: 50,
    stagger: 0.2,
    delay: caseId.value ? 0 : 2,
    ease: 'power3.out',
  });

  // 粒子特效
  window.particlesJS &&
    window.particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#ffffff' },
        shape: {
          type: 'circle',
          stroke: { width: 0, color: '#000000' },
          polygon: { nb_sides: 5 },
        },
        opacity: {
          value: 0.5,
          random: true,
          anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false },
        },
        size: {
          value: 3,
          random: true,
          anim: { enable: false, speed: 40, size_min: 0.1, sync: false },
        },
        line_linked: {
          enable: true,
          distance: 150,
          color: '#ffffff',
          opacity: 0.4,
          width: 1,
        },
        move: {
          enable: true,
          speed: 2,
          direction: 'none',
          random: false,
          straight: false,
          out_mode: 'out',
          bounce: false,
          attract: { enable: false, rotateX: 600, rotateY: 1200 },
        },
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true, mode: 'grab' },
          onclick: { enable: true, mode: 'push' },
          resize: true,
        },
        modes: {
          grab: { distance: 140, line_linked: { opacity: 1 } },
          bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 },
          repulse: { distance: 200, duration: 0.4 },
          push: { particles_nb: 4 },
          remove: { particles_nb: 2 },
        },
      },
      retina_detect: true,
    });
});

const scrollToMap = () => {
  mapSection.value?.scrollIntoView({ behavior: 'smooth' });
};
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');

.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 100vh;
  background-color: #f8f8f8;
}

.banner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 150px 20px 200px;
  color: white;
  text-align: center;
  overflow: hidden;
}

.banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #004aad 0%, #409EFF 100%);
  opacity: 0.8;
  z-index: -1;
}

.banner::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('https://images.unsplash.com/photo-1515527758725-b0885547947d?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'); /* 替换为你的背景图片 */
  background-size: cover;
  background-position: center;
  filter: blur(5px) brightness(70%);
  z-index: -2;
  animation: zoomInOut 20s linear infinite alternate;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  z-index: 0;
}

#particles-js {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 0;
}

@keyframes zoomInOut {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.1);
  }
}

.logo {
  width: 200px;
  height: auto;
  margin-bottom: 10px;
  z-index: 2;
}

.title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.title {
  font-size: 60px;
  font-weight: bold;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.subtitle {
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 15px;
}

.hust-name {
  width: 400px;
  height: auto;
  margin-bottom: 30px;
  z-index: 1;
}

.description {
  font-size: 20px;
  line-height: 1.6;
  max-width: 800px;
  z-index: 1;
}

.map-section {
  width: 80%;
  margin: 40px auto;
  box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  overflow: hidden;
}

.scroll-down {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 2;
  animation: bounce 2s infinite;
}

.scroll-down i {
  font-size: 30px;
  color: white;
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.intro-section {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 80%;
  margin: 50px auto;
  flex-wrap: wrap;
}

.intro-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 300px;
  padding: 20px;
  margin: 20px;
  border-radius: 10px;
  background-color: white;
  box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.intro-card:hover {
  transform: translateY(-10px);
}

.intro-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #004aad 0%, #409EFF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease;
}

.intro-icon-wrapper:hover {
  transform: rotate(360deg);
}

.intro-icon {
  font-size: 36px;
  color: #fff;
  /* 如果是图标字体 */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intro-icon img {
  /* 如果是图片 */
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.intro-card:hover .intro-icon {
  animation: iconShake 0.5s;
}

@keyframes iconShake {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(10deg);
  }
  50% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(5deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.intro-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.intro-text {
  font-size: 16px;
  line-height: 1.6;
}
</style>