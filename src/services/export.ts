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

/** 读取 i18n 中的 CSV 表头数组 */
function csvHeader(key: string): (string | number | undefined | null)[] {
  return i18n.global.t(key) as unknown as (string | number | undefined | null)[]
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

/** 按宝宝导出 CSV（九类分别一个文件） */
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
  const stamp = formatDate(Date.now())

  // 喂养
  const feedRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.feeding'),
    ...feedings.map((f) => [
      formatDate(f.startTime),
      formatTime(f.startTime),
      t(FEED_TYPE_LABELS[f.type]),
      f.amount ?? '',
      f.duration ? Math.round(f.duration / 60000) : '',
      f.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(feedRows),
    t('exportCsv.feedingFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 纸尿裤
  const diaperRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.diaper'),
    ...diapers.map((d) => [
      formatDate(d.time),
      formatTime(d.time),
      t(DIAPER_TYPE_LABELS[d.type]),
      d.color ? t(DIAPER_COLOR_LABELS[d.color]) : '',
      d.amount ? t(DIAPER_AMOUNT_LABELS[d.amount]) : '',
      d.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(diaperRows),
    t('exportCsv.diaperFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 吸奶
  const pumpRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.pump'),
    ...pumpings.map((p) => [
      formatDate(p.startTime),
      formatTime(p.startTime),
      t(PUMP_SIDE_LABELS[p.side]),
      p.amount ?? '',
      p.duration ? Math.round(p.duration / 60000) : '',
      p.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(pumpRows),
    t('exportCsv.pumpFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 睡眠
  const sleepRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.sleep'),
    ...sleeps.map((s) => [
      formatDate(s.startTime),
      formatTime(s.startTime),
      formatDate(s.endTime),
      formatTime(s.endTime),
      t(SLEEP_TYPE_LABELS[s.type]),
      Math.round((s.endTime - s.startTime) / 60000),
      s.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(sleepRows),
    t('exportCsv.sleepFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 成长记录
  const growthRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.growth'),
    ...growths.map((g) => [formatDate(g.date), g.weight ?? '', g.height ?? '', g.notes ?? '']),
  ]
  downloadBlob(
    '\ufeff' + toCsv(growthRows),
    t('exportCsv.growthFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 辅食
  const solidFoodRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.solidFood'),
    ...solidFoods.map((sf) => [formatDate(sf.time), formatTime(sf.time), sf.food, sf.amount ?? '', sf.notes ?? '']),
  ]
  downloadBlob(
    '\ufeff' + toCsv(solidFoodRows),
    t('exportCsv.solidFoodFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 用药
  const medicationRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.medication'),
    ...medications.map((m) => [formatDate(m.time), formatTime(m.time), m.name, m.dose ?? '', m.notes ?? '']),
  ]
  downloadBlob(
    '\ufeff' + toCsv(medicationRows),
    t('exportCsv.medicationFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 疫苗
  const vaccinationRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.vaccination'),
    ...vaccinations.map((v) => [
      formatDate(v.date),
      v.name,
      v.dose ?? '',
      v.status === 'done' ? t('vaccination.statusDone') : t('vaccination.statusPlanned'),
      v.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(vaccinationRows),
    t('exportCsv.vaccinationFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )

  // 体温
  const temperatureRows: (string | number | undefined | null)[][] = [
    csvHeader('exportCsv.temperature'),
    ...temperatures.map((tmp) => [
      formatDate(tmp.time),
      formatTime(tmp.time),
      tmp.value,
      tmp.method ? t(TEMP_METHOD_LABELS[tmp.method]) : '',
      tmp.notes ?? '',
    ]),
  ]
  downloadBlob(
    '\ufeff' + toCsv(temperatureRows),
    t('exportCsv.temperatureFileName', { name: baby.name, stamp }),
    'text/csv;charset=utf-8',
  )
}
