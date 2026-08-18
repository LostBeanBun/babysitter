<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FeedType } from '@/types'
import { FEED_TYPE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useFeedingStore } from '@/stores/feeding'

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

// 计时器状态
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
    <template v-if="isBreast">
      <div class="timer-box">
        <template v-if="!timerRunning && !props.editing">
          <button type="button" class="btn btn-primary btn-lg timer-start" @click="startTimer">
            {{ t('feed.startTimer') }}
          </button>
          <p class="timer-hint">{{ t('feed.timerHint') }}</p>
        </template>
        <template v-else-if="timerRunning">
          <div class="timer-display">{{ formatDuration(elapsedMs) }}</div>
          <button type="button" class="btn btn-soft btn-lg" @click="stopTimer">{{ t('feed.stopTimer') }}</button>
        </template>
        <template v-else-if="props.editing">
          <div class="timer-done">
            {{
              t('feed.recordedDuration', {
                duration: props.editing.duration ? formatDuration(props.editing.duration) : '—',
              })
            }}
          </div>
        </template>
        <template v-else>
          <div class="timer-done">
            {{
              t('feed.recordedRange', {
                start: startTime.replace('T', ' '),
                end: endTime ? t('feed.endRange', { end: endTime.replace('T', ' ') }) : '',
              })
            }}
          </div>
        </template>
      </div>
    </template>

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
        <input v-model="startTime" type="datetime-local" class="form-input" />
      </div>
      <div v-if="isBreast" class="form-field">
        <label class="form-label">{{ t('feed.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" class="form-input" />
      </div>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('feed.notesLabel') }}</label>
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

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>
