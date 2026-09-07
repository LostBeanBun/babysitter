import { db } from '@/db'
import i18n from '@/i18n'
import type {
  Feeding,
  DiaperChange,
  Pumping,
  Sleep,
  Baby,
  GrowthRecord,
  SolidFood,
  Medication,
  Vaccination,
  Temperature,
  Milestone,
} from '@/types'
import { downloadBlob, formatDate, formatTime, parseDate, startOfDay } from '@/utils/format'

const t = i18n.global.t

/** 按语言的标签映射：内部键值 -> 对应语言的显示文本 */
const LABELS_ZH: Record<string, string> = {
  // 记录类型
  feeding: '喂养',
  diaper: '纸尿裤',
  pumping: '吸奶',
  sleep: '睡眠',
  growth: '成长记录',
  solidFood: '辅食',
  medication: '用药',
  vaccination: '疫苗',
  temperature: '体温',
  milestone: '里程碑',
  // 喂养类型
  breast: '亲喂',
  bottle_breastmilk: '瓶喂母乳',
  bottle_formula: '配方奶',
  // 纸尿裤类型
  wet: '尿湿',
  dirty: '便便',
  both: '尿+便',
  // 纸尿裤颜色
  yellow: '黄色',
  brown: '褐色',
  green: '绿色',
  black: '黑色',
  red: '红色',
  other: '其他',
  // 纸尿裤量
  small: '少量',
  medium: '中等',
  large: '大量',
  // 吸奶侧
  left: '左侧',
  right: '右侧',
  // 睡眠类型
  nap: '小睡',
  night: '夜间睡眠',
  // 疫苗状态
  planned: '待接种',
  done: '已接种',
  // 体温方式
  armpit: '腋下',
  ear: '耳温',
  forehead: '额头',
  rectal: '肛温',
}

const LABELS_EN: Record<string, string> = {
  // 记录类型
  feeding: 'Feeding',
  diaper: 'Diaper',
  pumping: 'Pumping',
  sleep: 'Sleep',
  growth: 'Growth record',
  solidFood: 'Solid food',
  medication: 'Medication',
  vaccination: 'Vaccination',
  temperature: 'Temperature',
  milestone: 'Milestone',
  // 喂养类型
  breast: 'Breastfeed',
  bottle_breastmilk: 'Bottle breastmilk',
  bottle_formula: 'Bottle formula',
  // 纸尿裤类型
  wet: 'Wet',
  dirty: 'Dirty',
  both: 'Both',
  // 纸尿裤颜色
  yellow: 'Yellow',
  brown: 'Brown',
  green: 'Green',
  black: 'Black',
  red: 'Red',
  other: 'Other',
  // 纸尿裤量
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  // 吸奶侧
  left: 'Left',
  right: 'Right',
  // 睡眠类型
  nap: 'Nap',
  night: 'Night sleep',
  // 疫苗状态
  planned: 'Planned',
  done: 'Done',
  // 体温方式
  armpit: 'Armpit',
  ear: 'Ear',
  forehead: 'Forehead',
  rectal: 'Rectal',
}

/** 获取当前语言标签，未找到返回原键值 */
function bl(key: string): string {
  const locale = i18n.global.locale.value
  const map = locale === 'en-US' ? LABELS_EN : LABELS_ZH
  return map[key] ?? key
}

/** 亲喂侧边标签（避免与 diaper 的 both 键冲突） */
const BREAST_SIDE_LABELS_MAP: Record<string, Record<string, string>> = {
  'zh-CN': { left: '左侧', right: '右侧', both: '双侧' },
  'en-US': { left: 'Left', right: 'Right', both: 'Both' },
}
function breastSideLabel(side: string): string {
  const locale = i18n.global.locale.value
  return BREAST_SIDE_LABELS_MAP[locale]?.[side] ?? side
}

/** CSV 转义：含逗号/引号/换行时包裹引号 */
export function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
}

/** CSV 表头（仅本地化展示） */
function csvHeader(withBaby: boolean): Row {
  const cols = [
    t('exportCsv.recordType'),
    t('exportCsv.date'),
    t('exportCsv.time'),
    t('exportCsv.endDate'),
    t('exportCsv.endTime'),
    t('exportCsv.item'),
    t('exportCsv.value'),
    t('exportCsv.duration'),
    t('exportCsv.status'),
    t('exportCsv.notes'),
  ]
  return withBaby ? [t('exportCsv.babyName'), ...cols] : cols
}

