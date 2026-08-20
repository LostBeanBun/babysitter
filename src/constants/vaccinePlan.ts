/**
 * 疫苗计划库（0-6 岁）。
 * months 为建议接种月龄（0 表示出生时）；实际接种日期由宝宝出生日期推算。
 * 免费 = 国家免疫规划疫苗；自费 = 常见自费（二类）疫苗。
 */
import type { Vaccination } from '@/types'
export interface VaccinePlanItem {
  /** 疫苗名称 */
  name: string
  /** 剂次说明（如「第 1 剂」） */
  dose: string
  /** 建议接种月龄 */
  months: number
  /** 备注（可选） */
  note?: string
}

export type VaccinePlanCategory = 'free' | 'self'

/** 免费疫苗：国家免疫规划疫苗 */
export const VACCINE_PLAN: VaccinePlanItem[] = [
  { name: '乙肝疫苗', dose: '第 1 剂', months: 0, note: '出生时 24 小时内' },
  { name: '卡介苗', dose: '第 1 剂', months: 0, note: '出生时' },
  { name: '乙肝疫苗', dose: '第 2 剂', months: 1 },
  { name: '脊灰灭活疫苗（IPV）', dose: '第 1 剂', months: 2 },
  { name: '百白破疫苗', dose: '第 1 剂', months: 3 },
  { name: '脊灰灭活疫苗（IPV）', dose: '第 2 剂', months: 3 },
  { name: '百白破疫苗', dose: '第 2 剂', months: 4 },
  { name: '脊灰减毒活疫苗（bOPV）', dose: '第 3 剂', months: 4 },
  { name: '百白破疫苗', dose: '第 3 剂', months: 5 },
  { name: '流脑 A 群多糖疫苗', dose: '第 1 剂', months: 6 },
  { name: '乙肝疫苗', dose: '第 3 剂', months: 6 },
  { name: '乙脑减毒活疫苗', dose: '第 1 剂', months: 8 },
  { name: '麻腮风疫苗', dose: '第 1 剂', months: 8 },
  { name: '流脑 A 群多糖疫苗', dose: '第 2 剂', months: 9 },
  { name: '百白破疫苗', dose: '第 4 剂', months: 18 },
  { name: '麻腮风疫苗', dose: '第 2 剂', months: 18 },
  { name: '甲肝灭活疫苗', dose: '第 1 剂', months: 18 },
  { name: '甲肝灭活疫苗', dose: '第 2 剂', months: 24 },
  { name: '流脑 A+C 多糖疫苗', dose: '第 1 剂', months: 36 },
  { name: '白破疫苗', dose: '第 1 剂', months: 72 },
  { name: '流脑 A+C 多糖疫苗', dose: '第 2 剂', months: 72 },
]

/** 自费疫苗：常见二类疫苗（给宝宝的），可替代部分免费疫苗或补足保护 */
export const SELF_PAID_VACCINE_PLAN: VaccinePlanItem[] = [
  { name: '五联疫苗（百白破·脊灰·Hib）', dose: '第 1 剂', months: 2, note: '可替代百白破、脊灰、Hib 单独接种' },
  { name: '五联疫苗（百白破·脊灰·Hib）', dose: '第 2 剂', months: 3 },
  { name: '五联疫苗（百白破·脊灰·Hib）', dose: '第 3 剂', months: 4 },
  { name: '五联疫苗（百白破·脊灰·Hib）', dose: '第 4 剂', months: 18, note: '加强剂' },
  { name: '13 价肺炎球菌结合疫苗', dose: '第 1 剂', months: 2 },
  { name: '13 价肺炎球菌结合疫苗', dose: '第 2 剂', months: 4 },
  { name: '13 价肺炎球菌结合疫苗', dose: '第 3 剂', months: 6 },
  { name: '13 价肺炎球菌结合疫苗', dose: '第 4 剂', months: 12, note: '12-15 月龄加强' },
  { name: '五价轮状病毒疫苗', dose: '第 1 剂', months: 2, note: '口服，6 周龄起，每剂间隔 4-10 周' },
  { name: '五价轮状病毒疫苗', dose: '第 2 剂', months: 4 },
  { name: '五价轮状病毒疫苗', dose: '第 3 剂', months: 6 },
  { name: 'b 型流感嗜血杆菌（Hib）疫苗', dose: '第 1 剂', months: 2 },
  { name: 'b 型流感嗜血杆菌（Hib）疫苗', dose: '第 2 剂', months: 3 },
  { name: 'b 型流感嗜血杆菌（Hib）疫苗', dose: '第 3 剂', months: 4 },
  { name: 'b 型流感嗜血杆菌（Hib）疫苗', dose: '第 4 剂', months: 18, note: '接种五联疫苗则无需单独接种' },
  { name: '手足口病疫苗（EV71）', dose: '第 1 剂', months: 6, note: '共 2 剂，间隔 1 个月' },
  { name: '手足口病疫苗（EV71）', dose: '第 2 剂', months: 7 },
  { name: '流感疫苗', dose: '每年 1 剂', months: 6, note: '每年流感季前接种；首次接种需 2 剂（间隔 4 周）' },
  { name: '水痘疫苗', dose: '第 1 剂', months: 12 },
  { name: '水痘疫苗', dose: '第 2 剂', months: 48, note: '4 岁接种' },
  { name: 'AC 群流脑结合疫苗', dose: '第 1 剂', months: 6, note: '可替代流脑 A 群多糖疫苗' },
  { name: 'AC 群流脑结合疫苗', dose: '第 2 剂', months: 9 },
  { name: '乙脑灭活疫苗', dose: '第 1 剂', months: 8, note: '替代乙脑减毒活疫苗；8 月龄 2 剂间隔 7-10 天，2 岁、6 岁各 1 剂' },
]

