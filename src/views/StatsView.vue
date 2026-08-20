<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EChartsOption } from 'echarts'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ChartCard from '@/components/charts/ChartCard.vue'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import { useSolidFoodStore } from '@/stores/solidFood'
import { useMedicationStore } from '@/stores/medication'
import { useTemperatureStore } from '@/stores/temperature'
import {
  buildDailySeries,
  aggregateRange,
  compareRanges,
  RANGE_PRESETS,
  type DayAggregate,
  type ComparisonResult,
} from '@/services/stats'
import { CHART_COLORS } from '@/constants'
import { whoData, ageInMonths, type WhoField, type WhoPercentileKey } from '@/constants/whoGrowth'
import { MILESTONE_GUIDE, milestoneGuideRange } from '@/constants/milestoneGuide'
import { formatDuration, formatPercentChange, formatAmount } from '@/utils/format'
import { isDark } from '@/composables/useTheme'

const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()
const solidFoodStore = useSolidFoodStore()
const medicationStore = useMedicationStore()
const temperatureStore = useTemperatureStore()

const { t } = useI18n()

// 图表配色跟随主题
const axisColor = computed(() => (isDark.value ? '#b9ab9e' : '#8c7b72'))
const axisLineColor = computed(() => (isDark.value ? '#42372f' : '#f0e2d4'))
const splitLineColor = computed(() => (isDark.value ? '#2b251f' : '#f5ece2'))

const now = ref(Date.now())
const nowTimer = window.setInterval(() => (now.value = Date.now()), 60_000)
onUnmounted(() => window.clearInterval(nowTimer))

// 时间范围选择
const rangeKey = ref('7d')
const range = computed(() => RANGE_PRESETS.find((p) => p.key === rangeKey.value)!)
const rangeStart = computed(() => range.value.getRange(now.value)[0])
const rangeEnd = computed(() => range.value.getRange(now.value)[1])

// WHO 生长曲线说明弹窗
const growthInfoOpen = ref(false)

// 发育里程碑参考折叠卡片
const milestoneGuideOpen = ref(false)

// 概览 tab：对比 / 汇总
const activeView = ref<'summary' | 'trend' | 'compare'>('summary')

// 每日序列（趋势图数据）
const days = computed<DayAggregate[]>(() =>
  buildDailySeries(
    feedingStore.feedings,
    diaperStore.diapers,
    pumpingStore.pumpings,
    sleepStore.sleeps,
    rangeStart.value,
    rangeEnd.value,
    solidFoodStore.solidFoods,
    medicationStore.medications,
    temperatureStore.temperatures,
  ),
)

// 当前区间 vs 上一等长区间（对比）
const previousStart = computed(() => rangeStart.value - (rangeEnd.value - rangeStart.value))
const currentAgg = computed(() =>
  aggregateRange(
    feedingStore.feedings,
    diaperStore.diapers,
    pumpingStore.pumpings,
    sleepStore.sleeps,
    rangeStart.value,
    rangeEnd.value,
    solidFoodStore.solidFoods,
    medicationStore.medications,
    temperatureStore.temperatures,
  ),
)
const previousAgg = computed(() =>
  aggregateRange(
    feedingStore.feedings,
    diaperStore.diapers,
    pumpingStore.pumpings,
    sleepStore.sleeps,
    previousStart.value,
    rangeStart.value,
    solidFoodStore.solidFoods,
    medicationStore.medications,
    temperatureStore.temperatures,
  ),
)
const comparisons = computed<ComparisonResult[]>(() => compareRanges(currentAgg.value, previousAgg.value))

// 格式化轴标签
const xLabels = computed(() => days.value.map((d) => d.date.slice(5).replace('-', '/')))
const yFormatter = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

