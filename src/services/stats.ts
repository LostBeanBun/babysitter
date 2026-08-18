import type { Feeding, DiaperChange, Pumping, Sleep } from '@/types'
import { startOfDay, formatDate } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'

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
}

/** 生成空聚合 */
export function emptyDay(dayStart: number): DayAggregate {
  return {
    date: formatDate(dayStart),
    dayStart,
    bottleAmount: 0,
    breastMilkAmount: 0,
    formulaAmount: 0,
    totalMilkAmount: 0,
    breastCount: 0,
    bottleCount: 0,
    feedCount: 0,
    sleepMs: 0,
    napCount: 0,
    nightCount: 0,
    diaperCount: 0,
    wetCount: 0,
    dirtyCount: 0,
    pumpAmount: 0,
    pumpCount: 0,
    pumpMs: 0,
  }
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
}

/** 生成从 start 到 end（不含）的每日序列 */
export function buildDailySeries(
  feedings: Feeding[],
  diapers: DiaperChange[],
  pumpings: Pumping[],
  sleeps: Sleep[],
  start: number,
  end: number,
): DayAggregate[] {
  const days: DayAggregate[] = []
  const startDay = startOfDay(start)
  const endDay = startOfDay(end)
  for (let t = startDay; t < endDay; t += MS_PER_DAY) {
    days.push(emptyDay(t))
  }
  const dayMap = new Map<number, DayAggregate>()
  for (const d of days) dayMap.set(d.dayStart, d)

  // 睡眠可能跨天，按开始时间归到当天
  for (const s of sleeps) {
    const d = dayMap.get(startOfDay(s.startTime))
    if (!d) continue
    d.sleepMs += Math.max(0, s.endTime - s.startTime)
    if (s.type === 'nap') d.napCount++
    else d.nightCount++
  }

  for (const f of feedings) {
    const d = dayMap.get(startOfDay(f.startTime))
    if (!d) continue
    d.feedCount++
    if (f.type.startsWith('breast')) {
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
  }

  for (const p of pumpings) {
    const d = dayMap.get(startOfDay(p.startTime))
    if (!d) continue
    d.pumpCount++
    d.pumpAmount += p.amount ?? 0
    d.pumpMs += p.duration ?? 0
  }

  for (const dp of diapers) {
    const d = dayMap.get(startOfDay(dp.time))
    if (!d) continue
    d.diaperCount++
    if (dp.type === 'wet' || dp.type === 'both') d.wetCount++
    if (dp.type === 'dirty' || dp.type === 'both') d.dirtyCount++
  }

  return days
}

/** 区间汇总（用于对比面板） */
export function aggregateRange(
  feedings: Feeding[],
  diapers: DiaperChange[],
  pumpings: Pumping[],
  sleeps: Sleep[],
  start: number,
  end: number,
): RangeAggregate {
  const days = buildDailySeries(feedings, diapers, pumpings, sleeps, start, end)
  const agg: RangeAggregate = {
    dayCount: days.length,
    totalMilkAmount: 0,
    breastMilkAmount: 0,
    formulaAmount: 0,
    feedCount: 0,
    breastCount: 0,
    bottleCount: 0,
    sleepMs: 0,
    napCount: 0,
    nightCount: 0,
    diaperCount: 0,
    wetCount: 0,
    dirtyCount: 0,
    pumpAmount: 0,
    pumpCount: 0,
    pumpMs: 0,
  }
  for (const d of days) {
    agg.totalMilkAmount += d.totalMilkAmount
    agg.breastMilkAmount += d.breastMilkAmount
    agg.formulaAmount += d.formulaAmount
    agg.feedCount += d.feedCount
    agg.breastCount += d.breastCount
    agg.bottleCount += d.bottleCount
    agg.sleepMs += d.sleepMs
    agg.napCount += d.napCount
    agg.nightCount += d.nightCount
    agg.diaperCount += d.diaperCount
    agg.wetCount += d.wetCount
    agg.dirtyCount += d.dirtyCount
    agg.pumpAmount += d.pumpAmount
    agg.pumpCount += d.pumpCount
    agg.pumpMs += d.pumpMs
  }
  return agg
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

/** 比较两个区间各指标 */
export function compareRanges(current: RangeAggregate, previous: RangeAggregate): ComparisonResult[] {
  const items: { key: string; label: string; current: number; previous: number }[] = [
    { key: 'totalMilkAmount', label: '总奶量', current: current.totalMilkAmount, previous: previous.totalMilkAmount },
    { key: 'breastMilkAmount', label: '瓶喂母乳量', current: current.breastMilkAmount, previous: previous.breastMilkAmount },
    { key: 'formulaAmount', label: '配方奶量', current: current.formulaAmount, previous: previous.formulaAmount },
    { key: 'feedCount', label: '喂养次数', current: current.feedCount, previous: previous.feedCount },
    { key: 'breastCount', label: '亲喂次数', current: current.breastCount, previous: previous.breastCount },
    { key: 'sleepMs', label: '睡眠时长', current: current.sleepMs, previous: previous.sleepMs },
    { key: 'diaperCount', label: '纸尿裤次数', current: current.diaperCount, previous: previous.diaperCount },
    { key: 'pumpAmount', label: '吸奶量', current: current.pumpAmount, previous: previous.pumpAmount },
    { key: 'pumpCount', label: '吸奶次数', current: current.pumpCount, previous: previous.pumpCount },
  ]

  return items.map((item) => {
    const change =
      item.previous === 0
        ? item.current === 0
          ? null
          : null
        : ((item.current - item.previous) / item.previous) * 100
    const dailyAvg = current.dayCount > 0 ? item.current / current.dayCount : 0
    return {
      key: item.key,
      label: item.label,
      current: item.current,
      previous: item.previous,
      change,
      dailyAvg,
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

export const RANGE_PRESETS: RangePreset[] = [
  {
    key: 'today',
    label: '今天',
    getRange: (now) => {
      const s = startOfDay(now)
      return [s, s + MS_PER_DAY]
    },
  },
  {
    key: '7d',
    label: '近7天',
    getRange: (now) => {
      const s = startOfDay(now) - 6 * MS_PER_DAY
      return [s, startOfDay(now) + MS_PER_DAY]
    },
  },
  {
    key: '14d',
    label: '近14天',
    getRange: (now) => {
      const s = startOfDay(now) - 13 * MS_PER_DAY
      return [s, startOfDay(now) + MS_PER_DAY]
    },
  },
  {
    key: '30d',
    label: '近30天',
    getRange: (now) => {
      const s = startOfDay(now) - 29 * MS_PER_DAY
      return [s, startOfDay(now) + MS_PER_DAY]
    },
  },
  {
    key: 'month',
    label: '本月',
    getRange: (now) => {
      const d = new Date(now)
      const s = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
      return [s, e]
    },
  },
  {
    key: 'all',
    label: '全部',
    getRange: () => [0, Number.MAX_SAFE_INTEGER],
  },
]

/** 对比预设：当前区间 vs 前一个等长区间 */
export function getComparisonRange(presetKey: string, now: number): { current: [number, number]; previous: [number, number]; currentLabel: string; previousLabel: string } | null {
  const preset = RANGE_PRESETS.find((p) => p.key === presetKey)
  if (!preset) return null
  const [start, end] = preset.getRange(now)
  const len = end - start
  const previousStart = start - len
  return {
    current: [start, end],
    previous: [previousStart, start],
    currentLabel: preset.label,
    previousLabel: '上一周期',
  }
}