<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildVaccineCalendar,
  type VaccineCalendarItem,
  type VaccinePlanCategory,
} from '@/constants/vaccinePlan'
import { useBabyStore } from '@/stores/baby'
import { useVaccinationStore } from '@/stores/vaccination'

/** 疫苗计划日历：按宝宝出生日期展示建议接种时间线 */
const { t } = useI18n()
const babyStore = useBabyStore()
const vaccinationStore = useVaccinationStore()

const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const tab = ref<VaccinePlanCategory>('free')

const calendar = computed<VaccineCalendarItem[]>(() => {
  const baby = activeBaby.value
  if (!baby?.birthDate) return []
  return buildVaccineCalendar(baby.birthDate, vaccinationStore.vaccinations)
})

const visibleItems = computed(() => calendar.value.filter((i) => i.category === tab.value))

const summary = computed(() => {
  const items = calendar.value
  return {
    done: items.filter((i) => i.status === 'done').length,
    pending: items.filter((i) => i.status === 'due' || i.status === 'overdue' || i.status === 'upcoming').length,
  }
})

function statusBadgeClass(item: VaccineCalendarItem): string {
  switch (item.status) {
    case 'done':
      return 'badge-done'
    case 'due':
      return 'badge-due'
    case 'overdue':
      return 'badge-overdue'
    default:
      return 'badge-upcoming'
  }
}

function statusLabel(item: VaccineCalendarItem): string {
  switch (item.status) {
    case 'done':
      return t('vaccinePlan.statusDone')
    case 'due':
      return t('vaccinePlan.statusDue')
    case 'overdue':
      return t('vaccinePlan.statusOverdue')
    default:
      return t('vaccinePlan.statusUpcoming')
  }
}
</script>

<template>
  <div class="vaccine-plan-view">
    <p class="data-tip">{{ t('vaccinePlan.tip') }}</p>

    <template v-if="activeBaby?.birthDate">
      <div class="plan-summary">
        <span>✅ {{ t('vaccinePlan.doneCount', { n: summary.done }) }}</span>
        <span>📅 {{ t('vaccinePlan.pendingCount', { n: summary.pending }) }}</span>
      </div>

      <div class="plan-tabs" role="tablist">
        <button
          type="button"
          class="plan-tab"
          :class="{ active: tab === 'free' }"
          role="tab"
          :aria-selected="tab === 'free'"
          @click="tab = 'free'"
        >
          🆓 {{ t('vaccinePlan.tabFree') }}
        </button>
        <button
          type="button"
          class="plan-tab"
          :class="{ active: tab === 'self' }"
          role="tab"
          :aria-selected="tab === 'self'"
          @click="tab = 'self'"
        >
          💉 {{ t('vaccinePlan.tabSelf') }}
        </button>
      </div>

      <div class="plan-list">
        <div v-for="(item, i) in visibleItems" :key="i" class="plan-row" :class="statusBadgeClass(item)">
          <div class="plan-row-main">
            <p class="plan-row-name">
              {{ item.name }} <span class="plan-row-dose">{{ item.dose }}</span>
            </p>
            <p class="plan-row-date">🗓 {{ item.planDate }}<span v-if="item.note" class="plan-row-note"> · {{ item.note }}</span></p>
          </div>
          <span class="plan-badge" :class="statusBadgeClass(item)">{{ statusLabel(item) }}</span>
        </div>
        <p v-if="visibleItems.length === 0" class="plan-empty">{{ t('vaccinePlan.empty') }}</p>
      </div>
    </template>

    <p v-else class="plan-empty">{{ t('vaccinePlan.needBirthDate') }}</p>
  </div>
</template>

<style scoped>
.vaccine-plan-view {
  display: grid;
  gap: 10px;
}

.plan-summary {
  display: flex;
  gap: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.plan-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
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
  max-height: 42vh;
  overflow-y: auto;
}

.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
}

.plan-row-main {
  min-width: 0;
}

.plan-row-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.plan-row-dose {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.plan-row-date {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.plan-row-note {
  color: var(--text-muted);
}

.plan-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}

.badge-done {
  color: #6ab86a;
  background: #6ab86a1f;
}

.badge-due {
  color: #d8a45a;
  background: #d8a45a1f;
}

.badge-overdue {
  color: #d26a6a;
  background: #d26a6a1f;
}

.badge-upcoming {
  color: #7a9bc9;
  background: #7a9bc91f;
}

.plan-empty {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px 0;
}
</style>