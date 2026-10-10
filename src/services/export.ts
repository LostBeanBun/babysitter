import { db, type BabySitterDB } from '@/db'
import { RECORD_TABLES } from '@/db/tables'
import i18n from '@/i18n'
import zhCN from '@/i18n/locales/zh-CN'
import enUS from '@/i18n/locales/en-US'
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

/** CSV 数据列（不含可选宝宝名列），列序单一来源 */
const CSV_COLUMN_KEYS = ['recordType', 'date', 'time', 'endDate', 'endTime', 'item', 'value', 'duration', 'status', 'notes'] as const

/** 表头别名（导入用）：zh/en 两语言列名 + 内部键值，兼容任意语言导出的文件 */
const HEADER_ALIASES: Record<string, string[]> = {
  babyName: [zhCN.exportCsv.babyName, enUS.exportCsv.babyName, 'babyName'],
  ...Object.fromEntries(CSV_COLUMN_KEYS.map((k) => [k, [zhCN.exportCsv[k], enUS.exportCsv[k], k]])),
}

/** 按表头取单元格：当前 locale 列名 -> zh -> en -> 内部键值，未命中返回 '' */
function headerCell(obj: Record<string, string>, key: string): string {
  for (const alias of [t(`exportCsv.${key}`), ...HEADER_ALIASES[key]]) {
    const v = obj[alias]
    if (v !== undefined) return v
  }
  return ''
}

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
  brown: '棕色',
  green: '绿色',
  black: '黑色',
  red: '红色',
  other: '其他',
  // 纸尿裤量
  small: '少量',
  medium: '适中',
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
  forehead: '额温',
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

/** 旧版 CSV 标签别名（兼容历史导出文件的反查） */
const LEGACY_LABEL_ALIASES: [string, string][] = [
  ['褐色', 'brown'],
  ['中等', 'medium'],
  ['额头', 'forehead'],
]

/** 显示文本 -> 内部键值反查表（导入用：zh/en 标签、亲喂侧标签、内部键值自身） */
const LABEL_REV: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const k of Object.keys(LABELS_ZH)) m.set(k, k)
  for (const map of [LABELS_ZH, LABELS_EN]) {
    for (const [k, v] of Object.entries(map)) if (!m.has(v)) m.set(v, k)
  }
  for (const byLocale of Object.values(BREAST_SIDE_LABELS_MAP)) {
    for (const [k, v] of Object.entries(byLocale)) if (!m.has(v)) m.set(v, k)
  }
  for (const [label, key] of LEGACY_LABEL_ALIASES) if (!m.has(label)) m.set(label, key)
  return m
})()

