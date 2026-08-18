<script setup lang="ts">
defineProps<{
  label: string
  value: string
  icon?: string
  color?: string
  sub?: string
}>()
</script>

<template>
  <div class="stat-card card">
    <div
      v-if="icon"
      class="stat-icon"
      :style="{ background: (color ?? '#fdf0ea') + '33', color: color ?? 'var(--primary)' }"
    >
      {{ icon }}
    </div>
    <div class="stat-body">
      <p class="stat-value" :style="color ? { color } : undefined">{{ value }}</p>
      <p class="stat-label">{{ label }}</p>
      <p v-if="sub" class="stat-sub">{{ sub }}</p>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.stat-body {
  min-width: 0;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.stat-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

@media (max-width: 400px) {
  .stat-card {
    padding: 12px;
    gap: 10px;
  }

  .stat-icon {
    width: 38px;
    height: 38px;
    font-size: 19px;
  }

  .stat-value {
    font-size: 17px;
  }
}
</style>
