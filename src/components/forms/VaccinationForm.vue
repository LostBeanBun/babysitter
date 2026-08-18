<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VaccinationStatus } from '@/types'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useVaccinationStore } from '@/stores/vaccination'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; date: number; name: string; dose?: string; status: VaccinationStatus; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const vaccinationStore = useVaccinationStore()

const name = ref(props.editing?.name ?? '')
const dose = ref(props.editing?.dose ?? '')
const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const status = ref<VaccinationStatus>(props.editing?.status ?? 'planned')
const notes = ref(props.editing?.notes ?? '')

const STATUS_OPTIONS: { value: VaccinationStatus; label: string; icon: string; color: string }[] = [
  { value: 'planned', label: 'vaccination.statusPlanned', icon: '⏰', color: '#D8A45A' },
  { value: 'done', label: 'vaccination.statusDone', icon: '✅', color: '#6AB86A' },
]

async function submit() {
  if (!name.value.trim()) {
    alert(t('vaccination.invalidName'))
    return
  }
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    alert(t('vaccination.invalidDate'))
    return
  }
  if (props.editing) {
    await vaccinationStore.update(props.editing.id, {
      date: d,
      name: name.value.trim(),
      dose: dose.value || undefined,
      status: status.value,
      notes: notes.value || undefined,
    })
  } else {
    await vaccinationStore.add({
      date: d,
      name: name.value.trim(),
      dose: dose.value || undefined,
      status: status.value,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="vaccination-form">
    <div class="form-field">
      <label class="form-label">{{ t('vaccination.nameLabel') }}</label>
      <input v-model="name" type="text" :placeholder="t('vaccination.namePlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('vaccination.doseLabel') }}</label>
      <input v-model="dose" type="text" :placeholder="t('vaccination.dosePlaceholder')" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('vaccination.dateLabel') }}</label>
      <input v-model="date" type="date" class="form-input" />
    </div>

    <p class="form-label">{{ t('vaccination.statusLabel') }}</p>
    <div class="status-grid">
      <button
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value"
        type="button"
        class="status-btn"
        :class="{ selected: status === opt.value }"
        :style="status === opt.value ? { background: opt.color + '22', borderColor: opt.color, color: opt.color } : undefined"
        @click="status = opt.value"
      >
        <span class="status-icon">{{ opt.icon }}</span>
        <span class="status-label">{{ t(opt.label) }}</span>
      </button>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('vaccination.notesLabel') }}</label>
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
.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.status-btn {
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

.status-btn.selected {
  border-width: 1.5px;
}

.status-icon {
  font-size: 20px;
}

.status-label {
  font-size: 12px;
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
