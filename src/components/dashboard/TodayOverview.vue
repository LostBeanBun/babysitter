<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useVaccinationStore } from '@/stores/vaccination'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { startOfDay, formatDuration, formatAmount, formatTime } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import { recommendedIntervalMs, recommendedIntervalLabel } from '@/utils/feedingGuide'
import { dailyGuide } from '@/utils/dailyGuides'

/** 今日概览：喂奶/疫苗提醒条 + 统计卡 + 每日小结（数据按 now 实时重算） */
const props = defineProps<{ now: number }>()
const emit = defineEmits<{ add: [kind: 'vaccination'] }>()

/**
 * 提醒条关闭状态（会话级，仅内存）：关闭后当前会话不再显示，刷新页面即重新提醒。
 * 提醒基于实时数据（如喂奶间隔），跨天重新提醒没有意义，故不持久化。
 */
const dismissed = ref<{ feed: boolean; vaccine: boolean }>({ feed: false, vaccine: false })

/** 关闭某提醒条（当前会话生效） */
function dismissReminder(kind: 'feed' | 'vaccine') {
  dismissed.value = { ...dismissed.value, [kind]: true }
}

const { t } = useI18n()
const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
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
    sleepStore.sleeps.filter((s) => (s.endTime ?? s.startTime) >= todayStart.value && s.startTime <= todayEnd.value),
    'sleep',
  ),
)
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
    const e0 = Math.min(s.endTime ?? s.startTime, todayEnd.value)
    return sum + Math.max(0, e0 - s0)
  }, 0),
)

// —— 喂奶提醒 ——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const lastFeeding = computed(() => {
  const sorted = [...feedingStore.feedings].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]
})
const lastSleep = computed(() => {
  const sorted = [...sleepStore.sleeps].sort((a, b) => (b.endTime ?? b.startTime) - (a.endTime ?? a.startTime))
  return sorted[0]
})
const sinceMs = computed(() => {
  if (!lastFeeding.value) return null
  const end = lastFeeding.value.endTime ?? lastFeeding.value.startTime
  return props.now - end
})
const sinceSleepMs = computed(() => {
  if (!lastSleep.value) return null
  const end = lastSleep.value.endTime ?? lastSleep.value.startTime
  return props.now - end
})
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const overdue = computed(() => sinceMs.value != null && sinceMs.value > recommendedMs.value)
/** 按月龄的每日参考数据（无出生日期时为 null） */
const guide = computed(() => dailyGuide(activeBaby.value))

</script>

<template>
  <div class="today-overview">
    <!-- 喂奶提醒条 -->
    <div v-if="overdue && !dismissed.feed" class="feed-reminder-banner">
      <span class="fr-icon">🍼</span>
      <div class="fr-text">
        <p class="fr-title">{{ t('feed.sinceLast', { duration: formatDuration(sinceMs ?? 0) }) }}</p>
        <p class="fr-sub">{{ t('feed.reminderSub', { label: recommendedIntervalLabel(activeBaby) }) }}</p>
      </div>
      <button
        type="button"
        class="banner-close"
        :aria-label="t('common.close')"
        :title="t('common.close')"
        @click="dismissReminder('feed')"
      >
        ✕
      </button>
    </div>

    <!-- 疫苗提醒条 -->
    <div
      v-if="upcomingVaccinations.length > 0 && !dismissed.vaccine"
      class="vaccine-banner"
      @click="emit('add', 'vaccination')"
    >
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
      <button
        type="button"
        class="banner-close"
        :aria-label="t('common.close')"
        :title="t('common.close')"
        @click.stop="dismissReminder('vaccine')"
      >
        ✕
      </button>
    </div>

