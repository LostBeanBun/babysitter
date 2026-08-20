<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StatCard from '@/components/common/StatCard.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import { useSolidFoodStore } from '@/stores/solidFood'
import { useMedicationStore } from '@/stores/medication'
import { useTemperatureStore } from '@/stores/temperature'
import { useMilestoneStore } from '@/stores/milestone'
import { useVaccinationStore } from '@/stores/vaccination'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { startOfDay, formatDuration, formatAmount } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import {
  recommendedIntervalMs,
  recommendedIntervalLabel,
  avgFeedingIntervalMs,
  sinceLastFeedingMs,
} from '@/utils/feedingGuide'
import { dailyGuide } from '@/utils/dailyGuides'

/** 今日概览：喂奶/疫苗提醒条 + 统计卡 + 每日小结（数据按 now 实时重算） */
const props = defineProps<{ now: number }>()
const emit = defineEmits<{ add: [kind: 'vaccination'] }>()

const { t, locale } = useI18n()
const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()
const solidFoodStore = useSolidFoodStore()
const medicationStore = useMedicationStore()
const temperatureStore = useTemperatureStore()
const milestoneStore = useMilestoneStore()
const vaccinationStore = useVaccinationStore()
const { isPending } = useDeleteUndo()

const todayStart = computed(() => startOfDay(props.now))
const todayEnd = computed(() => todayStart.value + MS_PER_DAY - 1)

function keep<T extends { id?: number }>(items: T[], kind: string): T[] {
  return items.filter((x) => !isPending({ kind, id: x.id! }))
}

const todayFeedings = computed(() =>
  keep(
    feedingStore.feedings.filter((f) => f.startTime >= todayStart.value && f.startTime <= todayEnd.value),
    'feeding',
  ),
)
const todayDiapers = computed(() =>
  keep(diaperStore.diapers.filter((d) => d.time >= todayStart.value && d.time <= todayEnd.value), 'diaper'),
)
const todayPumpings = computed(() =>
  keep(
    pumpingStore.pumpings.filter((p) => p.startTime >= todayStart.value && p.startTime <= todayEnd.value),
    'pumping',
  ),
)
const todaySleeps = computed(() =>
  keep(
    sleepStore.sleeps.filter((s) => s.endTime >= todayStart.value && s.startTime <= todayEnd.value),
    'sleep',
  ),
)
const todayGrowths = computed(() =>
  keep(growthStore.growths.filter((g) => g.date >= todayStart.value && g.date <= todayEnd.value), 'growth'),
)
const todaySolidFoods = computed(() =>
  keep(solidFoodStore.solidFoods.filter((s) => s.time >= todayStart.value && s.time <= todayEnd.value), 'solidFood'),
)
const todayMedications = computed(() =>
  keep(
    medicationStore.medications.filter((m) => m.time >= todayStart.value && m.time <= todayEnd.value),
    'medication',
  ),
)
const todayTemperatures = computed(() =>
  keep(
    temperatureStore.temperatures.filter((tmp) => tmp.time >= todayStart.value && tmp.time <= todayEnd.value),
    'temperature',
  ),
)
const todayMilestones = computed(() =>
  keep(
    milestoneStore.milestones.filter((ms) => ms.time >= todayStart.value && ms.time <= todayEnd.value),
    'milestone',
  ),
)

// —— 疫苗提醒（近 14 天内的待接种项）——
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

const sleepTotal = computed(() =>
  todaySleeps.value.reduce((sum, s) => {
    const s0 = Math.max(s.startTime, todayStart.value)
    const e0 = Math.min(s.endTime, todayEnd.value)
    return sum + Math.max(0, e0 - s0)
  }, 0),
)

const lastFeeding = computed(() => {
  const sorted = [...feedingStore.feedings].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]
})
const lastFeedingLabel = computed(() => {
  if (!lastFeeding.value) return t('common.none')
  const mins = Math.round((props.now - lastFeeding.value.startTime) / 60000)
  if (mins < 60) return t('dashboard.lastFeedMin', { n: mins })
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? t('dashboard.lastFeedHour', { n: h }) : t('dashboard.lastFeedHourMin', { n: h, m })
})

// —— 喂奶间隔分析 ——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const avgGapMs = computed(() => avgFeedingIntervalMs(feedingStore.feedings.map((f) => f.startTime)))
/** 按月龄的每日参考数据（无出生日期时为 null） */
const guide = computed(() => dailyGuide(activeBaby.value))
const sinceMs = computed(() => (lastFeeding.value ? sinceLastFeedingMs(lastFeeding.value.startTime, props.now) : null))
/** 超过建议间隔时提示（实际提醒是否弹出由提醒配置决定） */
const overdue = computed(() => sinceMs.value != null && sinceMs.value > recommendedMs.value)

// —— 每日小结 ——
const summaryOpen = ref(false)
const dailySummary = ref('')
const summaryCopied = ref(false)

function generateSummary() {
  const d = new Date(props.now)
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
  if (todayMilestones.value.length > 0)
    lines.push(t('dashboard.summaryMilestone', { n: todayMilestones.value.length }))
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

defineExpose({ generateSummary })
</script>

<template>
  <div class="today-overview">
    <!-- 喂奶提醒条 -->
    <div v-if="overdue" class="feed-reminder-banner">
      <span class="fr-icon">🍼</span>
      <div class="fr-text">
        <p class="fr-title">{{ t('feed.sinceLast', { duration: formatDuration(sinceMs ?? 0) }) }}</p>
        <p class="fr-sub">{{ t('feed.reminderSub', { label: recommendedIntervalLabel(activeBaby) }) }}</p>
      </div>
    </div>

    <!-- 疫苗提醒条 -->
    <div v-if="upcomingVaccinations.length > 0" class="vaccine-banner" @click="emit('add', 'vaccination')">
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

    <!-- 统计卡 -->
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
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
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
}

/* PC/平板：统计卡 3 列避免单卡过宽 */
@media (min-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>