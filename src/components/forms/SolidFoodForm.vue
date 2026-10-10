<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useSolidFoodStore } from '@/stores/solidFood'
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; food: string; amount?: string; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const solidFoodStore = useSolidFoodStore()
const err = useFormErrors()

const food = ref(props.editing?.food ?? '')
const amount = ref(props.editing?.amount ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

function validate() {
  if (!food.value.trim()) {
    err.set('food', t('solidFood.invalidFood'))
    return null
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    err.set('time', t('solidFood.invalidTime'))
    return null
  }
  return {
    time: ts,
    food: food.value.trim(),
    amount: amount.value || undefined,
    notes: notes.value || undefined,
  }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => solidFoodStore.add(payload),
  update: (id, payload) => solidFoodStore.update(id, payload),
  onSaved: () => emit('saved'),
})
</script>

<template>
  <div class="solid-food-form">
    <TextField v-model="food" :label="t('solidFood.foodLabel')" :errors="err" error-key="food" :placeholder="t('solidFood.foodPlaceholder')" />

    <TextField v-model="amount" :label="t('solidFood.amountLabel')" :placeholder="t('solidFood.amountPlaceholder')" />

    <TextField
      v-model="time"
      type="datetime-local"
      step="1"
      :label="t('solidFood.timeLabel')"
      :errors="err"
      error-key="time"
      :placeholder="t('common.selectDateTime')"
    />

    <FormNotes v-model="notes" :label="t('solidFood.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>
