<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useMedicationStore } from '@/stores/medication'
import { useVaccinationStore } from '@/stores/vaccination'
import { useTemperatureStore } from '@/stores/temperature'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { buildCarePlan } from '@/services/carePlan'
import { buildHandoffSummary, formatHandoffText } from '@/services/handoff'
import { computeTodayStats } from '@/services/todayStats'
import { dailyGuide } from '@/utils/dailyGuides'
import {
  formatAmount,
  formatClock,
  formatDate,
  formatDuration,
  startOfDay,
} from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import HandoffModal from '@/components/dashboard/HandoffModal.vue'
import type { RecordKind } from '@/types'

const props = defineProps<{ now: number }>()
const emit = defineEmits<{
  add: [kind: RecordKind]
}>()

const { t } = useI18n()
const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const medicationStore = useMedicationStore()
const vaccinationStore = useVaccinationStore()
const temperatureStore = useTemperatureStore()
const activeTimer = useActiveTimer()
const { isPending } = useDeleteUndo()

function keep<T extends { id?: number }>(items: T[], kind: string): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

const feedings = computed(() => keep(feedingStore.feedings, 'feeding'))
const diapers = computed(() => keep(diaperStore.diapers, 'diaper'))
const pumpings = computed(() => keep(pumpingStore.pumpings, 'pumping'))
const sleeps = computed(() => keep(sleepStore.sleeps, 'sleep'))
const medications = computed(() => keep(medicationStore.medications, 'medication'))
const vaccinations = computed(() => keep(vaccinationStore.vaccinations, 'vaccination'))
const temperatures = computed(() => keep(temperatureStore.temperatures, 'temperature'))

const todayStart = computed(() => startOfDay(props.now))
const todayEnd = computed(() => todayStart.value + MS_PER_DAY - 1)

/** 今日汇总：奶量 / 喂养次数 / 吸奶 / 母乳库存 / 睡眠 / 尿布（按当日边界裁剪） */
const stats = computed(() =>
  computeTodayStats({
    feedings: feedings.value.filter(
      (f) => f.startTime >= todayStart.value && f.startTime <= todayEnd.value,
    ),
    diapers: diapers.value.filter(
      (d) => d.time >= todayStart.value && d.time <= todayEnd.value,
    ),
    pumpings: pumpings.value.filter(
      (p) => p.startTime >= todayStart.value && p.startTime <= todayEnd.value,
    ),
    sleeps: sleeps.value.filter(
      (s) => (s.endTime ?? s.startTime) >= todayStart.value && s.startTime <= todayEnd.value,
    ),
    todayStart: todayStart.value,
    todayEnd: todayEnd.value,
  }),
)

/** 按月龄的每日参考（无出生日期时为 null） */
const guide = computed(() => dailyGuide(babyStore.activeBaby ?? undefined))

const lastDiaper = computed(() =>
  [...diapers.value].sort((a, b) => b.time - a.time)[0],
)

const activeFeedingStart = computed(() => {
  const active = activeTimer.getByKind('feeding')
  if (!active) return undefined
  return feedings.value.find((f) => f.id === active.recordId)?.startTime ?? active.startTime
})
const activeSleepStart = computed(() => {
  const active = activeTimer.getByKind('sleep')
  if (!active) return undefined
  return sleeps.value.find((s) => s.id === active.recordId)?.startTime ?? active.startTime
})

const plan = computed(() =>
  buildCarePlan({
    baby: babyStore.activeBaby ?? undefined,
    now: props.now,
    feedings: feedings.value,
    sleeps: sleeps.value,
    medications: medications.value,
    vaccinations: vaccinations.value,
    activeFeedingStart: activeFeedingStart.value,
    activeSleepStart: activeSleepStart.value,
  }),
)

