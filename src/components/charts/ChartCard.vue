<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echartsSetup'
import type { EChartsOption } from 'echarts'
import { isDark } from '@/composables/useTheme'

const props = defineProps<{
  title: string
  subtitle?: string
  /** ECharts 配置对象 */
  option: EChartsOption
  height?: string
}>()

const style = computed(() => ({ height: props.height ?? '260px' }))

// tooltip 配色跟随主题
const tooltipColors = computed(() =>
  isDark.value
    ? { backgroundColor: 'rgba(41,35,30,0.96)', borderColor: '#42372f', textColor: '#f0e6dd' }
    : { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#f0e2d4', textColor: '#4a3a33' },
)

// 统一 tooltip 样式（避免数组类型兼容问题，仅处理对象形式）
const mergedOption = computed<EChartsOption>(() => {
  const base = props.option
  const hasTooltip = base.tooltip !== undefined
  return {
    ...base,
    tooltip: hasTooltip
      ? {
          trigger: 'axis',
          backgroundColor: tooltipColors.value.backgroundColor,
          borderColor: tooltipColors.value.borderColor,
          borderWidth: 1,
          textStyle: { color: tooltipColors.value.textColor, fontSize: 12 },
          confine: true,
          ...(typeof base.tooltip === 'object' && !Array.isArray(base.tooltip) ? base.tooltip : {}),
        }
      : base.tooltip,
  }
})
</script>

<template>
  <div class="chart-card card">
    <div class="chart-head">
      <h3 class="chart-title">{{ title }}</h3>
      <p v-if="subtitle" class="chart-sub">{{ subtitle }}</p>
    </div>
    <VChart :option="mergedOption" :style="style" autoresize />
  </div>
</template>

<style scoped>
.chart-card {
  padding: 14px;
  min-width: 0;
}

.chart-head {
  margin-bottom: 8px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.chart-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
