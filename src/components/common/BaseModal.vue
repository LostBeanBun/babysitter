<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  show: boolean
  title?: string
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-mask" @click.self="emit('close')">
        <div class="modal-panel">
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
  letter-spacing: 0.01em;
}

.modal-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.12s ease;
}

.modal-close:active {
  background: var(--surface-3);
  transform: scale(0.9);
}
</style>
