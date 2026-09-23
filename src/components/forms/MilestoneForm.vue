<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useMilestoneStore } from '@/stores/milestone'
import { MILESTONE_TYPE_LIST } from '@/constants'
import { MILESTONE_GUIDE, milestoneGuideRange } from '@/constants/milestoneGuide'
import type { MilestoneType } from '@/types'
import FormNotes from '@/components/common/FormNotes.vue'
import FormActions from '@/components/common/FormActions.vue'

const { t } = useI18n()

const props = defineProps<{
  editing?: { id: number; time: number; type: MilestoneType; notes?: string }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const milestoneStore = useMilestoneStore()

const type = ref<MilestoneType>(props.editing?.type ?? 'roll')
const time = ref(toDateTimeLocal(props.editing?.time ?? Date.now()))
const notes = ref(props.editing?.notes ?? '')
const guideOpen = ref(false)

async function submit() {
  const ts = fromDateTimeLocal(time.value)
  if (ts == null || isNaN(ts)) {
    alert(t('milestone.invalidTime'))
    return
  }
  if (props.editing) {
    await milestoneStore.update(props.editing.id, {
      time: ts,
      type: type.value,
      notes: notes.value || undefined,
    })
  } else {
    await milestoneStore.add({
      time: ts,
      type: type.value,
      notes: notes.value || undefined,
    })
  }
  emit('saved')
}
</script>

<template>
  <div class="milestone-form">
    <div class="form-field">
      <label class="form-label">{{ t('milestone.typeLabel') }}</label>
      <div class="milestone-types">
        <button
          v-for="item in MILESTONE_TYPE_LIST"
          :key="item.value"
          type="button"
          class="milestone-type"
          :class="{ active: type === item.value }"
          @click="type = item.value"
        >
          <span class="milestone-type-icon">{{ item.icon }}</span>
          <span class="milestone-type-label">{{ t(item.label) }}</span>
        </button>
      </div>
    </div>

    <!-- 发育参考折叠卡片 -->
    <div class="guide-section">
      <button type="button" class="guide-toggle" @click="guideOpen = !guideOpen">
        <span class="guide-toggle-icon">🌟</span>
        <span class="guide-toggle-title">{{ t('stats.milestoneGuideTitle') }}</span>
        <span class="guide-toggle-arrow" :class="{ open: guideOpen }">▾</span>
      </button>
      <div v-if="guideOpen" class="guide-list">
        <div v-for="item in MILESTONE_GUIDE" :key="item.labelKey" class="guide-item">
          <span class="guide-item-icon">{{ item.icon }}</span>
          <span class="guide-item-range">{{ milestoneGuideRange(item) }}</span>
          <span class="guide-item-text">{{ t(item.labelKey) }}</span>
        </div>
        <p class="guide-note">{{ t('stats.milestoneGuideNote') }}</p>
      </div>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('milestone.timeLabel') }}</label>
      <input v-model="time" type="datetime-local" :placeholder="t('common.selectDateTime')" class="form-input" />
    </div>

    <FormNotes v-model="notes" :label="t('milestone.notesLabel')" :placeholder="t('common.optional')" />

    <FormActions :editing="props.editing != null" @cancelled="emit('cancelled')" @save="submit" />
  </div>
</template>

<style scoped>
.milestone-types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.milestone-type {
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  transition:
    background 0.3s var(--spring),
    color 0.25s var(--ease-out),
    box-shadow 0.3s var(--spring);
}

.milestone-type:active {
  background: var(--surface-3);
}

.milestone-type.active {
  background: var(--primary-soft);
  color: var(--primary-dark);
  box-shadow: inset 0 0 0 1.5px var(--primary);
}

.milestone-type-icon {
  font-size: 20px;
  line-height: 1;
}

.milestone-type-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.guide-section {
  margin-bottom: 4px;
}

.guide-toggle {
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.guide-toggle:active {
  opacity: 0.7;
}

.guide-toggle-icon {
  font-size: 18px;
}

.guide-toggle-title {
  flex: 1;
  text-align: left;
}

.guide-toggle-arrow {
  color: var(--text-muted);
  font-size: 12px;
  transition: transform 0.18s ease;
}

.guide-toggle-arrow.open {
  transform: rotate(180deg);
}

.guide-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  font-size: 13px;
  line-height: 1.5;
}

.guide-item-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1.5;
}

.guide-item-range {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--primary-dark);
  font-variant-numeric: tabular-nums;
}

.guide-item-text {
  color: var(--text-secondary);
  min-width: 0;
}

.guide-note {
  font-size: 11px;
  color: var(--text-muted);
  margin: 8px 4px 2px;
  line-height: 1.6;
}
</style>