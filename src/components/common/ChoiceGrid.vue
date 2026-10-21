<script setup lang="ts">
/**
 * 选项按钮组公共组件：图标 + 文案的网格选择（喂养类型/纸尿裤类型/睡眠类型等）。
 * - 选项带 color 时选中态用该色内联样式；否则用主题色默认选中态。
 */
import { computed } from 'vue'

export interface ChoiceOption {
  value: string
  icon: string
  label: string
  /** 选中态颜色（如喂养类型各类型专属色） */
  color?: string
}

const props = withDefaults(
  defineProps<{
    options: ChoiceOption[]
    modelValue: string
    /** 每行列数 */
    columns?: number
    disabled?: boolean
    /** 再次点击已选项时清空（如体温方式可不选） */
    clearable?: boolean
  }>(),
  { columns: 3 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }))

function select(opt: ChoiceOption) {
  if (props.disabled) return
  if (props.clearable && props.modelValue === opt.value) {
    emit('update:modelValue', '')
    return
  }
  emit('update:modelValue', opt.value)
}

function selectedStyle(opt: ChoiceOption) {
  if (props.modelValue !== opt.value || !opt.color) return undefined
  return { background: opt.color + '22', borderColor: opt.color, color: opt.color }
}
</script>

<template>
  <div class="choice-grid" :style="gridStyle">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="choice-btn"
      :class="{ selected: modelValue === opt.value }"
      :style="selectedStyle(opt)"
      :disabled="disabled"
      @click="select(opt)"
    >
      <span class="choice-icon">{{ opt.icon }}</span>
      <span class="choice-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.choice-grid {
  display: grid;
  gap: 10px;
  margin-bottom: var(--space-4);
}

.choice-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: var(--space-3) 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  transition: background-color var(--dur-slow) var(--spring), border-color var(--dur-slow) var(--spring), color var(--dur-slow) var(--spring),
    box-shadow var(--dur-slow) var(--spring), transform var(--dur-slow) var(--spring), opacity var(--dur-slow) var(--spring);
}

.choice-btn.selected {
  border-width: 1.5px;
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.choice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.choice-icon {
  font-size: var(--fs-lg);
}

.choice-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
