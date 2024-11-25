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
// 使用 params 而不是 query
const caseId = computed(() => route.params.caseId || null)
</script>