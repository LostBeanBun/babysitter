/**
 * 全局计时器状态（单例）：跨弹窗/页面共享当前活跃计时器。
 * - start(kind) 开始计时
 * - stop() 停止并返回 { start, end }
 * - updateStartTime(ts) 修改起始时间（自动重算已用时）
 * - reset() 清除计时器状态
 */
import { ref, computed } from 'vue'

export type TimerKind = 'feeding' | 'sleep' | 'pumping'

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

export function useActiveTimer() {
  function start(k: TimerKind, ts: number = Date.now()) {
    kind.value = k
    startTime.value = ts
    running.value = true
    elapsedMs.value = 0
    if (timerId) clearInterval(timerId)
    timerId = window.setInterval(tick, 1000)
    tick()
  }

  function stop(): { start: number; end: number } | null {
    if (!running.value) return null
    const end = Date.now()
    const s = startTime.value
    running.value = false
    if (timerId) clearInterval(timerId)
    timerId = undefined
    elapsedMs.value = end - s
    return { start: s, end }
  }

  function updateStartTime(ts: number) {
    if (!running.value) return
    startTime.value = ts
    tick()
  }

  function reset() {
    running.value = false
    kind.value = null
    startTime.value = 0
    elapsedMs.value = 0
    if (timerId) clearInterval(timerId)
    timerId = undefined
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
