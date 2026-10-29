<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EChartsOption } from 'echarts'
import PageHeader from '@/components/common/PageHeader.vue'
import CountUp from '@/components/common/CountUp.vue'
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
import { CHART_COLORS, MS_PER_DAY } from '@/constants'
import { trendTooltip, trendAxes, areaLineSeries, type ChartThemeColors } from '@/services/chartOptions'
import { formatDuration, formatPercentChange, formatAmount, startOfDay, formatDate } from '@/utils/format'
import { useChartTheme } from '@/composables/useChartTheme'
import { buildRangeInsight, type InsightItem } from '@/services/insights'
import { exportReportPng, type ReportGrowthRow, type ReportMetric } from '@/services/report'
import { whoData, type WhoField } from '@/constants/whoGrowth'
import { estimatePercentile, percentileBand } from '@/utils/growthPercentile'
import { ageInMonths } from '@/utils/age'
import { showToast } from '@/composables/useToast'

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

// 时间范围选择（默认近 7 天：单看今天样本太少，趋势/对比更需要一段区间）
const rangeKey = ref('7d')
const range = computed(() => RANGE_PRESETS.find((p) => p.key === rangeKey.value)!)

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

// “全部”按实际最早记录收窄，避免从 1970 起逐日建桶导致日均失真
const allDataStart = computed<number | null>(() => {
  if (rangeKey.value !== 'all') return null
  const stamps = [
    ...datasets.value.feedings.map((f) => f.startTime),
    ...datasets.value.diapers.map((d) => d.time),
    ...datasets.value.pumpings.map((p) => p.startTime),
    ...datasets.value.sleeps.map((s) => s.startTime),
    ...growthStore.growths.map((g) => g.date),
    ...(datasets.value.solidFoods ?? []).map((sf) => sf.time),
    ...(datasets.value.medications ?? []).map((m) => m.time),
    ...(datasets.value.temperatures ?? []).map((tp) => tp.time),
  ].filter((ts) => Number.isFinite(ts) && ts > 0)
  if (stamps.length === 0) return startOfDay(now.value) - 30 * MS_PER_DAY
  return startOfDay(Math.min(...stamps))
})

const rangeStart = computed(() => {
  if (rangeKey.value === 'all') return allDataStart.value ?? startOfDay(now.value) - 30 * MS_PER_DAY
  return range.value.getRange(now.value)[0]
})
const rangeEnd = computed(() => {
  if (rangeKey.value === 'all') return startOfDay(now.value) + MS_PER_DAY
  return range.value.getRange(now.value)[1]
})

// 每日序列（趋势图数据）
const days = computed<DayAggregate[]>(() =>
  buildDailySeries(datasets.value, rangeStart.value, rangeEnd.value, now.value),
)

// 当前区间 vs 上一等长区间（对比）
const previousStart = computed(() => rangeStart.value - (rangeEnd.value - rangeStart.value))
const currentAgg = computed(() => sumDays(days.value))
const previousAgg = computed(() =>
  aggregateRange(datasets.value, previousStart.value, rangeStart.value, now.value),
)
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
      area: ['rgba(255,107,53,0.25)', 'rgba(255,107,53,0.02)'],
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

/** 对比行文案：上一周期 → 当前周期（睡眠时长等长文本换行展示，title 挂完整文案） */
function compareChangeText(c: ComparisonResult): string {
  return `${formatComparisonValue(c, c.previous)} → ${formatComparisonValue(c, c.current)}`
}

const rangeLabel = computed(() => t(range.value.label))

// —— 区间汇总（周报/月报）——
const summaryDays = computed(() => Math.max(1, currentAgg.value.dayCount))
const rangeGrowthCount = computed(
  () => growthStore.growths.filter((g) => g.date >= rangeStart.value && g.date < rangeEnd.value).length,
)

/** 对比值格式化工厂：供 CountUp 滚动时逐帧格式化 */
function compareFormat(c: ComparisonResult): (n: number) => string {
  return (n: number) => formatComparisonValue(c, n)
}

const summaryItems = computed(() => {
  const agg = currentAgg.value
  const days = summaryDays.value
  return [
    {
      label: t('stats.summary.feedCount'),
      num: agg.feedCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.feedCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.totalMilk'),
      num: agg.totalMilkAmount,
      format: (n: number) => formatAmount(n),
      sub: t('common.daily', { value: formatAmount(agg.totalMilkAmount / days) }),
    },
    {
      label: t('stats.summary.breastCount'),
      num: agg.breastCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.breastCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.sleepMs'),
      num: agg.sleepMs,
      format: (n: number) => formatDuration(n),
      sub: t('common.daily', { value: formatDuration(agg.sleepMs / days) }),
    },
    {
      label: t('stats.summary.diaper'),
      num: agg.diaperCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.diaperCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.pumpAmount'),
      num: agg.pumpAmount,
      format: (n: number) => formatAmount(n),
      sub: t('common.daily', { value: formatAmount(agg.pumpAmount / days) }),
    },
    {
      label: t('stats.summary.growthRecords'),
      num: rangeGrowthCount.value,
      format: (n: number) => t('common.records', { n: Math.round(n) }),
      sub: rangeLabel.value,
    },
    {
      label: t('stats.summary.solidFood'),
      num: agg.solidFoodCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.solidFoodCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.medication'),
      num: agg.medicationCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.medicationCount / days).toFixed(1) }) }),
    },
    {
      label: t('stats.summary.temperature'),
      num: agg.temperatureCount,
      format: (n: number) => t('common.times', { n: Math.round(n) }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.temperatureCount / days).toFixed(1) }) }),
    },
  ]
})

