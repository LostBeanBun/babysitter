<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import PageHeader from '@/components/common/PageHeader.vue'
import ChartCard from '@/components/charts/ChartCard.vue'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import { buildDailySeries, aggregateRange, compareRanges, RANGE_PRESETS, type DayAggregate, type ComparisonResult } from '@/services/stats'
import { CHART_COLORS } from '@/constants'
import { whoData, ageInMonths } from '@/constants/whoGrowth'
import { formatDuration, formatPercentChange, formatAmount } from '@/utils/format'
import { isDark } from '@/composables/useTheme'

const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()

// 图表配色跟随主题
const axisColor = computed(() => (isDark.value ? '#b9ab9e' : '#8c7b72'))
const axisLineColor = computed(() => (isDark.value ? '#42372f' : '#f0e2d4'))
const splitLineColor = computed(() => (isDark.value ? '#2b251f' : '#f5ece2'))

const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 60_000)

// 时间范围选择
const rangeKey = ref('7d')
const range = computed(() => RANGE_PRESETS.find((p) => p.key === rangeKey.value)!)
const rangeStart = computed(() => range.value.getRange(now.value)[0])
const rangeEnd = computed(() => range.value.getRange(now.value)[1])

// 概览 tab：对比 / 汇总
const overviewTab = ref<'compare' | 'summary'>('compare')

// 每日序列（趋势图数据）
const days = computed<DayAggregate[]>(() =>
  buildDailySeries(
    feedingStore.feedings,
    diaperStore.diapers,
    pumpingStore.pumpings,
    sleepStore.sleeps,
    rangeStart.value,
    rangeEnd.value,
  ),
)

// 当前区间 vs 上一等长区间（对比）
const previousStart = computed(() => rangeStart.value - (rangeEnd.value - rangeStart.value))
const currentAgg = computed(() =>
  aggregateRange(feedingStore.feedings, diaperStore.diapers, pumpingStore.pumpings, sleepStore.sleeps, rangeStart.value, rangeEnd.value),
)
const previousAgg = computed(() =>
  aggregateRange(feedingStore.feedings, diaperStore.diapers, pumpingStore.pumpings, sleepStore.sleeps, previousStart.value, rangeStart.value),
)
const comparisons = computed<ComparisonResult[]>(() => compareRanges(currentAgg.value, previousAgg.value))

// 格式化轴标签
const xLabels = computed(() => days.value.map((d) => d.date.slice(5).replace('-', '/')))
const yFormatter = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

// —— 趋势图配置 ——
const milkOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: { type: 'category', data: xLabels.value, axisLabel: { color: axisColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: axisLineColor.value } } },
  yAxis: { type: 'value', axisLabel: { color: '#8c7b72', fontSize: 10, formatter: yFormatter }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    {
      name: '奶量(ml)',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: days.value.map((d) => d.totalMilkAmount),
      lineStyle: { width: 2.5, color: CHART_COLORS.feedAmount },
      itemStyle: { color: CHART_COLORS.feedAmount },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,144,108,0.25)' }, { offset: 1, color: 'rgba(232,144,108,0.02)' }] } },
    },
  ],
}))

const sleepOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: { type: 'category', data: xLabels.value, axisLabel: { color: axisColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: axisLineColor.value } } },
  yAxis: { type: 'value', axisLabel: { color: '#8c7b72', fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    {
      name: '睡眠(小时)',
      type: 'bar',
      barMaxWidth: 22,
      data: days.value.map((d) => +(d.sleepMs / 3600_000).toFixed(1)),
      itemStyle: { color: CHART_COLORS.sleep, borderRadius: [4, 4, 0, 0] },
    },
  ],
}))

const diaperOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: { type: 'category', data: xLabels.value, axisLabel: { color: axisColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: axisLineColor.value } } },
  yAxis: { type: 'value', axisLabel: { color: '#8c7b72', fontSize: 10 }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    {
      name: '尿湿(次)',
      type: 'bar',
      stack: 'diaper',
      barMaxWidth: 22,
      data: days.value.map((d) => d.wetCount),
      itemStyle: { color: '#8FB9D8' },
    },
    {
      name: '便便(次)',
      type: 'bar',
      stack: 'diaper',
      barMaxWidth: 22,
      data: days.value.map((d) => d.dirtyCount),
      itemStyle: { color: '#B58B62' },
    },
  ],
}))

const pumpOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: { type: 'category', data: xLabels.value, axisLabel: { color: axisColor.value, fontSize: 10 }, axisLine: { lineStyle: { color: axisLineColor.value } } },
  yAxis: { type: 'value', axisLabel: { color: '#8c7b72', fontSize: 10, formatter: yFormatter }, splitLine: { lineStyle: { color: splitLineColor.value } } },
  series: [
    {
      name: '吸奶(ml)',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: days.value.map((d) => d.pumpAmount),
      lineStyle: { width: 2.5, color: CHART_COLORS.pump },
      itemStyle: { color: CHART_COLORS.pump },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(216,168,200,0.25)' }, { offset: 1, color: 'rgba(216,168,200,0.02)' }] } },
    },
  ],
}))

// 对比面板格式化
function formatComparisonValue(c: ComparisonResult, value: number): string {
  if (c.key === 'sleepMs') return formatDuration(value)
  if (c.key === 'totalMilkAmount' || c.key === 'breastMilkAmount' || c.key === 'formulaAmount' || c.key === 'pumpAmount') {
    return `${Math.round(value)} ml`
  }
  return `${Math.round(value)} 次`
}

const rangeLabel = computed(() => range.value.label)

// —— 区间汇总（周报/月报）——
const summaryDays = computed(() => Math.max(1, currentAgg.value.dayCount))
const rangeGrowthCount = computed(() => growthStore.growths.filter((g) => g.date >= rangeStart.value && g.date <= rangeEnd.value).length)

const summaryItems = computed(() => {
  const agg = currentAgg.value
  const days = summaryDays.value
  return [
    { label: '喂养次数', value: `${agg.feedCount} 次`, sub: `日均 ${(agg.feedCount / days).toFixed(1)} 次` },
    { label: '总奶量', value: formatAmount(agg.totalMilkAmount), sub: `日均 ${formatAmount(agg.totalMilkAmount / days)}` },
    { label: '亲喂次数', value: `${agg.breastCount} 次`, sub: `日均 ${(agg.breastCount / days).toFixed(1)} 次` },
    { label: '睡眠时长', value: formatDuration(agg.sleepMs), sub: `日均 ${formatDuration(agg.sleepMs / days)}` },
    { label: '纸尿裤', value: `${agg.diaperCount} 次`, sub: `日均 ${(agg.diaperCount / days).toFixed(1)} 次` },
    { label: '吸奶量', value: formatAmount(agg.pumpAmount), sub: `日均 ${formatAmount(agg.pumpAmount / days)}` },
    { label: '成长记录', value: `${rangeGrowthCount.value} 条`, sub: rangeLabel.value },
  ]
})

// —— 成长曲线（体重/身高 + WHO 生长标准参考）——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const growthRecords = computed(() => [...growthStore.growths].sort((a, b) => a.date - b.date))
/** 有出生日期才能换算月龄 */
const hasBirthDate = computed(() => Boolean(activeBaby.value?.birthDate))
const whoPoints = computed(() => whoData(activeBaby.value?.gender))

const weightPoints = computed(() =>
  growthRecords.value
    .filter((g) => g.weight != null)
    .map((g) => ({ month: ageInMonths(activeBaby.value!.birthDate!, g.date), weight: g.weight! }))
    .sort((a, b) => a.month - b.month),
)
const heightPoints = computed(() =>
  growthRecords.value
    .filter((g) => g.height != null)
    .map((g) => ({ month: ageInMonths(activeBaby.value!.birthDate!, g.date), height: g.height! }))
    .sort((a, b) => a.month - b.month),
)
/** 图表横轴上限：至少覆盖已有记录的最大月龄（不低于 24 月） */
const growthXMax = computed(() => Math.max(24, Math.ceil(Math.max(3, ...weightPoints.value.map((p) => p.month), ...heightPoints.value.map((p) => p.month)))))
const hasGrowthData = computed(() => weightPoints.value.length > 0 || heightPoints.value.length > 0)

