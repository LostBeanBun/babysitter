/**
 * 全局提醒循环：挂载于 App.vue，任何路由/页面下每分钟检查一次提醒并发送系统通知。
 * 不再依赖 Dashboard 页面存在，用户停留在统计/记录/设置页时提醒依然生效。
 */
import { onMounted, onUnmounted } from 'vue'
import { checkReminders } from '@/utils/reminderScheduler'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useMedicationStore } from '@/stores/medication'
import { useVaccinationStore } from '@/stores/vaccination'
import { useDiaperStore } from '@/stores/diaper'

const CHECK_INTERVAL = 60_000

let timer: number | null = null

export function useReminderLoop() {
  const babyStore = useBabyStore()
  const feedingStore = useFeedingStore()
  const medicationStore = useMedicationStore()
  const vaccinationStore = useVaccinationStore()
  const diaperStore = useDiaperStore()

  function sendNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const now = Date.now()
    const activeBaby = babyStore.babies.find((b) => b.id === babyStore.activeBabyId)
    const hits = checkReminders({
      now,
      baby: activeBaby,
      feedings: feedingStore.feedings,
      medications: medicationStore.medications,
      vaccinations: vaccinationStore.vaccinations,
      diapers: diaperStore.diapers,
    })
    hits.forEach((h) => {
      const notification = new Notification(h.title, { body: h.body, tag: h.tag })
      // 点击通知时聚焦窗口，并跳转到首页查看详情
      notification.onclick = () => {
        window.focus()
        if (!window.location.hash.startsWith('#/')) window.location.hash = '#/'
        notification.close()
      }
    })
  }

  onMounted(() => {
    if (timer == null) {
      // 首次进入页面即检查一次，随后每分钟轮询
      sendNotifications()
      timer = window.setInterval(sendNotifications, CHECK_INTERVAL)
    }
  })
  onUnmounted(() => {
    if (timer != null) {
      window.clearInterval(timer)
      timer = null
    }
  })
}