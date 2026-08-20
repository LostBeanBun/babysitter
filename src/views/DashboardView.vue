<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
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
import PageHeader from '@/components/common/PageHeader.vue'
import StatCard from '@/components/common/StatCard.vue'
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
import { startOfDay, formatDuration, formatAmount, formatTime, toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { MS_PER_DAY, BABY_AVATARS, FEED_TYPE_LABELS } from '@/constants'
import {
  recommendedIntervalMs,
  recommendedIntervalLabel,
  avgFeedingIntervalMs,
  sinceLastFeedingMs,
} from '@/utils/feedingGuide'
import { checkReminders } from '@/utils/reminderScheduler'
import { dailyGuide } from '@/utils/dailyGuides'
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
  FeedType,
  DiaperType,
  DiaperColor,
  DiaperAmount,
  PumpSide,
  SleepType,
  VaccinationStatus,
  TemperatureMethod,
  BabyGender,
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

const { t, locale } = useI18n()

const now = ref(Date.now())
const nowTimer = window.setInterval(() => (now.value = Date.now()), 60_000)
onUnmounted(() => window.clearInterval(nowTimer))

// 无宝宝时显示引导
const hasBaby = computed(() => babyStore.babies.length > 0)
const onboardingOpen = ref(false)
const onboardName = ref('')
const onboardGender = ref<BabyGender | ''>('')
const onboardBirthDate = ref('')
const onboardAvatar = ref('')

function openOnboarding() {
  onboardingOpen.value = true
}

async function onOnboarded() {
  const name = onboardName.value.trim()
  // 名称/性别/出生日期均为必填（出生日期用于月龄换算与生长曲线参考线）
  if (!name || !onboardBirthDate.value || !onboardGender.value) return
  await babyStore.addBaby(
    name,
    onboardGender.value,
    onboardBirthDate.value,
    undefined,
    undefined,
    onboardAvatar.value || undefined,
  )
  onboardName.value = ''
  onboardGender.value = ''
  onboardBirthDate.value = ''
  onboardAvatar.value = ''
  onboardingOpen.value = false
}

// 今日范围
const todayStart = computed(() => startOfDay(now.value))
const todayEnd = computed(() => todayStart.value + MS_PER_DAY - 1)

// 今日数据（按时间过滤）
const todayFeedings = computed(() =>
  feedingStore.feedings.filter((f) => f.startTime >= todayStart.value && f.startTime <= todayEnd.value),
)
const todayDiapers = computed(() =>
  diaperStore.diapers.filter((d) => d.time >= todayStart.value && d.time <= todayEnd.value),
)
const todayPumpings = computed(() =>
  pumpingStore.pumpings.filter((p) => p.startTime >= todayStart.value && p.startTime <= todayEnd.value),
)
const todaySleeps = computed(() =>
  sleepStore.sleeps.filter((s) => s.endTime >= todayStart.value && s.startTime <= todayEnd.value),
)
const todayGrowths = computed(() =>
  growthStore.growths.filter((g) => g.date >= todayStart.value && g.date <= todayEnd.value),
)
const todaySolidFoods = computed(() =>
  solidFoodStore.solidFoods.filter((s) => s.time >= todayStart.value && s.time <= todayEnd.value),
)
const todayMedications = computed(() =>
  medicationStore.medications.filter((m) => m.time >= todayStart.value && m.time <= todayEnd.value),
)
const todayVaccinations = computed(() =>
  vaccinationStore.vaccinations.filter((v) => v.date >= todayStart.value && v.date <= todayEnd.value),
)
const todayTemperatures = computed(() =>
  temperatureStore.temperatures.filter((tmp) => tmp.time >= todayStart.value && tmp.time <= todayEnd.value),
)

// —— 疫苗提醒（今日页卡片：近 14 天内的待接种项）——
const upcomingVaccinations = computed(() => {
  const cutoff = todayStart.value - 14 * MS_PER_DAY
  return vaccinationStore.vaccinations
    .filter((v) => v.status === 'planned' && v.date >= cutoff)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3)
})

