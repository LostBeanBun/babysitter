<script setup lang="ts">
import { computed, onUnmounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
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
  /** 无数据占位：显式传入时优先生效；缺省时自动检测 series 是否含有有效数据 */
  empty?: boolean
}>()

const { t } = useI18n()

const style = computed(() => ({ height: props.height ?? '260px' }))

/** vue-echarts 实例引用（exposed 直接转发 echarts 实例方法，如 dispatchAction） */
const chartRef = useTemplateRef<{ dispatchAction: (payload: Record<string, unknown>) => void }>('chartRef')

/** 触摸松开后延时隐藏 tooltip 的定时器 */
let hideTimer: number | undefined

/**
 * 移动端手指松开后延时隐藏 tooltip：
 * echarts 在触屏上 tap 会固定显示 tooltip，不会自动消失。
 * 这里在 touchend 后延时 500ms 主动 hideTip，形成「松开即消失」的默认体验。
 *
 * 通过模板 @touchend 绑定在 wrapper（普通 div）上，
 * Vue 会在 v-else 分支渲染/卸载时自动绑定与解绑。
 */
function onTouchEnd() {
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    chartRef.value?.dispatchAction({ type: 'hideTip' })
  }, 500)
}

onUnmounted(() => {
  window.clearTimeout(hideTimer)
})

/** 判断单个 series 是否存在有效数据点（null/undefined/0 均视为无数据） */
function seriesHasData(s: unknown): boolean {
  const data = (s as { data?: unknown } | null)?.data
  if (!Array.isArray(data) || data.length === 0) return false
  return data.some((v) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'number') return v !== 0
    if (Array.isArray(v)) return v.length > 1 && v[1] !== null && v[1] !== undefined && v[1] !== 0
    return true
  })
}

/** 图表是否处于无数据状态（渲染占位而非空图表） */
const isEmpty = computed(() => {
  if (props.empty === true) return true
  const series = props.option.series
  if (!Array.isArray(series) || series.length === 0) return true
  return !series.some(seriesHasData)
})

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
      <div class="chart-title-row">
        <h3 class="chart-title">{{ title }}</h3>
        <slot name="title-action" />
      </div>
      <p v-if="subtitle" class="chart-sub">{{ subtitle }}</p>
    </div>
    <div v-if="isEmpty" class="chart-empty" :style="style">
      <p class="chart-empty-text">{{ t('stats.noData') }}</p>
    </div>
    <div v-else class="chart-wrap" @touchend="onTouchEnd">
      <VChart ref="chartRef" :option="mergedOption" :style="style" autoresize />
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  padding: 12px;
  min-width: 0;
}

.chart-head {
  margin-bottom: 10px;
}

.chart-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chart-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.chart-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.chart-empty-text {
  font-size: 13px;
  color: var(--text-muted);
}
</style>