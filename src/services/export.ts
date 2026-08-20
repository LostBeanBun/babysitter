import { db, DB_VERSION } from '@/db'
import i18n from '@/i18n'
import type {
  ExportFile,
  ExportMeta,
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
import {
  FEED_TYPE_LABELS,
  DIAPER_TYPE_LABELS,
  DIAPER_COLOR_LABELS,
  DIAPER_AMOUNT_LABELS,
  PUMP_SIDE_LABELS,
  SLEEP_TYPE_LABELS,
  TEMP_METHOD_LABELS,
  MILESTONE_TYPE_LABELS,
} from '@/constants'

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

/** 导出全量数据为 JSON 备份文件 */
export async function exportAllJson(): Promise<void> {
  const [babies, feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures, milestones] =
    await Promise.all([
      db.babies.toArray(),
      db.feedings.toArray(),
      db.diapers.toArray(),
      db.pumpings.toArray(),
      db.sleeps.toArray(),
      db.growths.toArray(),
      db.solidFoods.toArray(),
      db.medications.toArray(),
      db.vaccinations.toArray(),
      db.temperatures.toArray(),
      db.milestones.toArray(),
    ])
  const meta: ExportMeta = { app: 'babysitter', version: DB_VERSION, exportedAt: new Date().toISOString() }
  const payload: ExportFile = {
    meta,
    babies,
    feedings,
    diapers,
    pumpings,
    sleeps,
    growths,
    solidFoods,
    medications,
    vaccinations,
    temperatures,
    milestones,
  }
  const filename = t('exportCsv.backupFileName', { app: t('app.name'), stamp: formatDate(Date.now()) })
  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8')
}

/** 导入 JSON 备份（覆盖当前数据） */
export async function importAllJson(
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
  let payload: ExportFile
  try {
    payload = JSON.parse(text) as ExportFile
  } catch {
    throw new Error(t('exportCsv.invalidFile'))
  }
  if (!payload.meta || payload.meta.app !== 'babysitter') {
    throw new Error(t('exportCsv.notBackup'))
  }
  const babies = (payload.babies ?? []) as Baby[]
  const feedings = (payload.feedings ?? []) as Feeding[]
  const diapers = (payload.diapers ?? []) as DiaperChange[]
  const pumpings = (payload.pumpings ?? []) as Pumping[]
  const sleeps = (payload.sleeps ?? []) as Sleep[]
  const growths = (payload.growths ?? []) as GrowthRecord[]
  const solidFoods = (payload.solidFoods ?? []) as SolidFood[]
  const medications = (payload.medications ?? []) as Medication[]
  const vaccinations = (payload.vaccinations ?? []) as Vaccination[]
  const temperatures = (payload.temperatures ?? []) as Temperature[]
  const milestones = (payload.milestones ?? []) as Milestone[]

  // 校验基本结构
  const bad = [...feedings, ...diapers, ...pumpings, ...sleeps, ...growths, ...solidFoods, ...medications, ...temperatures, ...milestones].some(
    (r) => typeof r.babyId !== 'number',
  )
  if (bad) throw new Error(t('exportCsv.incompleteData'))

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
      await Promise.all([
        db.babies.bulkAdd(babies),
        db.feedings.bulkAdd(feedings),
        db.diapers.bulkAdd(diapers),
        db.pumpings.bulkAdd(pumpings),
        db.sleeps.bulkAdd(sleeps),
        db.growths.bulkAdd(growths),
        db.solidFoods.bulkAdd(solidFoods),
        db.medications.bulkAdd(medications),
        db.vaccinations.bulkAdd(vaccinations),
        db.temperatures.bulkAdd(temperatures),
        db.milestones.bulkAdd(milestones),
      ])
    },
  )
  return {
    babies: babies.length,
    feedings: feedings.length,
    diapers: diapers.length,
    pumpings: pumpings.length,
    sleeps: sleeps.length,
    growths: growths.length,
    solidFoods: solidFoods.length,
    medications: medications.length,
    vaccinations: vaccinations.length,
    temperatures: temperatures.length,
    milestones: milestones.length,
  }
}

