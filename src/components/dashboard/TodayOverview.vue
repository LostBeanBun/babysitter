<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useVaccinationStore } from '@/stores/vaccination'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { useDismissedReminders } from '@/composables/useDismissedReminders'
import ReminderBanner from '@/components/common/ReminderBanner.vue'
import { exportJsonBackup, getLastBackupAt, shouldSuggestBackup } from '@/services/backup'
import { isSnoozed, snoozeReminder } from '@/utils/reminderScheduler'
import { startOfDay, formatDuration, formatAmount, formatTime } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import { computeTodayStats } from '@/services/todayStats'
import { upcomingVaccinations, vaccineDaysLeft } from '@/services/reminders'
import { recommendedIntervalMs, recommendedIntervalLabel } from '@/utils/feedingGuide'
import { dailyGuide } from '@/utils/dailyGuides'
import type { Vaccination } from '@/types'

/** 今日概览：喂奶/疫苗提醒条 + 统计卡 + 每日小结（数据按 now 实时重算） */
const props = defineProps<{ now: number }>()
const emit = defineEmits<{ edit: [v: Vaccination] }>()

const { t } = useI18n()
const router = useRouter()
const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const vaccinationStore = useVaccinationStore()
const { isPending } = useDeleteUndo()
const { dismissed, dismiss } = useDismissedReminders()

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
  const upcomingVaccinationsList = computed(() =>
  upcomingVaccinations(vaccinationStore.vaccinations, todayStart.value),
)

/** 疫苗提醒条内容芯片：名称 · 剂次 + 距接种日文案 */
const vaccineChips = computed(() =>
  upcomingVaccinationsList.value.map((v) => {
    const n = vaccineDaysLeft(v.date, todayStart.value)
    const badge =
      n === 0
        ? t('dashboard.vaccineToday')
        : n > 0
          ? t('dashboard.vaccineDaysLeft', { n })
          : t('dashboard.vaccineOverdue', { n: -n })
    return { key: v.id!, label: v.dose ? `${v.name} · ${v.dose}` : v.name, badge }
  }),
)

/** 点击提醒条/单个芯片：编辑对应计划记录 */
function onSelectVaccination(key: number | string) {
  const v = vaccinationStore.vaccinations.find((x) => x.id === key)
  if (v) emit('edit', v)
}

/** 全部待种计划数（提醒条只展示最近 3 条，其余仅在记录页疫苗筛选中可见/可改） */
const plannedVaccineCount = computed(() => vaccinationStore.vaccinations.filter((v) => v.status === 'planned').length)

/** 「全部 N 条」→ 记录页疫苗筛选（可逐条选择修改保存） */
function openAllVaccinations() {
  router.push('/log?filter=vaccination')
}

