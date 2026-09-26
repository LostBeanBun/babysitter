<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PumpSide } from '@/types'
import { PUMP_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { usePumpingStore } from '@/stores/pumping'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useFormErrors } from '@/composables/useFormErrors'
import { showToast } from '@/composables/useToast'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

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
const activeTimer = useActiveTimer()
const err = useFormErrors()

const side = ref<PumpSide>(props.editing?.side ?? 'both')
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

const activeEntry = computed(() => activeTimer.getByKind('pumping'))
const isRecording = computed(() => !!activeEntry.value)
const isEditing = computed(() => !!props.editing && !isRecording.value)

const durationText = computed(() => {
  const start = fromDateTimeLocal(startTime.value)
  const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
  if (start && end && end > start) return formatDuration(end - start)
  return null
})

const submitLabel = computed(() => {
  if (isEditing.value) return t('common.saveEdit')
  if (isRecording.value) return t('pump.endRecord')
  return t('pump.startRecord')
})

onMounted(() => {
  if (activeEntry.value) {
    const record = pumpingStore.pumpings.find((p) => p.id === activeEntry.value!.recordId)
    if (record) {
      side.value = record.side
      amount.value = record.amount != null ? String(record.amount) : ''
      notes.value = record.notes ?? ''
      startTime.value = toDateTimeLocal(record.startTime)
      endTime.value = ''
    }
  }
})

async function submit() {
  err.clearAll()
  try {
    const start = fromDateTimeLocal(startTime.value)
    if (start == null) {
      err.set('startTime', t('pump.invalidStart'))
      return
    }
    const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
    const amt = amount.value ? Number(amount.value) : undefined
    if (amount.value && (isNaN(amt as number) || (amt as number) <= 0)) {
      err.set('amount', t('pump.invalidAmount'))
      return
    }

    // 计时中：结束记录，结束时间写回（空则取当前时间）
    if (isRecording.value && activeEntry.value) {
      const endTs = end ?? Date.now()
      if (endTs <= start) {
        err.set('endTime', t('pump.invalidOrder'))
        return
      }
      await pumpingStore.update(activeEntry.value.recordId, {
        endTime: endTs,
        duration: endTs - start,
        amount: amt,
      })
      activeTimer.reset(activeEntry.value.id)
      emit('saved')
      return
    }

    if (isEditing.value && props.editing) {
      if (end != null && end <= start) {
        err.set('endTime', t('pump.invalidOrder'))
        return
      }
      await pumpingStore.update(props.editing.id, {
        side: side.value,
        startTime: start,
        endTime: end,
        duration: end && end > start ? end - start : undefined,
        amount: amt,
        notes: notes.value || undefined,
      })
      emit('saved')
      return
    }

    // 新记录：结束时间已填 → 直接保存；空 → 从输入开始时间启动计时
    if (end != null) {
      if (end <= start) {
        err.set('endTime', t('pump.invalidOrder'))
        return
      }
      await pumpingStore.add({
        side: side.value,
        startTime: start,
        endTime: end,
        amount: amt,
        notes: notes.value || undefined,
      })
      emit('saved')
      return
    }
    const id = await pumpingStore.add({
      side: side.value,
      startTime: start,
      amount: amt,
      notes: notes.value || undefined,
    })
    activeTimer.start('pumping', id, start)
    emit('startRecord')
  } catch {
    showToast(t('errors.generic'))
  }
}
</script>

<template>
  <div class="pump-form">
    <p class="form-label">{{ t('pump.sideLabel') }}</p>
    <div class="type-grid">
      <button
        v-for="s in PUMP_SIDE_LIST"
        :key="s.value"
        type="button"
        class="type-btn"
        :class="{ selected: side === s.value }"
        :disabled="isRecording"
        @click="side = s.value"
      >
        <span class="type-icon">{{ s.icon }}</span>
        <span class="type-label">{{ t(s.label) }}</span>
      </button>
    </div>

    <div class="form-field" :class="{ 'has-error': err.has('amount') }">
      <label class="form-label">{{ t('pump.amountLabel') }}</label>
      <input
        v-model="amount"
        type="number"
        min="0"
        step="5"
        :placeholder="t('pump.amountPlaceholder')"
        class="form-input"
        inputmode="decimal"
        @input="err.clear('amount')"
      />
      <p v-if="err.get('amount')" class="field-error">{{ err.get('amount') }}</p>
    </div>

    <div class="time-row">
      <div class="form-field" :class="{ 'has-error': err.has('startTime') }">
        <label class="form-label">{{ t('pump.startLabel') }}</label>
        <input
          v-model="startTime"
          type="datetime-local" step="1"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          :disabled="isRecording"
          @input="err.clear('startTime')"
        />
        <p v-if="err.get('startTime')" class="field-error">{{ err.get('startTime') }}</p>
      </div>
      <div class="form-field" :class="{ 'has-error': err.has('endTime') }">
        <label class="form-label">{{ t('pump.endLabel') }}</label>
        <input
          v-model="endTime"
          type="datetime-local" step="1"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          @input="err.clear('endTime')"
        />
        <p v-if="err.get('endTime')" class="field-error">{{ err.get('endTime') }}</p>
      </div>
    </div>

    <p v-if="durationText" class="duration-hint">{{ durationText }}</p>

    <FormNotes v-model="notes" :label="t('pump.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions
      :editing="isEditing"
      :submit-label="submitLabel"
      @cancelled="emit('cancelled')"
      @save="submit"
    />
  </div>
</template>

<style scoped>
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 12px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  transition: all 0.3s var(--spring);
}

.type-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.type-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.type-icon { font-size: 20px; }

.type-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.duration-hint {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 12px;
}

.time-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

@media (max-width: 480px) {
  .time-row { grid-template-columns: 1fr; }
}

@media (max-width: 375px) {
  .type-grid { gap: 8px; }
  .type-btn { padding: 10px 4px; }
  .type-icon { font-size: 18px; }
  .type-label { font-size: 11px; }
}
</style>
