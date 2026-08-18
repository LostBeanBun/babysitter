<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import PageHeader from '@/components/common/PageHeader.vue'
import StatCard from '@/components/common/StatCard.vue'
import TimelineList, { type TimelineEntry } from '@/components/timeline/TimelineList.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FeedingForm from '@/components/forms/FeedingForm.vue'
import DiaperForm from '@/components/forms/DiaperForm.vue'
import PumpingForm from '@/components/forms/PumpingForm.vue'
import SleepForm from '@/components/forms/SleepForm.vue'
import GrowthForm from '@/components/forms/GrowthForm.vue'
import { startOfDay, formatDuration, formatAmount, toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { MS_PER_DAY, BABY_AVATARS, FEED_TYPE_LABELS } from '@/constants'
import {
  recommendedIntervalMs,
  recommendedIntervalLabel,
  avgFeedingIntervalMs,
  sinceLastFeedingMs,
  isFeedReminderOn,
} from '@/utils/feedingGuide'
import type {
  Feeding,
  DiaperChange,
  Pumping,
  Sleep,
  GrowthRecord,
  FeedType,
  DiaperType,
  DiaperColor,
  DiaperAmount,
  PumpSide,
  SleepType,
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

const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()

const { t, locale } = useI18n()

const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 60_000)

// 无宝宝时显示引导
const hasBaby = computed(() => babyStore.babies.length > 0)
const onboardingOpen = ref(false)
const onboardName = ref('')
const onboardBirthDate = ref('')
const onboardAvatar = ref('')

function openOnboarding() {
  onboardingOpen.value = true
}

async function onOnboarded() {
  const name = onboardName.value.trim()
  if (!name) return
  await babyStore.addBaby(
    name,
    undefined,
    onboardBirthDate.value || undefined,
    undefined,
    undefined,
    onboardAvatar.value || undefined,
  )
  onboardName.value = ''
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

// 今日汇总
const totalMilk = computed(() => todayFeedings.value.reduce((sum, f) => sum + (f.amount ?? 0), 0))
const feedCount = computed(() => todayFeedings.value.length)
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

// —— 喂奶间隔分析与提醒 ——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const feedReminderOn = ref(isFeedReminderOn())
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const avgGapMs = computed(() => avgFeedingIntervalMs(feedingStore.feedings.map((f) => f.startTime)))
const sinceMs = computed(() => (lastFeeding.value ? sinceLastFeedingMs(lastFeeding.value.startTime, now.value) : null))
/** 超过建议间隔且开关开启时提示 */
const overdue = computed(() => feedReminderOn.value && sinceMs.value != null && sinceMs.value > recommendedMs.value)
let lastNotifiedAt = 0
watch(now, () => {
  if (!overdue.value || !sinceMs.value) return
  if (Date.now() - lastNotifiedAt < 5 * 60_000) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(t('feed.reminderTitle'), {
    body: t('feed.notificationBody', {
      duration: formatDuration(sinceMs.value),
      label: recommendedIntervalLabel(activeBaby.value),
    }),
    tag: 'feed-reminder',
  })
  lastNotifiedAt = Date.now()
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
const sfType = ref<FeedType>('bottle_breastmilk')
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
  sfType.value = 'bottle_breastmilk'
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
  const pumpTotal = todayPumpings.value.reduce((s, p) => s + (p.amount ?? 0), 0)
  const feedAmountPart =
    totalMilk.value > 0 ? t('dashboard.summaryFeedAmount', { amount: formatAmount(totalMilk.value) }) : ''
  const pumpAmountPart = pumpTotal > 0 ? t('dashboard.summaryPumpAmount', { amount: formatAmount(pumpTotal) }) : ''
  const lines = [
    t('dashboard.daySummary', { name: activeBaby.value?.name ?? t('common.baby'), date: dateLabel }),
    t('dashboard.summaryFeed', { n: feedCount.value, amount: feedAmountPart }),
    t('dashboard.summarySleep', { duration: formatDuration(sleepTotal.value) }),
    t('dashboard.summaryDiaper', { n: todayDiapers.value.length }),
    t('dashboard.summaryPump', { n: todayPumpings.value.length, amount: pumpAmountPart }),
    t('dashboard.summaryGrowth', { n: todayGrowths.value.length }),
  ]
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
const modalState = ref<{ kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth'; editing?: TimelineEntry } | null>(
  null,
)
const confirmDelete = ref<TimelineEntry | null>(null)

function openAdd(kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth') {
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
  else await growthStore.remove(e.id)
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
  const g = e.raw as GrowthRecord
  return { id: e.id, date: g.date, weight: g.weight, height: g.height, notes: g.notes }
})
</script>

<template>
  <div class="page dashboard">
    <PageHeader>
      <template #right>
        <span class="date-badge">{{
          new Date(now).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })
        }}</span>
      </template>
    </PageHeader>

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

      <!-- 今日汇总 -->
      <div class="stats-grid">
        <StatCard
          :label="t('dashboard.statLastFeed')"
          :value="lastFeedingLabel"
          :sub="lastFeeding ? t('feed.suggested', { label: recommendedIntervalLabel(activeBaby) }) : undefined"
          icon="🍼"
          color="#E8906C"
        />
        <StatCard
          :label="t('dashboard.statMilk')"
          :value="formatAmount(totalMilk) || '0 ml'"
          icon="🥛"
          color="#C4A8E0"
        />
        <StatCard
          :label="t('dashboard.statFeedCount')"
          :value="t('common.times', { n: feedCount })"
          icon="🍽️"
          color="#F2A28C"
        />
        <StatCard :label="t('dashboard.statSleep')" :value="formatDuration(sleepTotal)" icon="😴" color="#8FAED8" />
        <StatCard
          :label="t('dashboard.statDiaper')"
          :value="t('common.times', { n: todayDiapers.length })"
          icon="🧷"
          color="#9A8FC8"
        />
        <StatCard
          :label="t('dashboard.statPump')"
          :value="t('common.times', { n: todayPumpings.length })"
          :sub="formatAmount(todayPumpings.reduce((s, p) => s + (p.amount ?? 0), 0)) || undefined"
          icon="🎀"
          color="#D8A8C8"
        />
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
        <button class="quick-btn pump" @click="openAdd('pumping')">
          <span class="quick-icon">🎀</span>
          <span class="quick-label">{{ t('log.filters.pumping') }}</span>
        </button>
        <button class="quick-btn sleep" @click="openAdd('sleep')">
          <span class="quick-icon">😴</span>
          <span class="quick-label">{{ t('log.filters.sleep') }}</span>
        </button>
        <button class="quick-btn growth" @click="openAdd('growth')">
          <span class="quick-icon">📏</span>
          <span class="quick-label">{{ t('log.filters.growth') }}</span>
        </button>
      </div>

      <!-- 喂奶间隔分析 -->
      <div v-if="avgGapMs != null" class="interval-card card">
        <div class="interval-item">
          <p class="interval-label">{{ t('dashboard.avgInterval') }}</p>
          <p class="interval-value">{{ formatDuration(avgGapMs) }}</p>
        </div>
        <div class="interval-item">
          <p class="interval-label">{{ activeBaby?.birthDate ? t('feed.intervalByAge') : t('feed.intervalLabel') }}</p>
          <p class="interval-value">{{ recommendedIntervalLabel(activeBaby) }}</p>
        </div>
      </div>

      <!-- 奶睡一键 -->
      <button class="btn btn-outline sleep-feed-btn" @click="sleepFeedOpen = true">
        <span class="sf-btn-icon">🍼😴</span>
        <span>{{ t('dashboard.sleepFeedButton') }}</span>
      </button>

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
              todayGrowths.length >
            0
          "
          :feedings="todayFeedings"
          :diapers="todayDiapers"
          :pumpings="todayPumpings"
          :sleeps="todaySleeps"
          :growths="todayGrowths"
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
                        : 'log.filters.growth',
              ),
            })
          }}
        </p>
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
        <input v-model="sfStart" type="datetime-local" class="form-input" />
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
        <input v-model="sfSleepEnd" type="datetime-local" class="form-input" />
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
        <label class="form-label">{{ t('settings.birthDate') }}</label>
        <input v-model="onboardBirthDate" type="date" class="form-input" />
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
      <button class="btn btn-primary btn-block btn-lg" :disabled="!onboardName.trim()" @click="onOnboarded">
        {{ t('common.start') }}
      </button>
    </BaseModal>
  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  padding: 60px 24px 30px;
}