// —— 成长曲线（已抽取至 GrowthCurveCharts 组件）——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))

// —— 区间小结：跟随所选时间范围（「全部」没有可比的上期，不展示）——
const insight = computed(() =>
  rangeKey.value === 'all'
    ? null
    : buildRangeInsight(datasets.value, rangeStart.value, rangeEnd.value, now.value),
)

function insightText(item: InsightItem): string {
  if (item.change == null || item.tone === 'steady') return t(`stats.insights.${item.key}.steady`)
  return t(`stats.insights.${item.key}.${item.tone}`, { percent: Math.abs(Math.round(item.change)) })
}

// —— P1-4 儿保报告导出 ——
const reportBusy = ref(false)

const reportMetrics = computed<ReportMetric[]>(() => {
  const agg = currentAgg.value
  const days = summaryDays.value
  return [
    {
      label: t('stats.summary.totalMilk'),
      value: formatAmount(agg.totalMilkAmount),
      sub: t('common.daily', { value: formatAmount(agg.totalMilkAmount / days) }),
    },
    {
      label: t('stats.summary.feedCount'),
      value: t('common.times', { n: agg.feedCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.feedCount / days).toFixed(1) }) }),
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
      label: t('stats.summary.breastCount'),
      value: t('common.times', { n: agg.breastCount }),
      sub: t('common.daily', { value: t('common.times', { n: (agg.breastCount / days).toFixed(1) }) }),
    },
  ]
})

/** 最新一次体重/身高/头围 + WHO 百分位，供报告使用 */
const reportGrowthRows = computed<ReportGrowthRow[]>(() => {
  const baby = activeBaby.value
  if (!baby?.birthDate) return []
  const who = whoData(baby.gender)
  const rows: ReportGrowthRow[] = []

  const entries: { field: WhoField; label: string; unit: string; pick: (g: (typeof growthStore.growths)[number]) => number | undefined }[] = [
    { field: 'weight', label: t('stats.babyWeight'), unit: 'kg', pick: (g) => g.weight },
    { field: 'length', label: t('stats.babyHeight'), unit: 'cm', pick: (g) => g.height },
    { field: 'hc', label: t('stats.babyHead'), unit: 'cm', pick: (g) => g.headCircumference },
  ]

  for (const e of entries) {
    const latest = [...growthStore.growths]
      .filter((g) => e.pick(g) != null)
      .sort((a, b) => b.date - a.date)[0]
    if (!latest) continue
    const value = e.pick(latest)!
    const p = estimatePercentile(who, ageInMonths(baby.birthDate, latest.date), e.field, value)
    const band = percentileBand(p)
    rows.push({
      label: e.label,
      value: `${value.toFixed(1)} ${e.unit}`,
      percentile: p,
      band: t(`stats.bands.${band}`),
      tone: band === 'normal' ? 'normal' : 'attention',
    })
  }
  return rows
})

