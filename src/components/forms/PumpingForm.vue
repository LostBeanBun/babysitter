<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PumpSide } from '@/types'
import { PUMP_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { usePumpingStore } from '@/stores/pumping'
import FormTimer from '@/components/common/FormTimer.vue'
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
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const pumpingStore = usePumpingStore()

const side = ref<PumpSide>(props.editing?.side ?? 'both')
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

// 计时器回调：由 FormTimer 组件驱动
function onTimerStart() {
  startTime.value = toDateTimeLocal(Date.now())
}

function onTimerStop({ start, end }: { start: number; end: number }) {
  startTime.value = toDateTimeLocal(start)
  endTime.value = toDateTimeLocal(end)
}

/** 编辑既有吸奶记录时回显时长 */
const recordedText = computed(() =>
  t('pump.recordedDuration', { duration: props.editing?.duration ? formatDuration(props.editing.duration) : '—' }),
)

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

    <FormTimer
      :editing="!!props.editing"
      :recorded-text="recordedText"
      :start-label="t('pump.startTimer')"
      :stop-label="t('pump.stopTimer')"
      :hint="t('pump.timerHint')"
      kind="pumping"
      :start-ts="fromDateTimeLocal(startTime)"
      @start="onTimerStart"
      @stop="onTimerStop"
    />

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
        <input v-model="startTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('pump.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
    </div>

    <FormNotes v-model="notes" :label="t('pump.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
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
</style>
