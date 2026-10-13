<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useGrowthStore } from '@/stores/growth'
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

const { t } = useI18n()

const props = defineProps<{
  editing?: {
    id: number
    date: number
    weight?: number
    height?: number
    headCircumference?: number
    notes?: string
  }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const growthStore = useGrowthStore()
const err = useFormErrors()

const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const weight = ref<string>(props.editing?.weight != null ? String(props.editing.weight) : '')
const height = ref<string>(props.editing?.height != null ? String(props.editing.height) : '')
const headCircumference = ref<string>(
  props.editing?.headCircumference != null ? String(props.editing.headCircumference) : '',
)
const notes = ref(props.editing?.notes ?? '')

function validate() {
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    err.set('date', t('growth.invalidDate'))
    return null
  }
  const w = weight.value ? Number(weight.value) : undefined
  const h = height.value ? Number(height.value) : undefined
  const hc = headCircumference.value ? Number(headCircumference.value) : undefined
  if (w !== undefined && (isNaN(w) || w <= 0)) {
    err.set('weight', t('growth.invalidWeight'))
    return null
  }
  if (h !== undefined && (isNaN(h) || h <= 0)) {
    err.set('height', t('growth.invalidHeight'))
    return null
  }
  if (hc !== undefined && (isNaN(hc) || hc <= 0)) {
    err.set('head', t('growth.invalidHead'))
    return null
  }
  if (w === undefined && h === undefined && hc === undefined) {
    err.formError.value = t('growth.invalidEmpty')
    return null
  }
  return { date: d, weight: w, height: h, headCircumference: hc, notes: notes.value || undefined }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => growthStore.add(payload),
  update: (id, payload) => growthStore.update(id, payload),
  onSaved: () => emit('saved'),
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="growth-form" @submit.prevent="onSubmit">
    <TextField
      v-model="date"
      type="date"
      :label="t('growth.dateLabel')"
      :errors="err"
      error-key="date"
      :placeholder="t('common.selectDate')"
    />

    <TextField
      v-model="weight"
      type="number"
      min="0"
      step="0.1"
      inputmode="decimal"
      :label="t('growth.weightLabel')"
      :errors="err"
      error-key="weight"
      :placeholder="t('growth.weightPlaceholder')"
    />

    <TextField
      v-model="height"
      type="number"
      min="0"
      step="0.5"
      inputmode="decimal"
      :label="t('growth.heightLabel')"
      :errors="err"
      error-key="height"
      :placeholder="t('growth.heightPlaceholder')"
    />

    <TextField
      v-model="headCircumference"
      type="number"
      min="0"
      step="0.1"
      inputmode="decimal"
      :label="t('growth.headLabel')"
      :errors="err"
      error-key="head"
      :placeholder="t('growth.headPlaceholder')"
    />

    <p v-if="err.formError.value" class="form-error">{{ err.formError.value }}</p>

    <FormNotes v-model="notes" :label="t('growth.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" />
  </form>
</template>
