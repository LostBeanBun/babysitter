/**
 * 全局提醒循环：挂载于 App.vue，任何路由/页面下每分钟检查一次提醒并发送系统通知。
 * 不再依赖 Dashboard 页面存在，用户停留在统计/记录/设置页时提醒依然生效。
 */
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { checkReminders } from '@/utils/reminderScheduler'
import { canNotify, showReminderNotification, type ReminderNotification } from '@/services/notification'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useMedicationStore } from '@/stores/medication'
import { useVaccinationStore } from '@/stores/vaccination'
import { useDiaperStore } from '@/stores/diaper'
import { useSleepStore } from '@/stores/sleep'

const CHECK_INTERVAL = 60_000
/** 同一 tag 的通知冷却时间：避免每分钟重复弹出同一条提醒（与「稍后 15 分钟」对齐） */
const NOTIFY_COOLDOWN = 15 * 60_000

let timer: number | null = null
const lastSentAt = new Map<string, number>()

/** 同一 tag 在冷却期内只发一次；数据已恢复时再次命中会重新通知 */
function dueForNotify(hit: ReminderNotification, now: number): boolean {
  const last = lastSentAt.get(hit.tag)
  return last == null || now - last >= NOTIFY_COOLDOWN
}

export function useReminderLoop() {
  const babyStore = useBabyStore()
  const feedingStore = useFeedingStore()
  const medicationStore = useMedicationStore()
  const vaccinationStore = useVaccinationStore()
  const diaperStore = useDiaperStore()
  const sleepStore = useSleepStore()

  /** 各记录 store 首次从 IndexedDB 载入完成（首检时可能还是空数组） */
  const ready = computed(
    () =>
      !babyStore.babiesLoading &&
      !feedingStore.loading &&
      !medicationStore.loading &&
      !vaccinationStore.loading &&
      !diaperStore.loading &&
      !sleepStore.loading,
  )

  function sendNotifications() {
    if (!canNotify()) return
    const now = Date.now()
    const activeBaby = babyStore.babies.find((b) => b.id === babyStore.activeBabyId)
    const hits = checkReminders({
      now,
      baby: activeBaby,
      feedings: feedingStore.feedings,
      medications: medicationStore.medications,
      vaccinations: vaccinationStore.vaccinations,
      diapers: diaperStore.diapers,
      sleeps: sleepStore.sleeps,
    })
    // 移动端必须走 Service Worker 通知，点击行为由 SW 的 notificationclick 处理
    hits.forEach((h) => {
      if (!dueForNotify(h, now)) return
      lastSentAt.set(h.tag, now)
      void showReminderNotification(h)
    })
  }

  // 挂载时 store 可能尚未载入完成，数据就绪后补检一次，避免首条提醒要等下一轮
  let stopReadyWatch: (() => void) | null = null
  stopReadyWatch = watch(ready, (isReady) => {
    if (!isReady) return
    stopReadyWatch?.()
    stopReadyWatch = null
    sendNotifications()
  })

  onMounted(() => {
    if (timer == null) {
      // 首次进入页面即检查一次，随后每分钟轮询
      sendNotifications()
      timer = window.setInterval(sendNotifications, CHECK_INTERVAL)
    }
  })
  onUnmounted(() => {
    stopReadyWatch?.()
    stopReadyWatch = null
    if (timer != null) {
      window.clearInterval(timer)
      timer = null
    }
  })
}