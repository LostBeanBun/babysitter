<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FeedType } from '@/types'
import { FEED_TYPE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useFeedingStore } from '@/stores/feeding'
import FormTimer from '@/components/common/FormTimer.vue'
import FormNotes from '@/components/common/FormNotes.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: {
    id: number
    type: FeedType
    startTime: number
    endTime?: number
    duration?: number
    amount?: number
    notes?: string
  }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const feedingStore = useFeedingStore()

const type = ref<FeedType>(props.editing?.type ?? 'breast_both')
const isBreast = computed(() => type.value.startsWith('breast'))
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

// 计时器回调：由 FormTimer 组件驱动
const timerFinished = ref(false)

function onTimerStart() {
  startTime.value = toDateTimeLocal(Date.now())
}

function onTimerStop({ start, end }: { start: number; end: number }) {
  timerFinished.value = true
  startTime.value = toDateTimeLocal(start)
  endTime.value = toDateTimeLocal(end)
}

/** 编辑既有亲喂记录时回显时长 */
const editingRecordedText = computed(() =>
  t('feed.recordedDuration', { duration: props.editing?.duration ? formatDuration(props.editing.duration) : '—' }),
)

/** 计时结束后回显起止区间 */
const finishedText = computed(() =>
  t('feed.recordedRange', {
    start: startTime.value.replace('T', ' '),
    end: endTime.value ? t('feed.endRange', { end: endTime.value.replace('T', ' ') }) : '',
  }),
)

async function submit() {
  const start = fromDateTimeLocal(startTime.value) ?? Date.now()
  const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined

  if (props.editing) {
    await feedingStore.update(props.editing.id, {
      type: type.value,
      startTime: start,
      endTime: end,
      duration: end && end > start ? end - start : undefined,
      amount: isBreast.value ? undefined : amount.value ? Number(amount.value) : undefined,
      notes: notes.value || undefined,
    })
  } else if (isBreast.value) {
    await feedingStore.add({ type: type.value, startTime: start, endTime: end, notes: notes.value || undefined })
  } else {
    const amt = Number(amount.value)
    if (!amount.value || isNaN(amt) || amt <= 0) {
      alert(t('feed.invalidAmount'))
      return
    }
    await feedingStore.add({ type: type.value, startTime: start, amount: amt, notes: notes.value || undefined })
  }
  emit('saved')
}
</script>

<template>
  <div class="feeding-form">
    <p class="form-label">{{ t('feed.typeLabel') }}</p>
    <div class="type-grid">
      <button
        v-for="opt in FEED_TYPE_LIST"
        :key="opt.value"
        type="button"
        class="type-btn"
        :class="{ selected: type === opt.value }"
        :style="
          type === opt.value ? { background: opt.color + '22', borderColor: opt.color, color: opt.color } : undefined
        "
        @click="type = opt.value"
      >
        <span class="type-icon">{{ opt.icon }}</span>
        <span class="type-label">{{ t(opt.label) }}</span>
      </button>
    </div>

    <!-- 亲喂计时 -->
    <FormTimer
      v-if="isBreast"
      :editing="!!props.editing"
      :recorded-text="editingRecordedText"
      :finished="timerFinished"
      :finished-text="finishedText"
      :start-label="t('feed.startTimer')"
      :stop-label="t('feed.stopTimer')"
      :hint="t('feed.timerHint')"
      @start="onTimerStart"
      @stop="onTimerStop"
    />

    <!-- 瓶喂奶量 -->
    <template v-else>
      <div class="form-field">
        <label class="form-label">{{ t('feed.amountLabel') }}</label>
        <input
          v-model="amount"
          type="number"
          min="0"
          step="5"
          :placeholder="t('feed.amountPlaceholder')"
          class="form-input"
          inputmode="decimal"
        />
      </div>
    </template>

    <div class="time-row">
      <div class="form-field">
        <label class="form-label">{{ t('feed.startLabel') }}</label>
        <input v-model="startTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
      <div v-if="isBreast" class="form-field">
        <label class="form-label">{{ t('feed.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
    </div>

    <FormNotes v-model="notes" :label="t('feed.notesLabel')" :placeholder="t('common.optional')" />

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
  border-width: 1.5px;
}

.type-icon {
  font-size: 20px;
}

.type-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
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
