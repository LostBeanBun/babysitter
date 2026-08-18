<script setup lang="ts">
defineProps<{
  icon?: string
  text: string
  hint?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-icon">{{ icon }}</div>
    <p class="empty-text">{{ text }}</p>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-text {
  font-size: 15px;
  color: var(--text-secondary);
  font-weight: 500;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.empty-state :deep(.btn) {
  margin-top: 14px;
}
</style>