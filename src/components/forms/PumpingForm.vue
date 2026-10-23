<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PumpSide } from '@/types'
import { PUMP_SIDE_LIST } from '@/constants'
import { usePumpingStore } from '@/stores/pumping'
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
    side: PumpSide
    startTime: number
    endTime?: number
    duration?: number
    amount?: number
    notes?: string
  }
}>()
const emit = defineEmits<{ saved: []; cancelled: []; startRecord: [] }>()

const pumpingStore = usePumpingStore()
const err = useFormErrors()

const side = ref<PumpSide>(props.editing?.side ?? 'both')
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')

const sideOptions = computed<ChoiceOption[]>(() =>
  PUMP_SIDE_LIST.map((opt) => ({ value: opt.value, icon: opt.icon, label: t(opt.label) })),
)

/** 可选奶量：合法返回数值，非法标记字段错误返回 undefined */
function parseAmount(): number | undefined {
  if (!amount.value) return undefined
  const amt = Number(amount.value)
  if (isNaN(amt) || amt <= 0) {
    err.set('amount', t('pump.invalidAmount'))
    return undefined
  }
  return amt
}

interface Fields {
  side: PumpSide
  amount?: number
  notes?: string
}

function buildFields(): Fields | null {
  const amt = parseAmount()
  if (amount.value && amt === undefined) return null
  return { side: side.value, amount: amt, notes: notes.value || undefined }
}

const { startTime, endTime, isRecording, isEditing, durationText, submit } = useTimedRecord<Fields>({
  kind: 'pumping',
  editing: props.editing,
  err,
  invalidStart: () => t('pump.invalidStart'),
  invalidOrder: () => t('pump.invalidOrder'),
  buildFields,
  getRecordStartTime: (recordId) => pumpingStore.pumpings.find((p) => p.id === recordId)?.startTime,
  hydrate: (recordId) => {
    const record = pumpingStore.pumpings.find((p) => p.id === recordId)
    if (record) {
      side.value = record.side
      amount.value = record.amount != null ? String(record.amount) : ''
      notes.value = record.notes ?? ''
    }
  },
  add: (f, start) => pumpingStore.add({ side: f.side, startTime: start, amount: f.amount, notes: f.notes }),
  addRange: (f, start, end) =>
    pumpingStore.add({ side: f.side, startTime: start, endTime: end, amount: f.amount, notes: f.notes }),
  update: (id, f, start, end) =>
    pumpingStore.update(id, { side: f.side, startTime: start, endTime: end, amount: f.amount, notes: f.notes }),
  validateEdit: (start, end) => {
    if (end != null && end <= start) {
      err.set('endTime', t('pump.invalidOrder'))
      return false
    }
    return true
  },
  finishRecording: (recordId, endTs, f) => pumpingStore.update(recordId, { endTime: endTs, amount: f.amount }),
  emit: {
    saved: () => emit('saved'),
    startRecord: () => emit('startRecord'),
  },
})

const submitLabel = computed(() => {
  if (isEditing.value) return t('common.saveEdit')
  if (isRecording.value) return t('pump.endRecord')
  return t('pump.startRecord')
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="pump-form" @submit.prevent="onSubmit">
    <p class="form-label">{{ t('pump.sideLabel') }}</p>
    <ChoiceGrid v-model="side" :options="sideOptions" :disabled="isRecording" />

    <TextField
      v-model="amount"
      type="number"
      min="0"
      step="5"
      inputmode="decimal"
      :label="t('pump.amountLabel')"
      :errors="err"
      error-key="amount"
      :placeholder="t('pump.amountPlaceholder')"
    />

    <div class="time-row">
      <TextField
        v-model="startTime"
        type="datetime-local"
        step="1"
        :label="t('pump.startLabel')"
        :errors="err"
        error-key="startTime"
        :placeholder="t('common.selectDateTime')"
        :disabled="isRecording"
      />
      <TextField
        v-model="endTime"
        type="datetime-local"
        step="1"
        :label="t('pump.endLabel')"
        :errors="err"
        error-key="endTime"
        :placeholder="t('common.selectDateTime')"
      />
    </div>

    <p v-if="durationText" class="duration-hint">{{ durationText }}</p>

    <FormNotes v-model="notes" :label="t('pump.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions
      :editing="isEditing"
      :submit-label="submitLabel"
      @cancelled="emit('cancelled')"
    />
  </form>
</template>

<style scoped>
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
</style>
