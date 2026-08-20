<script setup lang="ts">
/**
 * 提醒参数公共组件：统一「间隔（数值输入）」与「时间（time 输入）」两种展开参数。
 * 由 SettingsView 中的提醒配置在开启后渲染，消除多类提醒重复的展开模板。
 */
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

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  emit('update:modelValue', props.mode === 'interval' ? (raw === '' ? '' : Number(raw)) : raw)
}
</script>

<template>
  <template v-if="mode === 'interval'">
    <label class="reminder-param-label">{{ label }}</label>
    <input
      :value="modelValue"
      type="number"
      :min="min"
      :step="step"
      :placeholder="placeholder"
      class="form-input reminder-param-input"
      inputmode="decimal"
      @input="onInput"
      @change="emit('change')"
    />
    <p v-if="hint" class="reminder-param-hint">{{ hint }}</p>
  </template>
  <template v-else>
    <label class="reminder-param-label">{{ label }}</label>
    <input
      :value="modelValue"
      type="time"
      :placeholder="placeholder"
      class="form-input reminder-param-input"
      @input="onInput"
      @change="emit('change')"
    />
  </template>
</template>

<style scoped>
.reminder-param-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input.reminder-param-input {
  width: 88px;
  min-height: 34px;
  padding: 4px 8px;
  border-radius: 8px;
}

.reminder-param-hint {
  width: 100%;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
}
</style>