import type { Feeding, DiaperChange, Pumping, Sleep, SolidFood, Medication, Temperature } from '@/types'
import { startOfDay, startOfMonth, endOfMonth, formatDate } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'

/** 统计用的记录数据集 */
export interface RecordDatasets {
  feedings: Feeding[]
  diapers: DiaperChange[]
  pumpings: Pumping[]
  sleeps: Sleep[]
  solidFoods?: SolidFood[]
  medications?: Medication[]
  temperatures?: Temperature[]
}

/** 单日聚合数据 */
export interface DayAggregate {
  date: string // YYYY-MM-DD
  dayStart: number
  /** 总瓶喂奶量 ml（瓶喂母乳 + 配方奶） */
  bottleAmount: number
  breastMilkAmount: number
  formulaAmount: number
  /** 总奶量（含亲喂估算 0 + 瓶喂） */
  totalMilkAmount: number
  /** 亲喂次数（左/右/双） */
  breastCount: number
  /** 瓶喂次数 */
  bottleCount: number
  /** 喂养总次数 */
  feedCount: number
  /** 睡眠时长 ms */
  sleepMs: number
  /** 小睡次数 */
  napCount: number
  /** 夜间睡眠次数 */
  nightCount: number
  /** 尿布更换总数 */
  diaperCount: number
  wetCount: number
  dirtyCount: number
  /** 吸奶总量 ml */
  pumpAmount: number
  /** 吸奶次数 */
  pumpCount: number
  /** 吸奶总时长 ms */
  pumpMs: number
  /** 辅食次数 */
  solidFoodCount: number
  /** 用药次数 */
  medicationCount: number
  /** 体温测量次数 */
  temperatureCount: number
  /** 当日体温平均值 ℃（无记录为 0） */
  temperatureAvg: number
}

/** 区间聚合（含奶量细分） */
export interface RangeAggregate {
  dayCount: number
  totalMilkAmount: number
  breastMilkAmount: number
  formulaAmount: number
  feedCount: number
  breastCount: number
  bottleCount: number
  sleepMs: number
  napCount: number
  nightCount: number
  diaperCount: number
  wetCount: number
  dirtyCount: number
  pumpAmount: number
  pumpCount: number
  pumpMs: number
  solidFoodCount: number
  medicationCount: number
  temperatureCount: number
}

/** 区间聚合中按日累加的指标键（汇总/对比的单一来源） */
const RANGE_METRIC_KEYS = [
  'totalMilkAmount',
  'breastMilkAmount',
  'formulaAmount',
  'feedCount',
  'breastCount',
  'bottleCount',
  'sleepMs',
  'napCount',
  'nightCount',
  'diaperCount',
  'wetCount',
  'dirtyCount',
  'pumpAmount',
  'pumpCount',
  'pumpMs',
  'solidFoodCount',
  'medicationCount',
  'temperatureCount',
] as const satisfies readonly (keyof RangeAggregate)[]

type RangeMetrics = Omit<RangeAggregate, 'dayCount'>

function emptyMetrics(): RangeMetrics {
  const m = {} as RangeMetrics
  for (const k of RANGE_METRIC_KEYS) m[k] = 0
  return m
}

/** 生成空聚合 */
export function emptyDay(dayStart: number): DayAggregate {
  return {
    date: formatDate(dayStart),
    dayStart,
    bottleAmount: 0,
    ...emptyMetrics(),
    temperatureAvg: 0,
  }
}

/** 按日遍历记录并归桶（dayMap 命中才处理） */
function forEachDay<T>(
  list: T[],
  dayMap: Map<number, DayAggregate>,
  getTime: (item: T) => number,
  reduce: (day: DayAggregate, item: T) => void,
): void {
  for (const item of list) {
    const d = dayMap.get(startOfDay(getTime(item)))
    if (d) reduce(d, item)
  }
}

/** 生成从 start 到 end（不含）的每日序列 */
export function buildDailySeries(ds: RecordDatasets, start: number, end: number): DayAggregate[] {
  const days: DayAggregate[] = []
  const startDay = startOfDay(start)
  const endDay = startOfDay(end)
  for (let t = startDay; t < endDay; t += MS_PER_DAY) {
    days.push(emptyDay(t))
  }
  const dayMap = new Map<number, DayAggregate>()
  for (const d of days) dayMap.set(d.dayStart, d)

  // 睡眠可能跨天，按开始时间归到当天
  forEachDay(ds.sleeps, dayMap, (s) => s.startTime, (d, s) => {
    d.sleepMs += Math.max(0, (s.endTime ?? s.startTime) - s.startTime)
    if (s.type === 'nap') d.napCount++
    else d.nightCount++
  })

  forEachDay(ds.feedings, dayMap, (f) => f.startTime, (d, f) => {
    d.feedCount++
    if (f.type === 'breast') {
      d.breastCount++
      // 亲喂量按估算：无奶量数据，仅计数
    } else {
      d.bottleCount++
      const amt = f.amount ?? 0
      d.bottleAmount += amt
      if (f.type === 'bottle_formula') {
        d.formulaAmount += amt
      } else {
        d.breastMilkAmount += amt
      }
      d.totalMilkAmount += amt
    }
  })

  forEachDay(ds.pumpings, dayMap, (p) => p.startTime, (d, p) => {
    d.pumpCount++
    d.pumpAmount += p.amount ?? 0
    d.pumpMs += p.duration ?? 0
  })

  forEachDay(ds.diapers, dayMap, (dp) => dp.time, (d, dp) => {
    d.diaperCount++
    if (dp.type === 'wet' || dp.type === 'both') d.wetCount++
    if (dp.type === 'dirty' || dp.type === 'both') d.dirtyCount++
  })

  forEachDay(ds.solidFoods ?? [], dayMap, (sf) => sf.time, (d) => {
    d.solidFoodCount++
  })

  forEachDay(ds.medications ?? [], dayMap, (m) => m.time, (d) => {
    d.medicationCount++
  })

  // 体温：每天聚合次数与均值
  forEachDay(ds.temperatures ?? [], dayMap, (tmp) => tmp.time, (d, tmp) => {
    d.temperatureCount++
    d.temperatureAvg += tmp.value
  })
  for (const d of days) {
    if (d.temperatureCount > 0) d.temperatureAvg = d.temperatureAvg / d.temperatureCount
  }

  return days
}

