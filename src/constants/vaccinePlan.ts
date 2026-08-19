/**
 * 国家免疫规划疫苗（0-6 岁）内置计划库。
 * months 为建议接种月龄（0 表示出生时）；实际接种日期由宝宝出生日期推算。
 */
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