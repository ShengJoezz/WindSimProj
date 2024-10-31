<!-- frontend/src/views/Home.vue -->
<template>
  <div>
    <TerrainMap :caseId="caseId" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TerrainMap from '../components/TerrainMap.vue'

const route = useRoute()
// 直接获取 caseId，不做任何检测
const caseId = computed(() => route.query.caseId || null)
</script>