import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'

const t = i18n.global.t

describe('i18n interpolation', () => {
  it('单花括号 {n} 可插值（与语言包 / React 端一致）', () => {
    expect(t('common.records', { n: 5 })).toBe('5 条')
    expect(t('common.times', { n: 3 })).toBe('3 次')
    expect(t('common.daily', { value: '3 次' })).toBe('日均 3 次')
    expect(t('stats.summarySub', { n: 7 })).toContain('7')
    expect(t('stats.summarySub', { n: 7 })).not.toContain('{n}')
  })

  it('多变量文案可插值', () => {
    expect(t('settings.ageDays', { n: 12 })).toBe('12 天')
    expect(t('dashboard.vaccineDaysLeft', { n: 3 })).not.toContain('{n}')
    expect(t('vaccination.planMonth', { n: 5 })).not.toContain('{n}')
  })
})
