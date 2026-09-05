<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
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
import BaseModal from '@/components/common/BaseModal.vue'
import OnboardingModal from '@/components/dashboard/OnboardingModal.vue'
import TodayOverview from '@/components/dashboard/TodayOverview.vue'
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
import { formatTime, toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { FEED_TYPE_LABELS } from '@/constants'
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

/** 各表单编辑 props 结构（与表单组件 props.editing 一致） */
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

const babyStore = useBabyStore()
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

const now = ref(Date.now())
const nowTimer = window.setInterval(() => (now.value = Date.now()), 60_000)
onUnmounted(() => window.clearInterval(nowTimer))
// 无宝宝时显示引导
const hasBaby = computed(() => babyStore.babies.length > 0)

const onboardingOpen = ref(false)

const { scheduleDelete } = useDeleteUndo()
const activeTimer = useActiveTimer()

// —— 奶睡一键（组合记录喂养 + 睡眠）——
const sleepFeedOpen = ref(false)
const sfType = ref<FeedType>('breast_both')
const sfAmount = ref('')
const sfStart = ref(toDateTimeLocal(Date.now()))
const sfSleepType = ref<SleepType>('nap')
const sfSleepEnd = ref(toDateTimeLocal(Date.now() + 2 * 3600_000))
const sfNotes = ref('')

const FEED_TYPE_CHOICES = Object.entries(FEED_TYPE_LABELS).map(([value, label]) => ({
  value: value as FeedType,
  label,
}))

async function saveSleepFeed() {
  const start = fromDateTimeLocal(sfStart.value)
  const end = fromDateTimeLocal(sfSleepEnd.value)
  if (start == null || isNaN(start)) {
    alert(t('dashboard.selectStart'))
    return
  }
  if (end == null || isNaN(end) || end <= start) {
    alert(t('dashboard.sleepEndAfter'))
    return
  }
  let amount: number | undefined
  if (sfType.value === 'bottle_formula' || sfType.value === 'bottle_breastmilk') {
    amount = sfAmount.value ? Number(sfAmount.value) : undefined
    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      alert(t('dashboard.invalidAmount'))
      return
    }
  }
  await feedingStore.add({ type: sfType.value, startTime: start, amount })
  await sleepStore.add({ type: sfSleepType.value, startTime: start, endTime: end, notes: sfNotes.value || undefined })
  activeTimer.reset()
  sleepFeedOpen.value = false
  sfType.value = 'breast_both'
  sfAmount.value = ''
  sfStart.value = toDateTimeLocal(Date.now())
  sfSleepType.value = 'nap'
  sfSleepEnd.value = toDateTimeLocal(Date.now() + 2 * 3600_000)
  sfNotes.value = ''
}

// 弹窗状态
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
  editing?: {
    kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature' | 'milestone'
    id: number
    time: number
    kindColor: string
    icon: string
    color: string
    title: string
    detail: string
    timeLabel?: string
    raw: Feeding | DiaperChange | Pumping | Sleep | GrowthRecord | SolidFood | Medication | Vaccination | Temperature | Milestone
  } | null
} | null>(null)
const confirmDelete = ref<{
  kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature' | 'milestone'
  id: number
  time: number
  kindColor: string
  icon: string
  color: string
  title: string
  detail: string
  timeLabel?: string
  raw: Feeding | DiaperChange | Pumping | Sleep | GrowthRecord | SolidFood | Medication | Vaccination | Temperature | Milestone
} | null>(null)

function openAdd(
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
    | 'milestone',
) {
  modalState.value = { kind }
}

async function confirmDeleteAction() {
  const e = confirmDelete.value
  if (!e) return
  scheduleDelete(e, () => removeEntry(e), t('common.deletedToast'), t('common.undo'))
  confirmDelete.value = null
}

