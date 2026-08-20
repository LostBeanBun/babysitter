<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useSolidFoodStore } from '@/stores/solidFood'
import FormNotes from '@/components/common/FormNotes.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; food: string; amount?: string; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const solidFoodStore = useSolidFoodStore()

const food = ref(props.editing?.food ?? '')
const amount = ref(props.editing?.amount ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  if (!food.value.trim()) {
    alert(t('solidFood.invalidFood'))
    return
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    alert(t('solidFood.invalidTime'))
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
    <div class="form-field">
      <label class="form-label">{{ t('solidFood.foodLabel') }}</label>
      <input v-model="food" type="text" :placeholder="t('solidFood.foodPlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('solidFood.amountLabel') }}</label>
      <input v-model="amount" type="text" :placeholder="t('solidFood.amountPlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('solidFood.timeLabel') }}</label>
      <input v-model="time" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
    </div>

    <FormNotes v-model="notes" :label="t('solidFood.notesLabel')" :placeholder="t('common.optional')" />

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
