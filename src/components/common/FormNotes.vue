<script setup lang="ts">
/**
 * 备注输入公共组件：统一「备注（可选）」字段，支持单行输入与多行文本域。
 */
defineProps<{
  label: string
  modelValue?: string
  placeholder?: string
  textarea?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="form-field">
    <label class="form-label">{{ label }}</label>
    <textarea
      v-if="textarea"
      :value="modelValue"
      :placeholder="placeholder ?? ''"
      class="form-input form-textarea"
      @input="onInput"
    />
    <input
      v-else
      :value="modelValue"
      type="text"
      :placeholder="placeholder ?? ''"
      class="form-input"
      @input="onInput"
    />
  </div>
</template>