/** 真实删除（3 秒撤销窗口结束后执行） */
async function removeEntry(e: {
  kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature' | 'milestone'
  id: number
  time: number
  kindColor: string
  icon: string
  color: string
  title: string
  detail: string
  timeLabel?: string
  raw: Feeding | DiaperChange | Pumping | Sleep | GrowthRecord | SolidFood | Medication | Vaccination | Temperature | Milestone
}) {
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
  const savedKind = modalState.value?.kind
  if (savedKind && savedKind === activeTimer.kind.value) {
    activeTimer.reset()
  }
  modalState.value = null
}

function onCancelled() {
  const closedKind = modalState.value?.kind
  if (closedKind && closedKind === activeTimer.kind.value) {
    activeTimer.reset()
  }
  modalState.value = null
}

// 编辑模式回填（按 kind 类型收窄）
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
</script>

<template>
  <div class="page dashboard">
    <PageHeader />

    <!-- 首次使用引导 -->
    <div v-if="!hasBaby" class="welcome">
      <div class="welcome-icon">👶</div>
      <h2 class="welcome-title">{{ t('dashboard.welcomeTitle') }}</h2>
      <p class="welcome-text">{{ t('dashboard.welcomeText1') }}<br />{{ t('dashboard.welcomeText2') }}</p>
      <button class="btn btn-primary btn-lg welcome-btn" @click="onboardingOpen = true">{{ t('dashboard.startBtn') }}</button>
      <button class="btn btn-outline welcome-btn" @click="$router.push('/settings')">
        {{ t('dashboard.importHint') }}
      </button>
    </div>

    <template v-else>
      <!-- 今日概览（提醒条 + 统计卡 + 小结按钮） -->
      <TodayOverview :now="now" @add="openAdd('vaccination')" />

      <!-- 快捷记录 -->
      <p class="section-title">{{ t('dashboard.quickRecord') }}</p>
      <div class="quick-actions">
        <button class="quick-btn feed" @click="openAdd('feeding')">
          <span class="quick-icon">🍼</span>
          <span class="quick-label">{{ t('log.filters.feeding') }}</span>
        </button>
        <button class="quick-btn diaper" @click="openAdd('diaper')">
          <span class="quick-icon">🧷</span>
          <span class="quick-label">{{ t('log.filters.diaper') }}</span>
        </button>
        <button class="quick-btn sleep" @click="openAdd('sleep')">
          <span class="quick-icon">😴</span>
          <span class="quick-label">{{ t('log.filters.sleep') }}</span>
        </button>
        <button class="quick-btn pump" @click="openAdd('pumping')">
          <span class="quick-icon">🎀</span>
          <span class="quick-label">{{ t('log.filters.pumping') }}</span>
        </button>
        <button class="quick-btn growth" @click="openAdd('growth')">
          <span class="quick-icon">📏</span>
          <span class="quick-label">{{ t('log.filters.growth') }}</span>
        </button>
        <button class="quick-btn solidFood" @click="openAdd('solidFood')">
          <span class="quick-icon">🍎</span>
          <span class="quick-label">{{ t('log.filters.solidFood') }}</span>
        </button>
        <button class="quick-btn medication" @click="openAdd('medication')">
          <span class="quick-icon">💊</span>
          <span class="quick-label">{{ t('log.filters.medication') }}</span>
        </button>
        <button class="quick-btn vaccination" @click="openAdd('vaccination')">
          <span class="quick-icon">💉</span>
          <span class="quick-label">{{ t('log.filters.vaccination') }}</span>
        </button>
        <button class="quick-btn temperature" @click="openAdd('temperature')">
          <span class="quick-icon">🌡️</span>
          <span class="quick-label">{{ t('log.filters.temperature') }}</span>
        </button>
        <button class="quick-btn milestone" @click="openAdd('milestone')">
          <span class="quick-icon">🌟</span>
          <span class="quick-label">{{ t('log.filters.milestone') }}</span>
        </button>
      </div>

      <!-- 奶睡一键（与快捷记录同组） -->
      <button class="btn btn-outline sleep-feed-btn" @click="sleepFeedOpen = true">
        <span class="sf-btn-icon">🍼😴</span>
        <span>{{ t('dashboard.sleepFeedButton') }}</span>
      </button>

      <!-- 记录弹窗 -->
      <BaseModal
        :show="modalState !== null"
        :title="modalState?.editing ? t('log.editTitle') : t('log.addTitle')"
        @close="modalState = null"
      >
        <FeedingForm
          v-if="modalState?.kind === 'feeding'"
          :editing="modalState?.editing ? (editPayload as FeedingFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <DiaperForm
          v-else-if="modalState?.kind === 'diaper'"
          :editing="modalState?.editing ? (editPayload as DiaperFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <PumpingForm
          v-else-if="modalState?.kind === 'pumping'"
          :editing="modalState?.editing ? (editPayload as PumpingFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <SleepForm
          v-else-if="modalState?.kind === 'sleep'"
          :editing="modalState?.editing ? (editPayload as SleepFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <GrowthForm
          v-else-if="modalState?.kind === 'growth'"
          :editing="modalState?.editing ? (editPayload as GrowthFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <SolidFoodForm
          v-else-if="modalState?.kind === 'solidFood'"
          :editing="modalState?.editing ? (editPayload as SolidFoodFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <MedicationForm
          v-else-if="modalState?.kind === 'medication'"
          :editing="modalState?.editing ? (editPayload as MedicationFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <VaccinationForm
          v-else-if="modalState?.kind === 'vaccination'"
          :editing="modalState?.editing ? (editPayload as VaccinationFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <TemperatureForm
          v-else-if="modalState?.kind === 'temperature'"
          :editing="modalState?.editing ? (editPayload as TemperatureFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
        <MilestoneForm
          v-else-if="modalState?.kind === 'milestone'"
          :editing="modalState?.editing ? (editPayload as MilestoneFormProps) : undefined"
          @saved="onSaved"
          @cancelled="onCancelled"
        />
      </BaseModal>

      <!-- 删除确认 -->
      <BaseModal :show="confirmDelete !== null" :title="t('common.deleteRecord')" @close="confirmDelete = null">
        <p class="confirm-text">
          {{
            t('log.deleteConfirm', {
              kind: t(
                confirmDelete?.kind === 'feeding'
                  ? 'log.filters.feeding'
                  : confirmDelete?.kind === 'diaper'
                    ? 'log.filters.diaper'
                    : confirmDelete?.kind === 'pumping'
                      ? 'log.filters.pumping'
                      : confirmDelete?.kind === 'sleep'
                        ? 'log.filters.sleep'
                        : confirmDelete?.kind === 'growth'
                          ? 'log.filters.growth'
                          : confirmDelete?.kind === 'solidFood'
                            ? 'log.filters.solidFood'
                            : confirmDelete?.kind === 'medication'
                              ? 'log.filters.medication'
: confirmDelete?.kind === 'vaccination'
                              ? 'log.filters.vaccination'
                              : confirmDelete?.kind === 'temperature'
                                ? 'log.filters.temperature'
                                : 'log.filters.milestone',
              ),
            })
          }}
        </p>
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
    </template>

    <!-- 奶睡组合弹窗 -->
    <BaseModal :show="sleepFeedOpen" :title="t('dashboard.sleepFeedTitle')" @close="activeTimer.reset(); sleepFeedOpen = false">
      <div class="form-field">
        <label class="form-label">{{ t('feed.typeLabel') }}</label>
        <select v-model="sfType" class="form-input">
          <option v-for="c in FEED_TYPE_CHOICES" :key="c.value" :value="c.value">{{ t(c.label) }}</option>
        </select>
      </div>
      <div v-if="sfType === 'bottle_formula' || sfType === 'bottle_breastmilk'" class="form-field">
        <label class="form-label">{{ t('dashboard.sleepFeedAmount') }}</label>
        <input
          v-model="sfAmount"
          type="number"
          min="0"
          step="5"
          :placeholder="t('dashboard.sleepFeedAmountPh')"
          class="form-input"
          inputmode="numeric"
        />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('feed.startLabel') }}</label>
        <input v-model="sfStart" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.typeLabel') }}</label>
        <select v-model="sfSleepType" class="form-input">
          <option value="nap">{{ t('sleep.types.nap') }}</option>
          <option value="night">{{ t('sleep.types.night') }}</option>
        </select>
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.endLabel') }}</label>
        <input v-model="sfSleepEnd" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.notesLabel') }}（{{ t('common.optional') }}）</label>
        <input v-model="sfNotes" type="text" :placeholder="t('dashboard.sleepFeedNotesPh')" class="form-input" />
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" @click="activeTimer.reset(); sleepFeedOpen = false">{{ t('common.cancel') }}</button>
        <button class="btn btn-primary" @click="saveSleepFeed">{{ t('dashboard.oneTapRecord') }}</button>
      </div>
    </BaseModal>

    <!-- 首次引导添加宝宝弹窗 -->
    <OnboardingModal :show="onboardingOpen" @close="onboardingOpen = false" />

  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  padding: 48px 24px 24px;
}

