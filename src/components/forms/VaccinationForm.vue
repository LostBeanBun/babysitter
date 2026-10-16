<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VaccinationStatus } from '@/types'
import { toDateTimeLocal, fromDateTimeLocal, formatDate, startOfDay } from '@/utils/format'
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
import { buildIcs, deliverIcs, googleCalendarUrl, type CalendarEvent } from '@/services/calendar'

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

/** 校验后的疫苗记录数据 */
interface VaccinationPayload {
  date: number
  name: string
  dose?: string
  status: VaccinationStatus
  notes?: string
}

/** 计划接种（新增或编辑）保存后保留弹窗，提供「添加到系统日历」 */
const savedPlan = ref<{ id: number; name: string; dose?: string; date: number; editing: boolean } | null>(null)
const calBusy = ref(false)
const calFeedback = ref<string | null>(null)
/** 最近一次校验通过的数据（保存成功后用于生成日历事件） */
let pendingPayload: VaccinationPayload | null = null
/** 新增记录 id（日历事件 UID 用，保证同一条记录稳定） */
let savedId: number | null = null

function validate(): VaccinationPayload | null {
  if (!name.value.trim()) {
    err.set('name', t('vaccination.invalidName'))
    return null
  }
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    err.set('date', t('vaccination.invalidDate'))
    return null
  }
  pendingPayload = {
    date: d,
    name: name.value.trim(),
    dose: dose.value || undefined,
    status: status.value,
    notes: notes.value || undefined,
  }
  return pendingPayload
}

const { submit } = useRecordForm({
  err,
  editing: props.editing,
  validate,
  add: async (payload) => {
    savedId = await vaccinationStore.add(payload)
  },
  update: (id, payload) => vaccinationStore.update(id, payload),
  onSaved: () => {
    // 计划接种（新增或编辑）保留弹窗提供添加到日历；已接种直接关闭
    const p = pendingPayload
    if (p?.status === 'planned') {
      savedPlan.value = {
        id: props.editing?.id ?? savedId ?? 0,
        name: p.name,
        dose: p.dose,
        date: p.date,
        editing: props.editing != null,
      }
      return
    }
    emit('saved')
  },
})
const { onSubmit } = useFormSubmit(submit)

/** 记录 → 日历事件（同一条记录 UID 稳定：再次添加视为更新同一条事件） */
function calEventOf(record: { id?: number; name: string; dose?: string; date: number }): CalendarEvent {
  const label = record.dose ? `${record.name} · ${record.dose}` : record.name
  return {
    uid: `vaccination-${record.id}@babysitter`,
    title: t('vaccination.calEventTitle', { label }),
    date: record.date,
    description: t('vaccination.calEventDesc', { app: t('app.name') }),
  }
}

/** 同一天的其它计划接种（批量为这一天的全部记录各建一条独立事件，可单独修改） */
const sameDateOthers = computed(() => {
  const plan = savedPlan.value
  if (!plan) return []
  const day = startOfDay(plan.date)
  return vaccinationStore.vaccinations.filter(
    (v) => v.status === 'planned' && v.id !== plan.id && startOfDay(v.date) === day,
  )
})

/** Google 日历网页链接（单条，无需下载文件） */
const googleUrl = computed(() => (savedPlan.value ? googleCalendarUrl(calEventOf(savedPlan.value)) : ''))

/** 交付 .ics 并给出结果反馈 */
async function deliver(events: CalendarEvent[], filename: string, title: string) {
  calFeedback.value = null
  const result = await deliverIcs(buildIcs(events), filename, title)
  calFeedback.value =
    result === 'shared'
      ? t('vaccination.calShared')
      : result === 'downloaded'
        ? t('vaccination.calDownloaded')
        : result === 'failed'
          ? t('vaccination.calFailed')
          : null
}

/** 添加本条到系统日历（含「提前 1 天」与「当天」两条提醒） */
async function addToCalendar() {
  const plan = savedPlan.value
  if (!plan || calBusy.value) return
  calBusy.value = true
  const event = calEventOf(plan)
  await deliver([event], `vaccine-${plan.id}.ics`, event.title)
  calBusy.value = false
}

/** 一次添加这一天的全部计划接种（含本条），逐条独立事件 */
async function addSameDateToCalendar() {
  const plan = savedPlan.value
  if (!plan || calBusy.value) return
  calBusy.value = true
  const day = formatDate(plan.date)
  await deliver([plan, ...sameDateOthers.value].map(calEventOf), `vaccines-${day}.ics`, day)
  calBusy.value = false
}

/** 完成：关闭弹窗（由父级收尾） */
function finishSavedPlan() {
  savedPlan.value = null
  emit('saved')
}
</script>

<template>
  <form ref="root" class="vaccination-form" @submit.prevent="onSubmit">
    <!-- 计划接种保存后：保持弹窗，提供「添加到系统日历」 -->
    <div v-if="savedPlan" class="cal-saved">
      <p class="cal-saved-title">
        ✅ {{ t(savedPlan.editing ? 'vaccination.calUpdatedTitle' : 'vaccination.calSavedTitle') }}
      </p>
      <p class="cal-saved-meta">
        {{ savedPlan.dose ? `${savedPlan.name} · ${savedPlan.dose}` : savedPlan.name }} ·
        {{ formatDate(savedPlan.date) }}
      </p>
      <p class="cal-hint">{{ t(savedPlan.editing ? 'vaccination.calUpdateHint' : 'vaccination.calHint') }}</p>
      <button type="button" class="btn btn-primary btn-block" :disabled="calBusy" @click="addToCalendar">
        📅 {{ t('vaccination.calAdd') }}
      </button>
      <button
        v-if="sameDateOthers.length"
        type="button"
        class="btn btn-outline btn-block"
        :disabled="calBusy"
        @click="addSameDateToCalendar"
      >
        💉 {{ t('vaccination.calBatchAdd', { n: sameDateOthers.length + 1 }) }}
      </button>
      <a class="cal-google" :href="googleUrl" target="_blank" rel="noopener noreferrer">
        🔗 {{ t('vaccination.calGoogle') }}
      </a>
      <p v-if="calFeedback" class="cal-feedback">{{ calFeedback }}</p>
      <button type="button" class="btn btn-outline btn-block" @click="finishSavedPlan">
        {{ t('vaccination.calDone') }}
      </button>
    </div>

    <template v-else>
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
    </template>
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

.cal-saved {
  display: grid;
  gap: 10px;
  padding: 2px 0;
}

.cal-saved-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.cal-saved-meta {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.cal-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

.cal-feedback {
  font-size: 12px;
  color: var(--primary-dark);
  line-height: 1.6;
}

.cal-google {
  font-size: 12px;
  color: var(--accent-blue);
  text-align: center;
  text-decoration: underline;
  padding: 2px 0;
  min-height: 0;
}
</style>
