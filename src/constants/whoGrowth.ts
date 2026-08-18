/**
 * WHO Child Growth Standards（世界卫生组织儿童生长标准）
 * 0-24 月龄 体重(kg) 与 身长(cm) 的 P3 / P50 / P97 百分位
 * 数据来源：WHO Child Growth Standards (2006)
 */

export interface WhoPoint {
  /** 月龄 0-24 */
  month: number
  /** 体重 kg 百分位 */
  weight: { p3: number; p50: number; p97: number }
  /** 身长 cm 百分位 */
  length: { p3: number; p50: number; p97: number }
}

/** 男孩 0-24 月龄 */
export const WHO_BOY: WhoPoint[] = [
  { month: 0, weight: { p3: 2.5, p50: 3.3, p97: 4.4 }, length: { p3: 46.3, p50: 49.9, p97: 53.4 } },
  { month: 1, weight: { p3: 3.4, p50: 4.5, p97: 5.8 }, length: { p3: 51.1, p50: 54.7, p97: 58.4 } },
  { month: 2, weight: { p3: 4.4, p50: 5.6, p97: 7.1 }, length: { p3: 54.7, p50: 58.4, p97: 62.2 } },
  { month: 3, weight: { p3: 5.0, p50: 6.4, p97: 8.0 }, length: { p3: 57.6, p50: 61.4, p97: 65.3 } },
  { month: 4, weight: { p3: 5.6, p50: 7.0, p97: 8.7 }, length: { p3: 60.0, p50: 63.9, p97: 67.8 } },
  { month: 5, weight: { p3: 6.0, p50: 7.5, p97: 9.3 }, length: { p3: 61.9, p50: 65.9, p97: 70.1 } },
  { month: 6, weight: { p3: 6.4, p50: 7.9, p97: 9.8 }, length: { p3: 63.6, p50: 67.6, p97: 71.6 } },
  { month: 7, weight: { p3: 6.7, p50: 8.3, p97: 10.3 }, length: { p3: 65.1, p50: 69.2, p97: 73.3 } },
  { month: 8, weight: { p3: 6.9, p50: 8.6, p97: 10.7 }, length: { p3: 66.5, p50: 70.6, p97: 74.8 } },
  { month: 9, weight: { p3: 7.1, p50: 8.9, p97: 11.0 }, length: { p3: 67.7, p50: 72.0, p97: 76.2 } },
  { month: 10, weight: { p3: 7.4, p50: 9.2, p97: 11.4 }, length: { p3: 69.0, p50: 73.3, p97: 77.6 } },
  { month: 11, weight: { p3: 7.6, p50: 9.4, p97: 11.7 }, length: { p3: 70.2, p50: 74.5, p97: 78.9 } },
  { month: 12, weight: { p3: 7.7, p50: 9.6, p97: 11.9 }, length: { p3: 71.3, p50: 75.7, p97: 80.1 } },
  { month: 13, weight: { p3: 7.9, p50: 9.9, p97: 12.2 }, length: { p3: 72.4, p50: 76.9, p97: 81.3 } },
  { month: 14, weight: { p3: 8.1, p50: 10.1, p97: 12.5 }, length: { p3: 73.4, p50: 78.0, p97: 82.5 } },
  { month: 15, weight: { p3: 8.3, p50: 10.3, p97: 12.7 }, length: { p3: 74.4, p50: 79.1, p97: 83.6 } },
  { month: 16, weight: { p3: 8.4, p50: 10.5, p97: 13.0 }, length: { p3: 75.4, p50: 80.2, p97: 84.7 } },
  { month: 17, weight: { p3: 8.6, p50: 10.7, p97: 13.2 }, length: { p3: 76.3, p50: 81.2, p97: 85.8 } },
  { month: 18, weight: { p3: 8.8, p50: 10.9, p97: 13.5 }, length: { p3: 77.2, p50: 82.3, p97: 86.8 } },
  { month: 19, weight: { p3: 8.9, p50: 11.1, p97: 13.7 }, length: { p3: 78.1, p50: 83.2, p97: 87.8 } },
  { month: 20, weight: { p3: 9.1, p50: 11.3, p97: 14.0 }, length: { p3: 79.0, p50: 84.2, p97: 88.8 } },
  { month: 21, weight: { p3: 9.2, p50: 11.5, p97: 14.2 }, length: { p3: 79.9, p50: 85.1, p97: 89.8 } },
  { month: 22, weight: { p3: 9.4, p50: 11.8, p97: 14.5 }, length: { p3: 80.7, p50: 86.0, p97: 90.8 } },
  { month: 23, weight: { p3: 9.6, p50: 12.0, p97: 14.8 }, length: { p3: 81.5, p50: 86.9, p97: 91.7 } },
  { month: 24, weight: { p3: 9.7, p50: 12.2, p97: 15.0 }, length: { p3: 82.3, p50: 87.8, p97: 92.7 } },
]

