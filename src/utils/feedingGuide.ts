import type { Baby } from '@/types'
import { ageInMonths } from '@/constants/whoGrowth'

/** 按月龄返回推荐喂奶间隔（毫秒），参考常见育儿指南 */
export function recommendedIntervalMs(baby?: Baby): number {
  const months = baby?.birthDate ? ageInMonths(baby.birthDate, Date.now()) : 0
  if (months < 1) return 2.5 * 3600_000
  if (months < 3) return 3 * 3600_000
  if (months < 6) return 3.5 * 3600_000
  if (months < 9) return 4 * 3600_000
  if (months < 12) return 4.5 * 3600_000
  return 5 * 3600_000
}

/** 推荐间隔的人类可读文案（如「约 3 小时」） */
export function recommendedIntervalLabel(baby?: Baby): string {
  const ms = recommendedIntervalMs(baby)
  const h = ms / 3600_000
  return h === Math.floor(h) ? `约 ${h} 小时` : `约 ${h} 小时`
}

/** 最近 N 次喂养的平均间隔（毫秒），不足 2 次返回 null */
export function avgFeedingIntervalMs(startTimes: number[], count = 3): number | null {
  const sorted = [...startTimes].sort((a, b) => b - a).slice(0, count + 1)
  if (sorted.length < 2) return null
  const gaps: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    gaps.push(sorted[i] - sorted[i + 1])
  }
  return gaps.reduce((s, g) => s + g, 0) / gaps.length
}

/** 距上次喂养的时长（毫秒） */
export function sinceLastFeedingMs(lastStart: number, now: number): number {
  return Math.max(0, now - lastStart)
}

/** 按月龄给出喂奶建议文案 */
export function feedingAdvice(baby?: Baby): string {
  const months = baby?.birthDate ? ageInMonths(baby.birthDate, Date.now()) : 0
  if (months < 1) return '新生儿按需喂养，通常每 2-3 小时一次'
  if (months < 3) return '按需喂养，通常每 3 小时左右一次'
  if (months < 6) return '通常每 3-4 小时一次，可逐渐拉长夜间间隔'
  if (months < 9) return '添加辅食后，通常每 4 小时左右一次'
  if (months < 12) return '通常每 4-5 小时一次'
  return '通常每 5-6 小时一次，随辅食增加可减少奶量'
}

/** 喂奶提醒本地开关 key */
export const FEED_REMINDER_KEY = 'babysitter.feedReminder'

/** 读取喂奶提醒开关 */
export function isFeedReminderOn(): boolean {
  return localStorage.getItem(FEED_REMINDER_KEY) === 'on'
}
