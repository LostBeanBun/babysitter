<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import PageHeader from '@/components/common/PageHeader.vue'
import Timeline, { type TimelineEntry } from '@/components/timeline/Timeline.vue'
import Modal from '@/components/common/Modal.vue'
import FeedingForm from '@/components/forms/FeedingForm.vue'
import DiaperForm from '@/components/forms/DiaperForm.vue'
import PumpingForm from '@/components/forms/PumpingForm.vue'
import SleepForm from '@/components/forms/SleepForm.vue'
import GrowthForm from '@/components/forms/GrowthForm.vue'
import type { Feeding, DiaperChange, Pumping, Sleep, GrowthRecord, FeedType, DiaperType, DiaperColor, DiaperAmount, PumpSide, SleepType } from '@/types'

type FeedingFormProps = { id: number; type: FeedType; startTime: number; endTime?: number; duration?: number; amount?: number; notes?: string }
type DiaperFormProps = { id: number; type: DiaperType; time: number; color?: DiaperColor; amount?: DiaperAmount; notes?: string }
type PumpingFormProps = { id: number; side: PumpSide; startTime: number; endTime?: number; duration?: number; amount?: number; notes?: string }
type SleepFormProps = { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
type GrowthFormProps = { id: number; date: number; weight?: number; height?: number; notes?: string }

const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()

// 类型筛选
const filter = ref<'all' | 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth'>('all')

const filteredFeedings = computed(() => (filter.value === 'all' || filter.value === 'feeding' ? feedingStore.feedings : []))
const filteredDiapers = computed(() => (filter.value === 'all' || filter.value === 'diaper' ? diaperStore.diapers : []))
const filteredPumpings = computed(() => (filter.value === 'all' || filter.value === 'pumping' ? pumpingStore.pumpings : []))
const filteredSleeps = computed(() => (filter.value === 'all' || filter.value === 'sleep' ? sleepStore.sleeps : []))
const filteredGrowths = computed(() => (filter.value === 'all' || filter.value === 'growth' ? growthStore.growths : []))

const hasAny = computed(() =>
  filteredFeedings.value.length + filteredDiapers.value.length + filteredPumpings.value.length + filteredSleeps.value.length + filteredGrowths.value.length > 0,
)

// 弹窗
const modalState = ref<{ kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth'; editing?: TimelineEntry } | null>(null)
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
  if (e.kind === 'feeding') await feedingStore.remove(e.id)
  else if (e.kind === 'diaper') await diaperStore.remove(e.id)
  else if (e.kind === 'pumping') await pumpingStore.remove(e.id)
  else if (e.kind === 'sleep') await sleepStore.remove(e.id)
  else await growthStore.remove(e.id)
  confirmDelete.value = null
}

function onSaved() {
  modalState.value = null
}

const editPayload = computed(() => {
  const e = modalState.value?.editing
  if (!e) return undefined
  if (e.kind === 'feeding') {
    const f = e.raw as Feeding
    return { id: e.id, type: f.type, startTime: f.startTime, endTime: f.endTime, duration: f.duration, amount: f.amount, notes: f.notes }
  }
  if (e.kind === 'diaper') {
    const d = e.raw as DiaperChange
    return { id: e.id, type: d.type, time: d.time, color: d.color, amount: d.amount, notes: d.notes }
  }
  if (e.kind === 'pumping') {
    const p = e.raw as Pumping
    return { id: e.id, side: p.side, startTime: p.startTime, endTime: p.endTime, duration: p.duration, amount: p.amount, notes: p.notes }
  }
  if (e.kind === 'sleep') {
    const s = e.raw as Sleep
    return { id: e.id, type: s.type, startTime: s.startTime, endTime: s.endTime, notes: s.notes }
  }
  const g = e.raw as GrowthRecord
  return { id: e.id, date: g.date, weight: g.weight, height: g.height, notes: g.notes }
})

const filters = [
  { key: 'all' as const, label: '全部' },
  { key: 'feeding' as const, label: '喂养' },
  { key: 'diaper' as const, label: '纸尿裤' },
  { key: 'pumping' as const, label: '吸奶' },
  { key: 'sleep' as const, label: '睡眠' },
  { key: 'growth' as const, label: '成长' },
]
</script>

<template>
  <div class="page log-page">
    <PageHeader />

    <div class="filter-select-row">
      <label class="filter-select-label" for="filter-select">记录类型</label>
      <select id="filter-select" v-model="filter" class="form-input filter-select">
        <option v-for="f in filters" :key="f.key" :value="f.key">{{ f.label }}</option>
      </select>
    </div>

    <div class="card">
      <Timeline
        v-if="hasAny"
        :feedings="filteredFeedings"
        :diapers="filteredDiapers"
        :pumpings="filteredPumpings"
        :sleeps="filteredSleeps"
        :growths="filteredGrowths"
        grouped
        @edit="onEdit"
        @delete="onDelete"
      />
      <div v-else class="empty-inline">
        <p>暂无{{ filter === 'all' ? '' : filters.find((f) => f.key === filter)?.label }}记录</p>
        <p class="empty-hint">回到「今日」页开始记录吧</p>
      </div>
    </div>

    <Modal :show="modalState !== null" :title="modalState?.editing ? '编辑记录' : '添加记录'" @close="modalState = null">
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
    </Modal>

    <Modal :show="confirmDelete !== null" title="删除记录" @close="confirmDelete = null">
      <p class="confirm-text">确定要删除这条记录吗？此操作不可撤销。</p>
      <div class="confirm-actions">
        <button class="btn btn-outline" @click="confirmDelete = null">取消</button>
        <button class="btn btn-danger-soft" @click="confirmDeleteAction">确认删除</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.filter-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 12px;
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
}

.empty-inline {
  text-align: center;
  padding: 32px 12px;
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-hint {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 4px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 18px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-actions .btn {
  flex: 1;
}
</style>