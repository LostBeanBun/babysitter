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
let moveRaf: number | null = null
let pendingX = 0
let pendingY = 0

function dragStart(id: string, clientX: number, clientY: number) {
  draggingId.value = id
  const s = getBallState(id)
  s.moved = false
  s.dragStartX = clientX
  s.dragStartY = clientY
  s.startDragX = s.posX
  s.startDragY = s.posY
}

function applyDragMove(clientX: number, clientY: number) {
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

/** 拖拽移动按帧合并：一次 rAF 至多一次响应式更新，避免 touchmove/mousemove 高频触发重渲染 */
function dragMove(clientX: number, clientY: number) {
  if (!draggingId.value) return
  pendingX = clientX
  pendingY = clientY
  if (moveRaf != null) return
  moveRaf = requestAnimationFrame(() => {
    moveRaf = null
    applyDragMove(pendingX, pendingY)
  })
}

function flushDragMove() {
  if (moveRaf == null) return
  cancelAnimationFrame(moveRaf)
  moveRaf = null
  applyDragMove(pendingX, pendingY)
}

function dragEnd() {
  const id = draggingId.value
  if (id) {
    flushDragMove()
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
  if (moveRaf != null) cancelAnimationFrame(moveRaf)
})

function onOpen(id: string) {
  if (!getBallState(id).moved) emit('open', id)
}
</script>

<template>
  <template v-for="rec in activeTimer.records.value" :key="rec.id">
    <!-- appear：每条计划各自挂载一个 Transition，属于「首次渲染」，不加 appear 则入场动画会被 Vue 跳过 -->
    <Transition name="float" appear>
      <div
        v-if="active && !sleepModalOpen"
        class="floating-ball"
        :class="{ dragging: draggingId === rec.id }"
        :style="{
          top: getBallState(rec.id).posY + 'px',
          left: getBallState(rec.id).posX + 'px',
          '--ball-color': CONFIG[rec.kind]?.color ?? '#e8906c',
          '--ball-bg': CONFIG[rec.kind]?.bg ?? 'rgba(232,144,108,0.12)',
        }"
        @touchstart.passive="onTouchStart(rec.id, $event)"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
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
  z-index: var(--z-float);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--space-2) var(--space-3);
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
  transition: transform var(--dur-slow) var(--spring), box-shadow var(--dur-slow) var(--ease-out);
}

.floating-ball:active {
  transform: scale(var(--tap-scale));
}

/* 拖拽中关闭毛玻璃：移动的 backdrop-filter 每帧都要重算模糊，代价高且视觉上被位移掩盖 */
.floating-ball.dragging {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.fb-icon {
  font-size: var(--fs-xl);
  flex-shrink: 0;
  line-height: 1;
}

.fb-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fb-label {
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1;
}

.fb-time {
  font-size: var(--fs-16);
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

/* 纯透明度版本：无位移无缩放，供「减少动态效果」环境使用 */
@keyframes pulse-ring-soft {
  0% { opacity: 0.45; }
  100% { opacity: 0; }
}

.float-enter-active { transition: opacity var(--dur-enter) var(--spring), transform var(--dur-enter) var(--spring); }
.float-leave-active { transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.float-enter-from { opacity: 0; transform: scale(0.7); }
.float-leave-to { opacity: 0; transform: scale(0.7); }

/* 系统开了「减少动态效果」（如 Windows 关闭动画效果）时，main.css 的全局
   兜底会把动画压成 0.01ms，波纹会直接不可见、球出现也是瞬移。这里为悬浮球
   保留纯透明度的淡入淡出与呼吸波纹：不含位移/缩放，契合减少动态偏好，
   同时继续提示「计时进行中」。 */
@media (prefers-reduced-motion: reduce) {
  .fb-pulse {
    animation: pulse-ring-soft 2.4s ease-out infinite !important;
  }
  .float-enter-active {
    transition: opacity var(--dur-slow) linear !important;
  }
  .float-leave-active {
    transition: opacity var(--dur-base) linear !important;
  }
  .float-enter-from,
  .float-leave-to {
    transform: none !important;
  }
}

@media (max-width: 375px) {
  .floating-ball { padding: 6px 10px; gap: 6px; }
  .fb-icon { font-size: var(--fs-18); }
  .fb-time { font-size: var(--fs-14); }
  .fb-label { font-size: var(--fs-2xs); }
}
</style>
