<script setup lang="ts">
/**
 * 提醒参数公共组件：统一「间隔（数值输入）」与「时间（time 输入）」两种展开参数。
 * 由 SettingsView 中的提醒配置在开启后渲染，消除多类提醒重复的展开模板。
 * 输入期间只改本地草稿，失焦（change）时统一钳制边界后才回写父级，避免
 * 输入中途的空串/半截数字被静默转成 0 击穿 min。
 */
import { ref, watch } from 'vue'
import { INTERVAL_MAX_HOURS, clampIntervalHours } from '@/utils/reminderScheduler'

const props = defineProps<{
  mode: 'interval' | 'time'
  label: string
  modelValue: number | string
  min?: number
  step?: number
  placeholder?: string
  hint?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: number | string): void
  (e: 'change'): void
}>()

const draft = ref(String(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    draft.value = String(v)
  },
)

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
}

/** 失焦/提交时校验并回写：间隔钳制到 [min, 24]（空值/非法值回退 min），时间非法回退原值 */
function commit() {
  if (props.mode === 'interval') {
    const v = clampIntervalHours(draft.value, props.min ?? 0)
    draft.value = String(v)
    emit('update:modelValue', v)
  } else {
    // 空串合法（关闭固定时间提醒），仅对粘贴等产生的畸形值回退原值
    const v = draft.value === '' || /^\d{2}:\d{2}$/.test(draft.value) ? draft.value : String(props.modelValue)
    draft.value = v
    emit('update:modelValue', v)
  }
  emit('change')
}
</script>

<template>
  <label class="reminder-param-field">
    <span class="reminder-param-label">{{ label }}</span>
    <input
      v-if="mode === 'interval'"
      :value="draft"
      type="number"
      :min="min"
      :max="INTERVAL_MAX_HOURS"
      :step="step"
      :placeholder="placeholder"
      class="form-input reminder-param-input"
      inputmode="decimal"
      @input="onInput"
      @change="commit"
    />
    <input
      v-else
      :value="draft"
      type="time"
      :placeholder="placeholder"
      class="form-input reminder-param-input"
      @input="onInput"
      @change="commit"
    />
  </label>
  <p v-if="hint" class="reminder-param-hint">{{ hint }}</p>
</template>

<style scoped>
.reminder-param-field {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  /* 输入本体 40px，包裹 label 撑到 44px 热区（规范 3.4），点击标签文字即聚焦输入 */
  min-height: 44px;
}

.reminder-param-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input.reminder-param-input {
  width: 72px;
  min-height: 40px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
}

.reminder-param-hint {
  width: 100%;
  font-size: var(--fs-xs);
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