/** 将每日序列汇总为区间聚合（可复用已有 days，避免二次分桶） */
export function sumDays(days: DayAggregate[]): RangeAggregate {
  const agg: RangeAggregate = { dayCount: days.length, ...emptyMetrics() }
  for (const d of days) {
    for (const k of RANGE_METRIC_KEYS) agg[k] += d[k]
  }
  return agg
}

/** 区间汇总（用于对比面板） */
export function aggregateRange(ds: RecordDatasets, start: number, end: number): RangeAggregate {
  return sumDays(buildDailySeries(ds, start, end))
}

/** 区间比较结果：当前 vs 上一周期 */
export interface ComparisonResult {
  key: string
  label: string
  current: number
  previous: number
  /** 变化百分比，previous 为 0 时返回 null */
  change: number | null
  /** 每日均值（当前周期） */
  dailyAvg: number
}

/** 对比指标注册表（key 对应 RangeAggregate 字段，label 为 i18n key） */
const COMPARE_METRICS = [
  { key: 'totalMilkAmount', label: 'stats.compare.totalMilk' },
  { key: 'breastMilkAmount', label: 'stats.compare.bottleMilk' },
  { key: 'formulaAmount', label: 'stats.compare.formula' },
  { key: 'feedCount', label: 'stats.compare.feedCount' },
  { key: 'breastCount', label: 'stats.compare.breastCount' },
  { key: 'sleepMs', label: 'stats.compare.sleepMs' },
  { key: 'diaperCount', label: 'stats.compare.diaperCount' },
  { key: 'pumpAmount', label: 'stats.compare.pumpAmount' },
  { key: 'pumpCount', label: 'stats.compare.pumpCount' },
  { key: 'solidFoodCount', label: 'stats.compare.solidFoodCount' },
  { key: 'medicationCount', label: 'stats.compare.medicationCount' },
  { key: 'temperatureCount', label: 'stats.compare.temperatureCount' },
] as const satisfies readonly { key: keyof RangeAggregate; label: string }[]

/** 比较两个区间各指标（label 为 i18n key） */
export function compareRanges(current: RangeAggregate, previous: RangeAggregate): ComparisonResult[] {
  return COMPARE_METRICS.map(({ key, label }) => {
    const cur = current[key]
    const prev = previous[key]
    return {
      key,
      label,
      current: cur,
      previous: prev,
      change: prev === 0 ? null : ((cur - prev) / prev) * 100,
      dailyAvg: current.dayCount > 0 ? cur / current.dayCount : 0,
    }
  })
}

/** 常用预设区间 */
export interface RangePreset {
  key: string
  label: string
  /** 返回 [start, end] 毫秒时间戳 */
  getRange: (now: number) => [number, number]
}

/** 最近 n 天（含今天）预设 */
function daysPreset(n: number, label: string): RangePreset {
  return {
    key: `${n}d`,
    label,
    getRange: (now) => {
      const todayStart = startOfDay(now)
      return [todayStart - (n - 1) * MS_PER_DAY, todayStart + MS_PER_DAY]
    },
  }
}

export const RANGE_PRESETS: RangePreset[] = [
  {
    key: 'today',
    label: 'stats.periods.today',
    getRange: (now) => {
      const s = startOfDay(now)
      return [s, s + MS_PER_DAY]
    },
  },
  daysPreset(7, 'stats.periods.week7'),
  daysPreset(14, 'stats.periods.week14'),
  daysPreset(30, 'stats.periods.week30'),
  {
    key: 'month',
    label: 'stats.periods.month',
    getRange: (now) => [startOfMonth(now), endOfMonth(now)],
  },
  {
    key: 'all',
    label: 'stats.periods.all',
    // 用有限上界：MAX_SAFE_INTEGER 会使 startOfDay 得到 NaN，日序列直接变空
    getRange: (now) => [0, startOfDay(now) + MS_PER_DAY],
  },
]