<!-- 统计卡 -->
      <p class="section-title">{{ t('dashboard.todayOverview') }}</p>
      <div class="stats-grid">
      <!-- 奶量卡片 -->
      <div class="detail-card">
        <div class="dc-header">
          <span class="dc-icon" style="background: #C4A8E033; color: #C4A8E0;">🥛</span>
          <span class="dc-title">{{ t('dashboard.statMilk') }}</span>
        </div>
        <p class="dc-primary" style="color: #C4A8E0;">{{ formatAmount(totalMilk) || '0 ml' }}</p>
        <div class="dc-body">
          <p class="dc-row">
            <span class="dc-key">{{ t('dashboard.feedCount') }}</span>
            <span class="dc-val">{{ feedCount }}{{ t('common.timesShort') }}</span>
          </p>
          <p v-if="lastFeeding" class="dc-row hl-warn">
            <span class="dc-key">{{ t('dashboard.lastFeedingEnd') }}</span>
            <span class="dc-val">{{ formatTime(lastFeeding.endTime ?? lastFeeding.startTime) }}<template v-if="sinceMs != null">, {{ formatDuration(sinceMs) }}{{ t('common.ago') }}</template></span>
          </p>
          <p v-if="guide" class="dc-row dc-guide">
            <span class="dc-key">{{ t('dashboard.guideDaily') }}</span>
            <span class="dc-val">{{ guide.milk }}</span>
          </p>
          <p class="dc-row">
            <span class="dc-key">{{ t('dashboard.pumpCount') }}</span>
            <span class="dc-val">{{ todayPumpings.length }}{{ t('common.timesShort') }}</span>
          </p>
          <p class="dc-row">
            <span class="dc-key">{{ t('dashboard.breastStock') }}</span>
            <span class="dc-val">{{ formatAmount(breastStock) }}</span>
          </p>
        </div>
      </div>
      <!-- 睡眠卡片 -->
      <div class="detail-card">
        <div class="dc-header">
          <span class="dc-icon" style="background: #8FAED833; color: #8FAED8;">😴</span>
          <span class="dc-title">{{ t('dashboard.statSleep') }}</span>
        </div>
        <p class="dc-primary" style="color: #8FAED8;">{{ formatDuration(sleepTotal) }}</p>
        <div class="dc-body">
          <p v-if="lastSleep" class="dc-row hl-warn">
            <span class="dc-key">{{ t('dashboard.lastSleepEnd') }}</span>
            <span class="dc-val">{{ formatTime(lastSleep.endTime ?? lastSleep.startTime) }}<template v-if="sinceSleepMs != null && sinceSleepMs >= 0">, {{ formatDuration(sinceSleepMs) }}{{ t('common.ago') }}</template></span>
          </p>
          <p v-if="guide" class="dc-row dc-guide">
            <span class="dc-key">{{ t('dashboard.guideDaily') }}</span>
            <span class="dc-val">{{ guide.sleep }}</span>
          </p>
        </div>
      </div>
      <!-- 尿布卡片 -->
      <div class="detail-card">
        <div class="dc-header">
          <span class="dc-icon" style="background: #9A8FC833; color: #9A8FC8;">🧷</span>
          <span class="dc-title">{{ t('dashboard.statDiaper') }}</span>
        </div>
        <p class="dc-primary" style="color: #9A8FC8;">{{ todayDiapers.length }}{{ t('common.timesShort') }}</p>
        <div class="dc-body">
          <p v-if="guide" class="dc-row dc-guide">
            <span class="dc-key">{{ t('dashboard.guideDaily') }}</span>
            <span class="dc-val">{{ guide.diaper }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.detail-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  padding: 8px 10px 9px;
}

.dc-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.dc-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.dc-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.3px;
}

/* 主数值：最重要，最大字号 */
.dc-primary {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.dc-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dc-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
  line-height: 1.45;
}

/* 键名：次要信息，小号 */
.dc-key {
  font-size: 11px;
  color: var(--text-muted);
}

/* 键值：次要信息，与键名同级 */
.dc-val {
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 高亮行：上次结束时间，警示色 */
.dc-row.hl-warn .dc-key {
  color: var(--primary);
  font-weight: 600;
}
.dc-row.hl-warn .dc-val {
  color: var(--primary);
  font-weight: 600;
  background: var(--primary-soft);
  border-radius: 3px;
  padding: 0 3px;
  margin: 0 -3px;
}

/* 参考行：辅助信息，最弱 */
.dc-guide .dc-key,
.dc-guide .dc-val {
  color: var(--text-muted);
  font-style: italic;
}

.feed-reminder-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-yellow-soft));
  border: 1px solid rgba(238, 122, 85, 0.28);
  border-radius: var(--radius-lg);
  padding: 9px 12px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-xs);
}

.feed-reminder-banner .fr-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.feed-reminder-banner .fr-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.feed-reminder-banner .fr-text {
  flex: 1;
  min-width: 0;
}

.feed-reminder-banner .fr-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 1px;
}

/* 提醒条右上角关闭按钮（喂奶/疫苗共用） */
.banner-close {
  width: 22px;
  height: 22px;
  min-height: 0;
  margin-left: auto;
  flex-shrink: 0;
  border-radius: 50%;
  color: var(--text-muted);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.banner-close:hover {
  color: var(--text);
  background: var(--surface-2);
}

.banner-close:active {
  transform: scale(0.9);
}

/* 疫苗提醒条 */
.vaccine-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--accent-blue-soft), var(--surface));
  border: 1px solid rgba(130, 174, 222, 0.32);
  border-radius: var(--radius-lg);
  padding: 9px 12px;
  margin-bottom: 8px;
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
  font-size: 24px;
  flex-shrink: 0;
}

.vaccine-banner .vb-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.vaccine-banner .vb-text {
  flex: 1;
  min-width: 0;
}

.vaccine-banner .vb-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px 12px;
}

.vb-days {
  color: var(--accent-blue);
  font-weight: 700;
  margin-left: 3px;
}

@media (max-width: 520px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>