function vaccineDaysLeft(date: number): number {
  return Math.round((date - todayStart.value) / MS_PER_DAY)
}

// 今日汇总
const totalMilk = computed(() => todayFeedings.value.reduce((sum, f) => sum + (f.amount ?? 0), 0))
const feedCount = computed(() => todayFeedings.value.length)
/** 今日泵出总量（吸奶产出） */
const pumpTotal = computed(() => todayPumpings.value.reduce((s, p) => s + (p.amount ?? 0), 0))
/** 今日瓶喂母乳消耗量 */
const bottleBreastmilkTotal = computed(() =>
  todayFeedings.value.filter((f) => f.type === 'bottle_breastmilk').reduce((s, f) => s + (f.amount ?? 0), 0),
)
/** 母乳库存 = 泵出 − 瓶喂母乳消耗（可为负：消耗多于泵出） */
const breastStock = computed(() => pumpTotal.value - bottleBreastmilkTotal.value)
const lastFeeding = computed(() => {
  const sorted = [...feedingStore.feedings].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]
})
const lastFeedingLabel = computed(() => {
  if (!lastFeeding.value) return t('common.none')
  const mins = Math.round((now.value - lastFeeding.value.startTime) / 60000)
  if (mins < 60) return t('dashboard.lastFeedMin', { n: mins })
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? t('dashboard.lastFeedHour', { n: h }) : t('dashboard.lastFeedHourMin', { n: h, m })
})

// —— 提醒调度（喂奶/睡眠/用药/疫苗/尿布，默认关闭，由用户自行开启）——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const avgGapMs = computed(() => avgFeedingIntervalMs(feedingStore.feedings.map((f) => f.startTime)))
/** 按月龄的每日参考数据（无出生日期时为 null） */
const guide = computed(() => dailyGuide(activeBaby.value))
const sinceMs = computed(() => (lastFeeding.value ? sinceLastFeedingMs(lastFeeding.value.startTime, now.value) : null))
/** 超过建议间隔时提示（实际提醒是否弹出由提醒配置决定） */
const overdue = computed(() => sinceMs.value != null && sinceMs.value > recommendedMs.value)
watch(now, () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const hits = checkReminders({
    now: now.value,
    baby: activeBaby.value,
    feedings: feedingStore.feedings,
    medications: medicationStore.medications,
    vaccinations: vaccinationStore.vaccinations,
    diapers: diaperStore.diapers,
  })
  hits.forEach((h) => new Notification(h.title, { body: h.body, tag: h.tag }))
})
const sleepTotal = computed(() =>
  todaySleeps.value.reduce((sum, s) => {
    const s0 = Math.max(s.startTime, todayStart.value)
    const e0 = Math.min(s.endTime, todayEnd.value)
    return sum + Math.max(0, e0 - s0)
  }, 0),
)

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
  sleepFeedOpen.value = false
  sfType.value = 'breast_both'
  sfAmount.value = ''
  sfStart.value = toDateTimeLocal(Date.now())
  sfSleepType.value = 'nap'
  sfSleepEnd.value = toDateTimeLocal(Date.now() + 2 * 3600_000)
  sfNotes.value = ''
}

// —— 每日小结 ——
const summaryOpen = ref(false)
const dailySummary = ref('')
const summaryCopied = ref(false)

