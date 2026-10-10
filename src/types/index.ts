/** 全局类型定义 */

/** 宝宝性别 */
export type BabyGender = 'boy' | 'girl'

/** 记录类型标识（时间轴/删除分发/表单路由共用） */
export type RecordKind =
  | 'feeding'
  | 'diaper'
  | 'pumping'
  | 'sleep'
  | 'growth'
  | 'solidFood'
  | 'medication'
  | 'vaccination'
  | 'temperature'
  | 'milestone'

/** 所有记录类型的公共字段 */
export interface BaseRecord {
  id?: number
  babyId: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** 宝宝资料 */
export interface Baby {
  id?: number
  name: string
  gender?: BabyGender
  /** 出生日期 YYYY-MM-DD */
  birthDate?: string
  /** 出生体重 kg */
  birthWeight?: number
  /** 出生身高 cm */
  birthHeight?: number
  /** 头像 emoji */
  avatar?: string
  /** 头像背景色（主题色变量名） */
  avatarColor: string
  createdAt: number
}

/** 喂养类型 */
export type FeedType =
  | 'breast' // 亲喂
  | 'bottle_breastmilk' // 瓶喂母乳
  | 'bottle_formula' // 配方奶

/** 亲喂侧边 */
export type BreastSide = 'left' | 'right' | 'both'

/** 喂养记录 */
export interface Feeding extends BaseRecord {
  type: FeedType
  /** 亲喂侧边（仅 type=breast 时有值） */
  side?: BreastSide
  /** 开始时间（毫秒时间戳） */
  startTime: number
  /** 结束时间（亲喂计时用） */
  endTime?: number
  /** 亲喂时长 ms */
  duration?: number
  /** 瓶喂奶量 ml */
  amount?: number
}

/** 纸尿裤类型 */
export type DiaperType = 'wet' | 'dirty' | 'both'
export type DiaperColor = 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'other'
export type DiaperAmount = 'small' | 'medium' | 'large'

/** 纸尿裤记录 */
export interface DiaperChange extends BaseRecord {
  type: DiaperType
  color?: DiaperColor
  amount?: DiaperAmount
  /** 更换时间 */
  time: number
}

/** 吸奶侧 */
export type PumpSide = 'left' | 'right' | 'both'

/** 吸奶记录 */
export interface Pumping extends BaseRecord {
  side: PumpSide
  startTime: number
  endTime?: number
  /** 吸奶时长 ms */
  duration?: number
  /** 吸奶量 ml */
  amount?: number
}

/** 睡眠类型 */
export type SleepType = 'nap' | 'night'

/** 睡眠记录 */
export interface Sleep extends BaseRecord {
  type: SleepType
  startTime: number
  endTime?: number
  /** 睡眠时长 ms */
  duration?: number
}

/** 成长记录（体重/身高/头围测量） */
export interface GrowthRecord extends BaseRecord {
  /** 测量日期（当天 0 点毫秒时间戳） */
  date: number
  /** 体重 kg */
  weight?: number
  /** 身高 cm */
  height?: number
  /** 头围 cm */
  headCircumference?: number
}

/** 辅食记录 */
export interface SolidFood extends BaseRecord {
  /** 进食时间 */
  time: number
  /** 食物名称 */
  food: string
  /** 用量描述（如「半碗」） */
  amount?: string
}

/** 用药记录 */
export interface Medication extends BaseRecord {
  /** 用药时间 */
  time: number
  /** 药品名称 */
  name: string
  /** 剂量（如「5ml」） */
  dose?: string
}

/** 疫苗状态：planned=待接种提醒，done=已接种记录 */
export type VaccinationStatus = 'planned' | 'done'

/** 疫苗记录/提醒 */
export interface Vaccination extends BaseRecord {
  /** 疫苗名称 */
  name: string
  /** 剂次（如「第 1 剂」） */
  dose?: string
  /** 接种日期（当天 0 点毫秒时间戳） */
  date: number
  status: VaccinationStatus
}

/** 体温测量方式 */
export type TemperatureMethod = 'armpit' | 'ear' | 'forehead' | 'rectal'

/** 体温记录 */
export interface Temperature extends BaseRecord {
  /** 测量时间 */
  time: number
  /** 体温 ℃ */
  value: number
  method?: TemperatureMethod
}

/** 里程碑类型 */
export type MilestoneType =
  | 'roll' // 翻身
  | 'sit' // 独坐
  | 'crawl' // 爬行
  | 'stand' // 站立
  | 'walk' // 独走
  | 'first_word' // 开口说话
  | 'tooth' // 长牙
  | 'wave' // 挥手再见
  | 'other' // 其他

/** 里程碑记录（翻身/独坐/爬行/说话/长牙等发育节点） */
export interface Milestone extends BaseRecord {
  type: MilestoneType
  /** 发生时间 */
  time: number
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
  growths?: GrowthRecord[]
  solidFoods?: SolidFood[]
  medications?: Medication[]
  vaccinations?: Vaccination[]
  temperatures?: Temperature[]
  milestones?: Milestone[]
}
