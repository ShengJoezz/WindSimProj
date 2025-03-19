// stores/windTurbineStore.js
import { defineStore } from 'pinia';

export const useWindTurbineStore = defineStore('windTurbine', {
  state: () => ({
    chartData: null,
    combinedData: [],
    realHighData: [],
    turbineCount: 0,
    avgSpeed: "-",
    totalPower: "-",
    avgCt: "-",
    latestCaseId: null
  }),

  actions: {
    setChartData(chartData) {
      this.chartData = chartData;
    },

    setTurbineData(turbineData) {
      this.combinedData = turbineData.combinedData || [];
      this.realHighData = turbineData.realHighData || [];
      this.turbineCount = turbineData.turbineCount || 0;
      this.avgSpeed = turbineData.avgSpeed || "-";
      this.totalPower = turbineData.totalPower || "-";
      this.avgCt = turbineData.avgCt || "-";
      this.latestCaseId = turbineData.caseId;
    },

    clearData() {
      this.chartData = null;
      this.combinedData = [];
      this.realHighData = [];
      this.turbineCount = 0;
      this.avgSpeed = "-";
      this.totalPower = "-";
      this.avgCt = "-";
      this.latestCaseId = null;
    }
  }
});