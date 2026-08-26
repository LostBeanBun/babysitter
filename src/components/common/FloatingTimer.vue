<script setup lang="ts">
/**
 * 悬浮计时球：固定在屏幕右侧边缘，显示当前活跃计时器状态。
 * - 点击主体：emit('open') 由父组件重新打开对应表单
 * - 点击 ✕：停止计时器
 * - 支持触摸拖拽垂直移动
 */
import { ref, watch, onUnmounted } from 'vue'
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

// —— 拖拽逻辑 ——
let dragStartY = 0
let startDragY = 0
let dragging = false

function onTouchStart(e: TouchEvent) {
  dragging = false
  dragStartY = e.touches[0].clientY
  startDragY = posY.value
}

function onTouchMove(e: TouchEvent) {
  const dy = e.touches[0].clientY - dragStartY
  if (Math.abs(dy) > 5) dragging = true
  if (dragging) {
    const half = 28
    posY.value = Math.min(Math.max(startDragY + dy, half), window.innerHeight - half)
  }
}

function onTouchEnd() {
  // 无操作，保持当前位置
}

function onStop(e: Event) {
  e.stopPropagation()
  activeTimer.stop()
}

function onOpen() {
  if (!dragging) emit('open')
}

onUnmounted(() => {
  // 不清除全局计时器——计时器应在组件卸载后继续运行
})
</script>

<template>
  <Transition name="float">
    <div
      v-if="active"
      class="floating-timer"
      :style="{ top: posY + 'px' }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @click="onOpen"
    >
      <span class="ft-icon">{{ icon }}</span>
      <div class="ft-body">
        <span class="ft-label">{{ label }}</span>
        <span class="ft-time">{{ formatDuration(activeTimer.elapsedMs.value) }}</span>
      </div>
      <button type="button" class="ft-close" aria-label="停止计时" @click="onStop">✕</button>
      <div class="ft-pulse" />
    </div>
  </Transition>
</template>

<style scoped>
.floating-timer {
  position: fixed;
  right: 12px;
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
  transition: transform 0.15s ease, box-shadow 0.15s ease;
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

.ft-close {
  width: 20px;
  height: 20px;
  min-height: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 2px;
  transition: background 0.15s ease, color 0.15s ease;
}

.ft-close:hover {
  background: var(--border);
  color: var(--text);
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
  transform: translateX(40px);
}
.float-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