/**
 * 生成单个宝宝的全部记录 CSV 数据行（不含表头）。
 * 使用双语标签，格式为 "English/中文"，确保跨 locale 可读。
 * babyName 提供时每行首列插入宝宝名（用于多宝宝合并导出）。
 */
export function buildBabyCsvRows(data: BabyCsvData, babyName?: string): Row[] {
  const withBaby = babyName !== undefined
  const rows: Row[] = []
  const nameCol = (): Row => (withBaby ? [babyName] : [])

  // 喂养
  for (const f of data.feedings) {
    const typeLabel = f.type === 'breast' && f.side ? bl(f.type) + '·' + breastSideLabel(f.side) : bl(f.type)
    rows.push([
      ...nameCol(),
      bl('feeding'),
      formatDate(f.startTime),
      formatTime(f.startTime),
      '',
      '',
      typeLabel,
      f.amount ? `${f.amount} ml` : '',
      f.duration ? Math.round(f.duration / 60000) : '',
      '',
      f.notes ?? '',
    ])
  }

  // 纸尿裤
  for (const d of data.diapers) {
    rows.push([
      ...nameCol(),
      bl('diaper'),
      formatDate(d.time),
      formatTime(d.time),
      '',
      '',
      bl(d.type),
      [d.color ? bl(d.color) : '', d.amount ? bl(d.amount) : ''].filter(Boolean).join(' · '),
      '',
      '',
      d.notes ?? '',
    ])
  }

  // 吸奶
  for (const p of data.pumpings) {
    rows.push([
      ...nameCol(),
      bl('pumping'),
      formatDate(p.startTime),
      formatTime(p.startTime),
      '',
      '',
      breastSideLabel(p.side),
      p.amount ? `${p.amount} ml` : '',
      p.duration ? Math.round(p.duration / 60000) : '',
      '',
      p.notes ?? '',
    ])
  }

  // 睡眠
  for (const s of data.sleeps) {
    rows.push([
      ...nameCol(),
      bl('sleep'),
      formatDate(s.startTime),
      formatTime(s.startTime),
      formatDate(s.endTime),
      formatTime(s.endTime),
      bl(s.type),
      '',
      s.duration ?? Math.round((s.endTime - s.startTime) / 60000),
      '',
      s.notes ?? '',
    ])
  }

  // 成长记录
  for (const g of data.growths) {
    const parts: string[] = []
    if (g.weight != null) parts.push(`${g.weight} kg`)
    if (g.height != null) parts.push(`${g.height} cm`)
    if (g.headCircumference != null) parts.push(`${g.headCircumference} cm`)
    rows.push([
      ...nameCol(),
      bl('growth'),
      formatDate(g.date),
      '',
      '',
      '',
      '',
      parts.join(' · '),
      '',
      '',
      g.notes ?? '',
    ])
  }

  // 辅食
  for (const sf of data.solidFoods) {
    rows.push([
      ...nameCol(),
      bl('solidFood'),
      formatDate(sf.time),
      formatTime(sf.time),
      '',
      '',
      sf.food,
      sf.amount ?? '',
      '',
      '',
      sf.notes ?? '',
    ])
  }

  // 用药
  for (const m of data.medications) {
    rows.push([
      ...nameCol(),
      bl('medication'),
      formatDate(m.time),
      formatTime(m.time),
      '',
      '',
      m.name,
      m.dose ?? '',
      '',
      '',
      m.notes ?? '',
    ])
  }

  // 疫苗
  for (const v of data.vaccinations) {
    rows.push([
      ...nameCol(),
      bl('vaccination'),
      formatDate(v.date),
      '',
      '',
      '',
      v.name,
      v.dose ?? '',
      '',
      bl(v.status),
      v.notes ?? '',
    ])
  }

  // 体温
  for (const tmp of data.temperatures) {
    rows.push([
      ...nameCol(),
      bl('temperature'),
      formatDate(tmp.time),
      formatTime(tmp.time),
      '',
      '',
      tmp.method ? bl(tmp.method) : '',
      tmp.value != null && tmp.value !== 0 ? `${tmp.value} ℃` : '',
      '',
      '',
      tmp.notes ?? '',
    ])
  }

  // 里程碑
  for (const ms of data.milestones) {
    rows.push([
      ...nameCol(),
      bl('milestone'),
      formatDate(ms.time),
      formatTime(ms.time),
      '',
      '',
      bl(ms.type),
      '',
      '',
      '',
      ms.notes ?? '',
    ])
  }

  return rows
}