async function handleExportReport() {
  if (reportBusy.value) return
  reportBusy.value = true
  try {
    const baby = activeBaby.value
    const babyLine = baby
      ? baby.birthDate
        ? `${baby.name} · ${t('settings.ageMonths', { n: Math.floor(ageInMonths(baby.birthDate, now.value)) })}`
        : baby.name
      : t('common.baby')
    await exportReportPng(
      {
        title: t('stats.report.title'),
        babyLine,
        rangeLine: `${rangeLabel.value} · ${formatDate(rangeStart.value)} ~ ${formatDate(rangeEnd.value - 1)}`,
        generatedLine: t('stats.report.generatedAt', { date: formatDate(now.value) }),
        metrics: reportMetrics.value,
        growthTitle: t('stats.report.growthTitle'),
        growthRows: reportGrowthRows.value,
        noGrowth: t('stats.report.noGrowth'),
        disclaimer: t('stats.report.disclaimer'),
        footer: t('stats.report.footer'),
      },
      `babysitter-report-${formatDate(now.value)}.png`,
    )
    showToast(t('stats.report.exported'), { duration: 4000 })
  } catch {
    showToast(t('stats.report.failed'))
  } finally {
    reportBusy.value = false
  }
}
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
      <div v-if="insight?.items.length" class="insight-block">
        <p class="insight-title">
          {{ t('stats.insightTitle', { range: t(range.label) }) }}
          <span class="insight-sub">{{ t('stats.insightSub') }}</span>
        </p>
        <ul class="insight-list">
          <li v-for="item in insight.items" :key="item.key" class="insight-item" :class="item.tone">
            <span class="insight-dot" aria-hidden="true"></span>
            <span>{{ insightText(item) }}</span>
          </li>
        </ul>
      </div>
      <div class="summary-grid">
        <div v-for="s in summaryItems" :key="s.label" class="summary-item">
          <p class="summary-label">{{ s.label }}</p>
          <p class="summary-value"><CountUp :value="s.num" :format="s.format" /></p>
          <p class="summary-sub">{{ s.sub }}</p>
        </div>
      </div>
      <button
        class="btn btn-outline btn-block report-btn"
        :disabled="reportBusy"
        @click="handleExportReport"
      >
        {{ reportBusy ? t('common.exporting') : t('stats.exportReport') }}
      </button>
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
          <p class="compare-value"><CountUp :value="c.current" :format="compareFormat(c)" /></p>
          <div class="compare-change-row">
            <span class="compare-change" :class="c.change === null ? 'none' : c.change >= 0 ? 'up' : 'down'">
              {{ c.change === null ? '—' : formatPercentChange(c.change) }}
            </span>
            <span class="compare-prev" :title="compareChangeText(c)">{{ compareChangeText(c) }}</span>
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
  padding: var(--space-1) var(--space-1) 10px;
}

.range-select-label {
  font-size: var(--fs-13);
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
  border-radius: var(--radius-pill);
  padding: var(--space-1);
  margin-bottom: 10px;
  box-shadow: var(--shadow-glass);
}

.overview-tab {
  flex: 1;
  min-width: 0; /* 允许收缩，避免长文本（如英文 tab）撑破容器 */
  min-height: 44px;
  padding: 9px var(--space-3);
  border-radius: var(--radius-pill);
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--text-secondary);
  transition: background-color var(--dur-slow) var(--spring), border-color var(--dur-slow) var(--spring), color var(--dur-slow) var(--spring),
    box-shadow var(--dur-slow) var(--spring), transform var(--dur-slow) var(--spring), opacity var(--dur-slow) var(--spring);
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
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-bottom: 10px;
}

/* ===== 区间小结（跟随时间范围） ===== */
.insight-block {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
}

.insight-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
}

.insight-sub {
  font-size: var(--fs-2xs);
  font-weight: 400;
  color: var(--text-muted);
}

.insight-list {
  margin-top: 6px;
  display: grid;
  gap: 4px;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  line-height: 1.5;
  color: var(--text-secondary);
}

.insight-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}

.insight-item.up .insight-dot {
  background: var(--primary);
}

.insight-item.down .insight-dot {
  background: var(--accent-green);
}

.insight-item.steady .insight-dot {
  background: var(--text-muted);
}

.report-btn {
  margin-top: 12px;
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
  padding: 9px var(--space-2);
  text-align: center;
  transition: transform var(--dur-slow) var(--spring);
  box-shadow: var(--shadow-glass);
}

.summary-item:active {
  transform: scale(var(--tap-scale));
}

.summary-label {
  font-size: var(--fs-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-value {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.summary-sub {
  font-size: var(--fs-2xs);
  color: var(--text-muted);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-head {
  margin-bottom: var(--space-3);
}

.compare-title {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text);
}

.compare-sub {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.compare-grid {
  display: grid;
  /* minmax(0,1fr) 防止长文案（如睡眠时长）把所在列撑宽导致三列不齐 */
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 400px) {
  .compare-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}

.compare-item {
  min-width: 0;
  background: var(--surface-translucent);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 11px var(--space-2);
  text-align: center;
  transition: transform var(--dur-slow) var(--spring);
  box-shadow: var(--shadow-glass);
}

.compare-item:active {
  transform: scale(var(--tap-scale));
}

.compare-label {
  font-size: var(--fs-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-value {
  font-size: var(--fs-base);
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
  margin-top: var(--space-1);
  min-width: 0;
}

.compare-change {
  font-size: var(--fs-13);
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
  font-size: var(--fs-2xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  max-width: 100%;
  /* 长文本（睡眠时长 前 → 后）自然换行，避免撑破网格列宽 */
  overflow-wrap: anywhere;
}

@media (max-width: 400px) {
  .compare-item {
    padding: var(--space-2) var(--space-1);
  }

  .compare-value {
    font-size: var(--fs-13);
  }

  .compare-prev {
    font-size: var(--fs-2xs);
  }
}

.note-text {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin: var(--space-3) var(--space-1) var(--space-1);
  line-height: 1.6;
}
</style>
