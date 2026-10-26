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
import { useDismissedReminders } from '@/composables/useDismissedReminders'
import { useActiveTimer } from '@/composables/useActiveTimer'
import ReminderBanner from '@/components/common/ReminderBanner.vue'
import { exportJsonBackup, getLastBackupAt, shouldSuggestBackup } from '@/services/backup'
import { isSnoozed, snoozeReminder, loadReminders } from '@/utils/reminderScheduler'
import { startOfDay, formatDuration } from '@/utils/format'
import { MS_PER_DAY, MS_PER_HOUR } from '@/constants'
import { upcomingVaccinations, vaccineDaysLeft } from '@/services/reminders'
import { recommendedIntervalMs, recommendedIntervalLabel } from '@/utils/feedingGuide'
import type { RecordKind, Vaccination } from '@/types'

/** 今日概览：喂奶 / 备份 / 疫苗 / 睡眠 / 尿布提醒条（数据按 now 实时重算） */
const props = defineProps<{ now: number }>()
const emit = defineEmits<{ edit: [v: Vaccination]; add: [kind: RecordKind] }>()

const { t } = useI18n()
const router = useRouter()
const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const vaccinationStore = useVaccinationStore()
const { dismissed, dismiss } = useDismissedReminders()

const todayStart = computed(() => startOfDay(props.now))

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

// —— 喂奶提醒 ——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const lastFeeding = computed(() => {
  const sorted = [...feedingStore.feedings].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]
})
const sinceMs = computed(() => {
  if (!lastFeeding.value) return null
  const end = lastFeeding.value.endTime ?? lastFeeding.value.startTime
  return props.now - end
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
function snoozeSleep() {
  snoozeReminder('sleep', 15, props.now)
  snoozeTick.value++
}
function snoozeDiaper() {
  snoozeReminder('diaper', 15, props.now)
  snoozeTick.value++
}

// —— 睡眠提醒条 ——（仅当睡眠提醒开启：就寝时间前 1 小时窗口内 / 距上次睡眠超过设定间隔；正在进行睡眠时不显示）
const activeTimer = useActiveTimer()
const sleepReminders = computed(() => loadReminders().sleep)
const lastSleepStart = computed(() => {
  const sorted = [...sleepStore.sleeps].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]?.startTime ?? null
})
const sleepSinceMs = computed(() =>
  lastSleepStart.value == null ? null : props.now - lastSleepStart.value,
)
/** 就寝时间前 1 小时窗口内返回已过毫秒数，窗口外返回 -1 */
const sleepTimeDueMs = computed(() => {
  const cfg = sleepReminders.value
  if (!cfg.time) return -1
  const [h, m] = cfg.time.split(':').map(Number)
  const target = new Date(props.now)
  target.setHours(h, m, 0, 0)
  const delta = props.now - target.getTime()
  return delta >= 0 && delta <= MS_PER_HOUR ? delta : -1
})
const sleepIntervalDue = computed(() => {
  const cfg = sleepReminders.value
  return cfg.intervalHours > 0 && sleepSinceMs.value != null && sleepSinceMs.value > cfg.intervalHours * MS_PER_HOUR
})
const sleepSnoozed = computed(() => {
  void snoozeTick.value
  return isSnoozed('sleep', props.now)
})
const sleepBannerActive = computed(
  () =>
    sleepReminders.value.enabled &&
    !activeTimer.hasKind('sleep') &&
    !sleepSnoozed.value &&
    !dismissed.value.sleep &&
    (sleepTimeDueMs.value >= 0 || sleepIntervalDue.value),
)

// —— 尿布提醒条 ——（阈值与今日照护共用：距上次换尿布超过提醒设置间隔，默认 3 小时，常显）
const diaperReminders = computed(() => loadReminders().diaper)
const lastDiaperTime = computed(() => {
  const sorted = [...diaperStore.diapers].sort((a, b) => b.time - a.time)
  return sorted[0]?.time ?? null
})
const diaperSinceMs = computed(() =>
  lastDiaperTime.value == null ? null : props.now - lastDiaperTime.value,
)
const diaperThresholdHours = computed(() => {
  const hours = diaperReminders.value.intervalHours
  return hours > 0 ? hours : 3
})
const diaperDue = computed(
  () => diaperSinceMs.value != null && diaperSinceMs.value > diaperThresholdHours.value * MS_PER_HOUR,
)
const diaperSnoozed = computed(() => {
  void snoozeTick.value
  return isSnoozed('diaper', props.now)
})
const diaperBannerActive = computed(() => diaperDue.value && !diaperSnoozed.value && !dismissed.value.diaper)

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
    <!-- 喂奶提醒条：点击整条直达喂养记录表单 -->
    <ReminderBanner
      v-if="overdue && !dismissed.feed && !feedSnoozed"
      icon="🍼"
      variant="feed"
      :title="t('feed.sinceLast', { duration: formatDuration(sinceMs ?? 0) })"
      :sub="t('feed.reminderSub', { label: recommendedIntervalLabel(activeBaby) })"
      :action-label="t('dashboard.snooze15')"
      :dismiss-label="t('common.close')"
      @click="emit('add', 'feeding')"
      @action="snoozeFeed"
      @dismiss="dismiss('feed')"
    />

    <!-- 睡眠提醒条（开启提醒时）：到达就寝时间或距上次睡眠超过间隔，点击直达睡眠表单 -->
    <ReminderBanner
      v-if="sleepBannerActive"
      icon="😴"
      variant="sleep"
      :title="t('dashboard.sleepReminderTitle')"
      :sub="
        sleepTimeDueMs >= 0
          ? t('reminders.sleep.bodyTime', { time: sleepReminders.time })
          : t('reminders.sleep.body', { duration: formatDuration(sleepSinceMs ?? 0) })
      "
      :action-label="t('dashboard.snooze15')"
      :dismiss-label="t('common.close')"
      @click="emit('add', 'sleep')"
      @action="snoozeSleep"
      @dismiss="dismiss('sleep')"
    />

    <!-- 尿布提醒条：距上次换尿布超过提醒间隔（默认 3 小时），点击直达纸尿裤表单 -->
    <ReminderBanner
      v-if="diaperBannerActive"
      icon="🧷"
      variant="diaper"
      :title="t('dashboard.diaperReminderTitle')"
      :sub="t('reminders.diaper.body', { hours: diaperThresholdHours })"
      :action-label="t('dashboard.snooze15')"
      :dismiss-label="t('common.close')"
      @click="emit('add', 'diaper')"
      @action="snoozeDiaper"
      @dismiss="dismiss('diaper')"
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
  </div>
</template>
