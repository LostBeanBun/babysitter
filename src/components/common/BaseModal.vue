<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
  title?: string
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)

// —— body 滚动锁（计数器：确认框叠在表单上时只在全部关闭后恢复） ——
let scrollLockCount = 0
let prevBodyOverflow = ''
let locked = false

function lockBodyScroll() {
  if (locked) return
  if (scrollLockCount++ === 0) {
    prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locked = true
}

function unlockBodyScroll() {
  if (!locked) return
  locked = false
  if (--scrollLockCount === 0) document.body.style.overflow = prevBodyOverflow
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Escape 关闭 + Tab 焦点陷阱（焦点限制在弹窗面板内循环） */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const panel = panelRef.value
  if (!panel) return
  const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (focusables.length === 0) {
    e.preventDefault()
    panel.focus()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (e.shiftKey) {
    if (active === first || active === panel || !panel.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else if (active === last || !panel.contains(active)) {
    e.preventDefault()
    first.focus()
  }
}

// 打开时记录触发元素，关闭后归还焦点
let restoreFocusTo: HTMLElement | null = null

watch(
  () => props.show,
  (v) => {
    if (v) {
      restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
      lockBodyScroll()
      document.addEventListener('keydown', onKeydown)
      requestAnimationFrame(() => panelRef.value?.focus())
    } else {
      unlockBodyScroll()
      document.removeEventListener('keydown', onKeydown)
      restoreFocusTo?.focus()
      restoreFocusTo = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-mask" @click.self="emit('close')">
        <div ref="panelRef" class="modal-panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
          <div v-if="title" class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" :aria-label="t('common.close')" @click="emit('close')">✕</button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-panel:focus-visible {
  outline: none;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.modal-title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.modal-close {
  width: 44px;
  height: 44px;
  min-height: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface-2);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  font-size: var(--fs-base);
  border: 1px solid var(--glass-border);
  transition:
    background var(--dur-base) ease,
    color var(--dur-base) ease,
    transform var(--dur-enter) var(--spring);
}

.modal-close:active {
  background: var(--surface-3);
  transform: scale(var(--tap-scale));
}
</style>
