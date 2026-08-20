<script setup lang="ts">
/**
 * 记录计时器公共组件：自包含开始/停止/计时显示逻辑，结果通过事件回传父表单。
 * - 未开始：显示开始按钮（+可选提示）
 * - 计时中：显示已计时长 + 停止按钮
 * - 编辑态（editing）：显示既有记录时长（recordedText）
 * - 已结束（finished）：显示区间回显（finishedText），可重新开始
 */
import { ref, onUnmounted } from 'vue'
import { formatDuration } from '@/utils/format'

defineProps<{
  editing?: boolean
  recordedText?: string
  finished?: boolean
  finishedText?: string
  startLabel: string
  stopLabel: string
  hint?: string
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop', payload: { start: number; end: number }): void
}>()

const running = ref(false)
const elapsedMs = ref(0)
let timerId: number | undefined
let startTs = 0

function start() {
  running.value = true
  startTs = Date.now()
  elapsedMs.value = 0
  timerId = window.setInterval(() => {
    elapsedMs.value = Date.now() - startTs
  }, 1000)
  emit('start')
}

function stop() {
  running.value = false
  if (timerId) clearInterval(timerId)
  timerId = undefined
  emit('stop', { start: startTs, end: Date.now() })
}

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
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