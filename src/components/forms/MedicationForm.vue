<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useMedicationStore } from '@/stores/medication'
import { useFormErrors } from '@/composables/useFormErrors'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

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

async function submit() {
  err.clearAll()
  if (!name.value.trim()) {
    err.set('name', t('medication.invalidName'))
    return
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    err.set('time', t('medication.invalidTime'))
    return
  }
  if (props.editing) {
    await medicationStore.update(props.editing.id, {
      time: ts,
      name: name.value.trim(),
      dose: dose.value || undefined,
      notes: notes.value || undefined,
    })
  } else {
    await medicationStore.add({
      time: ts,
      name: name.value.trim(),
      dose: dose.value || undefined,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="medication-form">
    <div class="form-field" :class="{ 'has-error': err.has('name') }">
      <label class="form-label">{{ t('medication.nameLabel') }}</label>
      <input
        v-model="name"
        type="text"
        :placeholder="t('medication.namePlaceholder')"
        class="form-input"
        @input="err.clear('name')"
      />
      <p v-if="err.get('name')" class="field-error">{{ err.get('name') }}</p>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('medication.doseLabel') }}</label>
      <input v-model="dose" type="text" :placeholder="t('medication.dosePlaceholder')" class="form-input" />
    </div>

    <div class="form-field" :class="{ 'has-error': err.has('time') }">
      <label class="form-label">{{ t('medication.timeLabel') }}</label>
      <input
        v-model="time"
        type="datetime-local" step="1"
        :placeholder="t('common.selectDateTime')"
        class="form-input"
        @input="err.clear('time')"
      />
      <p v-if="err.get('time')" class="field-error">{{ err.get('time') }}</p>
    </div>

    <FormNotes v-model="notes" :label="t('medication.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>
