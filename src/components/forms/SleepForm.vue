<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSleepStore } from '@/stores/sleep'
import { useFormErrors } from '@/composables/useFormErrors'
import { useTimedRecord } from '@/composables/useTimedRecord'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; startTime: number; endTime: number; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: []; startRecord: [] }>()

const sleepStore = useSleepStore()
const err = useFormErrors()

const notes = ref(props.editing?.notes ?? '')

const { startTime, endTime, isRecording, isEditing, durationText, submit } = useTimedRecord({
  kind: 'sleep',
  editing: props.editing,
  err,
  invalidStart: () => t('sleep.invalidStart'),
  invalidOrder: () => t('sleep.invalidOrder'),
  // 睡眠类型不再区分：统一按「小睡」保存（历史 night 记录编辑保存后也会归一到 nap）
  buildFields: () => ({ notes: notes.value || undefined }),
  getRecordStartTime: (recordId) => sleepStore.sleeps.find((s) => s.id === recordId)?.startTime,
  hydrate: (recordId) => {
    const record = sleepStore.sleeps.find((s) => s.id === recordId)
    if (record) notes.value = record.notes ?? ''
  },
  add: (fields, start) => sleepStore.add({ type: 'nap', startTime: start, notes: fields.notes }),
  addRange: (fields, start, end) =>
    sleepStore.add({ type: 'nap', startTime: start, endTime: end, notes: fields.notes }),
  update: (id, fields, start, end) =>
    sleepStore.update(id, { type: 'nap', startTime: start, endTime: end!, notes: fields.notes }),
  // 编辑必须有完整区间
  validateEdit: (start, end) => {
    if (end == null) {
      err.set('endTime', t('sleep.invalidRange'))
      return false
    }
    if (end <= start) {
      err.set('endTime', t('sleep.invalidOrder'))
      return false
    }
    return true
  },
  finishRecording: (recordId, endTs) => sleepStore.update(recordId, { endTime: endTs }),
  emit: {
    saved: () => emit('saved'),
    startRecord: () => emit('startRecord'),
  },
})

const submitLabel = computed(() => {
  if (isEditing.value) return t('common.saveEdit')
  if (isRecording.value) return t('sleep.endRecord')
  return t('sleep.startRecord')
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="sleep-form" @submit.prevent="onSubmit">
    <div class="time-row">
      <TextField
        v-model="startTime"
        type="datetime-local"
        step="1"
        :label="t('sleep.startLabel')"
        :errors="err"
        error-key="startTime"
        :placeholder="t('common.selectDateTime')"
        :disabled="isRecording"
      />
      <TextField
        v-model="endTime"
        type="datetime-local"
        step="1"
        :label="t('sleep.endLabel')"
        :errors="err"
        error-key="endTime"
        :placeholder="t('common.selectDateTime')"
      />
    </div>

    <p v-if="durationText" class="duration-hint">{{ durationText }}</p>

    <FormNotes v-model="notes" :label="t('sleep.notesLabel')" :placeholder="t('common.optional')" />

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