function generateSummary() {
  const d = new Date(now.value)
  const dateLabel = new Intl.DateTimeFormat(locale.value, { month: 'long', day: 'numeric' }).format(d)
  const pumpSum = pumpTotal.value
  const feedAmountPart =
    totalMilk.value > 0 ? t('dashboard.summaryFeedAmount', { amount: formatAmount(totalMilk.value) }) : ''
  const pumpAmountPart = pumpSum > 0 ? t('dashboard.summaryPumpAmount', { amount: formatAmount(pumpSum) }) : ''
  const lines = [
    t('dashboard.daySummary', { name: activeBaby.value?.name ?? t('common.baby'), date: dateLabel }),
    t('dashboard.summaryFeed', { n: feedCount.value, amount: feedAmountPart }),
    t('dashboard.summarySleep', { duration: formatDuration(sleepTotal.value) }),
    t('dashboard.summaryDiaper', { n: todayDiapers.value.length }),
    t('dashboard.summaryPump', { n: todayPumpings.value.length, amount: pumpAmountPart }),
    t('dashboard.summaryGrowth', { n: todayGrowths.value.length }),
  ]
  if (todaySolidFoods.value.length > 0) lines.push(t('dashboard.summarySolidFood', { n: todaySolidFoods.value.length }))
  if (todayMedications.value.length > 0)
    lines.push(t('dashboard.summaryMedication', { n: todayMedications.value.length }))
  if (todayTemperatures.value.length > 0)
    lines.push(t('dashboard.summaryTemperature', { n: todayTemperatures.value.length }))
  dailySummary.value = lines.join('\n')
  summaryCopied.value = false
  summaryOpen.value = true
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(dailySummary.value)
    summaryCopied.value = true
    setTimeout(() => (summaryCopied.value = false), 2000)
  } catch {
    alert(t('dashboard.copyFailed'))
  }
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
  editing?: TimelineEntry
} | null>(null)
const confirmDelete = ref<TimelineEntry | null>(null)

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
    | 'temperature',
) {
  modalState.value = { kind }
}

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
  else if (e.kind === 'growth') await growthStore.remove(e.id)
  else if (e.kind === 'solidFood') await solidFoodStore.remove(e.id)
  else if (e.kind === 'medication') await medicationStore.remove(e.id)
  else if (e.kind === 'vaccination') await vaccinationStore.remove(e.id)
  else await temperatureStore.remove(e.id)
  confirmDelete.value = null
}

