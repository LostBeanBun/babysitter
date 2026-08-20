import { describe, it, expect } from 'vitest'
import { pad2, startOfDay, formatPercentChange, formatAmount, fromDateTimeLocal } from '@/utils/format'

describe('format utils', () => {
  it('pad2 补零', () => {
    expect(pad2(5)).toBe('05')
    expect(pad2(12)).toBe('12')
  })

  it('startOfDay 返回当天 0 点', () => {
    const ts = new Date(2026, 7, 20, 15, 30).getTime() // 2026-08-20 15:30
    const start = startOfDay(ts)
    const d = new Date(start)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(20)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('formatPercentChange 正负号与保留 1 位', () => {
    expect(formatPercentChange(12.345)).toBe('+12.3%')
    expect(formatPercentChange(-3.25)).toBe('-3.3%')
    expect(formatPercentChange(0)).toBe('0.0%')
    expect(formatPercentChange(Infinity)).toBe('—')
    expect(formatPercentChange(NaN)).toBe('—')
  })

  it('formatAmount 输出 ml', () => {
    expect(formatAmount(120)).toBe('120 ml')
    expect(formatAmount(0)).toBe('0 ml')
    expect(formatAmount(undefined)).toBe('')
  })

  it('fromDateTimeLocal 解析 datetime-local 字符串', () => {
    const ts = fromDateTimeLocal('2026-08-20T08:30')
    expect(ts).not.toBeUndefined()
    if (ts != null) {
      const d = new Date(ts)
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(7)
      expect(d.getDate()).toBe(20)
      expect(d.getHours()).toBe(8)
      expect(d.getMinutes()).toBe(30)
    }
    expect(fromDateTimeLocal('')).toBeUndefined()
    expect(fromDateTimeLocal('not-a-date')).toBeUndefined()
  })
})