<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TemperatureMethod } from '@/types'
import { TEMP_METHOD_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useTemperatureStore } from '@/stores/temperature'
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import ChoiceGrid, { type ChoiceOption } from '@/components/common/ChoiceGrid.vue'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; value: number; method?: TemperatureMethod; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const temperatureStore = useTemperatureStore()
const err = useFormErrors()

const value = ref<string>(props.editing?.value != null ? String(props.editing.value) : '')
const method = ref<TemperatureMethod | ''>(props.editing?.method ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

const methodOptions = computed<ChoiceOption[]>(() =>
  TEMP_METHOD_LIST.map((opt) => ({ value: opt.value, icon: opt.icon, label: t(opt.label) })),
)

function validate() {
  const v = Number(value.value)
  if (value.value === '' || isNaN(v) || v < 35 || v > 43) {
    err.set('value', t('temperature.invalidValue'))
    return null
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    err.set('time', t('temperature.invalidTime'))
    return null
  }
  return {
    time: ts,
    value: v,
    method: method.value || undefined,
    notes: notes.value || undefined,
  }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => temperatureStore.add(payload),
  update: (id, payload) => temperatureStore.update(id, payload),
  onSaved: () => emit('saved'),
})
</script>

<template>
  <div class="temperature-form">
    <TextField
      v-model="value"
      type="number"
      min="35"
      max="43"
      step="0.1"
      inputmode="decimal"
      suffix="°C"
      :label="t('temperature.valueLabel')"
      :errors="err"
      error-key="value"
      :placeholder="t('temperature.valuePlaceholder')"
    />

    <p class="form-label">{{ t('temperature.methodLabel') }}</p>
    <ChoiceGrid v-model="method" :options="methodOptions" :columns="4" clearable />

    <TextField
      v-model="time"
      type="datetime-local"
      step="1"
      :label="t('temperature.timeLabel')"
      :errors="err"
      error-key="time"
      :placeholder="t('common.selectDateTime')"
    />

    <FormNotes v-model="notes" :label="t('temperature.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>