function onSaved() {
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
  const tmp = e.raw as Temperature
  return { id: e.id, time: tmp.time, value: tmp.value, method: tmp.method, notes: tmp.notes }
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
      <button class="btn btn-primary btn-lg welcome-btn" @click="openOnboarding">{{ t('dashboard.startBtn') }}</button>
      <button class="btn btn-outline welcome-btn" @click="$router.push('/settings')">
        {{ t('dashboard.importHint') }}
      </button>
    </div>

    <template v-else>
      <!-- 喂奶提醒条 -->
      <div v-if="overdue" class="feed-reminder-banner">
        <span class="fr-icon">🍼</span>
        <div class="fr-text">
          <p class="fr-title">{{ t('feed.sinceLast', { duration: formatDuration(sinceMs ?? 0) }) }}</p>
          <p class="fr-sub">{{ t('feed.reminderSub', { label: recommendedIntervalLabel(activeBaby) }) }}</p>
        </div>
      </div>

      <!-- 疫苗提醒条 -->
      <div v-if="upcomingVaccinations.length > 0" class="vaccine-banner" @click="openAdd('vaccination')">
        <span class="vb-icon">💉</span>
        <div class="vb-text">
          <p class="vb-title">{{ t('dashboard.vaccineReminderTitle') }}</p>
          <p class="vb-sub">
            <span v-for="v in upcomingVaccinations" :key="v.id" class="vb-item">
              {{ v.name }}<template v-if="v.dose"> · {{ v.dose }}</template>
              <span class="vb-days">
                {{
                  vaccineDaysLeft(v.date) === 0
                    ? t('dashboard.vaccineToday')
                    : vaccineDaysLeft(v.date) > 0
                      ? t('dashboard.vaccineDaysLeft', { n: vaccineDaysLeft(v.date) })
                      : t('dashboard.vaccineOverdue', { n: -vaccineDaysLeft(v.date) })
                }}
              </span>
            </span>
          </p>
        </div>
      </div>

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
      </div>

      <!-- 奶睡一键（与快捷记录同组） -->
      <button class="btn btn-outline sleep-feed-btn" @click="sleepFeedOpen = true">
        <span class="sf-btn-icon">🍼😴</span>
        <span>{{ t('dashboard.sleepFeedButton') }}</span>
      </button>

      <!-- 今日概览（统计卡 + 喂奶间隔分析） -->
      <p class="section-title">{{ t('dashboard.todayOverview') }}</p>
      <div class="stats-grid">
        <StatCard
          :label="t('dashboard.statLastFeed')"
          :value="lastFeedingLabel"
          :sub="lastFeeding ? [t('feed.suggested', { label: recommendedIntervalLabel(activeBaby) }), avgGapMs != null ? t('dashboard.avgIntervalInline', { value: formatDuration(avgGapMs) }) : undefined] : undefined"
          icon="🍼"
          color="#E8906C"
        />
        <StatCard
          :label="t('dashboard.statMilk')"
          :value="formatAmount(totalMilk) || '0 ml'"
          :sub="[
            t('common.times', { n: feedCount }),
            t('dashboard.milkStock', { pumped: formatAmount(pumpTotal), stock: formatAmount(breastStock) }),
            guide ? t('dashboard.guideMilk', { value: guide.milk }) : undefined,
          ]"
          icon="🥛"
          color="#C4A8E0"
        />
        <StatCard
          :label="t('dashboard.statSleep')"
          :value="formatDuration(sleepTotal)"
          :sub="guide ? t('dashboard.guideSleep', { value: guide.sleep }) : undefined"
          icon="😴"
          color="#8FAED8"
        />
        <StatCard
          :label="t('dashboard.statDiaper')"
          :value="t('common.times', { n: todayDiapers.length })"
          :sub="guide ? t('dashboard.guideDiaper', { value: guide.diaper }) : undefined"
          icon="🧷"
          color="#9A8FC8"
        />
      </div>

      <!-- 今日记录 -->
      <div class="section-row">
        <p class="section-title">{{ t('dashboard.todayRecords') }}</p>
        <button class="btn btn-sm btn-outline" @click="generateSummary">{{ t('dashboard.summaryButton') }}</button>
      </div>
      <div class="card">
        <TimelineList
          v-if="
            todayFeedings.length +
              todayDiapers.length +
              todayPumpings.length +
              todaySleeps.length +
              todayGrowths.length +
              todaySolidFoods.length +
              todayMedications.length +
              todayVaccinations.length +
              todayTemperatures.length >
            0
          "
          :feedings="todayFeedings"
          :diapers="todayDiapers"
          :pumpings="todayPumpings"
          :sleeps="todaySleeps"
          :growths="todayGrowths"
          :solid-foods="todaySolidFoods"
          :medications="todayMedications"
          :vaccinations="todayVaccinations"
          :temperatures="todayTemperatures"
          :deleting-key="confirmDelete ? confirmDelete.kind + '-' + confirmDelete.id : null"
          @edit="onEdit"
          @delete="onDelete"
        />
        <div v-else class="empty-inline">
          <p>{{ t('dashboard.noRecords') }}</p>
        </div>
      </div>

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
                                : 'log.filters.temperature',
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
    <BaseModal :show="sleepFeedOpen" :title="t('dashboard.sleepFeedTitle')" @close="sleepFeedOpen = false">
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
        <button class="btn btn-outline" @click="sleepFeedOpen = false">{{ t('common.cancel') }}</button>
        <button class="btn btn-primary" @click="saveSleepFeed">{{ t('dashboard.oneTapRecord') }}</button>
      </div>
    </BaseModal>

    <!-- 今日小结弹窗 -->
    <BaseModal :show="summaryOpen" :title="t('dashboard.summaryTitle')" @close="summaryOpen = false">
      <pre class="summary-text">{{ dailySummary }}</pre>
      <div class="form-actions">
        <button class="btn btn-outline" @click="summaryOpen = false">{{ t('common.close') }}</button>
        <button class="btn btn-primary" @click="copySummary">
          {{ summaryCopied ? t('common.copied') : t('dashboard.summaryCopy') }}
        </button>
      </div>
    </BaseModal>

    <!-- 首次引导添加宝宝弹窗 -->
    <BaseModal :show="onboardingOpen" :title="t('settings.addBaby')" @close="onboardingOpen = false">
      <div class="form-field">
        <label class="form-label">{{ t('settings.babyName') }} *</label>
        <input v-model="onboardName" type="text" :placeholder="t('dashboard.onboardingNamePh')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.birthDate') }} *</label>
        <input v-model="onboardBirthDate" type="date" :placeholder="t('common.selectDate')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.genderLabel') }} *</label>
        <div class="gender-picker" role="radiogroup">
          <button
            type="button"
            class="gender-option"
            :class="{ selected: onboardGender === 'boy' }"
            :aria-checked="onboardGender === 'boy'"
            role="radio"
            @click="onboardGender = 'boy'"
          >
            <span class="gender-emoji">👦</span>{{ t('settings.genderBoy') }}
          </button>
          <button
            type="button"
            class="gender-option"
            :class="{ selected: onboardGender === 'girl' }"
            :aria-checked="onboardGender === 'girl'"
            role="radio"
            @click="onboardGender = 'girl'"
          >
            <span class="gender-emoji">👧</span>{{ t('settings.genderGirl') }}
          </button>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.avatarLabel') }}</label>
        <div class="avatar-picker">
          <button
            v-for="a in BABY_AVATARS"
            :key="a"
            type="button"
            class="avatar-option"
            :class="{ selected: onboardAvatar === a }"
            @click="onboardAvatar = a"
          >
            {{ a }}
          </button>
        </div>
      </div>
      <button
        class="btn btn-primary btn-block btn-lg"
        :disabled="!onboardName.trim() || !onboardBirthDate || !onboardGender"
        @click="onOnboarded"
      >
        {{ t('common.start') }}
      </button>
    </BaseModal>
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.feed-reminder-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-yellow-soft));
  border: 1px solid rgba(238, 122, 85, 0.28);
  border-radius: var(--radius-lg);
  padding: 11px 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-xs);
}

