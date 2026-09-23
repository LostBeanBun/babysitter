import { computed } from 'vue'
import { isDark } from '@/composables/useTheme'

/** ECharts 坐标轴/网格主题色（随明暗切换） */
export function useChartTheme() {
  const axisColor = computed(() => (isDark.value ? '#b9ab9e' : '#8c7b72'))
  const axisLineColor = computed(() => (isDark.value ? '#42372f' : '#f0e2d4'))
  const splitLineColor = computed(() => (isDark.value ? '#2b251f' : '#f5ece2'))
  const tooltipColors = computed(() =>
    isDark.value
      ? { backgroundColor: 'rgba(41,35,30,0.96)', borderColor: '#42372f', textColor: '#f0e6dd' }
      : { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#f0e2d4', textColor: '#4a3a33' },
  )
  const whoColors = computed(() =>
    isDark.value
      ? { strong: '#6d6158', mid: '#5a5048', soft: '#4a413a' }
      : { strong: '#a49482', mid: '#c4b6a6', soft: '#d8cbbd' },
  )

  return { axisColor, axisLineColor, splitLineColor, tooltipColors, whoColors, isDark }
}
