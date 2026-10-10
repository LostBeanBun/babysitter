<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import TimelineList from '@/components/timeline/TimelineList.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import RecordFormModal from '@/components/common/RecordFormModal.vue'
import { buildTimelineEntries } from '@/services/timeline'
import { useRecordModal } from '@/composables/useRecordModal'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { KIND_META, RECORD_KINDS } from '@/constants'
import { formatTime, startOfDay } from '@/utils/format'
import type { RecordKind } from '@/types'

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
const filter = ref<RecordKind | 'all'>('all')

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
const { isPending } = useDeleteUndo()
const route = useRoute()
const router = useRouter()

const {
  modalState,
  confirmDelete,
  openAdd,
  onEdit,
  onDelete,
  onStartRecord,
  onSaved,
  onCancelled,
  confirmDeleteAction,
} = useRecordModal()

function keep<T extends { id?: number }>(items: T[], kind: RecordKind): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

/** 类型筛选 + 日期筛选 + 待删除过滤 */
function filtered<T extends { id?: number }>(kind: RecordKind, items: T[], timeOf: (x: T) => number): T[] {
  if (filter.value !== 'all' && filter.value !== kind) return []
  return keep(
    items.filter((x) => matchDate(timeOf(x))),
    kind,
  )
}

const entries = computed(() =>
  buildTimelineEntries({
    feedings: filtered('feeding', feedingStore.feedings, (f) => f.startTime),
    diapers: filtered('diaper', diaperStore.diapers, (d) => d.time),
    pumpings: filtered('pumping', pumpingStore.pumpings, (p) => p.startTime),
    sleeps: filtered('sleep', sleepStore.sleeps, (s) => s.startTime),
    growths: filtered('growth', growthStore.growths, (g) => g.date),
    solidFoods: filtered('solidFood', solidFoodStore.solidFoods, (sf) => sf.time),
    medications: filtered('medication', medicationStore.medications, (m) => m.time),
    // 记录页只展示实际接种记录（done），planned 待接种计划/提醒不混入时间线
    vaccinations: filtered(
      'vaccination',
      vaccinationStore.vaccinations.filter((v) => v.status === 'done'),
      (v) => v.date,
    ),
    temperatures: filtered('temperature', temperatureStore.temperatures, (tmp) => tmp.time),
    milestones: filtered('milestone', milestoneStore.milestones, (ms) => ms.time),
  }),
)

// 悬浮球导航过来时自动打开对应表单
let lastTimerKind = ''
watch(
  () => route.query.timer,
  (timerKind) => {
    if (timerKind && typeof timerKind === 'string' && timerKind !== lastTimerKind) {
      lastTimerKind = timerKind
      openAdd(timerKind as RecordKind)
      router.replace({ path: '/log' })
    }
  },
  { immediate: true },
)

const filters = [
  { key: 'all' as const, labelKey: 'log.filters.all' },
  ...RECORD_KINDS.map((k) => ({ key: k, labelKey: KIND_META[k].labelKey })),
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
        v-if="entries.length"
        :entries="entries"
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

    <RecordFormModal
      :state="modalState"
      @close="modalState = null"
      @saved="onSaved"
      @cancelled="onCancelled"
      @start-record="onStartRecord"
    />

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
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
}

/* ===== 平板适配（700–1439px）：筛选下拉不再拉满整行 ===== */
@media (min-width: 700px) and (max-width: 1439px) {
  .filter-select {
    max-width: 320px;
  }
}

.date-toggle {
  position: relative;
  width: 44px;
  height: 44px;
  min-height: 0;
  border-radius: var(--radius);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass);
  transition:
    color 0.25s var(--ease-out),
    background 0.25s var(--ease-out),
    transform 0.3s var(--spring),
    border-color 0.25s var(--ease-out);
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
  border-radius: var(--radius-sm);
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
  width: 44px;
  height: 44px;
  min-height: 0;
  border-radius: 50%;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.date-clear:active {
  transform: scale(var(--tap-scale));
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
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  margin-bottom: 18px;
}

.confirm-record-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
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
