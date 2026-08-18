import { db, DB_VERSION } from '@/db'
import type { ExportFile, ExportMeta, Feeding, DiaperChange, Pumping, Sleep, Baby } from '@/types'
import { downloadBlob, formatDate, formatTime } from '@/utils/format'
import { FEED_TYPE_LABELS, DIAPER_TYPE_LABELS, DIAPER_COLOR_LABELS, DIAPER_AMOUNT_LABELS, PUMP_SIDE_LABELS, SLEEP_TYPE_LABELS } from '@/constants'

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
  const [babies, feedings, diapers, pumpings, sleeps] = await Promise.all([
    db.babies.toArray(),
    db.feedings.toArray(),
    db.diapers.toArray(),
    db.pumpings.toArray(),
    db.sleeps.toArray(),
  ])
  const meta: ExportMeta = { app: 'babysitter', version: DB_VERSION, exportedAt: new Date().toISOString() }
  const payload: ExportFile = { meta, babies, feedings, diapers, pumpings, sleeps }
  const filename = `宝宝日记-备份-${formatDate(Date.now())}.json`
  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8')
}

/** 导入 JSON 备份（覆盖当前数据） */
export async function importAllJson(file: File): Promise<{ babies: number; feedings: number; diapers: number; pumpings: number; sleeps: number }> {
  const text = await file.text()
  let payload: ExportFile
  try {
    payload = JSON.parse(text) as ExportFile
  } catch {
    throw new Error('文件格式错误，不是有效的 JSON 备份文件')
  }
  if (!payload.meta || payload.meta.app !== 'babysitter') {
    throw new Error('不是宝宝日记的备份文件')
  }
  const babies = (payload.babies ?? []) as Baby[]
  const feedings = (payload.feedings ?? []) as Feeding[]
  const diapers = (payload.diapers ?? []) as DiaperChange[]
  const pumpings = (payload.pumpings ?? []) as Pumping[]
  const sleeps = (payload.sleeps ?? []) as Sleep[]

  // 校验基本结构
  const bad = [...feedings, ...diapers, ...pumpings, ...sleeps].some((r) => typeof r.babyId !== 'number')
  if (bad) throw new Error('备份文件数据结构不完整')

  await db.transaction('rw', db.babies, db.feedings, db.diapers, db.pumpings, db.sleeps, async () => {
    await Promise.all([
      db.babies.clear(),
      db.feedings.clear(),
      db.diapers.clear(),
      db.pumpings.clear(),
      db.sleeps.clear(),
    ])
    await Promise.all([
      db.babies.bulkAdd(babies),
      db.feedings.bulkAdd(feedings),
      db.diapers.bulkAdd(diapers),
      db.pumpings.bulkAdd(pumpings),
      db.sleeps.bulkAdd(sleeps),
    ])
  })
  return { babies: babies.length, feedings: feedings.length, diapers: diapers.length, pumpings: pumpings.length, sleeps: sleeps.length }
}

/** 按宝宝导出 CSV（四类分别一个文件） */
export async function exportBabyCsvs(baby: Baby): Promise<void> {
  const [feedings, diapers, pumpings, sleeps] = await Promise.all([
    db.feedings.where('babyId').equals(baby.id!).sortBy('startTime'),
    db.diapers.where('babyId').equals(baby.id!).sortBy('time'),
    db.pumpings.where('babyId').equals(baby.id!).sortBy('startTime'),
    db.sleeps.where('babyId').equals(baby.id!).sortBy('startTime'),
  ])
  const stamp = formatDate(Date.now())

  // 喂养
  const feedRows: (string | number | undefined | null)[][] = [
    ['日期', '时间', '类型', '奶量(ml)', '亲喂时长(分钟)', '备注'],
    ...feedings.map((f) => [
      formatDate(f.startTime),
      formatTime(f.startTime),
      FEED_TYPE_LABELS[f.type],
      f.amount ?? '',
      f.duration ? Math.round(f.duration / 60000) : '',
      f.notes ?? '',
    ]),
  ]
  downloadBlob('\ufeff' + toCsv(feedRows), `${baby.name}-喂养记录-${stamp}.csv`, 'text/csv;charset=utf-8')

  // 纸尿裤
  const diaperRows: (string | number | undefined | null)[][] = [
    ['日期', '时间', '类型', '颜色', '量', '备注'],
    ...diapers.map((d) => [
      formatDate(d.time),
      formatTime(d.time),
      DIAPER_TYPE_LABELS[d.type],
      d.color ? DIAPER_COLOR_LABELS[d.color] : '',
      d.amount ? DIAPER_AMOUNT_LABELS[d.amount] : '',
      d.notes ?? '',
    ]),
  ]
  downloadBlob('\ufeff' + toCsv(diaperRows), `${baby.name}-纸尿裤记录-${stamp}.csv`, 'text/csv;charset=utf-8')

  // 吸奶
  const pumpRows: (string | number | undefined | null)[][] = [
    ['日期', '开始时间', '侧', '奶量(ml)', '时长(分钟)', '备注'],
    ...pumpings.map((p) => [
      formatDate(p.startTime),
      formatTime(p.startTime),
      PUMP_SIDE_LABELS[p.side],
      p.amount ?? '',
      p.duration ? Math.round(p.duration / 60000) : '',
      p.notes ?? '',
    ]),
  ]
  downloadBlob('\ufeff' + toCsv(pumpRows), `${baby.name}-吸奶记录-${stamp}.csv`, 'text/csv;charset=utf-8')

  // 睡眠
  const sleepRows: (string | number | undefined | null)[][] = [
    ['开始日期', '开始时间', '结束日期', '结束时间', '类型', '时长(分钟)', '备注'],
    ...sleeps.map((s) => [
      formatDate(s.startTime),
      formatTime(s.startTime),
      formatDate(s.endTime),
      formatTime(s.endTime),
      SLEEP_TYPE_LABELS[s.type],
      Math.round((s.endTime - s.startTime) / 60000),
      s.notes ?? '',
    ]),
  ]
  downloadBlob('\ufeff' + toCsv(sleepRows), `${baby.name}-睡眠记录-${stamp}.csv`, 'text/csv;charset=utf-8')
}