<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SleepType } from '@/types'
import { SLEEP_TYPE_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { useSleepStore } from '@/stores/sleep'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { showToast } from '@/composables/useToast'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: []; startRecord: [] }>()

const sleepStore = useSleepStore()
const activeTimer = useActiveTimer()

const type = ref<SleepType>(props.editing?.type ?? 'nap')
const notes = ref(props.editing?.notes ?? '')
const startTime = ref(toDateTimeLocal(props.editing?.startTime ?? Date.now()))
const endTime = ref(props.editing?.endTime ? toDateTimeLocal(props.editing.endTime) : '')

const activeEntry = computed(() => activeTimer.getByKind('sleep'))
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
  if (isRecording.value) return t('sleep.endRecord')
  return t('sleep.startRecord')
})

onMounted(() => {
  if (activeEntry.value) {
    const record = sleepStore.sleeps.find((s) => s.id === activeEntry.value!.recordId)
    if (record) {
      type.value = record.type
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
      if (endTs <= start) {
        alert(t('sleep.invalidOrder'))
        return
      }
      await sleepStore.update(activeEntry.value.recordId, {
        endTime: endTs,
        duration: endTs - start,
      })
      activeTimer.reset(activeEntry.value.id)
      emit('saved')
      return
    }

    if (isEditing.value && props.editing) {
      if (!end) {
        alert(t('sleep.invalidRange'))
        return
      }
      if (end <= start) {
        alert(t('sleep.invalidOrder'))
        return
      }
      await sleepStore.update(props.editing.id, {
        type: type.value,
        startTime: start,
        endTime: end,
        notes: notes.value || undefined,
      })
      emit('saved')
      return
    }

    const id = await sleepStore.add({ type: type.value, startTime: start, notes: notes.value || undefined })
    activeTimer.start('sleep', id, start)
    emit('startRecord')
  } catch {
    showToast(t('errors.generic'))
  }
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

    <div class="time-row">
      <div class="form-field">
        <label class="form-label">{{ t('sleep.startLabel') }}</label>
        <input
          v-model="startTime"
          type="datetime-local"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          :disabled="isRecording"
        />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.endLabel') }}</label>
        <input v-model="endTime" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
      </div>
    </div>

    <p v-if="durationText" class="duration-hint">{{ durationText }}</p>

    <FormNotes v-model="notes" :label="t('sleep.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions
      :editing="isEditing"
      :submit-label="submitLabel"
      @cancelled="emit('cancelled')"
      @save="submit"
    />
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
  .type-row { gap: 8px; }
  .type-btn { padding: 10px 4px; }
  .type-icon { font-size: 18px; }
  .type-label { font-size: 11px; }
}
</style>