export const VACCINE_PLAN_BY_CATEGORY: Record<VaccinePlanCategory, VaccinePlanItem[]> = {
  free: VACCINE_PLAN,
  self: SELF_PAID_VACCINE_PLAN,
}

/** 出生日期 + 月龄 → 建议接种日期（YYYY-MM-DD，月末溢出钳制） */
export function planDateFromBirth(birthDate: string, months: number): string {
  const d = new Date(birthDate + 'T00:00:00')
  const m = d.getMonth() + months
  const y = d.getFullYear() + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  const day = Math.min(d.getDate(), new Date(y, mm + 1, 0).getDate())
  const dt = new Date(y, mm, day)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 疫苗日历项状态 */
export type VaccineItemStatus = 'done' | 'due' | 'overdue' | 'upcoming'

export interface VaccineCalendarItem extends VaccinePlanItem {
  category: VaccinePlanCategory
  /** 建议接种日期（YYYY-MM-DD） */
  planDate: string
  /** 计划日期时间戳（当天 0 点） */
  planTs: number
  /** done=已接种；due=今天该接种；overdue=已过期未种；upcoming=未到时间 */
  status: VaccineItemStatus
  /** 对应已存在记录 id（已接种或已 planned） */
  recordId?: number
  /** 该疫苗名+剂次是否已有计划/接种记录 */
  exists: boolean
}

function toDayStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 生成指定宝宝（按出生日期）的完整疫苗日历，标注每剂与已存在记录/计划的关系 */
export function buildVaccineCalendar(birthDate: string, existing: Vaccination[]): VaccineCalendarItem[] {
  const today = toDayStart(Date.now())
  const byKey = new Map<string, Vaccination>()
  existing.forEach((v) => byKey.set(`${v.name}|${v.dose ?? ''}`, v))

  const collect = (category: VaccinePlanCategory, plan: VaccinePlanItem[]): VaccineCalendarItem[] =>
    plan.map((p) => {
      const planDate = planDateFromBirth(birthDate, p.months)
      const planTs = toDayStart(new Date(planDate + 'T00:00:00').getTime())
      const record = byKey.get(`${p.name}|${p.dose ?? ''}`)
      let status: VaccineItemStatus
      if (record) status = 'done'
      else if (planTs === today) status = 'due'
      else if (planTs < today) status = 'overdue'
      else status = 'upcoming'
      return {
        ...p,
        category,
        planDate,
        planTs,
        status,
        recordId: record?.id,
        exists: record != null,
      }
    })

  return [...collect('free', VACCINE_PLAN), ...collect('self', SELF_PAID_VACCINE_PLAN)].sort(
    (a, b) => a.planTs - b.planTs || a.category.localeCompare(b.category),
  )
}

/** 从疫苗日历生成待接种计划记录（跳过已存在记录/计划的剂次） */
export function buildPendingVaccinePlans(birthDate: string, existing: Vaccination[]): Array<{ date: number; name: string; dose: string; status: 'planned' }> {
  return buildVaccineCalendar(birthDate, existing)
    .filter((item) => !item.exists && item.status !== 'done')
    .map((item) => ({
      date: item.planTs,
      name: item.name,
      dose: item.dose,
      status: 'planned' as const,
    }))
}