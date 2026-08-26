<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SleepType } from '@/types'
import { SLEEP_TYPE_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useSleepStore } from '@/stores/sleep'
import FormTimer from '@/components/common/FormTimer.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const sleepStore = useSleepStore()

const type = ref<SleepType>(props.editing?.type ?? 'nap')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(
  props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : toDateTimeLocal(Date.now() + 3600_000),
)

// 计时器回调：由 FormTimer 组件驱动
const timerFinished = ref(false)

function onTimerStart() {
  timerFinished.value = false
  startTime.value = toDateTimeLocal(Date.now())
}

function onTimerStop({ start, end }: { start: number; end: number }) {
  timerFinished.value = true
  startTime.value = toDateTimeLocal(start)
  endTime.value = toDateTimeLocal(end)
}

/** 编辑既有睡眠记录时回显时长 */
const recordedText = computed(() =>
  t('sleep.recordedDuration', {
    duration: formatDuration((props.editing?.endTime ?? 0) - (props.editing?.startTime ?? 0)),
  }),
)

/** 计时结束后回显起止区间 */
const finishedText = computed(() =>
  t('sleep.recordedRange', {
    start: startTime.value.replace('T', ' '),
    end: endTime.value ? t('sleep.endRange', { end: endTime.value.replace('T', ' ') }) : '',
  }),
)

async function submit() {
  const start = fromDateTimeLocal(startTime.value)
  const end = fromDateTimeLocal(endTime.value)
  if (!start || !end) {
    alert(t('sleep.invalidRange'))
    return
  }
  if (end <= start) {
    alert(t('sleep.invalidOrder'))
    return
  }
  if (props.editing) {
    await sleepStore.update(props.editing.id, {
      type: type.value,
      startTime: start,
      endTime: end,
      notes: notes.value || undefined,
    })
  } else {
    await sleepStore.add({ type: type.value, startTime: start, endTime: end, notes: notes.value || undefined })
  }
  emit('saved')
}
</script>

<template>
  <div class="sleep-form">
    <p class="form-label">{{ t('sleep.typeLabel') }}</p>
    <div class="type-row">
      <button
        v-for="(label, key) in SLEEP_TYPE_LABELS"
        :key="key"
        type="button"
        class="type-btn"
        :class="{ selected: type === key }"
        @click="type = key"
      >
        <span class="type-icon">{{ key === 'night' ? '🌙' : '😴' }}</span>
        <span class="type-label">{{ t(label) }}</span>
      </button>
    </div>

    <FormTimer
      :editing="!!props.editing"
      :recorded-text="recordedText"
      :finished="timerFinished"
      :finished-text="finishedText"
      :start-label="t('sleep.startTimer')"
      :stop-label="t('sleep.stopTimer')"
      :hint="t('sleep.timerHint')"
      kind="sleep"
      :start-ts="fromDateTimeLocal(startTime)"
      @start="onTimerStart"
      @stop="onTimerStop"
    />

    <div class="time-row">
      <div class="form-field">
        <label class="form-label">{{ t('sleep.startLabel') }}</label>
        <input v-model="startTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
    </div>

    <FormNotes v-model="notes" :label="t('sleep.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>

<style scoped>
.type-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
