<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import { useSolidFoodStore } from '@/stores/solidFood'
import { useMedicationStore } from '@/stores/medication'
import { useVaccinationStore } from '@/stores/vaccination'
import { useTemperatureStore } from '@/stores/temperature'
import { useMilestoneStore } from '@/stores/milestone'
import PageHeader from '@/components/common/PageHeader.vue'
import TimelineList, { type TimelineEntry } from '@/components/timeline/TimelineList.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FeedingForm from '@/components/forms/FeedingForm.vue'
import DiaperForm from '@/components/forms/DiaperForm.vue'
import PumpingForm from '@/components/forms/PumpingForm.vue'
import SleepForm from '@/components/forms/SleepForm.vue'
import GrowthForm from '@/components/forms/GrowthForm.vue'
import SolidFoodForm from '@/components/forms/SolidFoodForm.vue'
import MedicationForm from '@/components/forms/MedicationForm.vue'
import VaccinationForm from '@/components/forms/VaccinationForm.vue'
import TemperatureForm from '@/components/forms/TemperatureForm.vue'
import MilestoneForm from '@/components/forms/MilestoneForm.vue'
import { formatTime, startOfDay } from '@/utils/format'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { useActiveTimer } from '@/composables/useActiveTimer'
import type {
  Feeding,
  DiaperChange,
  Pumping,
  Sleep,
  GrowthRecord,
  SolidFood,
  Medication,
  Vaccination,
  Temperature,
  Milestone,
  FeedType,
  DiaperType,
  DiaperColor,
  DiaperAmount,
  PumpSide,
  SleepType,
  VaccinationStatus,
  TemperatureMethod,
  MilestoneType,
} from '@/types'

type FeedingFormProps = {
  id: number
  type: FeedType
  startTime: number
  endTime?: number
  duration?: number
  amount?: number
  notes?: string
}
type DiaperFormProps = {
  id: number
  type: DiaperType
  time: number
  color?: DiaperColor
  amount?: DiaperAmount
  notes?: string
}
type PumpingFormProps = {
  id: number
  side: PumpSide
  startTime: number
  endTime?: number
  duration?: number
  amount?: number
  notes?: string
}
type SleepFormProps = { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
type GrowthFormProps = { id: number; date: number; weight?: number; height?: number; notes?: string }
type SolidFoodFormProps = { id: number; time: number; food: string; amount?: string; notes?: string }
type MedicationFormProps = { id: number; time: number; name: string; dose?: string; notes?: string }
type VaccinationFormProps = {
  id: number
  date: number
  name: string
  dose?: string
  status: VaccinationStatus
  notes?: string
}
type TemperatureFormProps = {
  id: number
  time: number
  value: number
  method?: TemperatureMethod
  notes?: string
}
type MilestoneFormProps = { id: number; time: number; type: MilestoneType; notes?: string }

const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()
const solidFoodStore = useSolidFoodStore()
const medicationStore = useMedicationStore()
const vaccinationStore = useVaccinationStore()
const temperatureStore = useTemperatureStore()
const milestoneStore = useMilestoneStore()

const { t } = useI18n()

// 类型筛选
const filter = ref<
  | 'all'
  | 'feeding'
  | 'diaper'
  | 'pumping'
  | 'sleep'
  | 'growth'
  | 'solidFood'
  | 'medication'
  | 'vaccination'
  | 'temperature'
  | 'milestone'
>('all')

/** 按日期筛选：null=全部，否则为单日 0 点时间戳 */
const dateFilter = ref<number | null>(null)
/** 日期面板展开状态 */
const dateOpen = ref(false)

const todayStart = computed(() => startOfDay(Date.now()))

/** 当前日期筛选的显示标签 */
const dateFilterLabel = computed(() => {
  if (!dateFilter.value) return ''
  if (dateFilter.value === todayStart.value) return t('log.dateToday')
  const d = new Date(dateFilter.value)
  return `${d.getMonth() + 1}/${d.getDate()}`
})

function matchDate(ts: number): boolean {
  const d = dateFilter.value
  if (!d) return true
  const day = startOfDay(ts)
  return day === d
}

const customDate = ref('')

function applyDateFilter() {
  if (!customDate.value) return
  const ts = new Date(`${customDate.value}T00:00:00`).getTime()
  if (isNaN(ts)) return
  dateFilter.value = ts
}

function clearDateFilter() {
  dateFilter.value = null
  customDate.value = ''
}

/** 删除撤销：过滤待删除记录 */
const { isPending, scheduleDelete } = useDeleteUndo()
const activeTimer = useActiveTimer()
const route = useRoute()
const router = useRouter()

// 悬浮球导航过来时自动打开对应计时表单
onMounted(() => {
  const timerKind = route.query.timer
  if (timerKind && typeof timerKind === 'string') {
    openAdd(timerKind as 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature' | 'milestone')
    router.replace({ path: '/log' }) // 清除 query 避免重复触发
  }
})

function keep<T extends { id?: number }>(items: T[], kind: string): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

const filteredFeedings = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'feeding') return []
  return keep(feedingStore.feedings.filter((f) => matchDate(f.startTime)), 'feeding')
})
const filteredDiapers = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'diaper') return []
  return keep(diaperStore.diapers.filter((d) => matchDate(d.time)), 'diaper')
})
const filteredPumpings = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'pumping') return []
  return keep(pumpingStore.pumpings.filter((p) => matchDate(p.startTime)), 'pumping')
})
const filteredSleeps = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'sleep') return []
  return keep(sleepStore.sleeps.filter((s) => matchDate(s.startTime)), 'sleep')
})
const filteredGrowths = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'growth') return []
  return keep(growthStore.growths.filter((g) => matchDate(g.date)), 'growth')
})
const filteredSolidFoods = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'solidFood') return []
  return keep(solidFoodStore.solidFoods.filter((sf) => matchDate(sf.time)), 'solidFood')
})
const filteredMedications = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'medication') return []
  return keep(medicationStore.medications.filter((m) => matchDate(m.time)), 'medication')
})
const filteredVaccinations = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'vaccination') return []
  // 记录页只展示实际接种记录（done），planned 待接种计划/提醒不混入时间线
  return keep(
    vaccinationStore.vaccinations.filter((v) => v.status === 'done' && matchDate(v.date)),
    'vaccination',
  )
})
const filteredTemperatures = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'temperature') return []
  return keep(temperatureStore.temperatures.filter((tmp) => matchDate(tmp.time)), 'temperature')
})
const filteredMilestones = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'milestone') return []
  return keep(
    milestoneStore.milestones.filter((ms) => matchDate(ms.time)),
    'milestone',
  )
})

