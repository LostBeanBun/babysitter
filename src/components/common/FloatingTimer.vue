<script setup lang="ts">
/**
 * 悬浮计时球：固定在屏幕右侧边缘，显示当前活跃计时器状态。
 * - 点击主体：emit('open') 由父组件重新打开对应表单
 * - 无关闭按钮：仅在用户保存/取消记录时消失
 * - 支持触摸拖拽，拖到屏幕左右边缘时收起（半隐藏圆球）
 * - 收起状态下仅露出半个图标，点击可展开
 */
import { ref, watch } from 'vue'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { formatDuration } from '@/utils/format'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ open: [] }>()

const activeTimer = useActiveTimer()

const ICON_MAP: Record<string, string> = { feeding: '🍼', sleep: '😴', pumping: '🎀' }
const KIND_LABEL_MAP: Record<string, string> = { feeding: '喂养', sleep: '睡眠', pumping: '吸奶' }

const icon = ref('🍼')
const label = ref('')
const posY = ref(Math.round(window.innerHeight * 0.4))
const posX = ref(0) // 0 = 默认右侧（right: 12px），> 0 = 向左偏移
const snapSide = ref<'none' | 'left' | 'right'>('none')

watch(
  () => activeTimer.kind.value,
  (k) => {
    if (k) {
      icon.value = ICON_MAP[k] ?? '⏱️'
      label.value = KIND_LABEL_MAP[k] ?? ''
    }
  },
  { immediate: true },
)

// —— 拖拽 + 边缘收起逻辑 ——
const EDGE_THRESHOLD = 40
const BALL_SIZE = 56
let dragStartX = 0
let dragStartY = 0
let startDragX = 0
let startDragY = 0
let dragging = false

function onTouchStart(e: TouchEvent) {
  dragging = false
  dragStartX = e.touches[0].clientX
  dragStartY = e.touches[0].clientY
  startDragX = posX.value
  startDragY = posY.value
}

function onTouchMove(e: TouchEvent) {
  const dx = e.touches[0].clientX - dragStartX
  const dy = e.touches[0].clientY - dragStartY
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragging = true
  if (dragging) {
    const maxLeft = window.innerWidth - BALL_SIZE - 12
    posX.value = Math.min(Math.max(startDragX - dx, 0), maxLeft)
    const half = BALL_SIZE / 2
    posY.value = Math.min(Math.max(startDragY + dy, half), window.innerHeight - half)
  }
}

function onTouchEnd() {
  checkSnap()
}

function checkSnap() {
  const nearLeft = posX.value >= window.innerWidth - BALL_SIZE - 12 - EDGE_THRESHOLD
  const nearRight = posX.value <= EDGE_THRESHOLD
  if (nearLeft) {
    snapSide.value = 'left'
    posX.value = window.innerWidth - BALL_SIZE / 2 - 12
  } else if (nearRight) {
    snapSide.value = 'right'
    posX.value = 0
  } else {
    snapSide.value = 'none'
  }
}

function onOpen() {
  if (dragging) return
  if (snapSide.value !== 'none') {
    const wasLeft = snapSide.value === 'left'
    snapSide.value = 'none'
    posX.value = wasLeft ? window.innerWidth - BALL_SIZE - 24 : 0
  } else {
    emit('open')
  }
}
</script>

<template>
  <Transition name="float">
    <div
      v-if="active"
      class="floating-timer"
      :class="{ collapsed: snapSide !== 'none', 'snap-left': snapSide === 'left' }"
      :style="{ top: posY + 'px', right: (12 - posX) + 'px' }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @click="onOpen"
    >
      <span class="ft-icon">{{ icon }}</span>
      <div v-if="snapSide === 'none'" class="ft-body">
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
  z-index: 9000;
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
  transition: right 0.25s ease, padding 0.2s ease, border-radius 0.2s ease, width 0.2s ease;
  touch-action: none;
}

.floating-timer:active {
  transform: scale(0.96);
}

/* —— 收起状态：圆形半隐藏 —— */
.floating-timer.collapsed {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  justify-content: center;
  gap: 0;
}

.floating-timer.collapsed.snap-left {
  /* 贴左时 translateX 让球体一半藏在屏幕外 */
  transform: translateX(-50%);
}

.floating-timer.collapsed:active {
  transform: scale(0.96);
}

.floating-timer.collapsed.snap-left:active {
  transform: translateX(-50%) scale(0.96);
}

.ft-icon {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1;
}

.floating-timer.collapsed .ft-icon {
  font-size: 20px;
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

.floating-timer.collapsed .ft-pulse {
  border-radius: 50%;
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
  transform: translateX(40px);
}
.float-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