function whoSeries(field: 'weight' | 'length', key: 'p3' | 'p50' | 'p97'): [number, number][] {
  return whoPoints.value.filter((p) => p.month <= growthXMax.value).map((p) => [p.month, p[field][key]])
}

const growthTooltip = (unit: string) => ({
  trigger: 'axis' as const,
  valueFormatter: (v: unknown) => (Array.isArray(v) ? `${Number(v[1]).toFixed(1)} ${unit}` : `${v} ${unit}`),
})

const weightOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'value',
    min: 0,
    max: growthXMax.value,
    axisLabel: { color: axisColor.value, fontSize: 10, formatter: (v: number) => `${v}月` },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}kg` },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  tooltip: growthTooltip('kg'),
  series: [
    { name: 'P97', type: 'line', data: whoSeries('weight', 'p97'), symbol: 'none', lineStyle: { width: 1, color: '#c4b6a6', type: 'dashed' }, itemStyle: { color: '#c4b6a6' } },
    { name: 'P50', type: 'line', data: whoSeries('weight', 'p50'), symbol: 'none', lineStyle: { width: 1, color: '#a49482', type: 'dashed' }, itemStyle: { color: '#a49482' } },
    { name: 'P3', type: 'line', data: whoSeries('weight', 'p3'), symbol: 'none', lineStyle: { width: 1, color: '#c4b6a6', type: 'dashed' }, itemStyle: { color: '#c4b6a6' } },
    {
      name: '宝宝体重',
      type: 'line',
      data: weightPoints.value.map((p) => [p.month, p.weight]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 2.5, color: CHART_COLORS.feedAmount },
      itemStyle: { color: CHART_COLORS.feedAmount },
    },
  ],
}))

const heightOption = computed<EChartsOption>(() => ({
  grid: { left: 44, right: 16, top: 12, bottom: 28 },
  xAxis: {
    type: 'value',
    min: 0,
    max: growthXMax.value,
    axisLabel: { color: axisColor.value, fontSize: 10, formatter: (v: number) => `${v}月` },
    axisLine: { lineStyle: { color: axisLineColor.value } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#8c7b72', fontSize: 10, formatter: (v: number) => `${v}cm` },
    splitLine: { lineStyle: { color: splitLineColor.value } },
  },
  tooltip: growthTooltip('cm'),
  series: [
    { name: 'P97', type: 'line', data: whoSeries('length', 'p97'), symbol: 'none', lineStyle: { width: 1, color: '#c4b6a6', type: 'dashed' }, itemStyle: { color: '#c4b6a6' } },
    { name: 'P50', type: 'line', data: whoSeries('length', 'p50'), symbol: 'none', lineStyle: { width: 1, color: '#a49482', type: 'dashed' }, itemStyle: { color: '#a49482' } },
    { name: 'P3', type: 'line', data: whoSeries('length', 'p3'), symbol: 'none', lineStyle: { width: 1, color: '#c4b6a6', type: 'dashed' }, itemStyle: { color: '#c4b6a6' } },
    {
      name: '宝宝身高',
      type: 'line',
      data: heightPoints.value.map((p) => [p.month, p.height]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 2.5, color: CHART_COLORS.sleep },
      itemStyle: { color: CHART_COLORS.sleep },
    },
  ],
}))
</script>

<template>
  <div class="page stats-page">
    <PageHeader />

    <!-- 时间范围 -->
    <div class="range-select-row">
      <label class="range-select-label" for="range-select">时间范围</label>
      <select id="range-select" v-model="rangeKey" class="form-input range-select">
        <option v-for="p in RANGE_PRESETS" :key="p.key" :value="p.key">{{ p.label }}</option>
      </select>
    </div>

    <!-- 概览：与上一周期对比 / 区间汇总（tab 切换） -->
    <div class="card overview-card">
      <div class="overview-tabs" role="tablist">
        <button class="overview-tab" :class="{ active: overviewTab === 'compare' }" role="tab" :aria-selected="overviewTab === 'compare'" @click="overviewTab = 'compare'">
          与上一周期对比
        </button>
        <button class="overview-tab" :class="{ active: overviewTab === 'summary' }" role="tab" :aria-selected="overviewTab === 'summary'" @click="overviewTab = 'summary'">
          {{ rangeLabel }}汇总
        </button>
      </div>

      <div v-if="overviewTab === 'compare'" class="overview-body">
        <span class="overview-sub">{{ rangeLabel }} vs 上一周期（等长）</span>
        <div class="compare-grid">
          <div v-for="c in comparisons" :key="c.key" class="compare-item">
            <p class="compare-label">{{ c.label }}</p>
            <p class="compare-value">{{ formatComparisonValue(c, c.current) }}</p>
            <div class="compare-change-row">
              <span class="compare-change" :class="c.change === null ? 'none' : c.change >= 0 ? 'up' : 'down'">
                {{ c.change === null ? '—' : formatPercentChange(c.change) }}
              </span>
              <span class="compare-prev">{{ formatComparisonValue(c, c.previous) }} → {{ formatComparisonValue(c, c.current) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="overview-body">
        <span class="overview-sub">共 {{ summaryDays }} 天 · 每日均值参考</span>
        <div class="summary-grid">
          <div v-for="s in summaryItems" :key="s.label" class="summary-item">
            <p class="summary-label">{{ s.label }}</p>
            <p class="summary-value">{{ s.value }}</p>
            <p class="summary-sub">{{ s.sub }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 趋势图 -->
    <ChartCard title="每日奶量趋势" :subtitle="`${rangeLabel} · 瓶喂母乳 + 配方奶`" :option="milkOption" />
    <ChartCard title="每日睡眠时长" :subtitle="rangeLabel" :option="sleepOption" />
    <ChartCard title="纸尿裤使用" :subtitle="`${rangeLabel} · 蓝色=尿湿 棕色=便便`" :option="diaperOption" />
    <ChartCard title="每日吸奶量" :subtitle="rangeLabel" :option="pumpOption" />

    <!-- 成长曲线 -->
    <p class="section-title">成长曲线</p>
    <template v-if="hasBirthDate">
      <ChartCard v-if="weightPoints.length > 0" title="体重曲线" :subtitle="`WHO 生长标准参考（虚线 P3/P50/P97）· ${activeBaby?.name ?? ''}`" :option="weightOption" />
      <ChartCard v-else-if="hasGrowthData" title="体重曲线" subtitle="暂无体重记录，去「今日」页记录吧" :option="{ grid: { top: 40 }, xAxis: { type: 'value', axisLabel: { show: false } }, yAxis: { type: 'value', axisLabel: { show: false } }, series: [] }" />
      <ChartCard v-if="heightPoints.length > 0" title="身高曲线" :subtitle="`WHO 生长标准参考（虚线 P3/P50/P97）· ${activeBaby?.name ?? ''}`" :option="heightOption" />
      <ChartCard v-else-if="hasGrowthData" title="身高曲线" subtitle="暂无身高记录，去「今日」页记录吧" :option="{ grid: { top: 40 }, xAxis: { type: 'value', axisLabel: { show: false } }, yAxis: { type: 'value', axisLabel: { show: false } }, series: [] }" />
      <div v-if="!hasGrowthData" class="card empty-inline">暂无成长记录，去「今日」页记录体重/身高后即可查看 WHO 生长曲线</div>
    </template>
    <div v-else class="card empty-inline">请先在「设置」中为 {{ activeBaby?.name ?? '宝宝' }} 设置出生日期，即可查看成长曲线（参照 WHO 生长标准）</div>

    <p class="note-text">亲喂时长因无法计量奶量，未计入奶量趋势；可在记录详情中查看每次亲喂时长。</p>
  </div>
</template>

<style scoped>
.range-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 12px;
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
}

.overview-card {
  margin-bottom: 12px;
}

.overview-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 14px;
}

.overview-tab {
  flex: 1;
  min-height: 0; /* 覆盖全局 button min-height:44px */
  padding: 9px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.overview-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.overview-sub {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 400px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

.summary-item {
  background: var(--surface-2);
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
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
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
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

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 18px 2px 10px;
}

.empty-inline {
  text-align: center;
  padding: 28px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>