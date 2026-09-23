<script setup lang="ts">
import { toastState, dismissToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

function handleAction(id: number, onAction?: () => void) {
  onAction?.()
  dismissToast(id)
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="item in toastState.items" :key="item.id" class="toast">
          <span class="toast-message">{{ item.message }}</span>
          <button v-if="item.actionLabel" type="button" class="toast-action" @click="handleAction(item.id, item.onAction)">
            {{ item.actionLabel }}
          </button>
          <button
            v-if="item.duration === 0"
            type="button"
            class="toast-close"
            :aria-label="t('common.close')"
            @click="dismissToast(item.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: calc(var(--tabbar-height) + var(--tabbar-float-gap) + var(--safe-bottom) + 16px);
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 100;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: rgba(46, 38, 33, 0.82);
  color: #fff;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--shadow-glass), 0 8px 32px rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.toast-message {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.toast-action {
  flex-shrink: 0;
  min-height: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  transition: background 0.15s ease;
}

.toast-action:active {
  background: var(--primary-dark);
}

.toast-close {
  flex-shrink: 0;
  min-height: 0;
  width: 44px;
  height: 44px;
  margin: -10px -8px -10px 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:active {
  background: rgba(255, 255, 255, 0.15);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.3s var(--ease-out),
    transform 0.35s var(--spring);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
</style>