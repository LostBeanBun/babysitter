import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import type { FormErrors } from './useFormErrors'
import { useActiveTimer, type TimerKind } from './useActiveTimer'
import { showToast } from './useToast'
import { planTimedSubmit } from '@/services/timedRecord'

export interface TimedRecordOptions<TFields> {
  /** 计时种类（feeding/pumping/sleep） */
  kind: TimerKind
  /** 编辑中的记录（editing prop） */
  editing?: { id: number; startTime: number; endTime?: number } | undefined
  err: FormErrors
  /** 开始时间非法时的错误文案 */
  invalidStart: () => string
  /** 结束时间不晚于开始时间时的错误文案 */
  invalidOrder: () => string
  /** 构建时间之外的字段；校验失败需先 err.set 并返回 null */
  buildFields: () => TFields | null
  /** 活动计时对应的记录开始时间（用于 onMounted 回填），无记录返回 undefined */
  getRecordStartTime: (recordId: number) => number | undefined
  /** 活动计时回填：填充时间之外的字段（时间由本组合式函数回填） */
  hydrate?: (recordId: number) => void
  /** 新建（无结束时间）：返回记录 id */
  add: (fields: TFields, startTime: number) => Promise<number>
  /** 新建带结束时间 */
  addRange: (fields: TFields, startTime: number, endTime: number) => Promise<unknown>
  /** 编辑保存（endTime 可能为 undefined，由表单决定是否清除） */
  update: (id: number, fields: TFields, startTime: number, endTime: number | undefined) => Promise<unknown>
  /** 编辑前的区间校验（如睡眠编辑必须有完整区间）；失败需 err.set 并返回 false */
  validateEdit?: (startTime: number, endTime: number | undefined) => boolean
  /** 计时中结束（endTime 已校验晚于开始时间） */
  finishRecording: (recordId: number, endTime: number, fields: TFields) => Promise<unknown>
  /** 结束时间为空的新记录是否启动计时（瓶喂等单时间点记录返回 false） */
  startTimer?: () => boolean
  emit: { saved: () => void; startRecord: () => void }
}

/**
 * 带「开始/结束时间 + 活动计时」记录表单的公共状态与提交流程：
 * - startTime/endTime/durationText/isRecording/isEditing 状态
 * - 计时中提交 → 结束记录；编辑 → update；新记录有结束区间 → add；否则 add + 启动计时
 */
export function useTimedRecord<TFields>(opts: TimedRecordOptions<TFields>) {
  const { t } = useI18n()
  const activeTimer = useActiveTimer()

  const startTime = ref(toDateTimeLocal(opts.editing?.startTime ?? Date.now()))
  const endTime = ref(opts.editing?.endTime ? toDateTimeLocal(opts.editing.endTime) : '')

  const activeEntry = computed(() => activeTimer.getByKind(opts.kind))
  const isRecording = computed(() => !!activeEntry.value)
  const isEditing = computed(() => !!opts.editing && !isRecording.value)

  const durationText = computed(() => {
    const start = fromDateTimeLocal(startTime.value)
    const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
    if (start && end && end > start) return formatDuration(end - start)
    return null
  })

  onMounted(() => {
    const entry = activeEntry.value
    if (!entry) return
    const recStart = opts.getRecordStartTime(entry.recordId)
    if (recStart == null) return
    startTime.value = toDateTimeLocal(recStart)
    endTime.value = ''
    opts.hydrate?.(entry.recordId)
  })

  async function submit(): Promise<void> {
    opts.err.clearAll()
    try {
      const start = fromDateTimeLocal(startTime.value)
      const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
      const plan = planTimedSubmit<TFields>({
        start,
        end,
        recording: isRecording.value,
        editing: isEditing.value && !!opts.editing,
        buildFields: opts.buildFields,
        validateEdit: opts.validateEdit,
        startTimer: opts.startTimer,
      })

      switch (plan.type) {
        case 'invalidStart':
          opts.err.set('startTime', opts.invalidStart())
          return
        case 'invalidFields':
        case 'editRejected':
          return
        case 'invalidOrder':
          opts.err.set('endTime', opts.invalidOrder())
          return
        case 'finishRecording': {
          const entry = activeEntry.value
          if (!entry) return
          await opts.finishRecording(entry.recordId, plan.end, plan.fields)
          activeTimer.reset(entry.id)
          opts.emit.saved()
          return
        }
        case 'update':
          if (!opts.editing) return
          await opts.update(opts.editing.id, plan.fields, plan.start, plan.end)
          opts.emit.saved()
          return
        case 'addRange':
          await opts.addRange(plan.fields, plan.start, plan.end)
          opts.emit.saved()
          return
        case 'add': {
          const id = await opts.add(plan.fields, plan.start)
          if (plan.timer) {
            activeTimer.start(opts.kind, id, plan.start)
            opts.emit.startRecord()
          } else {
            opts.emit.saved()
          }
          return
        }
      }
    } catch {
      showToast(t('errors.generic'))
    }
  }

  return { startTime, endTime, activeEntry, isRecording, isEditing, durationText, submit }
}
