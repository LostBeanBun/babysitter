<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { useSleepStore } from '@/stores/sleep'
import { useTemperatureStore } from '@/stores/temperature'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { buildAnomalyHints, type AnomalyHint } from '@/services/anomalies'
import { formatDuration } from '@/utils/format'

/** 值得留意：近 3 天与前 7 天的记录对比 + 近 24 小时体温（描述性提示，无数据时整卡隐藏） */
const props = defineProps<{ now: number }>()

const { t } = useI18n()
const router = useRouter()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const sleepStore = useSleepStore()
const temperatureStore = useTemperatureStore()
const { isPending } = useDeleteUndo()

function keep<T extends { id?: number }>(items: T[], kind: string): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

const hints = computed(() =>
  buildAnomalyHints({
    now: props.now,
    feedings: keep(feedingStore.feedings, 'feeding'),
    diapers: keep(diaperStore.diapers, 'diaper'),
    sleeps: keep(sleepStore.sleeps, 'sleep'),
    temperatures: keep(temperatureStore.temperatures, 'temperature'),
  }),
)

const ICONS: Record<AnomalyHint['key'], string> = {
  temperature: '🌡️',
  feedDrop: '🍼',
  diaperDrop: '🧷',
  sleepDown: '😴',
  sleepUp: '😴',
}

function percent(h: AnomalyHint): number {
  return Math.round(Math.abs(h.change) * 100)
}

function textOf(h: AnomalyHint): string {
  switch (h.key) {
    case 'feedDrop':
      return t('anomaly.feedDrop', { recent: h.recent.toFixed(1), percent: percent(h) })
    case 'diaperDrop':
      return t('anomaly.diaperDrop', { recent: h.recent.toFixed(1), percent: percent(h) })
    case 'sleepDown':
      return t('anomaly.sleepDown', { recent: formatDuration(h.recent), percent: percent(h) })
    case 'sleepUp':
      return t('anomaly.sleepUp', { recent: formatDuration(h.recent), percent: percent(h) })
    default:
      return t('anomaly.temperature', { value: h.recent.toFixed(1) })
  }
}
</script>

<template>
  <section v-if="hints.length" class="anomaly-card" aria-labelledby="anomaly-title">
    <div class="anomaly-head">
      <div class="anomaly-heading">
        <h3 id="anomaly-title" class="anomaly-title">{{ t('anomaly.title') }}</h3>
        <p class="anomaly-sub">{{ t('anomaly.subtitle') }}</p>
      </div>
      <button type="button" class="anomaly-link" @click="router.push('/stats')">
        {{ t('anomaly.viewStats') }}
      </button>
    </div>

    <ul class="anomaly-list">
      <li v-for="h in hints" :key="h.key" class="anomaly-row" :class="`anomaly-row--${h.tone}`">
        <span class="anomaly-icon" aria-hidden="true">{{ ICONS[h.key] }}</span>
        <span class="anomaly-text">{{ textOf(h) }}</span>
      </li>
    </ul>

    <p class="anomaly-note">{{ t('anomaly.note') }}</p>
  </section>
</template>

<style scoped>
.anomaly-card {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-glass);
}

.anomaly-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.anomaly-heading {
  min-width: 0;
}

.anomaly-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.anomaly-sub {
  margin: 3px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-muted);
  line-height: 1.4;
}

.anomaly-link {
  flex-shrink: 0;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  font: inherit;
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--dur-base) ease,
    transform var(--dur-enter) var(--spring);
}

.anomaly-link:active {
  transform: scale(var(--tap-scale));
}

.anomaly-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.anomaly-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.anomaly-row--watch {
  background: var(--danger-soft, rgba(214, 92, 92, 0.12));
}

.anomaly-icon {
  flex-shrink: 0;
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.anomaly-text {
  min-width: 0;
  color: var(--text-secondary);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.anomaly-row--watch .anomaly-text {
  color: var(--text);
}

.anomaly-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: var(--fs-xs);
  line-height: 1.5;
}

@media (hover: hover) {
  .anomaly-link:hover {
    background: var(--primary-glow);
  }
}

@media (prefers-reduced-motion: reduce) {
  .anomaly-link {
    transition: none;
  }

  .anomaly-link:active {
    transform: none;
  }
}
</style>
