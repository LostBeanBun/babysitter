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
  margin-bottom: 16px;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}

.modal-close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
