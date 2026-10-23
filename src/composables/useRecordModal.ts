import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from './useToast'
import { useDeleteUndo } from './useDeleteUndo'
import { useSleepModal } from './useSleepModal'
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
import type { RecordKind } from '@/types'
import type { TimelineEntry } from '@/services/timeline'

/**
 * 记录表单弹窗 + 删除确认的公共状态与事件分发：
 * - modalState：新增/编辑（kind + 编辑条目），打开时自动隐藏睡眠悬浮球
 * - confirmDelete：删除确认 → 3 秒撤销窗口结束后真实删除（按 kind 分发到对应 store）
 */
export function useRecordModal() {
  const { t } = useI18n()
  const { scheduleDelete } = useDeleteUndo()
  const { sleepModalOpen } = useSleepModal()

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

  const modalState = ref<{ kind: RecordKind; editing?: TimelineEntry; prefill?: Record<string, unknown> } | null>(
    null,
  )
  const confirmDelete = ref<TimelineEntry | null>(null)

  /** 各记录类型真实删除 */
  const removers: Record<RecordKind, (id: number) => Promise<void>> = {
    feeding: (id) => feedingStore.remove(id),
    diaper: (id) => diaperStore.remove(id),
    pumping: (id) => pumpingStore.remove(id),
    sleep: (id) => sleepStore.remove(id),
    growth: (id) => growthStore.remove(id),
    solidFood: (id) => solidFoodStore.remove(id),
    medication: (id) => medicationStore.remove(id),
    vaccination: (id) => vaccinationStore.remove(id),
    temperature: (id) => temperatureStore.remove(id),
    milestone: (id) => milestoneStore.remove(id),
  }

  function openAdd(kind: RecordKind, prefill?: Record<string, unknown>) {
    modalState.value = { kind, prefill }
  }

  function onEdit(entry: TimelineEntry) {
    modalState.value = { kind: entry.kind, editing: entry }
  }

  /** 开始记录：保存开始时间，关闭弹窗，悬浮球出现 */
  function onStartRecord() {
    modalState.value = null
    showToast(t('common.recordStarted'))
  }

  /** 结束记录 / 编辑保存：关闭弹窗 */
  function onSaved() {
    modalState.value = null
    showToast(t('common.recordSaved'))
  }

  function onCancelled() {
    modalState.value = null
  }

  function onDelete(entry: TimelineEntry) {
    confirmDelete.value = entry
  }

  function removeEntry(e: TimelineEntry): Promise<void> {
    return removers[e.kind](e.id)
  }

  /** 确认删除：进入撤销窗口，3 秒后执行真实删除 */
  async function confirmDeleteAction() {
    const e = confirmDelete.value
    if (!e) return
    scheduleDelete(e, () => removeEntry(e), t('common.deletedToast'), t('common.undo'))
    confirmDelete.value = null
  }

  // 表单弹窗打开时隐藏悬浮球
  watch(modalState, (ms) => {
    sleepModalOpen.value = ms !== null
  })

  return {
    modalState,
    confirmDelete,
    openAdd,
    onEdit,
    onDelete,
    onStartRecord,
    onSaved,
    onCancelled,
    confirmDeleteAction,
  }
}
