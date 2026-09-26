<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useSolidFoodStore } from '@/stores/solidFood'
import { useFormErrors } from '@/composables/useFormErrors'
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

async function submit() {
  err.clearAll()
  if (!food.value.trim()) {
    err.set('food', t('solidFood.invalidFood'))
    return
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    err.set('time', t('solidFood.invalidTime'))
    return
  }
  if (props.editing) {
    await solidFoodStore.update(props.editing.id, {
      time: ts,
      food: food.value.trim(),
      amount: amount.value || undefined,
      notes: notes.value || undefined,
    })
  } else {
    await solidFoodStore.add({
      time: ts,
      food: food.value.trim(),
      amount: amount.value || undefined,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="solid-food-form">
    <div class="form-field" :class="{ 'has-error': err.has('food') }">
      <label class="form-label">{{ t('solidFood.foodLabel') }}</label>
      <input
        v-model="food"
        type="text"
        :placeholder="t('solidFood.foodPlaceholder')"
        class="form-input"
        @input="err.clear('food')"
      />
      <p v-if="err.get('food')" class="field-error">{{ err.get('food') }}</p>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('solidFood.amountLabel') }}</label>
      <input v-model="amount" type="text" :placeholder="t('solidFood.amountPlaceholder')" class="form-input" />
    </div>

    <div class="form-field" :class="{ 'has-error': err.has('time') }">
      <label class="form-label">{{ t('solidFood.timeLabel') }}</label>
      <input
        v-model="time"
        type="datetime-local" step="1"
        :placeholder="t('common.selectDateTime')"
        class="form-input"
        @input="err.clear('time')"
      />
      <p v-if="err.get('time')" class="field-error">{{ err.get('time') }}</p>
    </div>

    <FormNotes v-model="notes" :label="t('solidFood.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>
