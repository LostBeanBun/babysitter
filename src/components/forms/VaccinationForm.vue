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
import { useFormErrors } from '@/composables/useFormErrors'
import { useRecordForm } from '@/composables/useRecordForm'
import { showToast } from '@/composables/useToast'
import ChoiceGrid, { type ChoiceOption } from '@/components/common/ChoiceGrid.vue'
import FormField from '@/components/common/FormField.vue'
import TextField from '@/components/common/TextField.vue'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; date: number; name: string; dose?: string; status: VaccinationStatus; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const vaccinationStore = useVaccinationStore()
const babyStore = useBabyStore()
const err = useFormErrors()

const name = ref(props.editing?.name ?? '')
const dose = ref(props.editing?.dose ?? '')
const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const status = ref<VaccinationStatus>(props.editing?.status ?? 'planned')
const notes = ref(props.editing?.notes ?? '')

const STATUS_OPTIONS: { value: VaccinationStatus; label: string; icon: string; color: string }[] = [
  { value: 'planned', label: 'vaccination.statusPlanned', icon: '⏰', color: '#D8A45A' },
  { value: 'done', label: 'vaccination.statusDone', icon: '✅', color: '#6AB86A' },
]

const statusOptions = computed<ChoiceOption[]>(() =>
  STATUS_OPTIONS.map((opt) => ({ value: opt.value, icon: opt.icon, label: t(opt.label), color: opt.color })),
)

// —— 计划库选择 ——
const planOpen = ref(false)
const planTab = ref<VaccinePlanCategory>('free')
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))

/** 当前 Tab 展示的疫苗列表 */
const planItems = computed(() => (planTab.value === 'free' ? VACCINE_PLAN : SELF_PAID_VACCINE_PLAN))

/** 已添加过的疫苗（同名+同剂次），避免重复添加；编辑中的记录自身不算占用，允许重选以刷新名称/日期 */
const existingKeys = computed(() =>
  new Set(
    vaccinationStore.vaccinations
      .filter((v) => v.id !== props.editing?.id)
      .map((v) => `${v.name}|${v.dose ?? ''}`),
  ),
)

function pickFromPlan(item: VaccinePlanItem) {
  if (!activeBaby.value?.birthDate) {
    showToast(t('vaccination.needBirthDate'))
    return
  }
  name.value = item.name
  dose.value = item.dose
  date.value = planDateFromBirth(activeBaby.value.birthDate, item.months)
  planOpen.value = false
}

function validate() {
  if (!name.value.trim()) {
    err.set('name', t('vaccination.invalidName'))
    return null
  }
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    err.set('date', t('vaccination.invalidDate'))
    return null
  }
  return {
    date: d,
    name: name.value.trim(),
    dose: dose.value || undefined,
    status: status.value,
    notes: notes.value || undefined,
  }
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: (payload) => vaccinationStore.add(payload),
  update: (id, payload) => vaccinationStore.update(id, payload),
  onSaved: () => emit('saved'),
})
const { onSubmit } = useFormSubmit(submit)
</script>

<template>
  <form ref="root" class="vaccination-form" @submit.prevent="onSubmit">
    <FormField :label="t('vaccination.nameLabel')" :errors="err" error-key="name">
      <div class="name-row">
        <input
          v-model="name"
          type="text"
          :placeholder="t('vaccination.namePlaceholder')"
          class="form-input"
          @input="err.clear('name')"
        />
        <button type="button" class="btn btn-outline plan-btn" @click="planOpen = true">
          📋 {{ t('vaccination.planPicker') }}
        </button>
      </div>
    </FormField>

    <TextField v-model="dose" :label="t('vaccination.doseLabel')" :placeholder="t('vaccination.dosePlaceholder')" />

    <TextField
      v-model="date"
      type="date"
      :label="t('vaccination.dateLabel')"
      :errors="err"
      error-key="date"
      :placeholder="t('common.selectDate')"
    />

    <p class="form-label">{{ t('vaccination.statusLabel') }}</p>
    <ChoiceGrid v-model="status" :options="statusOptions" :columns="2" />

    <FormNotes v-model="notes" :label="t('vaccination.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" />

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
            <span v-if="existingKeys.has(`${item.name}|${item.dose}`)" class="plan-item-added">
              ✓ {{ t('vaccination.planAdded') }}
            </span>
            <span v-if="item.note" class="plan-item-note">{{ item.note }}</span>
          </span>
        </button>
      </div>
    </BaseModal>
  </form>
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
  min-height: 44px;
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
  border: 1px solid var(--glass-border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: background-color 0.3s var(--spring), border-color 0.3s var(--spring), color 0.3s var(--spring),
    box-shadow 0.3s var(--spring), transform 0.3s var(--spring), opacity 0.3s var(--spring);
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
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--surface-2);
  text-align: left;
  transition: background-color 0.3s var(--spring), border-color 0.3s var(--spring), color 0.3s var(--spring),
    box-shadow 0.3s var(--spring), transform 0.3s var(--spring), opacity 0.3s var(--spring);
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

.plan-item-added {
  font-size: 11px;
  font-weight: 600;
  color: #6ab86a;
  background: rgba(106, 184, 106, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
</style>