.feed-reminder-banner .fr-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.feed-reminder-banner .fr-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.feed-reminder-banner .fr-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* 疫苗提醒条 */
.vaccine-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--accent-blue-soft), var(--surface));
  border: 1px solid rgba(130, 174, 222, 0.32);
  border-radius: var(--radius-lg);
  padding: 11px 14px;
  margin-bottom: 10px;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition:
    transform 0.12s ease,
    box-shadow 0.15s ease;
}

.vaccine-banner:active {
  transform: scale(0.99);
  box-shadow: var(--shadow-sm);
}

.vaccine-banner .vb-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.vaccine-banner .vb-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.vaccine-banner .vb-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

.vb-days {
  color: var(--accent-blue);
  font-weight: 700;
  margin-left: 4px;
}

.interval-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 10px;
  padding: 12px 10px;
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

.summary-text {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text);
  background: var(--surface-2);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}

.interval-item {
  text-align: center;
}

.interval-label {
  font-size: 11px;
  color: var(--text-muted);
}

.interval-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
}

.interval-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.5;
}

/* 统一卡片高度：网格内不受全局 .card + .card 相邻外边距规则影响，
   避免同一行卡片因 margin-top 差异导致高度参差不齐 */
.stats-grid .stat-card {
  margin: 0;
  min-height: 84px;
}

/* 小屏下统计卡单列展示：双列时图标占位过大、数值与说明文字被挤压换行 */
@media (max-width: 520px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stats-grid .stat-card {
    min-height: 80px;
  }

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

/* PC/平板：统计卡 3 列避免单卡过宽；快捷按钮限宽居中避免拉伸 */
@media (min-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

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

.avatar-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.avatar-option {
  min-height: 40px;
  padding: 4px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.avatar-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  transform: scale(1.06);
}

.gender-picker {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.gender-option {
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;
}

.gender-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
  transform: scale(1.02);
}

.gender-emoji {
  font-size: 16px;
}
</style>
