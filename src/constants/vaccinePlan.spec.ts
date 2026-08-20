import { describe, expect, it } from 'vitest'
import {
  planDateFromBirth,
  buildVaccineCalendar,
  VACCINE_PLAN,
  SELF_PAID_VACCINE_PLAN,
} from '@/constants/vaccinePlan'
import type { Vaccination } from '@/types'

describe('planDateFromBirth', () => {
  it('计算出生当天的疫苗日期（0 月龄）', () => {
    expect(planDateFromBirth('2025-01-15', 0)).toBe('2025-01-15')
  })

  it('计算跨年的月龄', () => {
    expect(planDateFromBirth('2025-01-15', 12)).toBe('2026-01-15')
  })

  it('月末溢出时钳制到当月最后一天', () => {
    // 1 月 31 日 + 1 个月 → 2 月 28 日（非闰年）
    expect(planDateFromBirth('2025-01-31', 1)).toBe('2025-02-28')
  })

  it('闰年 2 月 29 日 + 12 个月保持 2 月 29 日', () => {
    expect(planDateFromBirth('2024-02-29', 12)).toBe('2025-02-28')
  })
})

const now = Date.now()
const day = 86_400_000
const makeVacc = (v: Partial<Vaccination> & { name: string }): Vaccination => ({
  id: 1,
  babyId: 1,
  date: now,
  status: 'done',
  createdAt: now,
  updatedAt: now,
  ...v,
})

describe('buildVaccineCalendar', () => {
  it('按出生日期生成免费+自费全部计划项', () => {
    const items = buildVaccineCalendar('2025-01-15', [])
    expect(items.length).toBe(VACCINE_PLAN.length + SELF_PAID_VACCINE_PLAN.length)
    expect(items.every((i) => i.planDate && i.status)).toBe(true)
  })

  it('按计划日期排序', () => {
    const items = buildVaccineCalendar('2025-01-15', [])
    for (let i = 1; i < items.length; i++) {
      expect(items[i].planTs).toBeGreaterThanOrEqual(items[i - 1].planTs)
    }
  })

  it('已接种的记录标记为 done 且 exists=true', () => {
    const items = buildVaccineCalendar('2025-01-15', [
      makeVacc({ name: '乙肝疫苗', dose: '第 1 剂', status: 'done' }),
    ])
    const hepB1 = items.find((i) => i.name === '乙肝疫苗' && i.dose === '第 1 剂')
    expect(hepB1?.status).toBe('done')
    expect(hepB1?.exists).toBe(true)
  })

  it('过期的计划标记为 overdue', () => {
    // 出生日期 1 年前 → 早期剂次均已过期
    const oldBirth = new Date(now - 365 * day)
    const iso = oldBirth.toISOString().slice(0, 10)
    const items = buildVaccineCalendar(iso, [])
    const hepB1 = items.find((i) => i.name === '乙肝疫苗' && i.dose === '第 1 剂')
    expect(hepB1?.status).toBe('overdue')
    // 72 月龄的剂次仍在未来
    const last = items.find((i) => i.months === 72)
    expect(last?.status).toBe('upcoming')
  })
})