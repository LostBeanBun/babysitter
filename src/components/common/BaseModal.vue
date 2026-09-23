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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.show,
  (v) => {
    if (v) {
      document.addEventListener('keydown', onKeydown)
      requestAnimationFrame(() => panelRef.value?.focus())
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
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
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.modal-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface-2);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  color: var(--text-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border);
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.3s var(--spring);
}

.modal-close:active {
  background: var(--surface-3);
  transform: scale(0.88);
}
</style>