const handoffOpen = ref(false)
const handoffSummary = computed(() =>
  buildHandoffSummary({
    baby: babyStore.activeBaby ?? undefined,
    now: props.now,
    feedings: feedings.value,
    diapers: diapers.value,
    pumpings: pumpings.value,
    sleeps: sleeps.value,
    medications: medications.value,
    vaccinations: vaccinations.value,
    temperatures: temperatures.value,
    activeFeedingStart: activeFeedingStart.value,
    activeSleepStart: activeSleepStart.value,
  }),
)
const handoffText = computed(() =>
  formatHandoffText(
    handoffSummary.value,
    (key, params) => t(key, params ?? {}),
    babyStore.activeBaby?.name ?? t('common.baby'),
  ),
)

function timeLabel(ts: number): string {
  const today = startOfDay(props.now)
  if (ts >= today) return formatClock(ts)
  if (ts >= today - MS_PER_DAY) return t('care.yesterday', { time: formatClock(ts) })
  return `${formatDate(ts).slice(5)} ${formatClock(ts)}`
}

/** 距上次喂养结束（或开始）已过去多久 */
const feedValue = computed(() => {
  const f = plan.value.feeding
  if (f.activeSince != null) {
    return t('care.feedActive', {
      duration: formatDuration(Math.max(0, props.now - f.activeSince)),
    })
  }
  if (f.lastAt == null) return t('care.feedEmpty')
  return `${formatDuration(Math.max(0, props.now - f.lastAt))}${t('common.ago')}`
})

/** 今日喂养汇总 + 上次喂养时间 */
const feedHint = computed(() => {
  const parts = [
    t('care.todayMilk', {
      amount: formatAmount(stats.value.totalMilk),
      count: stats.value.feedCount,
    }),
  ]
  if (plan.value.feeding.lastAt != null) {
    parts.push(t('care.lastAt', { time: timeLabel(plan.value.feeding.lastAt) }))
  }
  return parts.join(' · ')
})

/** 吸奶次数 / 母乳库存 + 月龄奶量参考 */
const feedMeta = computed(() => {
  const parts = [
    t('care.feedMeta', {
      count: stats.value.pumpCount,
      stock: formatAmount(stats.value.breastStock),
    }),
  ]
  if (guide.value) parts.push(t('care.dailyGuide', { guide: guide.value.milk }))
  return parts.join(' · ')
})

const sleepValue = computed(() => {
  const s = plan.value.sleep
  if (s.activeSince != null) {
    return t('care.sleeping', {
      duration: formatDuration(Math.max(0, props.now - s.activeSince)),
    })
  }
  if (s.awakeMs == null) return t('care.sleepEmpty')
  return t('care.awake', { duration: formatDuration(s.awakeMs) })
})

/** 今日睡眠总时长 + 上次睡眠结束时间 */
const sleepHint = computed(() => {
  const parts = [t('care.todaySleep', { duration: formatDuration(stats.value.sleepMs) })]
  if (plan.value.sleep.lastEndAt != null) {
    parts.push(t('care.lastAt', { time: timeLabel(plan.value.sleep.lastEndAt) }))
  }
  return parts.join(' · ')
})

/** 清醒窗口参考 + 月龄睡眠参考 */
const sleepMeta = computed(() => {
  const s = plan.value.sleep
  const parts: string[] = []
  if (s.activeSince != null) {
    parts.push(t('care.sleepingHint'))
  } else if (s.awakeMs != null) {
    parts.push(
      t('care.awakeHint', {
        range: `${formatDuration(s.wakeMinMs)}–${formatDuration(s.wakeMaxMs)}`,
      }),
    )
  }
  if (guide.value) parts.push(t('care.dailyGuide', { guide: guide.value.sleep }))
  return parts.join(' · ')
})

/** 距上次换尿布已过去多久 */
const diaperValue = computed(() => {
  const d = lastDiaper.value
  if (!d) return t('care.diaperEmpty')
  return `${formatDuration(Math.max(0, props.now - d.time))}${t('common.ago')}`
})

/** 今日换尿布次数 + 上次时间 */
const diaperHint = computed(() => {
  const parts = [t('care.todayDiaper', { count: stats.value.diaperCount })]
  if (lastDiaper.value) {
    parts.push(t('care.lastAt', { time: timeLabel(lastDiaper.value.time) }))
  }
  return parts.join(' · ')
})

