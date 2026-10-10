<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiaperType, DiaperColor, DiaperAmount } from '@/types'
import { DIAPER_TYPE_LIST, DIAPER_COLOR_LABELS, DIAPER_COLOR_DOTS, DIAPER_AMOUNT_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useDiaperStore } from '@/stores/diaper'
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import ChoiceGrid, { type ChoiceOption } from '@/components/common/ChoiceGrid.vue'
import FormField from '@/components/common/FormField.vue'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; type: DiaperType; time: number; color?: DiaperColor; amount?: DiaperAmount; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const diaperStore = useDiaperStore()
const err = useFormErrors()

const type = ref<DiaperType>(props.editing?.type ?? 'wet')
const color = ref<DiaperColor | ''>(props.editing?.color ?? '')
const amount = ref<DiaperAmount | ''>(props.editing?.amount ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

const typeOptions = computed<ChoiceOption[]>(() =>
  DIAPER_TYPE_LIST.map((opt) => ({ value: opt.value, icon: opt.icon, label: t(opt.label), color: opt.color })),
)

function validate() {
  const ts = fromDateTimeLocal(time.value)
  if (ts == null) {
    err.set('time', t('diaper.invalidTime'))
    return null
  }
  return {
    type: type.value,
    time: ts,
    color: color.value || undefined,
    amount: amount.value || undefined,
    notes: notes.value || undefined,
  }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => diaperStore.add(payload),
  update: (id, payload) => diaperStore.update(id, payload),
  onSaved: () => emit('saved'),
})
</script>

<template>
  <div class="diaper-form">
    <p class="form-label">{{ t('diaper.typeLabel') }}</p>
    <ChoiceGrid v-model="type" :options="typeOptions" />

    <FormField :label="t('diaper.colorLabel')" tag="p">
      <div class="color-row">
        <button
          v-for="(label, key) in DIAPER_COLOR_LABELS"
          :key="key"
          type="button"
          class="color-dot-btn"
          :class="{ selected: color === key }"
          @click="color = color === key ? '' : key"
        >
          <span class="color-dot" :style="{ background: DIAPER_COLOR_DOTS[key] }"></span>
          <span class="color-label">{{ t(label) }}</span>
        </button>
      </div>
    </FormField>

    <FormField :label="t('diaper.amountLabel')" tag="p">
      <div class="amount-row">
        <button
          v-for="(label, key) in DIAPER_AMOUNT_LABELS"
          :key="key"
          type="button"
          class="amount-btn"
          :class="{ selected: amount === key }"
          @click="amount = amount === key ? '' : key"
        >
          {{ t(label) }}
        </button>
      </div>
    </FormField>

    <TextField
      v-model="time"
      type="datetime-local"
      step="1"
      :label="t('diaper.timeLabel')"
      :errors="err"
      error-key="time"
      :placeholder="t('common.selectDateTime')"
    />

    <FormNotes v-model="notes" :label="t('diaper.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>

<style scoped>
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-dot-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface);
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.3s var(--spring);
}

.color-dot-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.amount-row {
  display: flex;
  gap: 8px;
}

.amount-btn {
  flex: 1;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.3s var(--spring);
}

.amount-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-weight: 600;
}
</style>
