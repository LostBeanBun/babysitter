<script setup lang="ts">
/** 提醒条内容芯片（如一条待种疫苗：名称 · 剂次 + 距接种日徽标） */
export interface ReminderChip {
  key: number | string
  label: string
  badge?: string
}

withDefaults(
  defineProps<{
    icon: string
    title: string
    /** 副文案（单行说明，如推荐喂奶间隔） */
    sub?: string
    /** 内容芯片列表（如待种疫苗项），点击芯片触发 select */
    chips?: ReminderChip[]
    /** 「全部 N 条」入口文案（疫苗计划数多于提醒条可容纳时展示），点击触发 all */
    allLabel?: string
    variant?: 'feed' | 'vaccine'
    dismissLabel: string
  }>(),
  { variant: 'feed', sub: undefined, chips: undefined, allLabel: undefined },
)

const emit = defineEmits<{
  dismiss: []
  click: []
  select: [key: number | string]
  all: []
}>()
</script>

<template>
  <div
    class="reminder-banner"
    :class="`reminder-banner--${variant}`"
    @click="variant === 'vaccine' && emit('click')"
  >
    <span class="rb-icon">{{ icon }}</span>
    <div class="rb-text">
      <p class="rb-title">{{ title }}</p>
      <p v-if="sub" class="rb-sub">{{ sub }}</p>
      <p v-if="chips?.length || allLabel" class="rb-sub">
        <button
          v-for="c in chips"
          :key="c.key"
          type="button"
          class="rb-chip"
          @click.stop="emit('select', c.key)"
        >
          {{ c.label }}
          <span v-if="c.badge" class="rb-badge">{{ c.badge }}</span>
        </button>
        <button v-if="allLabel" type="button" class="rb-chip rb-chip-all" @click.stop="emit('all')">
          {{ allLabel }} ›
        </button>
      </p>
    </div>
    <button
      type="button"
      class="rb-close"
      :aria-label="dismissLabel"
      :title="dismissLabel"
      @click.stop="emit('dismiss')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.reminder-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 9px 12px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-glass);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
}

.reminder-banner--feed {
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-yellow-soft));
}

.reminder-banner--vaccine {
  background: linear-gradient(135deg, var(--accent-blue-soft), var(--surface));
  cursor: pointer;
  transition:
    transform 0.3s var(--spring),
    box-shadow 0.3s var(--ease-out);
}

.reminder-banner--vaccine:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
}

.rb-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.rb-text {
  flex: 1;
  min-width: 0;
}

.rb-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.rb-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 1px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  align-items: baseline;
}

/* 内容芯片：显式 min-height:0 避开全局 button 44px 触控高度，保持单行紧凑 */
.rb-chip {
  min-height: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.rb-chip:hover {
  color: var(--accent-blue);
}

.rb-chip:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.rb-badge {
  color: var(--accent-blue);
  font-weight: 700;
  margin-left: 3px;
}

/* 「全部 N 条」入口：与芯片同款，但加粗并高亮，区别于具体疫苗项 */
.rb-chip-all {
  font-weight: 600;
  color: var(--accent-blue);
  white-space: nowrap;
}

.rb-close {
  width: 44px;
  height: 44px;
  min-height: 0;
  margin-left: auto;
  margin-right: -10px;
  flex-shrink: 0;
  border-radius: 50%;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.rb-close:hover {
  color: var(--text);
  background: var(--surface-2);
}

.rb-close:active {
  transform: scale(0.9);
}
</style>