.welcome-icon {
  font-size: 64px;
  margin-bottom: 12px;
}

.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.welcome-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 22px;
}

.welcome-btn {
  min-width: 220px;
  margin-bottom: 10px;
}

.welcome-btn + .welcome-btn {
  margin-left: 12px;
}

.sleep-feed-btn {
  width: 100%;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  font-weight: 700;
}

.sf-btn-icon {
  font-size: 18px;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 2px 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  flex-shrink: 0;
}

.section-row .section-title {
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}

/* 小屏下统计卡单列展示：双列时图标占位过大、数值与说明文字被挤压换行 */
@media (max-width: 520px) {
  .welcome {
    padding: 32px 12px 20px;
  }

  .welcome-btn {
    min-width: 0;
    width: 100%;
    max-width: 260px;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

/* 小屏下快捷按钮 3×3 网格：按钮更大、触控友好、英文长标签完整显示 */
@media (max-width: 520px) {
  .quick-actions {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
}

/* PC/平板：快捷按钮限宽居中避免拉伸 */
@media (min-width: 900px) {
  .quick-actions {
    margin: 0 auto;
  }
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0; /* 允许 grid track 收缩，避免长标签撑破容器 */
  padding: 10px 6px;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  transition:
    transform 0.12s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.quick-btn:active {
  transform: scale(0.94);
  background: var(--surface-2);
}

.quick-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21px;
  flex-shrink: 0;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.03), var(--shadow-xs);
  transition: transform 0.15s ease;
}

.quick-btn:active .quick-icon {
  transform: scale(0.94);
}

/* 每种记录类型的图标专属渐变色（浅色容器 + 主题色），视觉更有层次 */
.quick-btn.feed .quick-icon {
  background: linear-gradient(135deg, #fde8e0, #f6c9b8);
}

.quick-btn.diaper .quick-icon {
  background: linear-gradient(135deg, #ece5fa, #d5c6f0);
}

.quick-btn.pump .quick-icon {
  background: linear-gradient(135deg, #fbe4f0, #f2c3dc);
}

.quick-btn.sleep .quick-icon {
  background: linear-gradient(135deg, #e3eefb, #c2d8f0);
}

.quick-btn.growth .quick-icon {
  background: linear-gradient(135deg, #e4f4ea, #c2e4d0);
}

.quick-btn.solidFood .quick-icon {
  background: linear-gradient(135deg, #fbead8, #f2d0a8);
}

.quick-btn.medication .quick-icon {
  background: linear-gradient(135deg, #fbe3ea, #f2bfce);
}

.quick-btn.vaccination .quick-icon {
  background: linear-gradient(135deg, #e2f0fb, #bfdcf2);
}

.quick-btn.temperature .quick-icon {
  background: linear-gradient(135deg, #fdf0da, #f5ddae);
}

.quick-btn.milestone .quick-icon {
  background: linear-gradient(135deg, #fdf3dd, #f5e2b4);
}

.quick-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-inline {
  text-align: center;
  padding: 18px 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 14px;
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
