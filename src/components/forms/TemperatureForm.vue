<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TemperatureMethod } from '@/types'
import { TEMP_METHOD_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useTemperatureStore } from '@/stores/temperature'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; value: number; method?: TemperatureMethod; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const temperatureStore = useTemperatureStore()

const value = ref<string>(props.editing?.value != null ? String(props.editing.value) : '')
const method = ref<TemperatureMethod | ''>(props.editing?.method ?? '')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  const v = Number(value.value)
  if (value.value === '' || isNaN(v) || v < 35 || v > 43) {
    alert(t('temperature.invalidValue'))
    return
  }
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    alert(t('temperature.invalidTime'))
    return
  }
  if (props.editing) {
    await temperatureStore.update(props.editing.id, {
      time: ts,
      value: v,
      method: method.value || undefined,
      notes: notes.value || undefined,
    })
  } else {
    await temperatureStore.add({
      time: ts,
      value: v,
      method: method.value || undefined,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="temperature-form">
    <div class="form-field">
      <label class="form-label">{{ t('temperature.valueLabel') }}</label>
      <div class="value-wrap">
        <input
          v-model="value"
          type="number"
          min="35"
          max="43"
          step="0.1"
          :placeholder="t('temperature.valuePlaceholder')"
          class="form-input"
          inputmode="decimal"
        />
        <span class="value-unit">℃</span>
      </div>
    </div>

    <p class="form-label">{{ t('temperature.methodLabel') }}</p>
    <div class="method-grid">
      <button
        v-for="opt in TEMP_METHOD_LIST"
        :key="opt.value"
        type="button"
        class="method-btn"
        :class="{ selected: method === opt.value }"
        @click="method = method === opt.value ? '' : opt.value"
      >
        <span class="method-icon">{{ opt.icon }}</span>
        <span class="method-label">{{ t(opt.label) }}</span>
      </button>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('temperature.timeLabel') }}</label>
      <input v-model="time" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('temperature.notesLabel') }}</label>
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
.value-wrap {
  position: relative;
}

.value-wrap .form-input {
  padding-right: 34px;
}

.value-unit {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.method-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.method-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: all 0.12s ease;
}

.method-btn.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.method-icon {
  font-size: 18px;
}

.method-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>
