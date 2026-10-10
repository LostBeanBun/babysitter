<script setup lang="ts">
/**
 * 表单字段公共组件：label + 内联错误 + 任意控件（默认插槽）。
 * 自定义控件（如颜色/类型按钮组）直接用本组件包裹；文本输入请用 TextField。
 */
import type { FormErrors } from '@/composables/useFormErrors'

withDefaults(
  defineProps<{
    label: string
    errors?: FormErrors
    errorKey?: string
    /** label 元素类型：插槽内为按钮时用 p（避免 label 聚焦行为误触） */
    tag?: 'label' | 'p'
  }>(),
  { tag: 'label' },
)
</script>

<template>
  <div class="form-field" :class="{ 'has-error': errorKey != null && errors?.has(errorKey) }">
    <component :is="tag" class="form-label">{{ label }}</component>
    <slot />
    <p v-if="errorKey != null && errors?.get(errorKey)" class="field-error">{{ errors.get(errorKey) }}</p>
  </div>
</template>
