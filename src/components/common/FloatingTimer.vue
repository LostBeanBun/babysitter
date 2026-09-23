<script setup lang="ts">
/**
 * 悬浮记录球（多球模式）：每个活跃记录显示一个独立球。
 * - 点击：emit('open', timerId) 打开对应表单
 * - 纵向堆叠，独立拖拽
 * - 最多显示 3 个球
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useSleepModal } from '@/composables/useSleepModal'
import { formatTime } from '@/utils/format'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ open: [timerId: string] }>()

const { t } = useI18n()
const activeTimer = useActiveTimer()
const { sleepModalOpen } = useSleepModal()

const CONFIG: Record<string, { icon: string; labelKey: string; color: string; bg: string }> = {
  feeding: { icon: '🍼', labelKey: 'floatingTimer.kindFeeding', color: '#e8906c', bg: 'rgba(232, 144, 108, 0.12)' },
  sleep:   { icon: '😴', labelKey: 'floatingTimer.kindSleep',   color: '#7c6de8', bg: 'rgba(124, 109, 232, 0.12)' },
  pumping: { icon: '🎀', labelKey: 'floatingTimer.kindPumping', color: '#e86c9f', bg: 'rgba(232, 108, 159, 0.12)' },
}

const POS_KEY = 'floating_balls_pos'
const HEADER_BOTTOM = 70
const TABBAR_TOP_MARGIN = 96
const BALL_GAP = 8

function getBallWidth(): number {
  return window.innerWidth <= 375 ? 105 : 130
}

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(POS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePositions(map: Record<string, { x: number; y: number }>) {
  localStorage.setItem(POS_KEY, JSON.stringify(map))
}

// —— 每个球的拖拽状态 ——
interface BallState {
  posX: number
  posY: number
  dragStartX: number
  dragStartY: number
  startDragX: number
  startDragY: number
  moved: boolean
}

const ballStates = ref<Map<string, BallState>>(new Map())
const draggingId = ref<string | null>(null)

function getBallState(id: string): BallState {
  if (!ballStates.value.has(id)) {
    const saved = loadPositions()[id]
    const bw = getBallWidth()
    const idx = activeTimer.records.value.findIndex((r) => r.id === id)
    ballStates.value.set(id, {
      posX: saved?.x ?? window.innerWidth - bw - 12,
      posY: saved?.y ?? HEADER_BOTTOM + idx * (56 + BALL_GAP),
      dragStartX: 0,
      dragStartY: 0,
      startDragX: 0,
      startDragY: 0,
      moved: false,
    })
  }
  return ballStates.value.get(id)!
}

function clampPos(s: BallState) {
  const maxY = window.innerHeight - TABBAR_TOP_MARGIN
  const bw = getBallWidth()
  s.posY = Math.min(Math.max(s.posY, HEADER_BOTTOM), maxY)
  s.posX = Math.min(Math.max(s.posX, 12), window.innerWidth - bw - 12)
}

function saveBallPos(id: string, s: BallState) {
  clampPos(s)
  const map = loadPositions()
  map[id] = { x: s.posX, y: s.posY }
  savePositions(map)
}

// 清理不存在的 ball state
watch(
  () => activeTimer.records.value.length,
  () => {
    const ids = new Set(activeTimer.records.value.map((r) => r.id))
    for (const key of ballStates.value.keys()) {
      if (!ids.has(key)) ballStates.value.delete(key)
    }
  },
)

onMounted(() => {
  for (const r of activeTimer.records.value) {
    const s = getBallState(r.id)
    clampPos(s)
  }
})

// —— 统一拖拽逻辑 ——
function dragStart(id: string, clientX: number, clientY: number) {
  draggingId.value = id
  const s = getBallState(id)
  s.moved = false
  s.dragStartX = clientX
  s.dragStartY = clientY
  s.startDragX = s.posX
  s.startDragY = s.posY
}

function dragMove(clientX: number, clientY: number) {
  const id = draggingId.value
  if (!id) return
  const s = getBallState(id)
  const dx = clientX - s.dragStartX
  const dy = clientY - s.dragStartY
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) s.moved = true
  if (s.moved) {
    s.posX = s.startDragX + dx
    s.posY = s.startDragY + dy
    clampPos(s)
  }
}

function dragEnd() {
  const id = draggingId.value
  if (id) {
    saveBallPos(id, getBallState(id))
    draggingId.value = null
  }
}

// 鼠标事件
function onMouseDown(id: string, e: MouseEvent) {
  dragStart(id, e.clientX, e.clientY)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) { dragMove(e.clientX, e.clientY) }
function onMouseUp() {
  dragEnd()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// 触摸事件
function onTouchStart(id: string, e: TouchEvent) {
  dragStart(id, e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchMove(e: TouchEvent) { dragMove(e.touches[0].clientX, e.touches[0].clientY) }
function onTouchEnd() { dragEnd() }

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

function onOpen(id: string) {
  if (!getBallState(id).moved) emit('open', id)
}
</script>

<template>
  <template v-for="rec in activeTimer.records.value" :key="rec.id">
    <Transition name="float">
      <div
        v-if="active && !sleepModalOpen"
        class="floating-ball"
        :style="{
          top: getBallState(rec.id).posY + 'px',
          left: getBallState(rec.id).posX + 'px',
          '--ball-color': CONFIG[rec.kind]?.color ?? '#e8906c',
          '--ball-bg': CONFIG[rec.kind]?.bg ?? 'rgba(232,144,108,0.12)',
        }"
        @touchstart.passive="onTouchStart(rec.id, $event)"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
        @mousedown="onMouseDown(rec.id, $event)"
        @click="onOpen(rec.id)"
      >
        <span class="fb-icon">{{ CONFIG[rec.kind]?.icon ?? '⏱️' }}</span>
        <div class="fb-body">
          <span class="fb-label">{{ CONFIG[rec.kind] ? t(CONFIG[rec.kind].labelKey) : rec.kind }}</span>
          <span class="fb-time">{{ formatTime(rec.startTime) }}</span>
        </div>
        <div class="fb-pulse" />
      </div>
    </Transition>
  </template>
</template>

<style scoped>
.floating-ball {
  position: fixed;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-xl);
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass), 0 0 16px var(--ball-bg);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: transform 0.3s var(--spring), box-shadow 0.3s var(--ease-out);
}

.floating-ball:active {
  transform: scale(0.94);
}

.fb-icon {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1;
}

.fb-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fb-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1;
}

.fb-time {
  font-size: 16px;
  font-weight: 700;
  color: var(--ball-color);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.fb-pulse {
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--radius-xl) + 3px);
  border: 2px solid var(--ball-color);
  opacity: 0;
  animation: pulse-ring 2s ease-out infinite;
  pointer-events: none;
}

@keyframes pulse-ring {
  0% { opacity: 0.5; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.15); }
}

.float-enter-active { transition: opacity 0.35s var(--spring), transform 0.35s var(--spring); }
.float-leave-active { transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out); }
.float-enter-from { opacity: 0; transform: scale(0.7); }
.float-leave-to { opacity: 0; transform: scale(0.7); }

@media (max-width: 375px) {
  .floating-ball { padding: 6px 10px; gap: 6px; }
  .fb-icon { font-size: 18px; }
  .fb-time { font-size: 14px; }
  .fb-label { font-size: 9px; }
}
</style>
