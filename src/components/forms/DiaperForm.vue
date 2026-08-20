<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiaperType, DiaperColor, DiaperAmount } from '@/types'
import { DIAPER_TYPE_LIST, DIAPER_COLOR_LABELS, DIAPER_COLOR_DOTS, DIAPER_AMOUNT_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useDiaperStore } from '@/stores/diaper'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; type: DiaperType; time: number; color?: DiaperColor; amount?: DiaperAmount; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const diaperStore = useDiaperStore()

const type = ref<DiaperType>(props.editing?.type ?? 'wet')
const color = ref<DiaperColor | ''>(props.editing?.color ?? '')
const amount = ref<DiaperAmount | ''>(props.editing?.amount ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  const ts = fromDateTimeLocal(time.value) ?? Date.now()
  if (props.editing) {
    await diaperStore.update(props.editing.id, {
      type: type.value,
      time: ts,
      color: color.value || undefined,
      amount: amount.value || undefined,
      notes: notes.value || undefined,
    })
  } else {
    await diaperStore.add({
      type: type.value,
      time: ts,
      color: color.value || undefined,
      amount: amount.value || undefined,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="diaper-form">
    <p class="form-label">{{ t('diaper.typeLabel') }}</p>
    <div class="type-grid">
      <button
        v-for="opt in DIAPER_TYPE_LIST"
        :key="opt.value"
        type="button"
        class="type-btn"
        :class="{ selected: type === opt.value }"
        :style="
          type === opt.value ? { background: opt.color + '22', borderColor: opt.color, color: opt.color } : undefined
        "
        @click="type = opt.value"
      >
        <span class="type-icon">{{ opt.icon }}</span>
        <span class="type-label">{{ t(opt.label) }}</span>
      </button>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('diaper.colorLabel') }}</label>
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
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('diaper.amountLabel') }}</label>
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
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('diaper.timeLabel') }}</label>
      <input v-model="time" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
    </div>

    <FormNotes v-model="notes" :label="t('diaper.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>

<style scoped>
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: all 0.12s ease;
}

.type-btn.selected {
  border-width: 1.5px;
}

.type-icon {
  font-size: 20px;
}

.type-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

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
  border: 1.5px solid var(--border);
  background: var(--surface);
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.12s ease;
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
  border: 1.5px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.12s ease;
}

.amount-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-weight: 600;
}
</style>
