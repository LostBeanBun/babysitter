<script setup lang="ts">
/**
 * 记录计时器公共组件：自包含开始/停止/计时显示逻辑，结果通过事件回传父表单。
 * - 未开始：显示开始按钮（+可选提示）
 * - 计时中：显示已计时长 + 停止按钮
 * - 编辑态（editing）：显示既有记录时长（recordedText）
 * - 已结束（finished）：显示区间回显（finishedText），可重新开始
 *
 * 当传入 kind 时，与全局 useActiveTimer 同步，支持悬浮球跨弹窗显示。
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { formatDuration } from '@/utils/format'
import { useActiveTimer, type TimerKind } from '@/composables/useActiveTimer'

const props = defineProps<{
  editing?: boolean
  recordedText?: string
  finished?: boolean
  finishedText?: string
  startLabel: string
  stopLabel: string
  hint?: string
  /** 传入时启用全局同步，支持悬浮球 */
  kind?: TimerKind
  /** 父组件传入的当前起始时间（ms 时间戳），用于同步修改起始时间 */
  startTs?: number
}>()

const emit = defineEmits<{
  (e: 'start', startTs: number): void
  (e: 'stop', payload: { start: number; end: number }): void
}>()

const activeTimer = useActiveTimer()
const useGlobal = () => props.kind != null

const running = ref(false)
const elapsedMs = ref(0)
let localTimerId: number | undefined
let localStartTs = 0
let justStarted = false

// —— 全局同步：挂载时若计时器已在运行，恢复状态 ——
onMounted(() => {
  if (useGlobal() && activeTimer.isActive.value && activeTimer.kind.value === props.kind) {
    running.value = true
    elapsedMs.value = activeTimer.elapsedMs.value
    localStartTs = activeTimer.startTime.value
  }
})

// —— 全局同步：外部 startTs 变化时重算（仅用户手动编辑时间输入时触发，start 刚触发时跳过） ——
watch(
  () => props.startTs,
  (ts) => {
    if (justStarted) {
      justStarted = false
      return
    }
    if (useGlobal() && running.value && ts && ts > 0) {
      localStartTs = ts
      activeTimer.updateStartTime(ts)
      elapsedMs.value = Date.now() - ts
    }
  },
)

function start() {
  running.value = true
  elapsedMs.value = 0
  justStarted = true
  if (useGlobal()) {
    const now = Date.now()
    localStartTs = now
    activeTimer.start(props.kind!, now)
    emit('start', now)
  } else {
    localStartTs = Date.now()
    localTimerId = window.setInterval(() => {
      elapsedMs.value = Date.now() - localStartTs
    }, 1000)
    emit('start', localStartTs)
  }
}

function stop() {
  running.value = false
  if (useGlobal()) {
    const result = activeTimer.stop()
    const end = result?.end ?? Date.now()
    emit('stop', { start: localStartTs, end })
  } else {
    if (localTimerId) clearInterval(localTimerId)
    localTimerId = undefined
    emit('stop', { start: localStartTs, end: Date.now() })
  }
}

// —— 全局同步：每秒从全局状态读取 elapsedMs ——
let syncId: number | undefined
if (useGlobal()) {
  syncId = window.setInterval(() => {
    if (running.value && useGlobal()) {
      elapsedMs.value = activeTimer.elapsedMs.value
    }
  }, 1000)
}

onUnmounted(() => {
  if (localTimerId) clearInterval(localTimerId)
  if (syncId) clearInterval(syncId)
  // 全局计时器不在这里清除——悬浮球需要它继续运行
})
</script>

<template>
  <div class="timer-box">
    <template v-if="editing">
      <div class="timer-done">{{ recordedText }}</div>
    </template>
    <template v-else-if="running">
      <div class="timer-display">{{ formatDuration(elapsedMs) }}</div>
      <button type="button" class="btn btn-soft btn-lg" @click="stop">{{ stopLabel }}</button>
    </template>
    <template v-else-if="finished">
      <div class="timer-done">{{ finishedText }}</div>
      <button type="button" class="btn btn-outline btn-sm timer-restart" @click="start">{{ startLabel }}</button>
    </template>
    <template v-else>
      <button type="button" class="btn btn-primary btn-lg timer-start" @click="start">{{ startLabel }}</button>
      <p v-if="hint" class="timer-hint">{{ hint }}</p>
    </template>
  </div>
</template>

<style scoped>
.timer-box {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 12px;
  text-align: center;
}

.timer-start {
  width: 100%;
}

.timer-restart {
  margin-top: 8px;
}

.timer-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.timer-display {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}

.timer-done {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
}
</style>