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
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

@media (hover: hover) {
  .stat-card:hover {
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.stat-body {
  min-width: 0;
}

.stat-value {
  font-size: 21px;
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
  font-weight: 500;
}

.stat-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

@media (max-width: 400px) {
  .stat-card {
    padding: 13px;
    gap: 10px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .stat-value {
    font-size: 18px;
  }
}
</style>