/** 女孩 0-24 月龄 */
export const WHO_GIRL: WhoPoint[] = [
  { month: 0, weight: { p3: 2.4, p50: 3.2, p97: 4.2 }, length: { p3: 45.6, p50: 49.1, p97: 52.7 } },
  { month: 1, weight: { p3: 3.2, p50: 4.2, p97: 5.5 }, length: { p3: 50.0, p50: 53.7, p97: 57.4 } },
  { month: 2, weight: { p3: 4.0, p50: 5.1, p97: 6.6 }, length: { p3: 53.5, p50: 57.1, p97: 61.1 } },
  { month: 3, weight: { p3: 4.6, p50: 5.8, p97: 7.5 }, length: { p3: 56.2, p50: 59.8, p97: 63.9 } },
  { month: 4, weight: { p3: 5.1, p50: 6.4, p97: 8.2 }, length: { p3: 58.6, p50: 62.1, p97: 66.4 } },
  { month: 5, weight: { p3: 5.5, p50: 6.9, p97: 8.8 }, length: { p3: 60.5, p50: 64.0, p97: 68.5 } },
  { month: 6, weight: { p3: 5.8, p50: 7.3, p97: 9.3 }, length: { p3: 62.2, p50: 65.7, p97: 70.3 } },
  { month: 7, weight: { p3: 6.1, p50: 7.6, p97: 9.7 }, length: { p3: 63.6, p50: 67.3, p97: 71.9 } },
  { month: 8, weight: { p3: 6.3, p50: 7.9, p97: 10.1 }, length: { p3: 65.0, p50: 68.7, p97: 73.5 } },
  { month: 9, weight: { p3: 6.6, p50: 8.2, p97: 10.5 }, length: { p3: 66.2, p50: 70.1, p97: 74.9 } },
  { month: 10, weight: { p3: 6.8, p50: 8.5, p97: 10.8 }, length: { p3: 67.5, p50: 71.5, p97: 76.4 } },
  { month: 11, weight: { p3: 7.0, p50: 8.7, p97: 11.2 }, length: { p3: 68.7, p50: 72.8, p97: 77.8 } },
  { month: 12, weight: { p3: 7.1, p50: 8.9, p97: 11.5 }, length: { p3: 69.9, p50: 74.0, p97: 79.2 } },
  { month: 13, weight: { p3: 7.3, p50: 9.2, p97: 11.8 }, length: { p3: 71.0, p50: 75.2, p97: 80.5 } },
  { month: 14, weight: { p3: 7.5, p50: 9.4, p97: 12.1 }, length: { p3: 72.1, p50: 76.4, p97: 81.7 } },
  { month: 15, weight: { p3: 7.7, p50: 9.6, p97: 12.3 }, length: { p3: 73.1, p50: 77.5, p97: 83.0 } },
  { month: 16, weight: { p3: 7.8, p50: 9.8, p97: 12.6 }, length: { p3: 74.1, p50: 78.6, p97: 84.2 } },
  { month: 17, weight: { p3: 8.0, p50: 10.0, p97: 12.9 }, length: { p3: 75.1, p50: 79.7, p97: 85.4 } },
  { month: 18, weight: { p3: 8.2, p50: 10.2, p97: 13.2 }, length: { p3: 76.0, p50: 80.7, p97: 86.5 } },
  { month: 19, weight: { p3: 8.3, p50: 10.4, p97: 13.4 }, length: { p3: 76.9, p50: 81.7, p97: 87.6 } },
  { month: 20, weight: { p3: 8.5, p50: 10.6, p97: 13.7 }, length: { p3: 77.8, p50: 82.7, p97: 88.7 } },
  { month: 21, weight: { p3: 8.7, p50: 10.9, p97: 14.0 }, length: { p3: 78.7, p50: 83.7, p97: 89.8 } },
  { month: 22, weight: { p3: 8.8, p50: 11.1, p97: 14.3 }, length: { p3: 79.6, p50: 84.6, p97: 90.8 } },
  { month: 23, weight: { p3: 9.0, p50: 11.3, p97: 14.6 }, length: { p3: 80.4, p50: 85.5, p97: 91.9 } },
  { month: 24, weight: { p3: 9.2, p50: 11.5, p97: 14.8 }, length: { p3: 81.2, p50: 86.4, p97: 92.9 } },
]

/** 按性别取 WHO 数据集（未知性别默认按女孩，曲线更保守） */
export function whoData(gender?: BabyGender): WhoPoint[] {
  return gender === 'boy' ? WHO_BOY : WHO_GIRL
}

/** 按出生日期计算月龄（允许分数月龄，用于插值） */
export function ageInMonths(birthDate: string, date: number): number {
  const birth = new Date(birthDate + 'T00:00:00').getTime()
  return (date - birth) / (30.44 * 24 * 3600_000)
}

/** 线性插值获取指定月龄的百分位值 */
export function interpolateWho(data: WhoPoint[], month: number, field: 'weight' | 'length', key: 'p3' | 'p50' | 'p97'): number {
  if (!data.length) return 0
  if (month <= data[0].month) return data[0][field][key]
  if (month >= data[data.length - 1].month) return data[data.length - 1][field][key]
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i]
    const b = data[i + 1]
    if (month >= a.month && month <= b.month) {
      const t = (month - a.month) / (b.month - a.month)
      return a[field][key] + (b[field][key] - a[field][key]) * t
    }
  }
  return data[data.length - 1][field][key]
}

import type { BabyGender } from '@/types'

/** 生长百分位标签 */
export const WHO_PERCENTILES = [
  { key: 'p3' as const, label: 'P3' },
  { key: 'p50' as const, label: 'P50' },
  { key: 'p97' as const, label: 'P97' },
]