const hasAny = computed(
  () =>
    filteredFeedings.value.length +
      filteredDiapers.value.length +
      filteredPumpings.value.length +
      filteredSleeps.value.length +
      filteredGrowths.value.length +
      filteredSolidFoods.value.length +
      filteredMedications.value.length +
      filteredVaccinations.value.length +
      filteredTemperatures.value.length +
      filteredMilestones.value.length >
    0,
)

// 弹窗
const modalState = ref<{
  kind:
    | 'feeding'
    | 'diaper'
    | 'pumping'
    | 'sleep'
    | 'growth'
    | 'solidFood'
    | 'medication'
    | 'vaccination'
    | 'temperature'
    | 'milestone'
  editing?: TimelineEntry
} | null>(null)
const confirmDelete = ref<TimelineEntry | null>(null)

function onEdit(entry: TimelineEntry) {
  modalState.value = { kind: entry.kind, editing: entry }
}

function openAdd(kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature' | 'milestone') {
  modalState.value = { kind }
}

function onDelete(entry: TimelineEntry) {
  confirmDelete.value = entry
}

async function confirmDeleteAction() {
  const e = confirmDelete.value
  if (!e) return
  scheduleDelete(e, () => removeEntry(e), t('common.deletedToast'), t('common.undo'))
  confirmDelete.value = null
}

/** 真实删除（3 秒撤销窗口结束后执行） */
async function removeEntry(e: TimelineEntry) {
  if (e.kind === 'feeding') await feedingStore.remove(e.id)
  else if (e.kind === 'diaper') await diaperStore.remove(e.id)
  else if (e.kind === 'pumping') await pumpingStore.remove(e.id)
  else if (e.kind === 'sleep') await sleepStore.remove(e.id)
  else if (e.kind === 'growth') await growthStore.remove(e.id)
  else if (e.kind === 'solidFood') await solidFoodStore.remove(e.id)
  else if (e.kind === 'medication') await medicationStore.remove(e.id)
  else if (e.kind === 'vaccination') await vaccinationStore.remove(e.id)
  else if (e.kind === 'temperature') await temperatureStore.remove(e.id)
  else await milestoneStore.remove(e.id)
}

function onSaved() {
  activeTimer.reset()
  modalState.value = null
}

