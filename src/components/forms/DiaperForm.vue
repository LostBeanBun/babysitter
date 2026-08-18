<script setup lang="ts">
import { ref } from 'vue'
import type { DiaperType, DiaperColor, DiaperAmount } from '@/types'
import { DIAPER_TYPE_LIST, DIAPER_COLOR_LABELS, DIAPER_COLOR_DOTS, DIAPER_AMOUNT_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useDiaperStore } from '@/stores/diaper'

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
    <p class="form-label">更换类型</p>
    <div class="type-grid">
      <button
        v-for="t in DIAPER_TYPE_LIST"
        :key="t.value"
        type="button"
        class="type-btn"
        :class="{ selected: type === t.value }"
        :style="type === t.value ? { background: t.color + '22', borderColor: t.color, color: t.color } : undefined"
        @click="type = t.value"
      >
        <span class="type-icon">{{ t.icon }}</span>
        <span class="type-label">{{ t.label }}</span>
      </button>
    </div>

    <div class="form-field">
      <label class="form-label">便便颜色</label>
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
          <span class="color-label">{{ label }}</span>
        </button>
      </div>
    </div>

    <div class="form-field">
      <label class="form-label">量</label>
      <div class="amount-row">
        <button
          v-for="(label, key) in DIAPER_AMOUNT_LABELS"
          :key="key"
          type="button"
          class="amount-btn"
          :class="{ selected: amount === key }"
          @click="amount = amount === key ? '' : key"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <div class="form-field">
      <label class="form-label">时间</label>
      <input v-model="time" type="datetime-local" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">备注</label>
      <input v-model="notes" type="text" placeholder="可选" class="form-input" />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-outline" @click="emit('cancelled')">取消</button>
      <button type="button" class="btn btn-primary" @click="submit">
        {{ props.editing ? '保存修改' : '保存记录' }}
      </button>
    </div>
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

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>
