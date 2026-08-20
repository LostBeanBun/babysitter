<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useMilestoneStore } from '@/stores/milestone'
import { MILESTONE_TYPE_LIST } from '@/constants'
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
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text-secondary);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
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
</style>