const editPayload = computed(() => {
  const e = modalState.value?.editing
  if (!e) return undefined
  if (e.kind === 'feeding') {
    const f = e.raw as Feeding
    return {
      id: e.id,
      type: f.type,
      startTime: f.startTime,
      endTime: f.endTime,
      duration: f.duration,
      amount: f.amount,
      notes: f.notes,
    }
  }
  if (e.kind === 'diaper') {
    const d = e.raw as DiaperChange
    return { id: e.id, type: d.type, time: d.time, color: d.color, amount: d.amount, notes: d.notes }
  }
  if (e.kind === 'pumping') {
    const p = e.raw as Pumping
    return {
      id: e.id,
      side: p.side,
      startTime: p.startTime,
      endTime: p.endTime,
      duration: p.duration,
      amount: p.amount,
      notes: p.notes,
    }
  }
  if (e.kind === 'sleep') {
    const s = e.raw as Sleep
    return { id: e.id, type: s.type, startTime: s.startTime, endTime: s.endTime, notes: s.notes }
  }
  if (e.kind === 'growth') {
    const g = e.raw as GrowthRecord
    return { id: e.id, date: g.date, weight: g.weight, height: g.height, notes: g.notes }
  }
  if (e.kind === 'solidFood') {
    const sf = e.raw as SolidFood
    return { id: e.id, time: sf.time, food: sf.food, amount: sf.amount, notes: sf.notes }
  }
  if (e.kind === 'medication') {
    const m = e.raw as Medication
    return { id: e.id, time: m.time, name: m.name, dose: m.dose, notes: m.notes }
  }
  if (e.kind === 'vaccination') {
    const v = e.raw as Vaccination
    return { id: e.id, date: v.date, name: v.name, dose: v.dose, status: v.status, notes: v.notes }
  }
  if (e.kind === 'temperature') {
    const tmp = e.raw as Temperature
    return { id: e.id, time: tmp.time, value: tmp.value, method: tmp.method, notes: tmp.notes }
  }
  const ms = e.raw as Milestone
  return { id: e.id, time: ms.time, type: ms.type, notes: ms.notes }
})

const filters = [
  { key: 'all' as const, labelKey: 'log.filters.all' },
  { key: 'feeding' as const, labelKey: 'log.filters.feeding' },
  { key: 'diaper' as const, labelKey: 'log.filters.diaper' },
  { key: 'pumping' as const, labelKey: 'log.filters.pumping' },
  { key: 'sleep' as const, labelKey: 'log.filters.sleep' },
  { key: 'growth' as const, labelKey: 'log.filters.growth' },
  { key: 'solidFood' as const, labelKey: 'log.filters.solidFood' },
  { key: 'medication' as const, labelKey: 'log.filters.medication' },
  { key: 'vaccination' as const, labelKey: 'log.filters.vaccination' },
  { key: 'temperature' as const, labelKey: 'log.filters.temperature' },
  { key: 'milestone' as const, labelKey: 'log.filters.milestone' },
]

const currentFilterLabel = computed(() => t(filters.find((f) => f.key === filter.value)?.labelKey ?? 'log.filters.all'))
</script>

