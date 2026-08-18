/** 通用工具函数 */

/** 补零 */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** 格式化时间为 HH:mm */
export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 本地日期字符串转当天 0 点时间戳 */
export function dateToStart(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** 当天 0 点时间戳 */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 当天 23:59:59.999 时间戳 */
export function endOfDay(ts: number): number {
  return startOfDay(ts) + 24 * 3600_000 - 1
}

/** 格式化时长：秒/分钟 → "X小时Y分钟" / "Y分钟" */
export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0分钟'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 1) return `${Math.max(1, Math.round(ms / 1000))}秒`
  if (totalMin < 60) return `${totalMin}分钟`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h}小时` : `${h}小时${m}分`
}

/** 格式化奶量为 "120 ml" */
export function formatAmount(ml?: number): string {
  if (ml === undefined || ml === null) return ''
  return `${Math.round(ml)} ml`
}

/** 格式化日期为 "8月13日 周四" */
export function formatDateCN(ts: number): string {
  const d = new Date(ts)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`
}

/** 相对时间：今天/昨天/日期 */
export function formatDayLabel(ts: number): string {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  if (day === today) return '今天'
  if (day === today - 24 * 3600_000) return '昨天'
  return formatDate(ts)
}

/** 百分比变化格式：+12.5% / -3.2% */
export function formatPercentChange(change: number): string {
  if (!isFinite(change)) return '—'
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

/** 生成短 id */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 当前是否夜间（22:00-6:00） */
export function isNightTime(ts: number): boolean {
  const h = new Date(ts).getHours()
  return h >= 22 || h < 6
}

/** 下载文件到本地 */
export function downloadBlob(content: Blob | string, filename: string, mime: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 时间戳 → datetime-local 输入框值 */
export function toDateTimeLocal(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** datetime-local 输入框值 → 时间戳（无效返回 undefined） */
export function fromDateTimeLocal(value: string): number | undefined {
  if (!value) return undefined
  const ts = new Date(value).getTime()
  return isNaN(ts) ? undefined : ts
}
