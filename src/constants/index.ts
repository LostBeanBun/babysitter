import type { FeedType, DiaperType, DiaperColor, DiaperAmount, PumpSide, SleepType } from '@/types'

/** 喂养类型中文标签 */
export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  breast_left: '左侧亲喂',
  breast_right: '右侧亲喂',
  breast_both: '双侧亲喂',
  bottle_breastmilk: '瓶喂母乳',
  bottle_formula: '配方奶',
}

export const FEED_TYPE_LIST: { value: FeedType; label: string; icon: string; color: string }[] = [
  { value: 'breast_left', label: '左侧亲喂', icon: '🤱', color: '#F2A28C' },
  { value: 'breast_right', label: '右侧亲喂', icon: '🤱', color: '#F2A28C' },
  { value: 'breast_both', label: '双侧亲喂', icon: '🤱', color: '#E8906C' },
  { value: 'bottle_breastmilk', label: '瓶喂母乳', icon: '🍼', color: '#8FB9D8' },
  { value: 'bottle_formula', label: '配方奶', icon: '🥛', color: '#C4A8E0' },
]

/** 纸尿裤类型 */
export const DIAPER_TYPE_LABELS: Record<DiaperType, string> = {
  wet: '尿湿',
  dirty: '便便',
  both: '尿+便',
}

export const DIAPER_TYPE_LIST: { value: DiaperType; label: string; icon: string; color: string }[] = [
  { value: 'wet', label: '尿湿', icon: '💧', color: '#8FB9D8' },
  { value: 'dirty', label: '便便', icon: '💩', color: '#B58B62' },
  { value: 'both', label: '尿+便', icon: '🧷', color: '#9A8FC8' },
]

/** 便便颜色 */
export const DIAPER_COLOR_LABELS: Record<DiaperColor, string> = {
  yellow: '黄色',
  brown: '棕色',
  green: '绿色',
  black: '黑色',
  red: '红色',
  other: '其他',
}

export const DIAPER_COLOR_DOTS: Record<DiaperColor, string> = {
  yellow: '#E8C46A',
  brown: '#9C6B3D',
  green: '#7FAF6C',
  black: '#4A3F35',
  red: '#D96A5A',
  other: '#B0A8A0',
}

/** 便便量 */
export const DIAPER_AMOUNT_LABELS: Record<DiaperAmount, string> = {
  small: '少量',
  medium: '适中',
  large: '大量',
}

/** 吸奶侧 */
export const PUMP_SIDE_LABELS: Record<PumpSide, string> = {
  left: '左侧',
  right: '右侧',
  both: '双侧',
}

export const PUMP_SIDE_LIST: { value: PumpSide; label: string; icon: string }[] = [
  { value: 'left', label: '左侧', icon: '⬅️' },
  { value: 'right', label: '右侧', icon: '➡️' },
  { value: 'both', label: '双侧', icon: '↔️' },
]

/** 睡眠类型 */
export const SLEEP_TYPE_LABELS: Record<SleepType, string> = {
  nap: '小睡',
  night: '夜间睡眠',
}

/** 主题色（统计图表统一使用） */
export const CHART_COLORS = {
  feedAmount: '#E8906C',
  breast: '#F2A28C',
  bottle: '#8FB9D8',
  formula: '#C4A8E0',
  sleep: '#8FAED8',
  diaper: '#9A8FC8',
  pump: '#D8A8C8',
  primary: '#E8906C',
}

/** 常用单位换算 */
export const MS_PER_HOUR = 3600_000
export const MS_PER_DAY = 24 * MS_PER_HOUR

/** 宝宝头像配色 */
export const AVATAR_COLORS = ['#F2A28C', '#8FB9D8', '#8FBF9F', '#C4A8E0', '#E8C46A', '#D8A8C8', '#9A8FC8', '#7FB3A6']

/** 宝宝头像 emoji 选择（含 12 生肖） */
export const BABY_AVATARS = [
  // 12 生肖
  '🐭',
  '🐮',
  '🐯',
  '🐰',
  '🐲',
  '🐍',
  '🐴',
  '🐑',
  '🐵',
  '🐔',
  '🐶',
  '🐷',
  // 其他可爱形象
  '🐣',
  '🐻',
  '🐼',
  '🐨',
  '🦊',
  '🐸',
  '🐥',
  '🦄',
  '🌸',
  '🌙',
  '⭐',
  '🍀',
]
