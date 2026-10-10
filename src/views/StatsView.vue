<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EChartsOption } from 'echarts'
import PageHeader from '@/components/common/PageHeader.vue'
import ChartCard from '@/components/charts/ChartCard.vue'
import GrowthCurveCharts from '@/components/charts/GrowthCurveCharts.vue'
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
  sumDays,
  compareRanges,
  RANGE_PRESETS,
  type DayAggregate,
  type ComparisonResult,
  type RecordDatasets,
} from '@/services/stats'
import { CHART_COLORS } from '@/constants'
import { trendTooltip, trendAxes, areaLineSeries, type ChartThemeColors } from '@/services/chartOptions'
import { formatDuration, formatPercentChange, formatAmount } from '@/utils/format'
import { useChartTheme } from '@/composables/useChartTheme'

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
const { axisColor, axisLineColor, splitLineColor } = useChartTheme()
const chartTheme = computed<ChartThemeColors>(() => ({
  axisColor: axisColor.value,
  axisLineColor: axisLineColor.value,
  splitLineColor: splitLineColor.value,
}))

const now = ref(Date.now())
const nowTimer = window.setInterval(() => (now.value = Date.now()), 60_000)
onUnmounted(() => window.clearInterval(nowTimer))

// 时间范围选择
const rangeKey = ref('7d')
const range = computed(() => RANGE_PRESETS.find((p) => p.key === rangeKey.value)!)
const rangeStart = computed(() => range.value.getRange(now.value)[0])
const rangeEnd = computed(() => range.value.getRange(now.value)[1])

// 概览 tab：对比 / 汇总
const activeView = ref<'summary' | 'trend' | 'compare'>('summary')

// 统计用记录数据集
const datasets = computed<RecordDatasets>(() => ({
  feedings: feedingStore.feedings,
  diapers: diaperStore.diapers,
  pumpings: pumpingStore.pumpings,
  sleeps: sleepStore.sleeps,
  solidFoods: solidFoodStore.solidFoods,
  medications: medicationStore.medications,
  temperatures: temperatureStore.temperatures,
}))

// 每日序列（趋势图数据）
const days = computed<DayAggregate[]>(() => buildDailySeries(datasets.value, rangeStart.value, rangeEnd.value))

// 当前区间 vs 上一等长区间（对比）
const previousStart = computed(() => rangeStart.value - (rangeEnd.value - rangeStart.value))
const currentAgg = computed(() => sumDays(days.value))
const previousAgg = computed(() => aggregateRange(datasets.value, previousStart.value, rangeStart.value))
const comparisons = computed<ComparisonResult[]>(() => compareRanges(currentAgg.value, previousAgg.value))

// 格式化轴标签
const xLabels = computed(() => days.value.map((d) => d.date.slice(5).replace('-', '/')))
const yFormatter = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

// —— 趋势图配置 ——
const milkOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${Math.round(v)} ml`),
  ...trendAxes({ theme: chartTheme.value, xLabels: xLabels.value, yFormatter }),
  series: [
    areaLineSeries({
      name: t('stats.series.milk'),
      data: days.value.map((d) => d.totalMilkAmount),
      color: CHART_COLORS.feedAmount,
      area: ['rgba(232,144,108,0.25)', 'rgba(232,144,108,0.02)'],
    }),
  ],
}))

const sleepOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${v} h`),
  ...trendAxes({ theme: chartTheme.value, xLabels: xLabels.value }),
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
  ...trendAxes({ theme: chartTheme.value, xLabels: xLabels.value }),
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
  ...trendAxes({ theme: chartTheme.value, xLabels: xLabels.value, yFormatter }),
  series: [
    areaLineSeries({
      name: t('stats.series.pump'),
      data: days.value.map((d) => d.pumpAmount),
      color: CHART_COLORS.pump,
      area: ['rgba(216,168,200,0.25)', 'rgba(216,168,200,0.02)'],
    }),
  ],
}))

const temperatureOption = computed<EChartsOption>(() => ({
  tooltip: trendTooltip((v) => `${v} ℃`),
  ...trendAxes({
    theme: chartTheme.value,
    xLabels: xLabels.value,
    yMin: 35,
    yMax: 40,
    yFormatter: (v) => `${v}℃`,
  }),
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
        lineStyle: { color: '#ff7a45', type: 'dashed', width: 1 },
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

// —— 成长曲线（已抽取至 GrowthCurveCharts 组件）——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
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
      <div class="trend-grid">
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
      </div>

      <!-- 成长曲线 -->
      <p class="section-title">{{ t('stats.growthSection') }}</p>
      <GrowthCurveCharts
        :baby-name="activeBaby?.name ?? ''"
        :gender="activeBaby?.gender"
        :birth-date="activeBaby?.birthDate"
        :records="growthStore.growths"
      />

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
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
}

/* ===== 平板适配（700–1439px）：趋势图两列、筛选控件收窄 ===== */
@media (min-width: 700px) and (max-width: 1439px) {
  .range-select {
    max-width: 360px;
  }

  .trend-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .trend-grid .card + .card {
    margin-top: 0;
  }
}

.overview-card {
  margin-bottom: 10px;
  padding: 14px;
}

.overview-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-glass);
}

.overview-tab {
  flex: 1;
  min-width: 0; /* 允许收缩，避免长文本（如英文 tab）撑破容器 */
  min-height: 44px;
  padding: 9px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.3s var(--spring);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-tab.active {
  background: var(--surface);
  color: var(--primary-dark);
  box-shadow: var(--shadow-glass);
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
  background: var(--surface-translucent);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 9px 8px;
  text-align: center;
  transition: transform 0.3s var(--spring);
  box-shadow: var(--shadow-glass);
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
  background: var(--surface-translucent);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 11px 8px;
  text-align: center;
  transition: transform 0.3s var(--spring);
  box-shadow: var(--shadow-glass);
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
  color: var(--primary);
}

.compare-change.down {
  color: var(--accent-green);
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
</style>
