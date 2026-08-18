<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useMedicationStore } from '@/stores/medication'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; name: string; dose?: string; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const medicationStore = useMedicationStore()

const name = ref(props.editing?.name ?? '')
const dose = ref(props.editing?.dose ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  if (!name.value.trim()) {
    alert(t('medication.invalidName'))
    return
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    alert(t('medication.invalidTime'))
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
    <div class="form-field">
      <label class="form-label">{{ t('medication.nameLabel') }}</label>
      <input v-model="name" type="text" :placeholder="t('medication.namePlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('medication.doseLabel') }}</label>
      <input v-model="dose" type="text" :placeholder="t('medication.dosePlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('medication.timeLabel') }}</label>
      <input v-model="time" type="datetime-local" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('medication.notesLabel') }}</label>
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
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>