// 今日汇总
const stats = computed(() =>
  computeTodayStats({
    feedings: todayFeedings.value,
    diapers: todayDiapers.value,
    pumpings: todayPumpings.value,
    sleeps: todaySleeps.value,
    todayStart: todayStart.value,
    todayEnd: todayEnd.value,
  }),
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
const lastDiaper = computed(() => {
  const sorted = [...diaperStore.diapers].sort((a, b) => b.time - a.time)
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
const sinceDiaperMs = computed(() => {
  if (!lastDiaper.value) return null
  return props.now - lastDiaper.value.time
})
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const overdue = computed(() => sinceMs.value != null && sinceMs.value > recommendedMs.value)

// —— 稍后提醒：15 分钟内隐藏横幅并抑制系统通知（snoozeTick 让点击后立即重算）——
const snoozeTick = ref(0)
const feedSnoozed = computed(() => {
  void snoozeTick.value
  return isSnoozed('feed', props.now)
})
function snoozeFeed() {
  snoozeReminder('feed', 15, props.now)
  snoozeTick.value++
}
/** 按月龄的每日参考数据（无出生日期时为 null） */
const guide = computed(() => dailyGuide(activeBaby.value))

// —— 备份提醒：本地数据唯一兜底，超过 7 天未备份时提示（本会话可关闭）——
const lastBackupAt = ref<number | null>(getLastBackupAt())
const hasAnyData = computed(
  () =>
    feedingStore.feedings.length +
      diaperStore.diapers.length +
      pumpingStore.pumpings.length +
      sleepStore.sleeps.length +
      vaccinationStore.vaccinations.length >
    0,
)
const backupDue = computed(() =>
  shouldSuggestBackup({ lastBackupAt: lastBackupAt.value, hasData: hasAnyData.value, now: props.now }),
)
const backupDays = computed(() =>
  lastBackupAt.value == null ? 0 : Math.floor((props.now - lastBackupAt.value) / MS_PER_DAY),
)
async function handleBackup() {
  await exportJsonBackup()
  lastBackupAt.value = getLastBackupAt()
}

</script>

<template>
  <div class="today-overview">
    <!-- 喂奶提醒条 -->
    <ReminderBanner
      v-if="overdue && !dismissed.feed && !feedSnoozed"
      icon="🍼"
      variant="feed"
      :title="t('feed.sinceLast', { duration: formatDuration(sinceMs ?? 0) })"
      :sub="t('feed.reminderSub', { label: recommendedIntervalLabel(activeBaby) })"
      :action-label="t('dashboard.snooze15')"
      :dismiss-label="t('common.close')"
      @action="snoozeFeed"
      @dismiss="dismiss('feed')"
    />

    <!-- 备份提醒：本地数据超过 7 天未备份 / 从未备份时提示 -->
    <ReminderBanner
      v-if="backupDue && !dismissed.backup"
      icon="💾"
      variant="backup"
      :title="t('dashboard.backupTitle')"
      :sub="
        lastBackupAt == null
          ? t('dashboard.backupSubNever')
          : t('dashboard.backupSub', { days: backupDays })
      "
      :action-label="t('dashboard.backupAction')"
      :dismiss-label="t('common.close')"
      @action="handleBackup"
      @dismiss="dismiss('backup')"
    />

    <!-- 疫苗提醒条：点击打开最近一条待种记录进行编辑，点具体芯片可直接编辑该条，「全部」进记录页 -->
    <ReminderBanner
      v-if="upcomingVaccinationsList.length > 0 && !dismissed.vaccine"
      icon="💉"
      variant="vaccine"
      :title="t('dashboard.vaccineReminderTitle')"
      :chips="vaccineChips"
      :all-label="plannedVaccineCount > 1 ? t('dashboard.vaccineAll', { n: plannedVaccineCount }) : ''"
      :dismiss-label="t('common.close')"
      @click="emit('edit', upcomingVaccinationsList[0])"
      @select="onSelectVaccination"
      @all="openAllVaccinations"
      @dismiss="dismiss('vaccine')"
    />

<!-- 统计卡 -->
      <div class="overview-grid">
      <!-- 奶量卡片 -->
      <div class="ov-card ov-card--milk">
        <div class="ov-card__accent"></div>
        <div class="ov-card__content">
          <div class="ov-card__head">
            <span class="ov-card__icon">🥛</span>
            <span class="ov-card__label">{{ t('dashboard.statMilk') }}</span>
            <span v-if="lastFeeding" class="ov-card__alert">
              {{ formatTime(lastFeeding.endTime ?? lastFeeding.startTime) }}
              <template v-if="sinceMs != null"> · {{ formatDuration(sinceMs) }}{{ t('common.ago') }}</template>
            </span>
          </div>
          <div class="ov-card__hero-row">
            <p class="ov-card__hero">{{ formatAmount(stats.totalMilk) || '0 ml' }}</p>
            <span v-if="guide" class="ov-card__guide">{{ t('dashboard.guideDaily') }} {{ guide.milk }}</span>
          </div>
          <div class="ov-card__details">
            <div class="ov-dt ov-dt--spread">
              <span class="ov-dt__label">{{ t('dashboard.feedCount') }} <span class="ov-dt__value">{{ stats.feedCount }}{{ t('common.timesShort') }}</span></span>
            </div>
          </div>
          <div class="ov-card__footer">
            <div class="ov-dt">
              <span class="ov-dt__label">{{ t('dashboard.pumpCount') }} <span class="ov-dt__value">{{ stats.pumpCount }}{{ t('common.timesShort') }}</span></span>
            </div>
            <div class="ov-dt">
              <span class="ov-dt__label">{{ t('dashboard.breastStock') }} <span class="ov-dt__value">{{ formatAmount(stats.breastStock) }}</span></span>
            </div>
          </div>
        </div>
      </div>
      <!-- 睡眠卡片 -->
      <div class="ov-card ov-card--sleep">
        <div class="ov-card__accent"></div>
        <div class="ov-card__content">
          <div class="ov-card__head">
            <span class="ov-card__icon">😴</span>
            <span class="ov-card__label">{{ t('dashboard.statSleep') }}</span>
            <span v-if="lastSleep" class="ov-card__alert">
              {{ formatTime(lastSleep.endTime ?? lastSleep.startTime) }}
              <template v-if="sinceSleepMs != null && sinceSleepMs >= 0"> · {{ formatDuration(sinceSleepMs) }}{{ t('common.ago') }}</template>
            </span>
          </div>
          <div class="ov-card__hero-row">
            <p class="ov-card__hero">{{ formatDuration(stats.sleepMs) }}</p>
            <span v-if="guide" class="ov-card__guide">{{ t('dashboard.guideDaily') }} {{ guide.sleep }}</span>
          </div>
        </div>
      </div>
      <!-- 尿布卡片 -->
      <div class="ov-card ov-card--diaper">
        <div class="ov-card__accent"></div>
        <div class="ov-card__content">
          <div class="ov-card__head">
            <span class="ov-card__icon">🧷</span>
            <span class="ov-card__label">{{ t('dashboard.statDiaper') }}</span>
            <span v-if="lastDiaper" class="ov-card__alert">
              {{ formatTime(lastDiaper.time) }}
              <template v-if="sinceDiaperMs != null && sinceDiaperMs >= 0"
                > · {{ formatDuration(sinceDiaperMs) }}{{ t('common.ago') }}</template
              >
            </span>
          </div>
          <div class="ov-card__hero-row">
            <p class="ov-card__hero">{{ stats.diaperCount }}<span class="ov-card__unit">{{ t('common.timesShort') }}</span></p>
            <span v-if="guide" class="ov-card__guide">{{ t('dashboard.guideDaily') }} {{ guide.diaper }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 概览网格 ===== */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

/* ===== 卡片基础 — 液态玻璃 ===== */
.ov-card {
  display: flex;
  border-radius: var(--radius-lg);
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass);
  overflow: hidden;
  position: relative;
  transition:
    box-shadow var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
}

.ov-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-shine), transparent);
  pointer-events: none;
}

