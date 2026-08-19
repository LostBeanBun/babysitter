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
} from '@/types'
import { downloadBlob, formatDate, formatTime } from '@/utils/format'
import {
  FEED_TYPE_LABELS,
  DIAPER_TYPE_LABELS,
  DIAPER_COLOR_LABELS,
  DIAPER_AMOUNT_LABELS,
  PUMP_SIDE_LABELS,
  SLEEP_TYPE_LABELS,
  TEMP_METHOD_LABELS,
} from '@/constants'

const t = i18n.global.t

/** CSV 转义：含逗号/引号/换行时包裹引号 */
function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
}

/** 导出全量数据为 JSON 备份文件 */
export async function exportAllJson(): Promise<void> {
  const [babies, feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures] =
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

  // 校验基本结构
  const bad = [...feedings, ...diapers, ...pumpings, ...sleeps, ...growths, ...solidFoods, ...medications, ...temperatures].some(
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
  }
}

/** 按宝宝导出 CSV（九类记录合并为单个文件，统一宽表结构） */
export async function exportBabyCsvs(baby: Baby): Promise<void> {
  const [feedings, diapers, pumpings, sleeps, growths, solidFoods, medications, vaccinations, temperatures] =
    await Promise.all([
      db.feedings.where('babyId').equals(baby.id!).sortBy('startTime'),
      db.diapers.where('babyId').equals(baby.id!).sortBy('time'),
      db.pumpings.where('babyId').equals(baby.id!).sortBy('startTime'),
      db.sleeps.where('babyId').equals(baby.id!).sortBy('startTime'),
      db.growths.where('babyId').equals(baby.id!).sortBy('date'),
      db.solidFoods.where('babyId').equals(baby.id!).sortBy('time'),
      db.medications.where('babyId').equals(baby.id!).sortBy('time'),
      db.vaccinations.where('babyId').equals(baby.id!).sortBy('date'),
      db.temperatures.where('babyId').equals(baby.id!).sortBy('time'),
    ])

  type Row = (string | number | undefined | null)[]
  const rows: Row[] = [
    [
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
    ],
  ]

  // 喂养
  for (const f of feedings) {
    rows.push([
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
  for (const d of diapers) {
    const color = d.color ? t(DIAPER_COLOR_LABELS[d.color]) : ''
    const amount = d.amount ? t(DIAPER_AMOUNT_LABELS[d.amount]) : ''
    rows.push([
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
  for (const p of pumpings) {
    rows.push([
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
  for (const s of sleeps) {
    rows.push([
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
  for (const g of growths) {
    const parts: string[] = []
    if (g.weight != null) parts.push(`${g.weight} kg`)
    if (g.height != null) parts.push(`${g.height} cm`)
    rows.push([
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
  for (const sf of solidFoods) {
    rows.push([
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
  for (const m of medications) {
    rows.push([
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
  for (const v of vaccinations) {
    rows.push([
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
  for (const tmp of temperatures) {
    rows.push([
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

  const stamp = formatDate(Date.now())
  downloadBlob(
    '\ufeff' + toCsv(rows),
    t('exportCsv.allFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )
}
