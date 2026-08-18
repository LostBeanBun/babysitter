/** 全局类型定义 */

/** 宝宝资料 */
export interface Baby {
  id?: number
  name: string
  gender?: 'boy' | 'girl'
  /** 出生日期 YYYY-MM-DD */
  birthDate?: string
  /** 出生体重 kg */
  birthWeight?: number
  /** 出生身高 cm */
  birthHeight?: number
  /** 头像背景色（主题色变量名） */
  avatarColor: string
  createdAt: number
}

/** 喂养类型 */
export type FeedType =
  | 'breast_left' // 左侧亲喂
  | 'breast_right' // 右侧亲喂
  | 'breast_both' // 双侧亲喂
  | 'bottle_breastmilk' // 瓶喂母乳
  | 'bottle_formula' // 配方奶

/** 喂养记录 */
export interface Feeding {
  id?: number
  babyId: number
  type: FeedType
  /** 开始时间（毫秒时间戳） */
  startTime: number
  /** 结束时间（亲喂计时用） */
  endTime?: number
  /** 亲喂时长 ms */
  duration?: number
  /** 瓶喂奶量 ml */
  amount?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** 纸尿裤类型 */
export type DiaperType = 'wet' | 'dirty' | 'both'
export type DiaperColor = 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'other'
export type DiaperAmount = 'small' | 'medium' | 'large'

/** 纸尿裤记录 */
export interface DiaperChange {
  id?: number
  babyId: number
  type: DiaperType
  color?: DiaperColor
  amount?: DiaperAmount
  /** 更换时间 */
  time: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** 吸奶侧 */
export type PumpSide = 'left' | 'right' | 'both'

/** 吸奶记录 */
export interface Pumping {
  id?: number
  babyId: number
  side: PumpSide
  startTime: number
  endTime?: number
  /** 吸奶时长 ms */
  duration?: number
  /** 吸奶量 ml */
  amount?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** 睡眠类型 */
export type SleepType = 'nap' | 'night'

/** 睡眠记录 */
export interface Sleep {
  id?: number
  babyId: number
  type: SleepType
  startTime: number
  endTime: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** 导出文件的元信息 */
export interface ExportMeta {
  app: 'babysitter'
  version: number
  exportedAt: string
}

export interface ExportFile {
  meta: ExportMeta
  babies: Baby[]
  feedings: Feeding[]
  diapers: DiaperChange[]
  pumpings: Pumping[]
  sleeps: Sleep[]
}