/** 读取单个宝宝的全部记录（按时间排序） */
async function fetchBabyData(babyId: number): Promise<BabyCsvData> {
  if (!Number.isFinite(babyId) || babyId <= 0) {
    throw new Error('Invalid babyId for export')
  }
  const [feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures, milestones] =
    await Promise.all([
      db.feedings.where('babyId').equals(babyId).sortBy('startTime'),
      db.diapers.where('babyId').equals(babyId).sortBy('time'),
      db.pumpings.where('babyId').equals(babyId).sortBy('startTime'),
      db.sleeps.where('babyId').equals(babyId).sortBy('startTime'),
      db.growths.where('babyId').equals(babyId).sortBy('date'),
      db.solidFoods.where('babyId').equals(babyId).sortBy('time'),
      db.medications.where('babyId').equals(babyId).sortBy('time'),
      db.vaccinations.where('babyId').equals(babyId).sortBy('date'),
      db.temperatures.where('babyId').equals(babyId).sortBy('time'),
      // milestones 表在 v4 新增 babyId 索引，若数据库版本过旧可能抛错，做兼容处理
      db.milestones.where('babyId').equals(babyId).sortBy('time').catch(() => []),
    ])
  return { feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures, milestones }
}

/** 导出单个宝宝 CSV（十类记录合并为单个文件，统一宽表结构） */
export async function exportBabyCsvs(baby: Baby): Promise<void> {
  if (baby.id === undefined || baby.id === null || !Number.isFinite(baby.id) || baby.id <= 0) {
    throw new Error('Invalid baby id for export')
  }
  const data = await fetchBabyData(baby.id)
  const rows: Row[] = [csvHeader(false), ...buildBabyCsvRows(data)]
  const stamp = formatDate(Date.now())
  downloadBlob(
    '\ufeff' + toCsv(rows),
    t('exportCsv.allFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )
}

/** 一键导出全部宝宝的全部记录为单个合并 CSV（首列标识宝宝名） */
export async function exportAllBabiesCsv(): Promise<void> {
  const babies = await db.babies.toArray()
  const rows: Row[] = [csvHeader(true)]
  for (const baby of babies) {
    const data = await fetchBabyData(baby.id!)
    rows.push(...buildBabyCsvRows(data, baby.name))
  }
  const stamp = formatDate(Date.now())
  downloadBlob(
    '\ufeff' + toCsv(rows),
    t('exportCsv.allBabiesFileName', { stamp }),
    'text/csv;charset=utf-8',
  )
}

/** 单个宝宝的全部记录数据（供 CSV 行生成使用） */
export interface BabyCsvData {
  feedings: Feeding[]
  diapers: DiaperChange[]
  pumpings: Pumping[]
  sleeps: Sleep[]
  growths: GrowthRecord[]
  solidFoods: SolidFood[]
  medications: Medication[]
  vaccinations: Vaccination[]
  temperatures: Temperature[]
  milestones: Milestone[]
}

type Row = (string | number | undefined | null)[]

/** 解析 CSV 文本（支持 BOM、引号转义、字段内逗号/换行） */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^\ufeff/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < content.length) {
    const ch = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        row.push(field)
        // 仅当行非空时才加入结果，避免末尾空行产生额外空行
        if (row.some((c) => c !== '')) {
          rows.push(row)
        }
        row = []
        field = ''
        if (ch === '\r' && next === '\n') i++
      } else {
        field += ch
      }
    }
    i++
  }
  // 处理最后一行（无末尾换行时）
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((c) => c !== '')) {
      rows.push(row)
    }
  }
  return rows
}

/** 导入用：CSV 表头键名（内部键值）与内部类型映射（复数，对应 recordBuckets 键） */
const RECORD_TYPE_KEY_MAP: Record<string, string> = {
  feeding: 'feedings',
  diaper: 'diapers',
  pumping: 'pumpings',
  sleep: 'sleeps',
  growth: 'growths',
  solidFood: 'solidFoods',
  medication: 'medications',
  vaccination: 'vaccinations',
  temperature: 'temperatures',
  milestone: 'milestones',
}

/** 枚举反向映射（导入时将内部键值转为数据字段）——当前版本直接使用内部键值，保留定义以备后续扩展 */

/** 疫苗状态反向映射（中英） */
const VACCINE_STATUS_REV: Record<string, 'planned' | 'done'> = {
  [t('vaccination.statusDone')]: 'done',
  [t('vaccination.statusPlanned')]: 'planned',
  Done: 'done',
  Planned: 'planned',
}