type Row = (string | number | undefined | null)[]

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

/** CSV 表头；withBaby 时首列插入宝宝名 */
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
      t('exportCsv.recordTypes.feeding'),
      formatDate(f.startTime),
      formatTime(f.startTime),
      '',
      '',
      t(FEED_TYPE_LABELS[f.type]),
      f.amount ? `${f.amount} ml` : '',
      f.duration ? Math.round(f.duration / 60000) : '',
      '',
      f.notes ?? '',
    ])
  }

  // 纸尿裤
  for (const d of data.diapers) {
    const color = d.color ? t(DIAPER_COLOR_LABELS[d.color]) : ''
    const amount = d.amount ? t(DIAPER_AMOUNT_LABELS[d.amount]) : ''
    rows.push([
      ...nameCol(),
      t('exportCsv.recordTypes.diaper'),
      formatDate(d.time),
      formatTime(d.time),
      '',
      '',
      t(DIAPER_TYPE_LABELS[d.type]),
      [color, amount].filter(Boolean).join(' · '),
      '',
      '',
      d.notes ?? '',
    ])
  }

  // 吸奶
  for (const p of data.pumpings) {
    rows.push([
      ...nameCol(),
      t('exportCsv.recordTypes.pump'),
      formatDate(p.startTime),
      formatTime(p.startTime),
      '',
      '',
      t(PUMP_SIDE_LABELS[p.side]),
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
      t('exportCsv.recordTypes.sleep'),
      formatDate(s.startTime),
      formatTime(s.startTime),
      formatDate(s.endTime),
      formatTime(s.endTime),
      t(SLEEP_TYPE_LABELS[s.type]),
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
    if (g.headCircumference != null) parts.push(`${g.headCircumference} cm（头围）`)
    rows.push([
      ...nameCol(),
      t('exportCsv.recordTypes.growth'),
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
      t('exportCsv.recordTypes.solidFood'),
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
      t('exportCsv.recordTypes.medication'),
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
      t('exportCsv.recordTypes.vaccination'),
      formatDate(v.date),
      '',
      '',
      '',
      v.name,
      v.dose ?? '',
      '',
      v.status === 'done' ? t('vaccination.statusDone') : t('vaccination.statusPlanned'),
      v.notes ?? '',
    ])
  }

  // 体温
  for (const tmp of data.temperatures) {
    rows.push([
      ...nameCol(),
      t('exportCsv.recordTypes.temperature'),
      formatDate(tmp.time),
      formatTime(tmp.time),
      '',
      '',
      tmp.method ? t(TEMP_METHOD_LABELS[tmp.method]) : '',
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
      t('exportCsv.recordTypes.milestone'),
      formatDate(ms.time),
      formatTime(ms.time),
      '',
      '',
      t(MILESTONE_TYPE_LABELS[ms.type]),
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

/** 按宝宝导出 CSV（十类记录合并为单个文件，统一宽表结构） */
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

/** CSV 记录类型映射（中英文表头 -> 内部类型标识） */
const RECORD_TYPE_MAP: Record<string, string> = {
  [t('exportCsv.recordTypes.feeding')]: 'feeding',
  [t('exportCsv.recordTypes.diaper')]: 'diaper',
  [t('exportCsv.recordTypes.pump')]: 'pumping',
  [t('exportCsv.recordTypes.sleep')]: 'sleep',
  [t('exportCsv.recordTypes.growth')]: 'growth',
  [t('exportCsv.recordTypes.solidFood')]: 'solidFood',
  [t('exportCsv.recordTypes.medication')]: 'medication',
  [t('exportCsv.recordTypes.vaccination')]: 'vaccination',
  [t('exportCsv.recordTypes.temperature')]: 'temperature',
  [t('exportCsv.recordTypes.milestone')]: 'milestone',
  // English fallbacks (in case locale differs)
  Feeding: 'feeding',
  Diaper: 'diaper',
  Pumping: 'pumping',
  Sleep: 'sleep',
  Growth: 'growth',
  'Solid Food': 'solidFood',
  Medication: 'medication',
  Vaccination: 'vaccination',
  Temperature: 'temperature',
  Milestone: 'milestone',
}

/** 反向映射：内部类型 -> 表头标签（用于导出，已在 buildBabyCsvRows 中使用） */

/** 解析 CSV 文本（支持 BOM、引号转义、字段内逗号/换行） */
export function parseCsv(text: string): string[][] {
  // 移除 BOM
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
          // 转义的双引号
          field += '"'
          i += 2
          continue
        }
        // 结束引号
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
        rows.push(row)
        row = []
        field = ''
        // 处理 \r\n
        if (ch === '\r' && next === '\n') i++
      } else {
        field += ch
      }
    }
    i++
  }
  // 最后一行
  row.push(field)
  rows.push(row)
  return rows
}

/** 将 CSV 行映射为具体记录对象 */
function mapCsvRowToRecord(
  row: string[],
  headers: string[],
  babyId: number,
  now: number,
): { kind: string; data: any } | null {
  const obj: Record<string, string> = {}
  headers.forEach((h, idx) => {
    obj[h] = row[idx] ?? ''
  })

  const typeLabel = obj[t('exportCsv.recordType')] ?? obj['记录类型'] ?? obj['Record Type']
  const kind = RECORD_TYPE_MAP[typeLabel]
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

  // 解析日期时间
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
      const feedTypeLabelsRev: Record<string, any> = {}
      Object.entries(FEED_TYPE_LABELS).forEach(([k, v]) => { feedTypeLabelsRev[v] = k })
      return {
        kind,
        data: {
          ...base,
          type: feedTypeLabelsRev[item] || 'bottle_formula',
          startTime,
          endTime: endTime || undefined,
          duration: duration ? parseInt(duration) * 60000 : undefined,
          amount: value ? parseFloat(value) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'diaper': {
      const diaperTypeLabelsRev: Record<string, any> = {}
      Object.entries(DIAPER_TYPE_LABELS).forEach(([k, v]) => { diaperTypeLabelsRev[v] = k })
      const diaperColorLabelsRev: Record<string, any> = {}
      Object.entries(DIAPER_COLOR_LABELS).forEach(([k, v]) => { diaperColorLabelsRev[v] = k })
      const diaperAmountLabelsRev: Record<string, any> = {}
      Object.entries(DIAPER_AMOUNT_LABELS).forEach(([k, v]) => { diaperAmountLabelsRev[v] = k })
      // value 可能包含 "color · amount"
      const parts = value.split('·').map((p) => p.trim())
      return {
        kind,
        data: {
          ...base,
          type: diaperTypeLabelsRev[item] || 'wet',
          time: startTime,
          color: parts[0] ? diaperColorLabelsRev[parts[0]] : undefined,
          amount: parts[1] ? diaperAmountLabelsRev[parts[1]] : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'pumping': {
      const pumpSideLabelsRev: Record<string, any> = {}
      Object.entries(PUMP_SIDE_LABELS).forEach(([k, v]) => { pumpSideLabelsRev[v] = k })
      return {
        kind,
        data: {
          ...base,
          side: pumpSideLabelsRev[item] || 'both',
          startTime,
          endTime: endTime || undefined,
          duration: duration ? parseInt(duration) * 60000 : undefined,
          amount: value ? parseFloat(value) : undefined,
          notes: notes || undefined,
        },
      }
    }
    case 'sleep': {
      const sleepTypeLabelsRev: Record<string, any> = {}
      Object.entries(SLEEP_TYPE_LABELS).forEach(([k, v]) => { sleepTypeLabelsRev[v] = k })
      return {
        kind,
        data: {
          ...base,
          type: sleepTypeLabelsRev[item] || 'nap',
          startTime,
          endTime: endTime || startTime + 60 * 60000,
          notes: notes || undefined,
        },
      }
    }
    case 'growth': {
      // value 格式: "8.5 kg · 70.2 cm · 44 cm（头围）"
      const weightMatch = value.match(/([\d.]+)\s*kg/)
      const heightMatch = value.match(/([\d.]+)\s*cm(?!.*头围)/)
      const headMatch = value.match(/([\d.]+)\s*cm.*头围/)
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
          height: heightMatch ? parseFloat(heightMatch[1]) : undefined,
          headCircumference: headMatch ? parseFloat(headMatch[1]) : undefined,
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
      const statusMap: Record<string, 'planned' | 'done'> = {}
      statusMap[t('vaccination.statusDone')] = 'done'
      statusMap[t('vaccination.statusPlanned')] = 'planned'
      statusMap['Done'] = 'done'
      statusMap['Planned'] = 'planned'
      return {
        kind,
        data: {
          ...base,
          date: startOfDay(startTime),
          name: item,
          dose: value || undefined,
          status: statusMap[status] || 'planned',
          notes: notes || undefined,
        },
      }
    }
    case 'temperature': {
      const tempMethodLabelsRev: Record<string, any> = {}
      Object.entries(TEMP_METHOD_LABELS).forEach(([k, v]) => { tempMethodLabelsRev[v] = k })
      const tempMatch = value.match(/([\d.]+)\s*℃?/)
      return {
        kind,
        data: {
          ...base,
          time: startTime,
          method: item ? tempMethodLabelsRev[item] : undefined,
          value: tempMatch ? parseFloat(tempMatch[1]) : 0,
          notes: notes || undefined,
        },
      }
    }
    case 'milestone': {
      const milestoneTypeLabelsRev: Record<string, any> = {}
      Object.entries(MILESTONE_TYPE_LABELS).forEach(([k, v]) => { milestoneTypeLabelsRev[v] = k })
      return {
        kind,
        data: {
          ...base,
          type: milestoneTypeLabelsRev[item] || 'other',
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

  // 收集所有记录
  const babiesMap = new Map<string, { name: string; id: number }>()
  const recordBuckets: Record<string, any[]> = {
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
    if (row.every((c) => c === '')) continue // 跳过空行

    const babyName = hasBabyNameCol ? row[0] : ''
    let babyId: number

    if (babyName) {
      if (!babiesMap.has(babyName)) {
        // 创建新宝宝（临时 ID，后续统一分配）
        const tempId = -(babiesMap.size + 1)
        babiesMap.set(babyName, { name: babyName, id: tempId })
      }
      babyId = babiesMap.get(babyName)!.id
    } else {
      // 无宝宝名列，使用第一个宝宝或创建默认
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

  // 分配真实 babyId（先写入 babies，获取自增 ID，再关联记录）
  const babyIdMap = new Map<number, number>() // tempId -> realId
  const babyNames = Array.from(babiesMap.entries())
  if (babyNames.length === 0) throw new Error(t('exportCsv.noBaby'))

  // 清空并重新写入
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
      // 先清空
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

      // 写入 babies，获取真实 ID
      for (const [, { name, id: tempId }] of babyNames) {
        const realId = await db.babies.add({ name, avatarColor: '#FF6B6B', createdAt: now, updatedAt: now })
        babyIdMap.set(tempId, realId)
      }

      // 替换记录中的 babyId 并批量写入
      for (const [kind, records] of Object.entries(recordBuckets)) {
        if (records.length === 0) continue
        const withRealId = records.map((r) => ({
          ...r,
          babyId: babyIdMap.get(r.babyId) ?? babyIdMap.values().next().value!,
        }))
        await db[kind as keyof typeof db].bulkAdd(withRealId as any)
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