.welcome-icon {
  font-size: 64px;
  margin-bottom: 16px;
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
  margin-bottom: 28px;
}

.welcome-btn {
  min-width: 220px;
  margin-bottom: 10px;
}

.welcome-btn + .welcome-btn {
  margin-left: 12px;
}

.date-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface);
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.feed-reminder-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--primary-soft);
  border: 1.5px solid var(--primary);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 12px;
}

.feed-reminder-banner .fr-icon {
  font-size: 26px;
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

.interval-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 12px;
  padding: 14px 12px;
}

.sleep-feed-btn {
  width: 100%;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-weight: 700;
}

.sf-btn-icon {
  font-size: 18px;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 2px 10px;
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
  padding: 14px;
  margin-bottom: 16px;
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

/* 统一卡片高度：网格内不受全局 .card + .card 相邻外边距规则影响，
   避免同一行卡片因 margin-top 差异导致高度参差不齐 */
.stats-grid .stat-card {
  margin: 0;
  min-height: 88px;
}

/* 小屏下统计卡更紧凑，避免长数值溢出 */
@media (max-width: 400px) {
  .stats-grid {
    gap: 8px;
  }

  .stats-grid .stat-card {
    min-height: 84px;
  }

  .welcome {
    padding: 40px 12px 24px;
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
  gap: 10px;
}

/* 小屏下快捷按钮更紧凑 */
@media (max-width: 400px) {
  .quick-actions {
    gap: 8px;
  }

  .quick-btn {
    padding: 12px 4px;
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
  gap: 6px;
  padding: 14px 8px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}

.quick-btn:active {
  transform: scale(0.95);
}

.quick-icon {
  font-size: 24px;
}

.quick-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-inline {
  text-align: center;
  padding: 24px 12px;
  color: var(--text-muted);
  font-size: 13px;
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
</style>
