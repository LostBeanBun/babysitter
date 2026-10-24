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
import { vaccineDaysLeft } from '@/services/reminders'
import { formatClock, formatDate, formatDuration, startOfDay } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import HandoffModal from '@/components/dashboard/HandoffModal.vue'
import type { RecordKind, Vaccination } from '@/types'

const props = defineProps<{ now: number }>()
const emit = defineEmits<{
  add: [kind: RecordKind]
  editVaccination: [v: Vaccination]
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

const feedValue = computed(() => {
  const f = plan.value.feeding
  if (f.activeSince != null) {
    return t('care.feedActive', {
      duration: formatDuration(Math.max(0, props.now - f.activeSince)),
    })
  }
  if (f.nextAt == null) return t('care.feedEmpty')
  if (f.overdue) return t('care.feedOverdue')
  return t('care.nextFeed', { time: formatClock(f.nextAt) })
})

const feedHint = computed(() => {
  const f = plan.value.feeding
  if (f.activeSince != null) return t('care.feedActiveHint')
  if (!f.lastFeeding) return t('care.feedEmptyHint')
  return t('care.feedHint', {
    time: timeLabel(f.lastFeeding.endTime ?? f.lastFeeding.startTime),
    amount:
      f.lastFeeding.amount != null ? t('care.feedAmount', { amount: f.lastFeeding.amount }) : '',
  })
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

const sleepHint = computed(() => {
  const s = plan.value.sleep
  if (s.activeSince != null) return t('care.sleepingHint')
  if (s.awakeMs == null) return t('care.sleepEmptyHint')
  return t('care.awakeHint', {
    range: `${formatDuration(s.wakeMinMs)}–${formatDuration(s.wakeMaxMs)}`,
  })
})

const vaccine = computed(() => plan.value.todo.vaccine)

function vaccineBadge(v: Vaccination): string {
  const n = vaccineDaysLeft(v.date, startOfDay(props.now))
  if (n === 0) return t('care.vaccineToday')
  if (n > 0) return t('care.vaccineDays', { n })
  return t('care.vaccineOverdue', { n: -n })
}

const todoLabel = computed(() => {
  if (vaccine.value) return t('care.todo')
  if (plan.value.todo.lastMedication) return t('log.filters.medication')
  return t('care.todo')
})

const todoValue = computed(() => {
  const v = vaccine.value
  if (v) {
    return t('care.vaccineTodo', {
      name: v.name,
      dose: v.dose ? t('care.vaccineDose', { dose: v.dose }) : '',
    })
  }
  if (plan.value.todo.lastMedication) {
    return t('care.medicationTodo', { n: plan.value.todo.medicationCount })
  }
  return t('care.todoEmpty')
})

const todoHint = computed(() => {
  const v = vaccine.value
  if (v) return vaccineBadge(v)
  const med = plan.value.todo.lastMedication
  if (med) {
    return t('care.medicationHint', {
      time: timeLabel(med.time),
      name: med.name ? t('care.medicationName', { name: med.name }) : '',
    })
  }
  return t('care.todoEmptyHint')
})

const todoIcon = computed(() => {
  if (vaccine.value) return '💉'
  if (plan.value.todo.lastMedication) return '💊'
  return '📋'
})

function onTodoClick() {
  if (vaccine.value) {
    emit('editVaccination', vaccine.value)
    return
  }
  emit('add', 'medication')
}
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
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="care-row" @click="emit('add', 'sleep')">
        <span class="care-icon care-icon--sleep" aria-hidden="true">😴</span>
        <span class="care-body">
          <span class="care-label">{{ t('care.sleep') }}</span>
          <span class="care-value">{{ sleepValue }}</span>
          <span class="care-hint">{{ sleepHint }}</span>
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" class="care-row" @click="onTodoClick">
        <span class="care-icon care-icon--todo" aria-hidden="true">{{ todoIcon }}</span>
        <span class="care-body">
          <span class="care-label">{{ todoLabel }}</span>
          <span class="care-value">{{ todoValue }}</span>
          <span class="care-hint">{{ todoHint }}</span>
        </span>
        <span class="care-chevron" aria-hidden="true">›</span>
      </button>
    </div>

    <p v-if="!plan.hasRecords" class="care-empty">{{ t('care.empty') }}</p>

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

.care-icon--todo {
  background: rgba(196, 168, 224, 0.18);
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