<template>
  <div class="page log-page">
    <PageHeader />

    <div class="filter-toolbar">
      <template v-if="!dateOpen">
        <label class="filter-select-label" for="filter-select">{{ t('log.filterLabel') }}</label>
        <select id="filter-select" v-model="filter" class="form-input filter-select">
          <option v-for="f in filters" :key="f.key" :value="f.key">{{ t(f.labelKey) }}</option>
        </select>
        <span v-if="dateFilter !== null" class="date-selected-label">{{ dateFilterLabel }}</span>
      </template>
      <div v-else class="date-wrap">
        <div class="date-custom">
          <input
            v-model="customDate"
            type="date"
            class="form-input date-input"
            :aria-label="t('log.dateFilter')"
            :title="t('log.dateFilter')"
            @change="applyDateFilter"
          />
          <button
            v-if="dateFilter !== null"
            type="button"
            class="date-clear"
            :aria-label="t('log.dateClear')"
            :title="t('log.dateClear')"
            @click="clearDateFilter"
          >
            ✕
          </button>
        </div>
      </div>
      <button
        type="button"
        class="date-toggle"
        :class="{ active: dateOpen, filtered: dateFilter !== null }"
        :title="t('log.dateFilter')"
        :aria-label="t('log.dateFilter')"
        @click="dateOpen = !dateOpen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
    </div>

    <div class="card">
      <TimelineList
        v-if="hasAny"
        :feedings="filteredFeedings"
        :diapers="filteredDiapers"
        :pumpings="filteredPumpings"
        :sleeps="filteredSleeps"
        :growths="filteredGrowths"
        :solid-foods="filteredSolidFoods"
        :medications="filteredMedications"
        :vaccinations="filteredVaccinations"
        :temperatures="filteredTemperatures"
        :milestones="filteredMilestones"
        :deleting-key="confirmDelete ? confirmDelete.kind + '-' + confirmDelete.id : null"
        grouped
        @edit="onEdit"
        @delete="onDelete"
      />
      <div v-else class="empty-inline">
        <p>{{ t('log.empty', { type: filter === 'all' ? '' : currentFilterLabel }) }}</p>
        <p class="empty-hint">{{ t('log.emptyHint') }}</p>
      </div>
    </div>

    <BaseModal
      :show="modalState !== null"
      :title="modalState?.editing ? t('log.editTitle') : t('log.addTitle')"
      @close="modalState = null"
    >
      <FeedingForm
        v-if="modalState?.kind === 'feeding'"
        :editing="modalState?.editing ? (editPayload as FeedingFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <DiaperForm
        v-else-if="modalState?.kind === 'diaper'"
        :editing="modalState?.editing ? (editPayload as DiaperFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <PumpingForm
        v-else-if="modalState?.kind === 'pumping'"
        :editing="modalState?.editing ? (editPayload as PumpingFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <SleepForm
        v-else-if="modalState?.kind === 'sleep'"
        :editing="modalState?.editing ? (editPayload as SleepFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <GrowthForm
        v-else-if="modalState?.kind === 'growth'"
        :editing="modalState?.editing ? (editPayload as GrowthFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <SolidFoodForm
        v-else-if="modalState?.kind === 'solidFood'"
        :editing="modalState?.editing ? (editPayload as SolidFoodFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <MedicationForm
        v-else-if="modalState?.kind === 'medication'"
        :editing="modalState?.editing ? (editPayload as MedicationFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <VaccinationForm
        v-else-if="modalState?.kind === 'vaccination'"
        :editing="modalState?.editing ? (editPayload as VaccinationFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <TemperatureForm
        v-else-if="modalState?.kind === 'temperature'"
        :editing="modalState?.editing ? (editPayload as TemperatureFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
      <MilestoneForm
        v-else-if="modalState?.kind === 'milestone'"
        :editing="modalState?.editing ? (editPayload as MilestoneFormProps) : undefined"
        @saved="onSaved"
        @cancelled="activeTimer.reset(); modalState = null"
      />
    </BaseModal>

    <BaseModal :show="confirmDelete !== null" :title="t('common.deleteRecord')" @close="confirmDelete = null">
      <p class="confirm-text">{{ t('log.deleteSimple') }}</p>
      <div v-if="confirmDelete" class="confirm-record">
        <span class="confirm-record-icon" :style="{ background: confirmDelete.color + '22' }">{{ confirmDelete.icon }}</span>
        <div class="confirm-record-body">
          <p class="confirm-record-title">{{ confirmDelete.title }}</p>
          <p class="confirm-record-detail">{{ confirmDelete.detail }}</p>
          <p class="confirm-record-time">{{ confirmDelete.timeLabel ?? formatTime(confirmDelete.time) }}</p>
        </div>
      </div>
      <div class="confirm-actions">
        <button class="btn btn-outline" @click="confirmDelete = null">{{ t('common.cancel') }}</button>
        <button class="btn btn-danger-soft" @click="confirmDeleteAction">{{ t('log.confirmDelete') }}</button>
      </div>
    </BaseModal>

  </div>
</template>

<style scoped>
.filter-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px 14px;
}

.filter-select-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.filter-select {
  flex: 1;
  min-width: 0;
  border-radius: 12px;
  box-shadow: var(--shadow-xs);
}

.date-toggle {
  position: relative;
  width: 40px;
  height: 40px;
  min-height: 0;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.12s ease,
    border-color 0.15s ease;
}

.date-toggle:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.date-toggle:active {
  transform: scale(0.92);
}

.date-toggle.active {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: var(--primary);
}

.date-toggle.filtered {
  color: var(--primary);
  border-color: var(--primary);
}

.date-selected-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 8px;
  flex-shrink: 0;
}

.date-wrap {
  flex: 1;
  min-width: 0;
}

.date-custom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-input {
  flex: 1;
  min-width: 0;
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
  font-size: 13px;
  padding: 8px 10px;
}

.date-sep {
  color: var(--text-muted);
  font-size: 13px;
  flex-shrink: 0;
}

.date-clear {
  width: 28px;
  height: 28px;
  min-height: 0;
  border-radius: 50%;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
}

.empty-inline {
  text-align: center;
  padding: 40px 12px;
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-inline p:first-child {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-hint {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 6px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 18px;
}

.confirm-record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface-2);
  margin-bottom: 18px;
}

.confirm-record-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.confirm-record-body {
  min-width: 0;
  flex: 1;
}

.confirm-record-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.confirm-record-detail {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.confirm-record-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-actions .btn {
  flex: 1;
}
</style>
