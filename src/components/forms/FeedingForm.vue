<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FeedType, BreastSide } from '@/types'
import { FEED_TYPE_LIST, BREAST_SIDE_LIST } from '@/constants'
import { useFeedingStore } from '@/stores/feeding'
import { useFormErrors } from '@/composables/useFormErrors'
import { useTimedRecord } from '@/composables/useTimedRecord'
import ChoiceGrid, { type ChoiceOption } from '@/components/common/ChoiceGrid.vue'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

const { t } = useI18n()

const props = defineProps<{
  editing?: {
    id: number
    type: FeedType
    side?: BreastSide
    startTime: number
    endTime?: number
    duration?: number
    amount?: number
    notes?: string
  }
  /** 「重复上次」预填：只带参数，不带 id/时间 */
  prefill?: { type?: FeedType; side?: BreastSide; amount?: number; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: []; startRecord: [] }>()

const feedingStore = useFeedingStore()
const err = useFormErrors()

const type = ref<FeedType>(props.editing?.type ?? props.prefill?.type ?? 'breast')
const side = ref<BreastSide>(props.editing?.side ?? props.prefill?.side ?? 'left')
const isBreast = computed(() => type.value === 'breast')
const amountSource = props.editing?.amount ?? props.prefill?.amount
const amount = ref<string>(amountSource != null ? String(amountSource) : '')
const notes = ref(props.editing?.notes ?? props.prefill?.notes ?? '')

const typeOptions = computed<ChoiceOption[]>(() =>
  FEED_TYPE_LIST.map((opt) => ({ value: opt.value, icon: opt.icon, label: t(opt.label), color: opt.color })),
)

interface Fields {
  type: FeedType
  side?: BreastSide
  amount?: number
  notes?: string
}

/** 瓶喂奶量必填；合法返回数值，非法标记字段错误返回 undefined */
function parseAmount(): number | undefined {
  const amt = amount.value ? Number(amount.value) : NaN
  if (!amount.value || isNaN(amt) || amt <= 0) {
    err.set('amount', t('feed.invalidAmount'))
    return undefined
  }
  return amt
}

function buildFields(): Fields | null {
  if (isBreast.value) {
    return { type: type.value, side: side.value, amount: undefined, notes: notes.value || undefined }
  }
  const amt = parseAmount()
  if (amt === undefined) return null
  return { type: type.value, side: undefined, amount: amt, notes: notes.value || undefined }
}

const { startTime, endTime, isRecording, isEditing, durationText, submit } = useTimedRecord<Fields>({
  kind: 'feeding',
  editing: props.editing,
  err,
  invalidStart: () => t('feed.invalidStart'),
  invalidOrder: () => t('feed.invalidOrder'),
  buildFields,
  getRecordStartTime: (recordId) => feedingStore.feedings.find((f) => f.id === recordId)?.startTime,
  hydrate: (recordId) => {
    const record = feedingStore.feedings.find((f) => f.id === recordId)
    if (record) {
      type.value = record.type
      side.value = record.side ?? 'left'
      amount.value = record.amount != null ? String(record.amount) : ''
      notes.value = record.notes ?? ''
    }
  },
  add: (f, start) => feedingStore.add({ type: f.type, side: f.side, startTime: start, amount: f.amount, notes: f.notes }),
  addRange: (f, start, end) =>
    feedingStore.add({ type: f.type, side: f.side, startTime: start, endTime: end, notes: f.notes }),
  update: (id, f, start, end) => {
    if (f.type === 'breast') {
      return feedingStore.update(id, {
        type: f.type,
        side: f.side,
        startTime: start,
        endTime: end,
        amount: undefined,
        notes: f.notes,
      })
    }
    return feedingStore.update(id, {
      type: f.type,
      side: undefined,
      startTime: start,
      endTime: undefined,
      amount: f.amount,
      notes: f.notes,
    })
  },
  validateEdit: (start, end) => {
    if (isBreast.value && end != null && end <= start) {
      err.set('endTime', t('feed.invalidOrder'))
      return false
    }
    return true
  },
  finishRecording: (recordId, endTs) => feedingStore.update(recordId, { endTime: endTs }),
  // 瓶喂为单时间点，不启动计时
  startTimer: () => isBreast.value,
  emit: {
    saved: () => emit('saved'),
    startRecord: () => emit('startRecord'),
  },
})

/** 瓶喂用单时间点；亲喂或计时中用开始/结束区间 */
const showTimePair = computed(() => isBreast.value || isRecording.value)

const submitLabel = computed(() => {
  if (isRecording.value) return t('feed.endRecord')
  if (isEditing.value) return t('common.saveEdit')
  if (!isBreast.value) return t('common.save')
  return t('feed.startRecord')
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="feeding-form" @submit.prevent="onSubmit">
    <p class="form-label">{{ t('feed.typeLabel') }}</p>
    <ChoiceGrid v-model="type" :options="typeOptions" :disabled="isRecording" />

    <div v-if="isBreast" class="side-row">
      <button
        v-for="s in BREAST_SIDE_LIST"
        :key="s.value"
        type="button"
        class="side-btn"
        :class="{ selected: side === s.value }"
        :disabled="isRecording"
        @click="side = s.value"
      >
        <span>{{ s.icon }}</span>
        <span>{{ t(s.label) }}</span>
      </button>
    </div>

    <TextField
      v-if="!isBreast"
      v-model="amount"
      type="number"
      min="0"
      step="5"
      inputmode="decimal"
      :label="t('feed.amountLabel')"
      :errors="err"
      error-key="amount"
      :placeholder="t('feed.amountPlaceholder')"
      :disabled="isRecording"
    />

    <template v-if="showTimePair">
      <div class="time-row">
        <TextField
          v-model="startTime"
          type="datetime-local"
          step="1"
          :label="t('feed.startLabel')"
          :errors="err"
          error-key="startTime"
          :placeholder="t('common.selectDateTime')"
          :disabled="isRecording"
        />
        <TextField
          v-model="endTime"
          type="datetime-local"
          step="1"
          :label="t('feed.endLabel')"
          :errors="err"
          error-key="endTime"
          :placeholder="t('common.selectDateTime')"
        />
      </div>

      <p v-if="durationText" class="duration-hint">{{ durationText }}</p>
    </template>
    <TextField
      v-else
      v-model="startTime"
      type="datetime-local"
      step="1"
      :label="t('feed.timeLabel')"
      :errors="err"
      error-key="startTime"
      :placeholder="t('common.selectDateTime')"
    />

    <FormNotes v-model="notes" :label="t('feed.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions
      :editing="isEditing"
      :submit-label="submitLabel"
      @cancelled="emit('cancelled')"
    />
  </form>
</template>

<style scoped>
.side-row {
  display: flex;
  gap: 10px;
  margin-bottom: var(--space-4);
}

.side-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color var(--dur-slow) var(--spring), border-color var(--dur-slow) var(--spring), color var(--dur-slow) var(--spring),
    box-shadow var(--dur-slow) var(--spring), transform var(--dur-slow) var(--spring), opacity var(--dur-slow) var(--spring);
}

.side-btn.selected {
  border-width: 1.5px;
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.side-btn:active {
  transform: scale(var(--tap-scale));
}

.side-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.duration-hint {
  font-size: var(--fs-13);
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--space-3);
}

.time-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

@media (max-width: 480px) {
  .time-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 375px) {
  .side-btn {
    padding: var(--space-2) 6px;
    font-size: var(--fs-sm);
  }
}
</style>
