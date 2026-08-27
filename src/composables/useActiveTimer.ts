/**
 * 全局计时器状态（单例）：跨弹窗/页面共享当前活跃计时器。
 * - start(kind) 开始计时
 * - stop() 停止并返回 { start, end }
 * - updateStartTime(ts) 修改起始时间（自动重算已用时）
 * - reset() 清除计时器状态
 * - 持久化到 localStorage，刷新页面后自动恢复
 */
import { ref, computed } from 'vue'

export type TimerKind = 'feeding' | 'sleep' | 'pumping'

const STORAGE_KEY = 'active_timer'

interface StoredTimer {
  kind: TimerKind
  startTime: number
}

// —— 模块级单例状态 ——
const kind = ref<TimerKind | null>(null)
const startTime = ref(0)
const running = ref(false)
const elapsedMs = ref(0)
let timerId: number | undefined

function tick() {
  if (running.value && startTime.value > 0) {
    elapsedMs.value = Date.now() - startTime.value
  }
}

function save() {
  if (running.value && kind.value && startTime.value > 0) {
    const data: StoredTimer = { kind: kind.value, startTime: startTime.value }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function restore(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data: StoredTimer = JSON.parse(raw)
    if (data.kind && data.startTime > 0) {
      kind.value = data.kind
      startTime.value = data.startTime
      running.value = true
      elapsedMs.value = Date.now() - data.startTime
      if (timerId) clearInterval(timerId)
      timerId = window.setInterval(tick, 1000)
      tick()
      return true
    }
  } catch {
    // corrupted data, ignore
  }
  return false
}

// 页面加载时自动恢复
const restored = restore()

export function useActiveTimer() {
  function start(k: TimerKind, ts: number = Date.now()) {
    kind.value = k
    startTime.value = ts
    running.value = true
    elapsedMs.value = 0
    if (timerId) clearInterval(timerId)
    timerId = window.setInterval(tick, 1000)
    tick()
    save()
  }

  function stop(): { start: number; end: number } | null {
    if (!running.value) return null
    const end = Date.now()
    const s = startTime.value
    running.value = false
    if (timerId) clearInterval(timerId)
    timerId = undefined
    elapsedMs.value = end - s
    save()
    return { start: s, end }
  }

  function updateStartTime(ts: number) {
    if (!running.value) return
    startTime.value = ts
    tick()
    save()
  }

  function reset() {
    running.value = false
    kind.value = null
    startTime.value = 0
    elapsedMs.value = 0
    if (timerId) clearInterval(timerId)
    timerId = undefined
    save()
  }

  const isActive = computed(() => running.value && kind.value !== null)

  return {
    kind,
    startTime,
    running,
    elapsedMs,
    isActive,
    start,
    stop,
    updateStartTime,
    reset,
  }
}

// 导出恢复状态供 App.vue 判断
export { restored }
