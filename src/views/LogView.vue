<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { formatTime } from '@/utils/format'
import { MILESTONE_TYPE_LABELS } from '@/constants'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
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

/** 记录搜索关键词（匹配备注/食物/药品/疫苗名等） */
const searchQuery = ref('')

function matchQuery(record: { notes?: string; food?: string; name?: string; dose?: string }, extraFields?: string[]): boolean {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return true
  const fields = [record.notes ?? '', record.food ?? '', record.name ?? '', record.dose ?? '', ...(extraFields ?? [])]
  return fields.some((f) => f.toLowerCase().includes(q))
}

/** 删除撤销：过滤待删除记录 */
const { isPending, scheduleDelete } = useDeleteUndo()

function keep<T extends { id?: number }>(items: T[], kind: string): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

const filteredFeedings = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'feeding') return []
  return keep(feedingStore.feedings.filter((f) => matchQuery(f)), 'feeding')
})
const filteredDiapers = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'diaper') return []
  return keep(diaperStore.diapers.filter((d) => matchQuery(d)), 'diaper')
})
const filteredPumpings = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'pumping') return []
  return keep(pumpingStore.pumpings.filter((p) => matchQuery(p)), 'pumping')
})
const filteredSleeps = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'sleep') return []
  return keep(sleepStore.sleeps.filter((s) => matchQuery(s)), 'sleep')
})
const filteredGrowths = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'growth') return []
  return keep(growthStore.growths.filter((g) => matchQuery(g)), 'growth')
})
const filteredSolidFoods = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'solidFood') return []
  return keep(solidFoodStore.solidFoods.filter((sf) => matchQuery(sf)), 'solidFood')
})
const filteredMedications = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'medication') return []
  return keep(medicationStore.medications.filter((m) => matchQuery(m)), 'medication')
})
const filteredVaccinations = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'vaccination') return []
  return keep(vaccinationStore.vaccinations.filter((v) => matchQuery(v)), 'vaccination')
})
const filteredTemperatures = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'temperature') return []
  return keep(temperatureStore.temperatures.filter((tmp) => matchQuery(tmp)), 'temperature')
})
const filteredMilestones = computed(() => {
  if (filter.value !== 'all' && filter.value !== 'milestone') return []
  return keep(
    milestoneStore.milestones.filter((ms) => matchQuery(ms, [t(MILESTONE_TYPE_LABELS[ms.type])])),
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

    <div class="filter-select-row">
      <label class="filter-select-label" for="filter-select">{{ t('log.filterLabel') }}</label>
      <select id="filter-select" v-model="filter" class="form-input filter-select">
        <option v-for="f in filters" :key="f.key" :value="f.key">{{ t(f.labelKey) }}</option>
      </select>
    </div>

    <div class="search-row">
      <input
        v-model="searchQuery"
        type="search"
        class="form-input search-input"
        :placeholder="t('log.searchPlaceholder')"
        :aria-label="t('log.searchPlaceholder')"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="search-clear"
        :aria-label="t('common.clear')"
        @click="searchQuery = ''"
      >
        ✕
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
        @cancelled="modalState = null"
      />
      <DiaperForm
        v-else-if="modalState?.kind === 'diaper'"
        :editing="modalState?.editing ? (editPayload as DiaperFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <PumpingForm
        v-else-if="modalState?.kind === 'pumping'"
        :editing="modalState?.editing ? (editPayload as PumpingFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <SleepForm
        v-else-if="modalState?.kind === 'sleep'"
        :editing="modalState?.editing ? (editPayload as SleepFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <GrowthForm
        v-else-if="modalState?.kind === 'growth'"
        :editing="modalState?.editing ? (editPayload as GrowthFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <SolidFoodForm
        v-else-if="modalState?.kind === 'solidFood'"
        :editing="modalState?.editing ? (editPayload as SolidFoodFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <MedicationForm
        v-else-if="modalState?.kind === 'medication'"
        :editing="modalState?.editing ? (editPayload as MedicationFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <VaccinationForm
        v-else-if="modalState?.kind === 'vaccination'"
        :editing="modalState?.editing ? (editPayload as VaccinationFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <TemperatureForm
        v-else-if="modalState?.kind === 'temperature'"
        :editing="modalState?.editing ? (editPayload as TemperatureFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <MilestoneForm
        v-else-if="modalState?.kind === 'milestone'"
        :editing="modalState?.editing ? (editPayload as MilestoneFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
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
.filter-select-row {
  display: flex;
  align-items: center;
  gap: 12px;
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

.search-row {
  position: relative;
  padding: 0 4px 14px;
}

.search-input {
  border-radius: 12px;
  box-shadow: var(--shadow-xs);
  padding-right: 40px;
}

.search-clear {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  min-height: 0;
  border-radius: 50%;
  color: var(--text-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
}

.search-clear:active {
  background: var(--surface-3);
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
