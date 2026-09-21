/**
 * 全局记录状态（数组模式）：支持多个未完成记录同时存在。
 * - start(kind, recordId, ts) 开始记录，返回唯一 id
 * - reset(id?) 按 id 清除，不传则清除全部
 * - records 活跃记录列表（最多 MAX_RECORDS 条）
 * - 持久化到 localStorage，刷新页面后悬浮球自动恢复
 */
import { ref, computed } from 'vue'

export type TimerKind = 'feeding' | 'sleep' | 'pumping'

export interface ActiveRecord {
  id: string
  kind: TimerKind
  recordId: number
  startTime: number
}

const STORAGE_KEY = 'active_records'
const MAX_RECORDS = 3

let nextId = 1

// —— 模块级单例状态 ——
const records = ref<ActiveRecord[]>([])

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const arr: ActiveRecord[] = JSON.parse(raw)
    if (Array.isArray(arr)) {
      records.value = arr.filter((r) => r.kind && r.recordId != null && r.startTime > 0)
      // 恢复 nextId
      for (const r of records.value) {
        const num = Number(r.id)
        if (!isNaN(num) && num >= nextId) nextId = num + 1
      }
    }
  } catch {
    // corrupted data, ignore
  }
}

restore()

export function useActiveTimer() {
  /** 是否已存在同类记录 */
  function hasKind(k: TimerKind): boolean {
    return records.value.some((r) => r.kind === k)
  }

  /** 开始记录，返回唯一 id；若已达上限或同类已存在则返回 null */
  function start(k: TimerKind, recordId: number, ts: number = Date.now()): string | null {
    if (records.value.length >= MAX_RECORDS) return null
    if (hasKind(k)) return null
    const id = String(nextId++)
    records.value.push({ id, kind: k, recordId, startTime: ts })
    save()
    return id
  }

  /** 按 id 清除记录；不传 id 则清除全部 */
  function reset(id?: string) {
    if (id) {
      records.value = records.value.filter((r) => r.id !== id)
    } else {
      records.value = []
    }
    save()
  }

  /** 按 id 查找记录 */
  function getById(id: string): ActiveRecord | undefined {
    return records.value.find((r) => r.id === id)
  }

  /** 按 kind 查找记录 */
  function getByKind(k: TimerKind): ActiveRecord | undefined {
    return records.value.find((r) => r.kind === k)
  }

  const isActive = computed(() => records.value.length > 0)

  return {
    records,
    isActive,
    hasKind,
    start,
    reset,
    getById,
    getByKind,
  }
}
