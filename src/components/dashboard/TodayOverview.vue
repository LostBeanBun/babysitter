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
import ReminderBanner from '@/components/common/ReminderBanner.vue'
import { exportJsonBackup, getLastBackupAt, shouldSuggestBackup } from '@/services/backup'
import { isSnoozed, snoozeReminder } from '@/utils/reminderScheduler'
import { startOfDay, formatDuration } from '@/utils/format'
import { MS_PER_DAY } from '@/constants'
import { upcomingVaccinations, vaccineDaysLeft } from '@/services/reminders'
import { recommendedIntervalMs, recommendedIntervalLabel } from '@/utils/feedingGuide'
import type { Vaccination } from '@/types'

/** 今日概览：喂奶 / 备份 / 疫苗提醒条（数据按 now 实时重算） */
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
  </div>
</template>