const diaperMeta = computed(() =>
  guide.value ? t('care.dailyGuide', { guide: guide.value.diaper }) : '',
)

/** 照护卡只展示喂养 / 睡眠 / 尿布，三者都为空时给出空态提示 */
const hasCareRecords = computed(
  () => feedings.value.length + sleeps.value.length + diapers.value.length > 0,
)
</script>

<template>
  <section class="care-card" aria-labelledby="care-title">
    <div class="care-head">
      <div class="care-heading">
        <h3 id="care-title" class="care-title">{{ t('care.title') }}</h3>
        <p class="care-sub">{{ t('care.subtitle') }}</p>
      </div>
      <button type="button" class="care-handoff" @click="handoffOpen = true">
        <span aria-hidden="true">📋</span>
        {{ t('care.handoff') }}
      </button>
    </div>

    <div class="care-list">
      <button type="button" class="care-row" @click="emit('add', 'feeding')">
        <span class="care-icon care-icon--feed" aria-hidden="true">🍼</span>
        <span class="care-body">
          <span class="care-label">{{ t('care.feeding') }}</span>
          <span class="care-value">{{ feedValue }}</span>
          <span class="care-hint">{{ feedHint }}</span>
          <span class="care-meta">{{ feedMeta }}</span>
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="care-row" @click="emit('add', 'sleep')">
        <span class="care-icon care-icon--sleep" aria-hidden="true">😴</span>
        <span class="care-body">
          <span class="care-label">{{ t('care.sleep') }}</span>
          <span class="care-value">{{ sleepValue }}</span>
          <span class="care-hint">{{ sleepHint }}</span>
          <span v-if="sleepMeta" class="care-meta">{{ sleepMeta }}</span>
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="care-row" @click="emit('add', 'diaper')">
        <span class="care-icon care-icon--diaper" aria-hidden="true">🧷</span>
        <span class="care-body">
          <span class="care-label">{{ t('care.diaper') }}</span>
          <span class="care-value">{{ diaperValue }}</span>
          <span class="care-hint">{{ diaperHint }}</span>
          <span v-if="diaperMeta" class="care-meta">{{ diaperMeta }}</span>
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>
    </div>

    <p v-if="!hasCareRecords" class="care-empty">{{ t('care.empty') }}</p>

    <HandoffModal :show="handoffOpen" :text="handoffText" @close="handoffOpen = false" />
  </section>
</template>

<style scoped>
.care-card {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-glass);
}

.care-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.care-heading {
  min-width: 0;
}

.care-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.care-sub {
  margin: 3px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}

.care-handoff {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.care-handoff:active {
  transform: scale(var(--tap-scale));
}

.care-list {
  display: flex;
  flex-direction: column;
}

.care-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 62px;
  padding: 9px 0;
  border: 0;
  border-top: 1px solid var(--glass-border);
  background: transparent;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background var(--dur-base) ease;
}

.care-row:first-child {
  border-top: 0;
}

.care-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: var(--fs-18);
}

.care-icon--feed {
  background: rgba(242, 162, 140, 0.16);
}

.care-icon--sleep {
  background: rgba(143, 185, 216, 0.18);
}

.care-icon--diaper {
  background: rgba(154, 143, 200, 0.18);
}

.care-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.care-label {
  font-size: var(--fs-xs);
  color: var(--text-muted);
}

.care-value {
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.care-hint {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--fs-xs);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.care-meta {
  color: var(--text-muted);
  font-size: var(--fs-xs);
  line-height: 1.35;
}

.care-chevron {
  color: var(--text-muted);
  font-size: var(--fs-lg);
  line-height: 1;
}

.care-empty {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--glass-border);
  color: var(--text-muted);
  font-size: var(--fs-xs);
  line-height: 1.5;
}

@media (hover: hover) {
  .care-handoff:hover {
    background: var(--primary-glow);
  }

  .care-row:hover {
    background: var(--surface-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .care-handoff,
  .care-row {
    transition: none;
  }

  .care-handoff:active {
    transform: none;
  }
}
</style>
