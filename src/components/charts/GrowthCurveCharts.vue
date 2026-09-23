<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EChartsOption } from 'echarts'
import ChartCard from '@/components/charts/ChartCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { whoData, ageInMonths, type WhoField, type WhoPercentileKey } from '@/constants/whoGrowth'
import { estimatePercentile } from '@/utils/growthPercentile'
import { isDark } from '@/composables/useTheme'
import { CHART_COLORS } from '@/constants'
import { startOfDay } from '@/utils/format'
import type { BabyGender, GrowthRecord } from '@/types'

const props = defineProps<{
  babyName: string
  gender?: BabyGender
  /** 出生日期 YYYY-MM-DD（缺失时不渲染成长曲线） */
  birthDate?: string
  /** 该宝宝的全部成长记录 */
  records: GrowthRecord[]
}>()

const { t } = useI18n()

// 图表配色跟随主题
const axisColor = computed(() => (isDark.value ? '#b9ab9e' : '#8c7b72'))
const axisLineColor = computed(() => (isDark.value ? '#42372f' : '#f0e2d4'))
const splitLineColor = computed(() => (isDark.value ? '#2b251f' : '#f5ece2'))

// WHO 生长曲线说明弹窗
const growthInfoOpen = ref(false)

const whoPoints = computed(() => whoData(props.gender))
/** 按日合并：同一天多次测量取当天最后一条，曲线图以「日」为单位展示 */
const growthRecords = computed(() => {
  const byDay = new Map<number, GrowthRecord>()
  const sorted = [...props.records].sort((a, b) => a.date - b.date)
  sorted.forEach((g) => byDay.set(startOfDay(g.date), g))
  return [...byDay.values()].sort((a, b) => a.date - b.date)
})
/** 有出生日期才能换算月龄/绘制参考线 */
const hasBirthDate = computed(() => Boolean(props.birthDate))

/** 出生日 0 点时间戳（时间轴原点） */
const birthTs = computed(() => {
  const b = props.birthDate
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
    ageInMonths(props.birthDate!, p.ts),
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

/** 空态图表配置 */
const emptyOption: EChartsOption = {
  grid: { top: 40 },
  xAxis: { type: 'value', axisLabel: { show: false } },
  yAxis: { type: 'value', axisLabel: { show: false } },
  series: [],
}

/** 最新一条记录的百分位信息（无出生日期或无记录时为 null） */
function latestPercentile(field: WhoField, points: { ts: number; value: number }[]): number | null {
  if (!props.birthDate || points.length === 0) return null
  const last = points[points.length - 1]
  const month = ageInMonths(props.birthDate, last.ts)
  return estimatePercentile(whoPoints.value, month, field, last.value)
}

/** 图副标题：宝宝名 + 最新记录百分位（如「小糯米 · 最新 8.9kg ≈ P60」） */
function growthSubtitle(field: WhoField, points: { ts: number; value: number }[]): string {
  const p = latestPercentile(field, points)
  if (p != null && points.length > 0) {
    const unit = field === 'weight' ? 'kg' : 'cm'
    const value = `${points[points.length - 1].value.toFixed(1)}${unit}`
    return `${props.babyName} · ${t('stats.growthLatestPercentile', { value, p })}`
  }
  return t('stats.growthSub', { name: props.babyName })
}

/** 趋势图 tooltip：显示日期 + 各系列数值，用户数据行附加估算百分位 */
const growthTooltip = (unit: string, field: WhoField, label: string) => ({
  trigger: 'axis' as const,
  formatter: (params: unknown) => {
    const list = params as Array<{ seriesName: string; marker: string; value?: [number, number] }>
    const first = list.find((p) => Array.isArray(p.value))
    if (!first?.value) return ''
    const d = new Date(first.value[0])
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const month = props.birthDate ? ageInMonths(props.birthDate, first.value[0]) : null
    const lines = list.map((p) => {
      const v = Array.isArray(p.value) ? p.value[1] : null
      let line = `${p.marker}${p.seriesName}: ${v != null ? Number(v).toFixed(1) : '-'} ${unit}`
      if (v != null && month != null && p.seriesName === label) {
        line += ` ≈ P${estimatePercentile(whoPoints.value, month, field, v)}`
      }
      return line
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
  tooltip: growthTooltip('kg', 'weight', t('stats.babyWeight')),
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
  tooltip: growthTooltip('cm', 'length', t('stats.babyHeight')),
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
  tooltip: growthTooltip('cm', 'hc', t('stats.babyHead')),
  series: growthSeries('hc', hcPoints.value, '#6AB0D8', t('stats.babyHead')),
}))

const weightSubtitle = computed(() => growthSubtitle('weight', weightPoints.value))
const heightSubtitle = computed(() => growthSubtitle('length', heightPoints.value))
const hcSubtitle = computed(() => growthSubtitle('hc', hcPoints.value))
</script>

<template>
  <div class="growth-curve-charts">
    <template v-if="hasBirthDate">
      <ChartCard
        v-if="weightPoints.length > 0"
        :title="t('stats.growthTitle')"
        :subtitle="weightSubtitle"
        :option="weightOption"
      >
        <template #title-action>
          <button
            class="growth-info-btn"
            :aria-label="t('stats.whoInfoTitle')"
            @click="growthInfoOpen = true"
          >
            ?
          </button>
        </template>
      </ChartCard>
      <ChartCard
        v-else-if="hasGrowthData"
        :title="t('stats.growthTitle')"
        :subtitle="t('stats.growthEmpty')"
        :option="emptyOption"
      />

      <ChartCard
        v-if="heightPoints.length > 0"
        :title="t('stats.heightTitle')"
        :subtitle="heightSubtitle"
        :option="heightOption"
      >
        <template #title-action>
          <button
            class="growth-info-btn"
            :aria-label="t('stats.whoInfoTitle')"
            @click="growthInfoOpen = true"
          >
            ?
          </button>
        </template>
      </ChartCard>
      <ChartCard
        v-else-if="hasGrowthData"
        :title="t('stats.heightTitle')"
        :subtitle="t('stats.heightEmpty')"
        :option="emptyOption"
      />

      <ChartCard
        v-if="hcPoints.length > 0"
        :title="t('stats.hcTitle')"
        :subtitle="hcSubtitle"
        :option="hcOption"
      >
        <template #title-action>
          <button
            class="growth-info-btn"
            :aria-label="t('stats.whoInfoTitle')"
            @click="growthInfoOpen = true"
          >
            ?
          </button>
        </template>
      </ChartCard>
      <ChartCard
        v-else-if="hasGrowthData"
        :title="t('stats.hcTitle')"
        :subtitle="t('stats.hcEmpty')"
        :option="emptyOption"
      />

      <div v-if="!hasGrowthData" class="card empty-inline">
        {{ t('stats.growthEmptyBoth') }}
      </div>
    </template>
    <div v-else class="card empty-inline">
      {{ t('stats.growthCta', { name: babyName || t('common.baby') }) }}
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
.growth-info-btn {
  flex-shrink: 0;
  min-height: 0; /* 覆盖全局 button min-height:44px，保持正圆 */
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
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
    background 0.3s var(--spring),
    color 0.25s var(--ease-out),
    border-color 0.25s var(--ease-out);
}

.growth-info-btn:hover {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
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
  color: var(--primary);
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

.empty-inline {
  text-align: center;
  padding: 20px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>