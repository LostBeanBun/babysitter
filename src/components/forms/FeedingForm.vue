<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FeedType, BreastSide } from '@/types'
import { FEED_TYPE_LIST, BREAST_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useFeedingStore } from '@/stores/feeding'
import { useActiveTimer } from '@/composables/useActiveTimer'
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
  if (isEditing.value) return t('common.saveEdit')
  if (isRecording.value) return t('feed.endRecord')
  return t('feed.startRecord')
})

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

async function submit() {
  try {
    const start = fromDateTimeLocal(startTime.value) ?? Date.now()
    const end = endTime.value ? fromDateTimeLocal(endTime.value) : undefined

    if (isRecording.value && activeEntry.value) {
      const endTs = end ?? Date.now()
      await feedingStore.update(activeEntry.value.recordId, {
        endTime: endTs,
        duration: endTs > start ? endTs - start : undefined,
      })
      activeTimer.reset(activeEntry.value.id)
      emit('saved')
      return
    }

    if (isEditing.value && props.editing) {
      await feedingStore.update(props.editing.id, {
        type: type.value,
        side: isBreast.value ? side.value : undefined,
        startTime: start,
        endTime: end,
        duration: end && end > start ? end - start : undefined,
        amount: isBreast.value ? undefined : amount.value ? Number(amount.value) : undefined,
        notes: notes.value || undefined,
      })
      emit('saved')
      return
    }

    if (isBreast.value) {
      const id = await feedingStore.add({ type: type.value, side: side.value, startTime: start, notes: notes.value || undefined })
      activeTimer.start('feeding', id, start)
    } else {
      const amt = Number(amount.value)
      if (!amount.value || isNaN(amt) || amt <= 0) {
        alert(t('feed.invalidAmount'))
        return
      }
      const id = await feedingStore.add({ type: type.value, startTime: start, amount: amt, notes: notes.value || undefined })
      activeTimer.start('feeding', id, start)
    }
    emit('startRecord')
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
        @click="side = s.value"
      >
        <span>{{ s.icon }}</span>
        <span>{{ t(s.label) }}</span>
      </button>
    </div>

    <div v-if="!isBreast" class="form-field">
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

    <div class="time-row">
      <div class="form-field">
        <label class="form-label">{{ t('feed.startLabel') }}</label>
        <input
          v-model="startTime"
          type="datetime-local"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          :disabled="isRecording"
        />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('feed.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
    </div>

    <p v-if="durationText" class="duration-hint">{{ durationText }}</p>

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
  padding: 12px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  transition: all 0.3s var(--spring);
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