function toInternal(label: string): string {
  return LABEL_REV.get(label) ?? label
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

type Row = (string | number | undefined | null)[]

/** CSV 表头（仅本地化展示） */
function csvHeader(withBaby: boolean): Row {
  const cols = CSV_COLUMN_KEYS.map((k) => t(`exportCsv.${k}`))
  return withBaby ? [t('exportCsv.babyName'), ...cols] : cols
}

/** 开始时间两列：[date, time] */
function startCells(ts: number): [string, string] {
  return [formatDate(ts), formatTime(ts)]
}

/** 结束时间两列：无值时留空 */
function endCells(ts?: number): [string, string] {
  return ts ? [formatDate(ts), formatTime(ts)] : ['', '']
}

/** 时长列：ms → 分钟（无值留空） */
function minCell(ms?: number): number | string {
  return ms ? Math.round(ms / 60000) : ''
}

/** 一条记录行：宝宝名前列 + 固定 10 列（type..notes） */
function makeRow(nameCol: Row, type: string, cells: [string, string, string, string, string, string, number | string, string, string]): Row {
  const [date, time, endDate, endTime, item, value, duration, status, notes] = cells
  return [...nameCol, bl(type), date, time, endDate, endTime, item, value, duration, status, notes]
}

/**
 * 生成单个宝宝的全部记录 CSV 数据行（不含表头）。
 * 列值使用当前 locale 的本地化标签；导入时经 zh/en 双语反查表还原为内部键值。
 * babyName 提供时每行首列插入宝宝名（用于多宝宝合并导出）。
 */
export function buildBabyCsvRows(data: BabyCsvData, babyName?: string): Row[] {
  const nameCol: Row = babyName !== undefined ? [babyName] : []
  const rows: Row[] = []

  // 喂养
  for (const f of data.feedings) {
    const typeLabel = f.type === 'breast' && f.side ? bl(f.type) + '·' + breastSideLabel(f.side) : bl(f.type)
    const [ed, et] = endCells(f.endTime)
    const [d, tm] = startCells(f.startTime)
    rows.push(makeRow(nameCol, 'feeding', [d, tm, ed, et, typeLabel, f.amount ? `${f.amount} ml` : '', minCell(f.duration), '', f.notes ?? '']))
  }

  // 纸尿裤
  for (const g of data.diapers) {
    const [d, tm] = startCells(g.time)
    const value = [g.color ? bl(g.color) : '', g.amount ? bl(g.amount) : ''].filter(Boolean).join(' · ')
    rows.push(makeRow(nameCol, 'diaper', [d, tm, '', '', bl(g.type), value, '', '', g.notes ?? '']))
  }

  // 吸奶
  for (const p of data.pumpings) {
    const [ed, et] = endCells(p.endTime)
    const [d, tm] = startCells(p.startTime)
    rows.push(
      makeRow(nameCol, 'pumping', [d, tm, ed, et, breastSideLabel(p.side), p.amount ? `${p.amount} ml` : '', minCell(p.duration), '', p.notes ?? '']),
    )
  }

  // 睡眠
  for (const s of data.sleeps) {
    const endTs = s.endTime ?? s.startTime
    const durMs = s.duration ?? endTs - s.startTime
    const [d, tm] = startCells(s.startTime)
    const [ed, et] = startCells(endTs)
    rows.push(makeRow(nameCol, 'sleep', [d, tm, ed, et, bl(s.type), '', minCell(durMs), '', s.notes ?? '']))
  }

  // 成长记录
  for (const g of data.growths) {
    const parts: string[] = []
    if (g.weight != null) parts.push(`${g.weight} kg`)
    if (g.height != null) parts.push(`${g.height} cm`)
    if (g.headCircumference != null) parts.push(`${g.headCircumference} cm`)
    rows.push(makeRow(nameCol, 'growth', [formatDate(g.date), '', '', '', '', parts.join(' · '), '', '', g.notes ?? '']))
  }

  // 辅食
  for (const sf of data.solidFoods) {
    const [d, tm] = startCells(sf.time)
    rows.push(makeRow(nameCol, 'solidFood', [d, tm, '', '', sf.food, sf.amount ?? '', '', '', sf.notes ?? '']))
  }

  // 用药
  for (const m of data.medications) {
    const [d, tm] = startCells(m.time)
    rows.push(makeRow(nameCol, 'medication', [d, tm, '', '', m.name, m.dose ?? '', '', '', m.notes ?? '']))
  }

  // 疫苗
  for (const v of data.vaccinations) {
    rows.push(makeRow(nameCol, 'vaccination', [formatDate(v.date), '', '', '', v.name, v.dose ?? '', '', bl(v.status), v.notes ?? '']))
  }

  // 体温
  for (const tmp of data.temperatures) {
    const [d, tm] = startCells(tmp.time)
    rows.push(
      makeRow(nameCol, 'temperature', [
        d,
        tm,
        '',
        '',
        tmp.method ? bl(tmp.method) : '',
        tmp.value != null && tmp.value !== 0 ? `${tmp.value} ℃` : '',
        '',
        '',
        tmp.notes ?? '',
      ]),
    )
  }

  // 里程碑
  for (const ms of data.milestones) {
    const [d, tm] = startCells(ms.time)
    rows.push(makeRow(nameCol, 'milestone', [d, tm, '', '', bl(ms.type), '', '', '', ms.notes ?? '']))
  }

  return rows
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

/** 读取单个宝宝的全部记录（按时间排序） */
async function fetchBabyData(babyId: number): Promise<BabyCsvData> {
  if (!Number.isFinite(babyId) || babyId <= 0) {
    throw new Error('Invalid babyId for export')
  }
  const entries = await Promise.all(
    RECORD_TABLES.map(async (r) => {
      const query = db[r.name].where('babyId').equals(babyId).sortBy(r.timeField) as Promise<unknown[]>
      // milestones 表在 v4 新增 babyId 索引，若数据库版本过旧可能抛错，做兼容处理
      const list = r.name === 'milestones' ? await query.catch(() => []) : await query
      return [r.name, list] as const
    }),
  )
  return Object.fromEntries(entries) as unknown as BabyCsvData
}

/** 下载 CSV（带 BOM） */
function downloadCsv(rows: Row[], filename: string): void {
  downloadBlob('\ufeff' + toCsv(rows), filename, 'text/csv;charset=utf-8')
}

/** 导出单个宝宝 CSV（十类记录合并为单个文件，统一宽表结构） */
export async function exportBabyCsvs(baby: Baby): Promise<void> {
  if (baby.id === undefined || baby.id === null || !Number.isFinite(baby.id) || baby.id <= 0) {
    throw new Error('Invalid baby id for export')
  }
  const data = await fetchBabyData(baby.id)
  const rows: Row[] = [csvHeader(false), ...buildBabyCsvRows(data)]
  downloadCsv(rows, t('exportCsv.allFileName', { name: baby.name, stamp: formatDate(Date.now()) }))
}

/** 一键导出全部宝宝的全部记录为单个合并 CSV（首列标识宝宝名） */
export async function exportAllBabiesCsv(): Promise<void> {
  const babies = await db.babies.toArray()
  const rows: Row[] = [csvHeader(true)]
  for (const baby of babies) {
    const data = await fetchBabyData(baby.id!)
    rows.push(...buildBabyCsvRows(data, baby.name))
  }
  downloadCsv(rows, t('exportCsv.allBabiesFileName', { stamp: formatDate(Date.now()) }))
}

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

/** 导入用：记录种类 → 表名（复数）映射 */
const RECORD_TYPE_KEY_MAP: Record<string, string> = Object.fromEntries(RECORD_TABLES.map((r) => [r.kind, r.name]))

/** 解析 "date time" → 时间戳（date 为空返回 0） */
function parseDateTime(date: string, time: string): number {
  if (!date) return 0
  const d = parseDate(`${date} ${time || '00:00'}`)
  return d ?? new Date(`${date}T${time || '00:00'}`).getTime()
}

/** 兼容旧格式：breast_left 等下划线写法 */
const OLD_FEED_TYPE_MAP: Record<string, { type: string; side?: string }> = {
  breast_left: { type: 'breast', side: 'left' },
  breast_right: { type: 'breast', side: 'right' },
  breast_both: { type: 'breast', side: 'both' },
}

/** 将 CSV 行映射为具体记录对象（列值为本地化标签或内部键值，统一经 toInternal 反查） */
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

  // 表头可能是当前 locale / zh / en 的列名或内部键值
  const typeLabel = headerCell(obj, 'recordType')
  const kind = RECORD_TYPE_KEY_MAP[toInternal(typeLabel)]
  if (!kind) return null

  const dateStr = headerCell(obj, 'date')
  const timeStr = headerCell(obj, 'time')
  const endDateStr = headerCell(obj, 'endDate')
  const endTimeStr = headerCell(obj, 'endTime')
  const item = headerCell(obj, 'item')
  const value = headerCell(obj, 'value')
  const duration = headerCell(obj, 'duration')
  const status = headerCell(obj, 'status')
  const notes = headerCell(obj, 'notes')

  const startTime = parseDateTime(dateStr, timeStr)
  const endTime = parseDateTime(endDateStr, endTimeStr)

  if (!startTime) return null

  const base = { babyId, createdAt: now, updatedAt: now }

  switch (kind) {
    case 'feedings': {
      // 兼容新旧格式：item 可能是 "breast·left" 或旧的 "breast_left" 等
      let feedType: string
      let feedSide: string | undefined
      if (item in OLD_FEED_TYPE_MAP) {
        const mapped = OLD_FEED_TYPE_MAP[item]
        feedType = mapped.type
        feedSide = mapped.side
      } else if (item.includes('·')) {
        const [rawType, rawSide] = item.split('·').map((p) => p.trim())
        feedType = toInternal(rawType || item)
        feedSide = rawSide ? toInternal(rawSide) : undefined
      } else {
        feedType = toInternal(item)
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
    case 'diapers': {
      // value 格式：color · amount（导入时反查为内部键值）
      const parts = value.split('·').map((p) => p.trim())
      return {
        kind,
        data: {
          ...base,
          type: toInternal(item),
          time: startTime,
          color: parts[0] ? toInternal(parts[0]) : undefined,
          amount: parts[1] ? toInternal(parts[1]) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'pumpings': {
      return {
        kind,
        data: {
          ...base,
          side: toInternal(item),
          startTime,
          endTime: endTime || undefined,
          duration: duration ? parseInt(duration) * 60000 : undefined,
          amount: value ? parseFloat(value) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'sleeps': {
      return {
        kind,
        data: {
          ...base,
          type: toInternal(item),
          startTime,
          endTime: endTime || startTime + 60 * 60000,
          notes: notes || undefined,
        },
      }
    }
    case 'growths': {
      // value 格式："8.5 kg · 70.2 cm · 44 cm"（身高、头围按出现顺序）
      const weightMatch = value.match(/([\d.]+)\s*kg/)
      const cmMatches = [...value.matchAll(/([\d.]+)\s*cm/g)]
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
          height: cmMatches[0] ? parseFloat(cmMatches[0][1]) : undefined,
          headCircumference: cmMatches[1] ? parseFloat(cmMatches[1][1]) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'solidFoods': {
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
    case 'medications': {
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
    case 'vaccinations': {
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          name: item,
          dose: value || undefined,
          status: toInternal(status) === 'done' ? 'done' : 'planned',
          notes: notes || undefined,
        },
      }
    }
    case 'temperatures': {
      const tempMatch = value.match(/([\d.]+)\s*℃?/)
      return {
        kind,
        data: {
          ...base,
          time: startTime,
          method: item ? toInternal(item) : undefined,
          value: tempMatch ? parseFloat(tempMatch[1]) : 0,
          notes: notes || undefined,
        },
      }
    }
    case 'milestones': {
      return {
        kind,
        data: {
          ...base,
          type: toInternal(item),
          time: startTime,
          notes: notes || undefined,
        },
      }
    }
  }
  return null
}

/** 导入结果计数 */
export type ImportCsvResult = { babies: number } & Record<(typeof RECORD_TABLES)[number]['name'], number>

/** 导入 CSV 备份（覆盖当前数据） */
export async function importAllCsv(file: File): Promise<ImportCsvResult> {
  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error(t('exportCsv.invalidFile'))

  const headers = rows[0]
  const hasBabyNameCol = [t('exportCsv.babyName'), ...HEADER_ALIASES.babyName].includes(headers[0])

  const babiesMap = new Map<string, { name: string; id: number }>()
  const recordBuckets = Object.fromEntries(RECORD_TABLES.map((r) => [r.name, [] as unknown[]]))

  const now = Date.now()
  let mappedCount = 0

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
        const defaultBabyName = t('exportCsv.defaultBaby')
        babiesMap.set(defaultBabyName, { name: defaultBabyName, id: -1 })
      }
      babyId = babiesMap.values().next().value!.id
    }

    const mapped = mapCsvRowToRecord(row, headers, babyId, now)
    if (mapped) {
      recordBuckets[mapped.kind].push(mapped.data)
      mappedCount++
    }
  }

  // 一条记录都没识别出：不是本应用导出的文件，拒绝导入（避免清库后写入空数据）
  if (mappedCount === 0) throw new Error(t('exportCsv.invalidFile'))

  const babyIdMap = new Map<number, number>()
  const babyNames = Array.from(babiesMap.entries())
  if (babyNames.length === 0) throw new Error(t('exportCsv.noBaby'))

  await db.transaction(
    'rw',
    [db.babies, ...RECORD_TABLES.map((r) => db[r.name])],
    async () => {
      await Promise.all([db.babies.clear(), ...RECORD_TABLES.map((r) => db[r.name].clear())])

      for (const [, { name, id: tempId }] of babyNames) {
        const realId = (await db.babies.add({ name, avatarColor: '#FF6B6B', createdAt: now }))!
        babyIdMap.set(tempId, realId)
      }

      for (const [name, records] of Object.entries(recordBuckets)) {
        if (records.length === 0) continue
        const withRealId = records.map((r) => ({
          ...(r as Record<string, unknown>),
          babyId: babyIdMap.get((r as Record<string, unknown>).babyId as number) ?? babyIdMap.values().next().value!,
        }))
        await (db[name as keyof BabySitterDB] as { bulkAdd: (items: typeof withRealId) => Promise<unknown> }).bulkAdd(withRealId)
      }
    },
  )

  return {
    babies: babyNames.length,
    ...Object.fromEntries(RECORD_TABLES.map((r) => [r.name, recordBuckets[r.name].length])),
  } as ImportCsvResult
}
