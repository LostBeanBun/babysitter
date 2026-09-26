<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FeedType, BreastSide } from '@/types'
import { FEED_TYPE_LIST, BREAST_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useFeedingStore } from '@/stores/feeding'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useFormErrors } from '@/composables/useFormErrors'
import { showToast } from '@/composables/useToast'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

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
}>()
const emit = defineEmits<{ saved: []; cancelled: []; startRecord: [] }>()

const feedingStore = useFeedingStore()
const activeTimer = useActiveTimer()
const err = useFormErrors()

const type = ref<FeedType>(props.editing?.type ?? 'breast')
const side = ref<BreastSide>(props.editing?.side ?? 'left')
const isBreast = computed(() => type.value === 'breast')
const amount = ref<string>(props.editing?.amount != null ? String(props.editing.amount) : '')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

const activeEntry = computed(() => activeTimer.getByKind('feeding'))
const isRecording = computed(() => !!activeEntry.value)
const isEditing = computed(() => !!props.editing && !isRecording.value)

const durationText = computed(() => {
  const start = fromDateTimeLocal(startTime.value)
  const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined
  if (start && end && end > start) return formatDuration(end - start)
  return null
})

const submitLabel = computed(() => {
  if (isRecording.value) return t('feed.endRecord')
  if (isEditing.value) return t('common.saveEdit')
  if (!isBreast.value) return t('common.save')
  return t('feed.startRecord')
})

/** 瓶喂用单时间点；亲喂或计时中用开始/结束区间 */
const showTimePair = computed(() => isBreast.value || isRecording.value)

onMounted(() => {
  if (activeEntry.value) {
    const record = feedingStore.feedings.find((f) => f.id === activeEntry.value!.recordId)
    if (record) {
      type.value = record.type
      side.value = record.side ?? 'left'
      amount.value = record.amount != null ? String(record.amount) : ''
      notes.value = record.notes ?? ''
      startTime.value = toDateTimeLocal(record.startTime)
      endTime.value = ''
    }
  }
})

/** 瓶喂奶量必填；合法返回数值，非法标记字段错误返回 null */
function parseAmount(): number | null {
  const amt = amount.value ? Number(amount.value) : NaN
  if (!amount.value || isNaN(amt) || amt <= 0) {
    err.set('amount', t('feed.invalidAmount'))
    return null
  }
  return amt
}

async function submit() {
  err.clearAll()
  try {
    const start = fromDateTimeLocal(startTime.value)
    if (start == null) {
      err.set('startTime', t('feed.invalidStart'))
      return
    }
    const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined

    // 计时中：结束记录，结束时间写回（空则取当前时间）
    if (isRecording.value && activeEntry.value) {
      const endTs = end ?? Date.now()
      if (endTs <= start) {
        err.set('endTime', t('feed.invalidOrder'))
        return
      }
      await feedingStore.update(activeEntry.value.recordId, {
        endTime: endTs,
        duration: endTs - start,
      })
      activeTimer.reset(activeEntry.value.id)
      emit('saved')
      return
    }

    // 编辑
    if (isEditing.value && props.editing) {
      if (isBreast.value) {
        if (end != null && end <= start) {
          err.set('endTime', t('feed.invalidOrder'))
          return
        }
        await feedingStore.update(props.editing.id, {
          type: type.value,
          side: side.value,
          startTime: start,
          endTime: end,
          duration: end && end > start ? end - start : undefined,
          amount: undefined,
          notes: notes.value || undefined,
        })
      } else {
        const amt = parseAmount()
        if (amt == null) return
        await feedingStore.update(props.editing.id, {
          type: type.value,
          side: undefined,
          startTime: start,
          endTime: undefined,
          duration: undefined,
          amount: amt,
          notes: notes.value || undefined,
        })
      }
      emit('saved')
      return
    }

    if (isBreast.value) {
      // 亲喂：结束时间已填 → 直接保存；空 → 从输入开始时间启动计时
      if (end != null) {
        if (end <= start) {
          err.set('endTime', t('feed.invalidOrder'))
          return
        }
        await feedingStore.add({
          type: type.value,
          side: side.value,
          startTime: start,
          endTime: end,
          notes: notes.value || undefined,
        })
        emit('saved')
        return
      }
      const id = await feedingStore.add({ type: type.value, side: side.value, startTime: start, notes: notes.value || undefined })
      activeTimer.start('feeding', id, start)
      emit('startRecord')
      return
    }

    // 瓶喂：单时间点直接保存，不启动计时
    const amt = parseAmount()
    if (amt == null) return
    await feedingStore.add({ type: type.value, startTime: start, amount: amt, notes: notes.value || undefined })
    emit('saved')
  } catch {
    showToast(t('errors.generic'))
  }
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
        :disabled="isRecording"
        @click="type = opt.value"
      >
        <span class="type-icon">{{ opt.icon }}</span>
        <span class="type-label">{{ t(opt.label) }}</span>
      </button>
    </div>

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

    <div v-if="!isBreast" class="form-field" :class="{ 'has-error': err.has('amount') }">
      <label class="form-label">{{ t('feed.amountLabel') }}</label>
      <input
        v-model="amount"
        type="number"
        min="0"
        step="5"
        :placeholder="t('feed.amountPlaceholder')"
        class="form-input"
        inputmode="decimal"
        :disabled="isRecording"
        @input="err.clear('amount')"
      />
      <p v-if="err.get('amount')" class="field-error">{{ err.get('amount') }}</p>
    </div>

    <template v-if="showTimePair">
      <div class="time-row">
        <div class="form-field" :class="{ 'has-error': err.has('startTime') }">
          <label class="form-label">{{ t('feed.startLabel') }}</label>
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
          <label class="form-label">{{ t('feed.endLabel') }}</label>
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
    </template>
    <div v-else class="form-field" :class="{ 'has-error': err.has('startTime') }">
      <label class="form-label">{{ t('feed.timeLabel') }}</label>
      <input
        v-model="startTime"
        type="datetime-local" step="1"
        :placeholder="t('common.selectDateTime')"
        class="form-input"
        @input="err.clear('startTime')"
      />
      <p v-if="err.get('startTime')" class="field-error">{{ err.get('startTime') }}</p>
    </div>

    <FormNotes v-model="notes" :label="t('feed.notesLabel')" :placeholder="t('common.optional')" />

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
  border-width: 1.5px;
}

.type-btn:disabled,
.side-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.type-icon {
  font-size: 20px;
}

.type-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.side-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s var(--spring);
}

.side-btn.selected {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(232, 144, 108, 0.08);
}

.side-btn:active {
  transform: scale(0.97);
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
  .time-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 375px) {
  .type-grid { gap: 8px; }
  .type-btn { padding: 10px 4px; }
  .type-icon { font-size: 18px; }
  .type-label { font-size: 11px; }
  .side-btn { padding: 8px 6px; font-size: 12px; }
}
</style>
