<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useGrowthStore } from '@/stores/growth'
import FormNotes from '@/components/common/FormNotes.vue'

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

const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const weight = ref<string>(props.editing?.weight != null ? String(props.editing.weight) : '')
const height = ref<string>(props.editing?.height != null ? String(props.editing.height) : '')
const headCircumference = ref<string>(
  props.editing?.headCircumference != null ? String(props.editing.headCircumference) : '',
)
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    alert(t('growth.invalidDate'))
    return
  }
  const w = weight.value ? Number(weight.value) : undefined
  const h = height.value ? Number(height.value) : undefined
  const hc = headCircumference.value ? Number(headCircumference.value) : undefined
  if (w !== undefined && (isNaN(w) || w <= 0)) {
    alert(t('growth.invalidWeight'))
    return
  }
  if (h !== undefined && (isNaN(h) || h <= 0)) {
    alert(t('growth.invalidHeight'))
    return
  }
  if (hc !== undefined && (isNaN(hc) || hc <= 0)) {
    alert(t('growth.invalidHead'))
    return
  }
  if (w === undefined && h === undefined && hc === undefined) {
    alert(t('growth.invalidEmpty'))
    return
  }

  if (props.editing) {
    await growthStore.update(props.editing.id, {
      date: d,
      weight: w,
      height: h,
      headCircumference: hc,
      notes: notes.value || undefined,
    })
  } else {
    await growthStore.add({ date: d, weight: w, height: h, headCircumference: hc, notes: notes.value || undefined })
  }
  emit('saved')
}
</script>

<template>
  <div class="growth-form">
    <div class="form-field">
      <label class="form-label">{{ t('growth.dateLabel') }}</label>
      <input v-model="date" type="date" :placeholder="t('common.selectDate')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('growth.weightLabel') }}</label>
      <input
        v-model="weight"
        type="number"
        min="0"
        step="0.1"
        :placeholder="t('growth.weightPlaceholder')"
        class="form-input"
        inputmode="decimal"
      />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('growth.heightLabel') }}</label>
      <input
        v-model="height"
        type="number"
        min="0"
        step="0.5"
        :placeholder="t('growth.heightPlaceholder')"
        class="form-input"
        inputmode="decimal"
      />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('growth.headLabel') }}</label>
      <input
        v-model="headCircumference"
        type="number"
        min="0"
        step="0.1"
        :placeholder="t('growth.headPlaceholder')"
        class="form-input"
        inputmode="decimal"
      />
    </div>

    <FormNotes v-model="notes" :label="t('growth.notesLabel')" :placeholder="t('common.optional')" />

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
