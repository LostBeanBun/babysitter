<script setup lang="ts">
/**
 * 文本输入公共组件：label + input + 字段级错误一体化。
 * - v-model 双向绑定；输入时自动清除该字段错误
 * - suffix：输入框内右侧单位（如 °C）
 * - append 插槽：输入框右侧附加元素（如按钮）
 */
import { computed, useSlots } from 'vue'
import type { FormErrors } from '@/composables/useFormErrors'
import FormField from './FormField.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    errors?: FormErrors
    errorKey?: string
    type?: string
    placeholder?: string
    min?: string | number
    max?: string | number
    step?: string | number
    inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
    disabled?: boolean
    suffix?: string
    tag?: 'label' | 'p'
  }>(),
  { type: 'text' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const slots = useSlots()

const hasAppend = computed(() => !!slots.append)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  if (props.errorKey != null) props.errors?.clear(props.errorKey)
}
</script>

<template>
  <FormField :label="label" :errors="errors" :error-key="errorKey" :tag="tag">
    <div class="text-input-row" :class="{ 'has-append': hasAppend }">
      <input
        v-bind="$attrs"
        :value="modelValue"
        :type="type"
        :min="min"
        :max="max"
        :step="step"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :disabled="disabled"
        class="form-input"
        @input="onInput"
      />
      <span v-if="suffix" class="text-input-unit">{{ suffix }}</span>
      <slot name="append" />
    </div>
  </FormField>
</template>

<style scoped>
.text-input-row {
  position: relative;
}

/* 带右侧附加内容时为输入预留空间 */
.text-input-row.has-append {
  display: flex;
  gap: 8px;
}

.text-input-row.has-append .form-input {
  flex: 1;
  min-width: 0;
}

.text-input-row:has(.text-input-unit) .form-input {
  padding-right: 34px;
}

.text-input-unit {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--text-muted);
  pointer-events: none;
}
</style>