/** 将 CSV 行映射为具体记录对象（使用内部键值） */
function mapCsvRowToRecord(
  row: string[],
  headers: string[],
  babyId: number,
  now: number,
): { kind: string; data: Record<string, unknown> } | null {
  const obj: Record<string, string> = {}
  headers.forEach((h, idx) => {
    obj[h] = row[idx] ?? ''
  })

  // 兼容：表头可能是本地化标签或内部键值
  const typeLabel = obj[t('exportCsv.recordType')] ?? obj['记录类型'] ?? obj['Record Type'] ?? obj['recordType']
  const kind = RECORD_TYPE_KEY_MAP[typeLabel]
  if (!kind) return null

  const dateStr = obj[t('exportCsv.date')] ?? obj['日期'] ?? obj['Date']
  const timeStr = obj[t('exportCsv.time')] ?? obj['时间'] ?? obj['Time']
  const endDateStr = obj[t('exportCsv.endDate')] ?? obj['结束日期'] ?? obj['End Date']
  const endTimeStr = obj[t('exportCsv.endTime')] ?? obj['结束时间'] ?? obj['End Time']
  const item = obj[t('exportCsv.item')] ?? obj['项目'] ?? obj['Item']
  const value = obj[t('exportCsv.value')] ?? obj['数值'] ?? obj['Value']
  const duration = obj[t('exportCsv.duration')] ?? obj['时长'] ?? obj['Duration']
  const status = obj[t('exportCsv.status')] ?? obj['状态'] ?? obj['Status']
  const notes = obj[t('exportCsv.notes')] ?? obj['备注'] ?? obj['Notes']

  const parseDateTime = (date: string, time: string): number => {
    if (!date) return 0
    const d = parseDate(`${date} ${time || '00:00'}`)
    return d ?? new Date(`${date}T${time || '00:00'}`).getTime()
  }

  const startTime = parseDateTime(dateStr, timeStr)
  const endTime = parseDateTime(endDateStr, endTimeStr)

  if (!startTime) return null

  const base = { babyId, createdAt: now, updatedAt: now }

  switch (kind) {
    case 'feeding': {
      // 兼容新旧格式：item 可能是 "breast·left" 或旧的 "breast_left" 等
      const OLD_TYPE_MAP: Record<string, { type: string; side?: string }> = {
        breast_left: { type: 'breast', side: 'left' },
        breast_right: { type: 'breast', side: 'right' },
        breast_both: { type: 'breast', side: 'both' },
      }
      let feedType: string
      let feedSide: string | undefined
      if (item in OLD_TYPE_MAP) {
        const mapped = OLD_TYPE_MAP[item]
        feedType = mapped.type
        feedSide = mapped.side
      } else if (item.includes('·')) {
        const [t, s] = item.split('·').map((p) => p.trim())
        feedType = t || item
        feedSide = s || undefined
      } else {
        feedType = item
        feedSide = undefined
      }
      return {
        kind,
        data: {
          ...base,
          type: feedType,
          side: feedSide,
          startTime,
          endTime: endTime || undefined,
          duration: duration ? parseInt(duration) * 60000 : undefined,
          amount: value ? parseFloat(value) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'diaper': {
      // value 格式：color · amount（内部键值）
      const parts = value.split('·').map((p) => p.trim())
      return {
        kind,
        data: {
          ...base,
          type: item, // 内部键值
          time: startTime,
          color: parts[0] || undefined,
          amount: parts[1] || undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'pumping': {
      return {
        kind,
        data: {
          ...base,
          side: item, // 内部键值
          startTime,
          endTime: endTime || undefined,
          duration: duration ? parseInt(duration) * 60000 : undefined,
          amount: value ? parseFloat(value) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'sleep': {
      return {
        kind,
        data: {
          ...base,
          type: item, // 内部键值
          startTime,
          endTime: endTime || startTime + 60 * 60000,
          notes: notes || undefined,
        },
      }
    }
    case 'growth': {
      // value 格式： "8.5 kg · 70.2 cm · 44 cm"
      const weightMatch = value.match(/([\d.]+)\s*kg/)
      const heightMatch = value.match(/([\d.]+)\s*cm/)
      // headMatch 暂不使用，保留以备头围解析扩展
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
          height: heightMatch ? parseFloat(heightMatch[1]) : undefined,
          headCircumference: undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'solidFood': {
      return {
        kind,
        data: {
          ...base,
          time: startTime,
          food: item,
          amount: value || undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'medication': {
      return {
        kind,
        data: {
          ...base,
          time: startTime,
          name: item,
          dose: value || undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'vaccination': {
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          name: item,
          dose: value || undefined,
          status: VACCINE_STATUS_REV[status] || 'planned',
          notes: notes || undefined,
        },
      }
    }
    case 'temperature': {
      const tempMatch = value.match(/([\d.]+)\s*℃?/)
      return {
        kind,
        data: {
          ...base,
          time: startTime,
          method: item || undefined, // 内部键值
          value: tempMatch ? parseFloat(tempMatch[1]) : 0,
          notes: notes || undefined,
        },
      }
    }
    case 'milestone': {
      return {
        kind,
        data: {
          ...base,
          type: item, // 内部键值
          time: startTime,
          notes: notes || undefined,
        },
      }
    }
  }
  return null
}

/** 导入 CSV 备份（覆盖当前数据） */
export async function importAllCsv(
  file: File,
): Promise<{
  babies: number
  feedings: number
  diapers: number
  pumpings: number
  sleeps: number
  growths: number
  solidFoods: number
  medications: number
  vaccinations: number
  temperatures: number
  milestones: number
}> {
  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error(t('exportCsv.invalidFile'))

  const headers = rows[0]
  const hasBabyNameCol = headers[0] === t('exportCsv.babyName') || headers[0] === '宝宝名' || headers[0] === 'Baby Name'

  const babiesMap = new Map<string, { name: string; id: number }>()
  const recordBuckets: Record<string, unknown[]> = {
    feedings: [],
    diapers: [],
    pumpings: [],
    sleeps: [],
    growths: [],
    solidFoods: [],
    medications: [],
    vaccinations: [],
    temperatures: [],
    milestones: [],
  }

  const now = Date.now()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((c) => c === '')) continue

    const babyName = hasBabyNameCol ? row[0] : ''
    let babyId: number

    if (babyName) {
      if (!babiesMap.has(babyName)) {
        const tempId = -(babiesMap.size + 1)
        babiesMap.set(babyName, { name: babyName, id: tempId })
      }
      babyId = babiesMap.get(babyName)!.id
    } else {
      if (babiesMap.size === 0) {
        babiesMap.set('默认宝宝', { name: '默认宝宝', id: -1 })
      }
      babyId = babiesMap.values().next().value!.id
    }

    const mapped = mapCsvRowToRecord(row, headers, babyId, now)
    if (mapped) {
      recordBuckets[mapped.kind].push(mapped.data)
    }
  }

  const babyIdMap = new Map<number, number>()
  const babyNames = Array.from(babiesMap.entries())
  if (babyNames.length === 0) throw new Error(t('exportCsv.noBaby'))

  await db.transaction(
    'rw',
    [
      db.babies,
      db.feedings,
      db.diapers,
      db.pumpings,
      db.sleeps,
      db.growths,
      db.solidFoods,
      db.medications,
      db.vaccinations,
      db.temperatures,
      db.milestones,
    ],
    async () => {
      await Promise.all([
        db.babies.clear(),
        db.feedings.clear(),
        db.diapers.clear(),
        db.pumpings.clear(),
        db.sleeps.clear(),
        db.growths.clear(),
        db.solidFoods.clear(),
        db.medications.clear(),
        db.vaccinations.clear(),
        db.temperatures.clear(),
        db.milestones.clear(),
      ])

      for (const [, { name, id: tempId }] of babyNames) {
        const realId = (await db.babies.add({ name, avatarColor: '#FF6B6B', createdAt: now }))!
        babyIdMap.set(tempId, realId)
      }

      for (const [kind, records] of Object.entries(recordBuckets)) {
        if (records.length === 0) continue
        const withRealId = records.map((r) => ({
          ...(r as Record<string, unknown>),
          babyId: babyIdMap.get((r as Record<string, unknown>).babyId as number) ?? babyIdMap.values().next().value!,
        }))
        await (db as Record<string, any>)[kind].bulkAdd(withRealId)
      }
    },
  )

  return {
    babies: babyNames.length,
    feedings: recordBuckets.feedings.length,
    diapers: recordBuckets.diapers.length,
    pumpings: recordBuckets.pumpings.length,
    sleeps: recordBuckets.sleeps.length,
    growths: recordBuckets.growths.length,
    solidFoods: recordBuckets.solidFoods.length,
    medications: recordBuckets.medications.length,
    vaccinations: recordBuckets.vaccinations.length,
    temperatures: recordBuckets.temperatures.length,
    milestones: recordBuckets.milestones.length,
  }
}