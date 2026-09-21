<script setup lang="ts">
defineProps<{
  label: string
  value: string
  icon?: string
  color?: string
  /** 支持多行说明：传数组则每项一行 */
  sub?: string | Array<string | undefined>
  /** 第一行 sub 用警示黄高亮 */
  highlightFirst?: boolean
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
      <template v-if="sub">
        <p v-if="Array.isArray(sub)" class="stat-sub">
          <span v-for="(s, i) in sub" :key="i" v-show="s" class="stat-sub-line" :class="{ 'hl-warn': highlightFirst && i === 0 }">{{ s }}</span>
        </p>
        <p v-else class="stat-sub">{{ sub }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
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
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.stat-body {
  min-width: 0;
}

.stat-value {
  font-size: 18px;
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

.stat-sub-line {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-sub-line.hl-warn {
  color: var(--accent-yellow);
  font-weight: 600;
}

@media (max-width: 400px) {
  .stat-card {
    padding: 8px;
    gap: 6px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .stat-value {
    font-size: 16px;
  }
}
</style>
