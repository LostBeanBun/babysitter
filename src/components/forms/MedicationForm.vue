<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useMedicationStore } from '@/stores/medication'
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; name: string; dose?: string; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const medicationStore = useMedicationStore()
const err = useFormErrors()

const name = ref(props.editing?.name ?? '')
const dose = ref(props.editing?.dose ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

function validate() {
  if (!name.value.trim()) {
    err.set('name', t('medication.invalidName'))
    return null
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    err.set('time', t('medication.invalidTime'))
    return null
  }
  return {
    time: ts,
    name: name.value.trim(),
    dose: dose.value || undefined,
    notes: notes.value || undefined,
  }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => medicationStore.add(payload),
  update: (id, payload) => medicationStore.update(id, payload),
  onSaved: () => emit('saved'),
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="medication-form" @submit.prevent="onSubmit">
    <TextField v-model="name" :label="t('medication.nameLabel')" :errors="err" error-key="name" :placeholder="t('medication.namePlaceholder')" />

    <TextField v-model="dose" :label="t('medication.doseLabel')" :placeholder="t('medication.dosePlaceholder')" />

    <TextField
      v-model="time"
      type="datetime-local"
      step="1"
      :label="t('medication.timeLabel')"
      :errors="err"
      error-key="time"
      :placeholder="t('common.selectDateTime')"
    />

    <FormNotes v-model="notes" :label="t('medication.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" />
  </form>
</template>
