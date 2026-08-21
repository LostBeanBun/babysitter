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
import { downloadBlob, formatDate, formatTime, parseDate } from '@/utils/format'

const t = i18n.global.t

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
 * 使用内部键值，确保跨 locale 可导入。
 * babyName 提供时每行首列插入宝宝名（用于多宝宝合并导出）。
 */
export function buildBabyCsvRows(data: BabyCsvData, babyName?: string): Row[] {
  const withBaby = babyName !== undefined
  const rows: Row[] = []
  const nameCol = (): Row => (withBaby ? [babyName] : [])

  // 喂养
  for (const f of data.feedings) {
    rows.push([
      ...nameCol(),
      'feeding',
      formatDate(f.startTime),
      formatTime(f.startTime),
      '',
      '',
      f.type, // 内部键值：breast_left / breast_right / breast_both / bottle_breastmilk / bottle_formula
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
      'diaper',
      formatDate(d.time),
      formatTime(d.time),
      '',
      '',
      d.type, // 内部键值：wet / dirty / both
      [d.color ? d.color : '', d.amount ? d.amount : ''].filter(Boolean).join(' · '),
      '',
      '',
      d.notes ?? '',
    ])
  }

  // 吸奶
  for (const p of data.pumpings) {
    rows.push([
      ...nameCol(),
      'pumping',
      formatDate(p.startTime),
      formatTime(p.startTime),
      '',
      '',
      p.side, // 内部键值：left / right / both
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
      'sleep',
      formatDate(s.startTime),
      formatTime(s.startTime),
      formatDate(s.endTime),
      formatTime(s.endTime),
      s.type, // 内部键值：nap / night
      '',
      Math.round((s.endTime - s.startTime) / 60000),
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
      'growth',
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
      'solidFood',
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
      'medication',
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
      'vaccination',
      formatDate(v.date),
      '',
      '',
      '',
      v.name,
      v.dose ?? '',
      '',
      v.status, // 内部键值：planned / done
      v.notes ?? '',
    ])
  }

  // 体温
  for (const tmp of data.temperatures) {
    rows.push([
      ...nameCol(),
      'temperature',
      formatDate(tmp.time),
      formatTime(tmp.time),
      '',
      '',
      tmp.method ?? '', // 内部键值：armpit / ear / forehead / rectal
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
      'milestone',
      formatDate(ms.time),
      formatTime(ms.time),
      '',
      '',
      ms.type, // 内部键值：roll / sit / crawl / stand / walk / first_word / tooth / wave / other
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
      db.milestones.where('babyId').equals(babyId).sortBy('time'),
    ])
  return { feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures, milestones }
}

/** 导出单个宝宝 CSV（十类记录合并为单个文件，统一宽表结构） */
export async function exportBabyCsvs(baby: Baby): Promise<void> {
  const data = await fetchBabyData(baby.id!)
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
      return {
        kind,
        data: {
          ...base,
          type: item, // 内部键值
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
        const realId = await db.babies.add({ name, avatarColor: '#FF6B6B', createdAt: now, updatedAt: now })
        babyIdMap.set(tempId, realId)
      }

      for (const [kind, records] of Object.entries(recordBuckets)) {
        if (records.length === 0) continue
        const withRealId = records.map((r) => ({
          ...r,
          babyId: babyIdMap.get(r.babyId) ?? babyIdMap.values().next().value!,
        }))
        await db[kind as keyof typeof db].bulkAdd(withRealId)
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