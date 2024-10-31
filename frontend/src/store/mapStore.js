// frontend/src/store/mapStore.js
import { defineStore } from 'pinia';

export const useMapStore = defineStore('mapStore', {
  state: () => ({
    parameters: {},
    results: {}
  }),
  actions: {
    setParameters(params) {
      this.parameters = params;
    },
    setResults(res) {
      this.results = res;
    }
  }
});