@media (hover: hover) {
  .ov-card:hover {
    box-shadow: var(--shadow-md), var(--shadow-glass);
    transform: translateY(-1px);
  }
}

/* 左侧彩色指示条 */
.ov-card__accent {
  width: 3.5px;
  flex-shrink: 0;
}

.ov-card--milk .ov-card__accent  { background: linear-gradient(to bottom, #C4A8E0, #a78bdb); }
.ov-card--sleep .ov-card__accent { background: linear-gradient(to bottom, #8FAED8, #6a96c7); }
.ov-card--diaper .ov-card__accent { background: linear-gradient(to bottom, #9A8FC8, #8476b5); }

/* 内容区 */
.ov-card__content {
  flex: 1;
  min-width: 0;
  padding: 10px var(--space-3) 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 头部：图标 + 标签 + 右侧上次时间（空间不足时徽标换到第二行，而非挤压标签） */
.ov-card__head {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  row-gap: 4px;
}

.ov-card__icon {
  font-size: var(--fs-16);
  line-height: 1;
}

.ov-card__label {
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.1px;
  white-space: nowrap;
}

/* 标题行右侧：上次结束时间 */
.ov-card__alert {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 1px 6px;
  border-radius: var(--radius-2xs);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 主数值行：左侧大数字 + 右侧参考（放不下时参考下移一行，大数字不折断） */
.ov-card__hero-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  flex-wrap: wrap;
  row-gap: 2px;
}

/* 主数值：大号粗体，视觉焦点 */
.ov-card__hero {
  font-size: var(--fs-24);
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.ov-card__unit {
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 2px;
}

/* 参考量：主数值行右侧（换行后右对齐） */
.ov-card__guide {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.ov-card--milk .ov-card__hero  { color: #af52de; }
.ov-card--sleep .ov-card__hero { color: #0a84ff; }
.ov-card--diaper .ov-card__hero { color: #bf5af2; }

/* 详情区 */
.ov-card__details {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* 底部分隔区（泵/库存等辅助数据） */
.ov-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  padding-top: 5px;
  border-top: 1px solid var(--glass-border);
  margin-top: auto;
  justify-content: flex-end;
}

/* ===== 数据行 ===== */
.ov-dt {
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1.4;
}

/* 左右分散一行 */
.ov-dt--spread {
  justify-content: space-between;
}

.ov-dt__label {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  flex-shrink: 0;
}

.ov-dt__value {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 弱化文字 */
.ov-dt--muted {
  color: var(--text-muted) !important;
  font-style: italic;
  font-weight: 400;
}

/* ===== 响应式 ===== */
/* 手机（≤699）：单列大卡 */
@media (max-width: 699px) {
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .ov-card__hero {
    font-size: var(--fs-xl);
  }
}

/* 平板竖屏（700–899）：两列，信息量最大的奶量卡独占整行 */
@media (min-width: 700px) and (max-width: 899px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ov-card--milk {
    grid-column: 1 / -1;
  }
}
</style>
