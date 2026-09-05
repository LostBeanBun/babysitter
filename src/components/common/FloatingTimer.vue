<script setup lang="ts">
/**
 * 悬浮计时球：可自由拖拽，显示当前活跃计时器状态。
 * - 点击主体：emit('open') 由父组件重新打开对应表单
 * - 无关闭按钮：仅在用户保存/取消记录时消失
 * - 支持触摸+鼠标拖拽水平+垂直移动
 * - 垂直范围限制在 header 与 tabbar 之间
 */
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useSleepModal } from '@/composables/useSleepModal'
import { formatDuration } from '@/utils/format'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const activeTimer = useActiveTimer()
const { sleepModalOpen } = useSleepModal()

const ICON_MAP: Record<string, string> = { feeding: '🍼', sleep: '😴', pumping: '🎀' }
const KIND_LABEL_KEYS: Record<string, string> = { feeding: 'floatingTimer.kindFeeding', sleep: 'floatingTimer.kindSleep', pumping: 'floatingTimer.kindPumping' }

const icon = ref('🍼')
const label = ref('')

// 位置持久化到 localStorage
const POS_KEY = 'floating_timer_pos'
const savedPos = (() => {
  try {
    const raw = localStorage.getItem(POS_KEY)
    return raw ? JSON.parse(raw) as { x: number; y: number } : null
  } catch {
    return null
  }
})()

// 安全区域边界：header ~60px，tabbar ~70px
const HEADER_BOTTOM = 70
const TABBAR_TOP_MARGIN = 80
const BALL_W = 130 // 近似宽度

const posX = ref(savedPos?.x ?? window.innerWidth - BALL_W - 12)
const posY = ref(savedPos?.y ?? Math.round(window.innerHeight * 0.4))

function clampPos() {
  const maxY = window.innerHeight - TABBAR_TOP_MARGIN
  posY.value = Math.min(Math.max(posY.value, HEADER_BOTTOM), maxY)
  posX.value = Math.min(Math.max(posX.value, 12), window.innerWidth - BALL_W - 12)
}

watch(
  () => activeTimer.kind.value,
  (k) => {
    if (k) {
      icon.value = ICON_MAP[k] ?? '⏱️'
      label.value = t(KIND_LABEL_KEYS[k] ?? '')
    }
  },
  { immediate: true },
)

// —— 拖拽逻辑（触摸+鼠标） ——
let dragStartX = 0
let dragStartY = 0
let startDragX = 0
let startDragY = 0
let dragging = false

function onStart(clientX: number, clientY: number) {
  dragging = false
  dragStartX = clientX
  dragStartY = clientY
  startDragX = posX.value
  startDragY = posY.value
}

function onMove(clientX: number, clientY: number) {
  const dx = clientX - dragStartX
  const dy = clientY - dragStartY
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragging = true
  if (dragging) {
    posX.value = startDragX + dx
    posY.value = startDragY + dy
    clampPos()
  }
}

function onEnd() {
  clampPos()
  localStorage.setItem(POS_KEY, JSON.stringify({ x: posX.value, y: posY.value }))
}

// 触摸事件
function onTouchStart(e: TouchEvent) {
  onStart(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchMove(e: TouchEvent) {
  onMove(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchEnd() {
  onEnd()
}

// 鼠标事件
function onMouseDown(e: MouseEvent) {
  onStart(e.clientX, e.clientY)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) {
  onMove(e.clientX, e.clientY)
}
function onMouseUp() {
  onEnd()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

function onOpen() {
  if (!dragging) emit('open')
}
</script>

<template>
  <Transition name="float">
    <div
      v-if="active && !sleepModalOpen"
      class="floating-timer"
      :style="{ top: posY + 'px', left: posX + 'px' }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @mousedown="onMouseDown"
      @click="onOpen"
    >
      <span class="ft-icon">{{ icon }}</span>
      <div class="ft-body">
        <span class="ft-label">{{ label }}</span>
        <span class="ft-time">{{ formatDuration(activeTimer.elapsedMs.value) }}</span>
      </div>
      <div class="ft-pulse" />
    </div>
  </Transition>
</template>

<style scoped>
.floating-timer {
  position: fixed;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 28px;
  background: var(--surface);
  border: 1.5px solid var(--primary);
  box-shadow: var(--shadow-md), 0 0 12px rgba(232, 144, 108, 0.25);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.floating-timer:active {
  transform: scale(0.96);
}

.ft-icon {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1;
}

.ft-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ft-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1;
}

.ft-time {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

/* 脉冲动画 */
.ft-pulse {
  position: absolute;
  inset: -3px;
  border-radius: 31px;
  border: 2px solid var(--primary);
  opacity: 0;
  animation: pulse-ring 2s ease-out infinite;
  pointer-events: none;
}

@keyframes pulse-ring {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.15);
  }
}

/* 进出动画 */
.float-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.float-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.float-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.float-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