// —— 趋势图配置 ——
const milkOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${Math.round(v)} ml`),
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: xLabels.value,
    axisLabel: { color: axisColor.value, fontSize: 10, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: yFormatter, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  series: [
    {
      name: t('stats.series.milk'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: days.value.map((d) => d.totalMilkAmount),
      lineStyle: { width: 2.5, color: CHART_COLORS.feedAmount },
      itemStyle: { color: CHART_COLORS.feedAmount },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(232,144,108,0.25)' },
            { offset: 1, color: 'rgba(232,144,108,0.02)' },
          ],
        },
      },
    },
  ],
}))

const sleepOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${v} h`),
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: xLabels.value,
    axisLabel: { color: axisColor.value, fontSize: 10, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#8c7b72', fontSize: 10, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  series: [
    {
      name: t('stats.series.sleep'),
      type: 'bar',
      barMaxWidth: 22,
      data: days.value.map((d) => +(d.sleepMs / 3600_000).toFixed(1)),
      itemStyle: { color: CHART_COLORS.sleep, borderRadius: [4, 4, 0, 0] },
    },
  ],
}))

const diaperOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => t('common.times', { n: Math.round(v) })),
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: xLabels.value,
    axisLabel: { color: axisColor.value, fontSize: 10, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#8c7b72', fontSize: 10, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  series: [
    {
      name: t('stats.series.wet'),
      type: 'bar',
      stack: 'diaper',
      barMaxWidth: 22,
      data: days.value.map((d) => d.wetCount),
      itemStyle: { color: '#8FB9D8' },
    },
    {
      name: t('stats.series.dirty'),
      type: 'bar',
      stack: 'diaper',
      barMaxWidth: 22,
      data: days.value.map((d) => d.dirtyCount),
      itemStyle: { color: '#B58B62' },
    },
  ],
}))

const pumpOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${Math.round(v)} ml`),
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: xLabels.value,
    axisLabel: { color: axisColor.value, fontSize: 10, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: yFormatter, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  series: [
    {
      name: t('stats.series.pump'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: days.value.map((d) => d.pumpAmount),
      lineStyle: { width: 2.5, color: CHART_COLORS.pump },
      itemStyle: { color: CHART_COLORS.pump },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(216,168,200,0.25)' },
            { offset: 1, color: 'rgba(216,168,200,0.02)' },
          ],
        },
      },
    },
  ],
}))

const temperatureOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${v} ℃`),
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: xLabels.value,
    axisLabel: { color: axisColor.value, fontSize: 10, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    min: 35,
    max: 40,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}℃`, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  series: [
    {
      name: t('stats.series.temperature'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: days.value.map((d) => (d.temperatureCount > 0 ? +d.temperatureAvg.toFixed(1) : null)),
      connectNulls: false,
      lineStyle: { width: 2.5, color: CHART_COLORS.temperature },
      itemStyle: { color: CHART_COLORS.temperature },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        data: [{ yAxis: 37.3 }],
        lineStyle: { color: '#D97A52', type: 'dashed', width: 1 },
      },
    },
  ],
}))

// 对比面板格式化
function formatComparisonValue(c: ComparisonResult, value: number): string {
  if (c.key === 'sleepMs') return formatDuration(value)
  if (
    c.key === 'totalMilkAmount' ||
    c.key === 'breastMilkAmount' ||
    c.key === 'formulaAmount' ||
    c.key === 'pumpAmount'
  ) {
    return `${Math.round(value)} ml`
  }
  return t('common.times', { n: Math.round(value) })
}

const rangeLabel = computed(() => t(range.value.label))

// —— 区间汇总（周报/月报）——
const summaryDays = computed(() => Math.max(1, currentAgg.value.dayCount))
const rangeGrowthCount = computed(
  () => growthStore.growths.filter((g) => g.date >= rangeStart.value && g.date <= rangeEnd.value).length,
)

const summaryItems = computed(() => {
  const agg = currentAgg.value
  const days = summaryDays.value
  return [
    {
      label: t('stats.summary.feedCount'),
      value: t('common.times', { n: agg.feedCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.feedCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.totalMilk'),
      value: formatAmount(agg.totalMilkAmount),
      sub: t('common.daily', { value: formatAmount(agg.totalMilkAmount / days) }),
    },
    {
      label: t('stats.summary.breastCount'),
      value: t('common.times', { n: agg.breastCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.breastCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.sleepMs'),
      value: formatDuration(agg.sleepMs),
      sub: t('common.daily', { value: formatDuration(agg.sleepMs / days) }),
    },
    {
      label: t('stats.summary.diaper'),
      value: t('common.times', { n: agg.diaperCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.diaperCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.pumpAmount'),
      value: formatAmount(agg.pumpAmount),
      sub: t('common.daily', { value: formatAmount(agg.pumpAmount / days) }),
    },
    {
      label: t('stats.summary.growthRecords'),
      value: t('common.records', { n: rangeGrowthCount.value }),
      sub: rangeLabel.value,
    },
    {
      label: t('stats.summary.solidFood'),
      value: t('common.times', { n: agg.solidFoodCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.solidFoodCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.medication'),
      value: t('common.times', { n: agg.medicationCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.medicationCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.temperature'),
      value: t('common.times', { n: agg.temperatureCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.temperatureCount / days).toFixed(1) }) }),
    },
  ]
})

// —— 成长曲线（体重/身高/头围 + WHO 生长标准参考，时间轴按真实记录日期）——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const growthRecords = computed(() => [...growthStore.growths].sort((a, b) => a.date - b.date))
/** 有出生日期才能换算月龄/绘制参考线 */
const hasBirthDate = computed(() => Boolean(activeBaby.value?.birthDate))
const whoPoints = computed(() => whoData(activeBaby.value?.gender))

/** 出生日 0 点时间戳（时间轴原点） */
const birthTs = computed(() => {
  const b = activeBaby.value?.birthDate
  return b ? new Date(b + 'T00:00:00').getTime() : 0
})

/** 月龄 → 日历日期时间戳（出生日 + n 个自然月，处理月末溢出） */
function monthToTs(month: number): number {
  const d = new Date(birthTs.value)
  const m = d.getMonth() + Math.floor(month)
  const y = d.getFullYear() + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  const day = Math.min(d.getDate(), new Date(y, mm + 1, 0).getDate())
  return new Date(y, mm, day).getTime()
}

const weightPoints = computed(() =>
  growthRecords.value.filter((g) => g.weight != null).map((g) => ({ ts: g.date, value: g.weight! })),
)
const heightPoints = computed(() =>
  growthRecords.value.filter((g) => g.height != null).map((g) => ({ ts: g.date, value: g.height! })),
)
const hcPoints = computed(() =>
  growthRecords.value
    .filter((g) => g.headCircumference != null)
    .map((g) => ({ ts: g.date, value: g.headCircumference! })),
)

/** 图表覆盖的最大月龄（至少 24 月） */
const growthXMax = computed(() => {
  const months = [...weightPoints.value, ...heightPoints.value, ...hcPoints.value].map((p) =>
    ageInMonths(activeBaby.value!.birthDate!, p.ts),
  )
  return Math.max(24, Math.ceil(Math.max(3, ...months)))
})
const hasGrowthData = computed(
  () => weightPoints.value.length > 0 || heightPoints.value.length > 0 || hcPoints.value.length > 0,
)

/** 时间轴范围：出生日 → max(参考曲线最大日期, 最后记录日期) */
const growthXMin = computed(() => birthTs.value)
const growthXMaxTs = computed(() =>
  Math.max(
    monthToTs(growthXMax.value),
    ...weightPoints.value.map((p) => p.ts),
    ...heightPoints.value.map((p) => p.ts),
    ...hcPoints.value.map((p) => p.ts),
  ),
)

/** WHO 参考线数据（x 为月龄对应的日历日期时间戳） */
function whoSeries(field: WhoField, key: WhoPercentileKey): [number, number][] {
  return whoPoints.value.filter((p) => p.month <= growthXMax.value).map((p) => [monthToTs(p.month), p[field][key]])
}

/** 时间轴标签：M/D（跨年显示 YY/M/D，保持标签紧凑避免重叠） */
const tsAxisLabel = (v: number) => {
  const d = new Date(v)
  const birth = new Date(birthTs.value)
  if (d.getFullYear() !== birth.getFullYear()) return `${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 趋势图 tooltip：显示日期 + 各系列数值（无数据日显示 -），触摸/悬停均可查看 */
const trendTooltip = (fmt: (v: number) => string) => ({
  trigger: 'axis' as const,
  formatter: (params: unknown) => {
    const list = params as Array<{ seriesName: string; marker: string; value?: number | null; axisValue?: string }>
    const first = list.find((p) => typeof p.value === 'number' && !Number.isNaN(p.value))
    if (!first) return ''
    const dateStr = first.axisValue ?? ''
    const lines = list.map((p) => {
      const v = typeof p.value === 'number' ? p.value : null
      return `${p.marker}${p.seriesName}: ${v != null ? fmt(v) : '-'}`
    })
    return `<b>${dateStr}</b><br/>${lines.join('<br/>')}`
  },
})

const growthTooltip = (unit: string) => ({
  trigger: 'axis' as const,
  formatter: (params: unknown) => {
    const list = params as Array<{ seriesName: string; marker: string; value?: [number, number] }>
    const first = list.find((p) => Array.isArray(p.value))
    if (!first?.value) return ''
    const d = new Date(first.value[0])
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const lines = list.map((p) => {
      const v = Array.isArray(p.value) ? p.value[1] : null
      return `${p.marker}${p.seriesName}: ${v != null ? Number(v).toFixed(1) : '-'} ${unit}`
    })
    return `<b>${dateStr}</b><br/>${lines.join('<br/>')}`
  },
})

/** WHO 参考线颜色（P15/P85 更浅，突出 P3-P97 区间） */
const WHO_LINE_COLORS: Record<WhoPercentileKey, string> = {
  p97: '#c4b6a6',
  p85: '#d8cbbd',
  p50: '#a49482',
  p15: '#d8cbbd',
  p3: '#c4b6a6',
}

function growthSeries(
  field: WhoField,
  data: { ts: number; value: number }[],
  mainColor: string,
  label: string,
): EChartsOption['series'] {
  const keys: WhoPercentileKey[] = ['p97', 'p85', 'p50', 'p15', 'p3']
  const series: EChartsOption['series'] = keys.map((k) => ({
    name: k.toUpperCase(),
    type: 'line',
    data: whoSeries(field, k),
    symbol: 'none',
    smooth: 0.4,
    lineStyle: { width: 1, color: WHO_LINE_COLORS[k], type: 'dashed' },
    itemStyle: { color: WHO_LINE_COLORS[k] },
  }))
  series.push({
    name: label,
    type: 'line',
    data: data.map((p) => [p.ts, p.value]),
    smooth: true,
    symbol: 'circle',
    symbolSize: 7,
    lineStyle: { width: 2.5, color: mainColor },
    itemStyle: { color: mainColor },
  })
  return series
}

const weightOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 34, bottom: 30 },
  legend: {
    top: 4,
    left: 'center',
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 12,
    textStyle: { fontSize: 10, color: axisColor.value },
  },
  xAxis: {
    type: 'value',
    min: growthXMin.value,
    max: growthXMaxTs.value,
    axisLabel: { color: axisColor.value, fontSize: 10, formatter: tsAxisLabel, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}kg`, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  tooltip: growthTooltip('kg'),
  series: growthSeries('weight', weightPoints.value, CHART_COLORS.feedAmount, t('stats.babyWeight')),
}))

const heightOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 34, bottom: 30 },
  legend: {
    top: 4,
    left: 'center',
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 12,
    textStyle: { fontSize: 10, color: axisColor.value },
  },
  xAxis: {
    type: 'value',
    min: growthXMin.value,
    max: growthXMaxTs.value,
    axisLabel: { color: axisColor.value, fontSize: 10, formatter: tsAxisLabel, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}cm`, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  tooltip: growthTooltip('cm'),
  series: growthSeries('length', heightPoints.value, CHART_COLORS.sleep, t('stats.babyHeight')),
}))

const hcOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 34, bottom: 30 },
  legend: {
    top: 4,
    left: 'center',
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 12,
    textStyle: { fontSize: 10, color: axisColor.value },
  },
  xAxis: {
    type: 'value',
    min: growthXMin.value,
    max: growthXMaxTs.value,
    axisLabel: { color: axisColor.value, fontSize: 10, formatter: tsAxisLabel, hideOverlap: true },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}cm`, hideOverlap: true },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  tooltip: growthTooltip('cm'),
  series: growthSeries('hc', hcPoints.value, '#6AB0D8', t('stats.babyHead')),
}))
</script>

<template>
  <div class="page stats-page">
    <PageHeader />

    <!-- 时间范围 -->
    <div class="range-select-row">
      <label class="range-select-label" for="range-select">{{ t('stats.rangeLabel') }}</label>
      <select id="range-select" v-model="rangeKey" class="form-input range-select">
        <option v-for="p in RANGE_PRESETS" :key="p.key" :value="p.key">{{ t(p.label) }}</option>
      </select>
    </div>

    <!-- 页面级视图切换：总览 / 趋势 / 对比 -->
    <div class="overview-tabs page-tabs" role="tablist">
      <button
        class="overview-tab"
        :class="{ active: activeView === 'summary' }"
        role="tab"
        :aria-selected="activeView === 'summary'"
        @click="activeView = 'summary'"
      >
        {{ t('stats.tabSummary') }}
      </button>
      <button
        class="overview-tab"
        :class="{ active: activeView === 'trend' }"
        role="tab"
        :aria-selected="activeView === 'trend'"
        @click="activeView = 'trend'"
      >
        {{ t('stats.tabTrend') }}
      </button>
      <button
        class="overview-tab"
        :class="{ active: activeView === 'compare' }"
        role="tab"
        :aria-selected="activeView === 'compare'"
        @click="activeView = 'compare'"
      >
        {{ t('stats.tabCompare') }}
      </button>
    </div>

    <!-- 总览：区间汇总 -->
    <div v-if="activeView === 'summary'" class="card overview-card">
      <span class="overview-sub">{{ t('stats.summarySub', { n: summaryDays }) }}</span>
      <div class="summary-grid">
        <div v-for="s in summaryItems" :key="s.label" class="summary-item">
          <p class="summary-label">{{ s.label }}</p>
          <p class="summary-value">{{ s.value }}</p>
          <p class="summary-sub">{{ s.sub }}</p>
        </div>
      </div>
    </div>

    <!-- 趋势：趋势图 + 成长曲线 -->
    <template v-else-if="activeView === 'trend'">
      <ChartCard
        :title="t('stats.charts.milkTitle')"
        :subtitle="`${rangeLabel} · ${t('stats.charts.milkSub')}`"
        :option="milkOption"
      />
      <ChartCard :title="t('stats.charts.sleepTitle')" :subtitle="rangeLabel" :option="sleepOption" />
      <ChartCard
        :title="t('stats.charts.diaperTitle')"
        :subtitle="`${rangeLabel} · ${t('stats.charts.diaperSub')}`"
        :option="diaperOption"
      />
      <ChartCard :title="t('stats.charts.pumpTitle')" :subtitle="rangeLabel" :option="pumpOption" />
      <ChartCard
        :title="t('stats.charts.temperatureTitle')"
        :subtitle="`${rangeLabel} · ${t('stats.charts.temperatureSub')}`"
        :option="temperatureOption"
      />

      <!-- 成长曲线 -->
      <p class="section-title">{{ t('stats.growthSection') }}</p>
      <template v-if="hasBirthDate">
        <ChartCard
          v-if="weightPoints.length > 0"
          :title="t('stats.growthTitle')"
          :subtitle="t('stats.growthSub', { name: activeBaby?.name ?? '' })"
          :option="weightOption"
        >
          <template #title-action>
            <button class="growth-info-btn" :aria-label="t('stats.whoInfoTitle')" @click="growthInfoOpen = true">?</button>
          </template>
        </ChartCard>
        <ChartCard
          v-else-if="hasGrowthData"
          :title="t('stats.growthTitle')"
          :subtitle="t('stats.growthEmpty')"
          :option="{
            grid: { top: 40 },
            xAxis: { type: 'value', axisLabel: { show: false } },
            yAxis: { type: 'value', axisLabel: { show: false } },
            series: [],
          }"
        />
        <ChartCard
          v-if="heightPoints.length > 0"
          :title="t('stats.heightTitle')"
          :subtitle="t('stats.growthSub', { name: activeBaby?.name ?? '' })"
          :option="heightOption"
        >
          <template #title-action>
            <button class="growth-info-btn" :aria-label="t('stats.whoInfoTitle')" @click="growthInfoOpen = true">?</button>
          </template>
        </ChartCard>
        <ChartCard
          v-else-if="hasGrowthData"
          :title="t('stats.heightTitle')"
          :subtitle="t('stats.heightEmpty')"
          :option="{
            grid: { top: 40 },
            xAxis: { type: 'value', axisLabel: { show: false } },
            yAxis: { type: 'value', axisLabel: { show: false } },
            series: [],
          }"
        />
        <ChartCard
          v-if="hcPoints.length > 0"
          :title="t('stats.hcTitle')"
          :subtitle="t('stats.growthSub', { name: activeBaby?.name ?? '' })"
          :option="hcOption"
        >
          <template #title-action>
            <button class="growth-info-btn" :aria-label="t('stats.whoInfoTitle')" @click="growthInfoOpen = true">?</button>
          </template>
        </ChartCard>
        <ChartCard
          v-else-if="hasGrowthData"
          :title="t('stats.hcTitle')"
          :subtitle="t('stats.hcEmpty')"
          :option="{
            grid: { top: 40 },
            xAxis: { type: 'value', axisLabel: { show: false } },
            yAxis: { type: 'value', axisLabel: { show: false } },
            series: [],
          }"
        />
        <div v-if="!hasGrowthData" class="card empty-inline">
          {{ t('stats.growthEmptyBoth') }}
        </div>
      </template>
      <div v-else class="card empty-inline">
        {{ t('stats.growthCta', { name: activeBaby?.name ?? t('common.baby') }) }}
      </div>

      <!-- 发育里程碑参考 -->
      <div class="card guide-card">
        <button
          type="button"
          class="guide-toggle"
          :aria-expanded="milestoneGuideOpen"
          @click="milestoneGuideOpen = !milestoneGuideOpen"
        >
          <span class="guide-toggle-icon">🌟</span>
          <span class="guide-toggle-title">{{ t('stats.milestoneGuideTitle') }}</span>
          <span class="guide-toggle-arrow" :class="{ open: milestoneGuideOpen }">▾</span>
        </button>
        <div v-if="milestoneGuideOpen" class="guide-list">
          <div v-for="item in MILESTONE_GUIDE" :key="item.labelKey" class="guide-item">
            <span class="guide-item-icon">{{ item.icon }}</span>
            <span class="guide-item-range">{{ milestoneGuideRange(item) }}</span>
            <span class="guide-item-text">{{ t(item.labelKey) }}</span>
          </div>
          <p class="guide-note">{{ t('stats.milestoneGuideNote') }}</p>
        </div>
      </div>

      <p class="note-text">{{ t('stats.noteText') }}</p>
    </template>

    <!-- 对比：与上一周期对比 -->
    <div v-else class="card overview-card">
      <span class="overview-sub">{{ t('stats.compareSub', { range: rangeLabel }) }}</span>
      <div class="compare-grid">
        <div v-for="c in comparisons" :key="c.key" class="compare-item">
          <p class="compare-label">{{ t(c.label) }}</p>
          <p class="compare-value">{{ formatComparisonValue(c, c.current) }}</p>
          <div class="compare-change-row">
            <span class="compare-change" :class="c.change === null ? 'none' : c.change >= 0 ? 'up' : 'down'">
              {{ c.change === null ? '—' : formatPercentChange(c.change) }}
            </span>
            <span class="compare-prev"
              >{{ formatComparisonValue(c, c.previous) }} → {{ formatComparisonValue(c, c.current) }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <BaseModal :show="growthInfoOpen" :title="t('stats.whoInfoTitle')" @close="growthInfoOpen = false">
      <div class="who-info">
        <p class="who-intro">{{ t('stats.whoIntro') }}</p>
        <ul class="who-list">
          <li><b>P3</b><span>{{ t('stats.whoP3') }}</span></li>
          <li><b>P15</b><span>{{ t('stats.whoP15') }}</span></li>
          <li><b>P50</b><span>{{ t('stats.whoP50') }}</span></li>
          <li><b>P85</b><span>{{ t('stats.whoP85') }}</span></li>
          <li><b>P97</b><span>{{ t('stats.whoP97') }}</span></li>
        </ul>
        <p class="who-range">{{ t('stats.whoRange') }}</p>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.range-select-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 10px;
}

.range-select-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.range-select {
  flex: 1;
  min-width: 0;
  border-radius: 12px;
  box-shadow: var(--shadow-xs);
}

.overview-card {
  margin-bottom: 10px;
  padding: 14px;
}

.overview-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 10px;
}

.overview-tab {
  flex: 1;
  min-width: 0; /* 允许收缩，避免长文本（如英文 tab）撑破容器 */
  min-height: 0; /* 覆盖全局 button min-height:44px */
  padding: 9px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.18s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-tab.active {
  background: var(--surface);
  color: var(--primary-dark);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.overview-sub {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

@media (max-width: 400px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
}

.summary-item {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 9px 8px;
  text-align: center;
  transition: transform 0.12s ease;
}

.summary-item:active {
  transform: scale(0.97);
}

.summary-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.summary-sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-head {
  margin-bottom: 12px;
}

.compare-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.compare-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 400px) {
  .compare-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

.compare-item {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 11px 8px;
  text-align: center;
  transition: transform 0.12s ease;
}

.compare-item:active {
  transform: scale(0.97);
}

.compare-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.compare-change-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  margin-top: 4px;
}

.compare-change {
  font-size: 13px;
  font-weight: 700;
}

.compare-change.up {
  color: #d97a52;
}

.compare-change.down {
  color: #7fae6c;
}

.compare-change.none {
  color: var(--text-muted);
}

.compare-prev {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

@media (max-width: 400px) {
  .compare-item {
    padding: 8px 4px;
  }

  .compare-value {
    font-size: 13px;
  }

  .compare-prev {
    font-size: 9px;
  }
}

.note-text {
  font-size: 12px;
  color: var(--text-muted);
  margin: 12px 4px 4px;
  line-height: 1.6;
}

.guide-card {
  margin-bottom: 8px;
}

.guide-toggle {
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.guide-toggle:active {
  opacity: 0.7;
}

.guide-toggle-icon {
  font-size: 18px;
}

.guide-toggle-title {
  flex: 1;
  text-align: left;
}

.guide-toggle-arrow {
  color: var(--text-muted);
  font-size: 12px;
  transition: transform 0.18s ease;
}

.guide-toggle-arrow.open {
  transform: rotate(180deg);
}

.guide-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 13px;
  line-height: 1.5;
}

.guide-item-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1.5;
}

.guide-item-range {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--primary-dark);
  font-variant-numeric: tabular-nums;
}

.guide-item-text {
  color: var(--text-secondary);
  min-width: 0;
}

.guide-note {
  font-size: 11px;
  color: var(--text-muted);
  margin: 8px 4px 2px;
  line-height: 1.6;
}

.growth-info-btn {
  flex-shrink: 0;
  min-height: 0; /* 覆盖全局 button min-height:44px，保持正圆 */
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.growth-info-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}

.who-info {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.who-intro {
  margin-bottom: 12px;
}

.who-list {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.who-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.who-list b {
  flex-shrink: 0;
  min-width: 40px;
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
  line-height: 1.8;
}

.who-range {
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  color: var(--text-muted);
  font-size: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 14px 2px 8px;
}

.empty-inline {
  text-align: center;
  padding: 20px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>
