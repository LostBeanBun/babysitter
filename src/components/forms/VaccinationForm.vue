<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VaccinationStatus } from '@/types'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useVaccinationStore } from '@/stores/vaccination'
import { useBabyStore } from '@/stores/baby'
import {
  VACCINE_PLAN,
  SELF_PAID_VACCINE_PLAN,
  planDateFromBirth,
  type VaccinePlanItem,
  type VaccinePlanCategory,
} from '@/constants/vaccinePlan'
import BaseModal from '@/components/common/BaseModal.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; date: number; name: string; dose?: string; status: VaccinationStatus; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const vaccinationStore = useVaccinationStore()
const babyStore = useBabyStore()

const name = ref(props.editing?.name ?? '')
const dose = ref(props.editing?.dose ?? '')
const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const status = ref<VaccinationStatus>(props.editing?.status ?? 'planned')
const notes = ref(props.editing?.notes ?? '')

const STATUS_OPTIONS: { value: VaccinationStatus; label: string; icon: string; color: string }[] = [
  { value: 'planned', label: 'vaccination.statusPlanned', icon: '⏰', color: '#D8A45A' },
  { value: 'done', label: 'vaccination.statusDone', icon: '✅', color: '#6AB86A' },
]

// —— 计划库选择 ——
const planOpen = ref(false)
const planTab = ref<VaccinePlanCategory>('free')
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))

/** 当前 Tab 展示的疫苗列表 */
const planItems = computed(() => (planTab.value === 'free' ? VACCINE_PLAN : SELF_PAID_VACCINE_PLAN))

/** 已添加过的疫苗（同名+同剂次），避免重复添加 */
const existingKeys = computed(() =>
  new Set(vaccinationStore.vaccinations.map((v) => `${v.name}|${v.dose ?? ''}`)),
)

function pickFromPlan(item: VaccinePlanItem) {
  if (!activeBaby.value?.birthDate) {
    alert(t('vaccination.needBirthDate'))
    return
  }
  name.value = item.name
  dose.value = item.dose
  date.value = planDateFromBirth(activeBaby.value.birthDate, item.months)
  planOpen.value = false
}

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
      <div class="name-row">
        <input v-model="name" type="text" :placeholder="t('vaccination.namePlaceholder')" class="form-input" />
        <button type="button" class="btn btn-outline plan-btn" @click="planOpen = true">
          📋 {{ t('vaccination.planPicker') }}
        </button>
      </div>
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

    <BaseModal :show="planOpen" :title="t('vaccination.planTitle')" @close="planOpen = false">
      <p class="plan-tip">{{ t('vaccination.planTip', { name: activeBaby?.name ?? '' }) }}</p>
      <div class="plan-tabs" role="tablist">
        <button
          type="button"
          class="plan-tab"
          :class="{ active: planTab === 'free' }"
          role="tab"
          :aria-selected="planTab === 'free'"
          @click="planTab = 'free'"
        >
          🆓 {{ t('vaccination.planTabFree') }}
        </button>
        <button
          type="button"
          class="plan-tab"
          :class="{ active: planTab === 'self' }"
          role="tab"
          :aria-selected="planTab === 'self'"
          @click="planTab = 'self'"
        >
          💉 {{ t('vaccination.planTabSelf') }}
        </button>
      </div>
      <div class="plan-list">
        <button
          v-for="(item, i) in planItems"
          :key="i"
          type="button"
          class="plan-item"
          :class="{ disabled: existingKeys.has(`${item.name}|${item.dose}`) }"
          :disabled="existingKeys.has(`${item.name}|${item.dose}`)"
          @click="pickFromPlan(item)"
        >
          <span class="plan-item-name">{{ item.name }}</span>
          <span class="plan-item-meta">
            {{ item.dose }} · {{ t('vaccination.planMonth', { n: item.months }) }}
            <span v-if="item.note" class="plan-item-note">{{ item.note }}</span>
          </span>
        </button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.name-row {
  display: flex;
  gap: 8px;
}

.name-row .form-input {
  flex: 1;
  min-width: 0;
}

.plan-btn {
  flex-shrink: 0;
  white-space: nowrap;
  min-height: 40px;
}

.plan-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
  line-height: 1.6;
}

.plan-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.plan-tab {
  padding: 9px 6px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.12s ease;
}

.plan-tab.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.plan-list {
  display: grid;
  gap: 8px;
  max-height: 46vh;
  overflow-y: auto;
}

.plan-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  text-align: left;
  transition: all 0.12s ease;
}

.plan-item:not(.disabled):active {
  transform: scale(0.98);
  border-color: var(--primary);
  background: var(--primary-soft);
}

.plan-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.plan-item-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.plan-item-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.plan-item-note {
  font-size: 11px;
  color: var(--text-muted);
}

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
