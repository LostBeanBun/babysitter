<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PumpSide } from '@/types'
import { PUMP_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { usePumpingStore } from '@/stores/pumping'

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
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const pumpingStore = usePumpingStore()

const side = ref<PumpSide>(props.editing?.side ?? 'both')
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

const timerRunning = ref(false)
const timerStartTs = ref(0)
const elapsedMs = ref(0)
let timerId: number | undefined

function startTimer() {
  timerRunning.value = true
  timerStartTs.value = Date.now()
  elapsedMs.value = 0
  timerId = window.setInterval(() => {
    elapsedMs.value = Date.now() - timerStartTs.value
  }, 1000)
}

function stopTimer() {
  timerRunning.value = false
  if (timerId) clearInterval(timerId)
  timerId = undefined
  startTime.value = toDateTimeLocal(timerStartTs.value)
  endTime.value = toDateTimeLocal(Date.now())
}

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})

async function submit() {
  const start = fromDateTimeLocal(startTime.value) ?? Date.now()
  const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
  const amt = amount.value ? Number(amount.value) : undefined
  if (amount.value && (isNaN(amt as number) || (amt as number) <= 0)) {
    alert(t('pump.invalidAmount'))
    return
  }
  if (props.editing) {
    await pumpingStore.update(props.editing.id, {
      side: side.value,
      startTime: start,
      endTime: end,
      duration: end && end > start ? end - start : undefined,
      amount: amt,
      notes: notes.value || undefined,
    })
  } else {
    await pumpingStore.add({
      side: side.value,
      startTime: start,
      endTime: end,
      amount: amt,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
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
        @click="side = s.value"
      >
        <span class="type-icon">{{ s.icon }}</span>
        <span class="type-label">{{ t(s.label) }}</span>
      </button>
    </div>

    <div class="timer-box">
      <template v-if="!timerRunning && !props.editing">
        <button type="button" class="btn btn-primary btn-lg timer-start" @click="startTimer">
          {{ t('pump.startTimer') }}
        </button>
        <p class="timer-hint">{{ t('pump.timerHint') }}</p>
      </template>
      <template v-else-if="timerRunning">
        <div class="timer-display">{{ formatDuration(elapsedMs) }}</div>
        <button type="button" class="btn btn-soft btn-lg" @click="stopTimer">{{ t('pump.stopTimer') }}</button>
      </template>
      <template v-else-if="props.editing">
        <div class="timer-done">
          {{
            t('pump.recordedDuration', {
              duration: props.editing.duration ? formatDuration(props.editing.duration) : '—',
            })
          }}
        </div>
      </template>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('pump.amountLabel') }}</label>
      <input
        v-model="amount"
        type="number"
        min="0"
        step="5"
        :placeholder="t('pump.amountPlaceholder')"
        class="form-input"
        inputmode="decimal"
      />
    </div>

    <div class="time-row">
      <div class="form-field">
        <label class="form-label">{{ t('pump.startLabel') }}</label>
        <input v-model="startTime" type="datetime-local" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('pump.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" class="form-input" />
      </div>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('pump.notesLabel') }}</label>
      <input v-model="notes" type="text" :placeholder="t('common.optional')" class="form-input" />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-outline" @click="emit('cancelled')">{{ t('common.cancel') }}</button>
      <button type="button" class="btn btn-primary" @click="submit">
        {{ props.editing ? t('common.saveEdit') : t('common.save') }}
      </button>
    </div>
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
  padding: 12px 6px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: all 0.12s ease;
}

.type-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.type-icon {
  font-size: 20px;
}

.type-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.timer-box {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
}

.timer-start {
  width: 100%;
}

.timer-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.timer-display {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}

.timer-done {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.5;
}

.time-row {
  display: grid;
  /* 窄屏（手机）自动单列，宽屏两列，避免 datetime-local 挤压重叠 */
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

/* 手机下强制单列：真机日期控件固有宽度大，并排必然溢出 */
@media (max-width: 480px) {
  .time-row {
    grid-template-columns: 1fr;
  }
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>
