import { nextTick, useTemplateRef } from 'vue'

/**
 * 表单提交包装：
 * - 根节点为 <form ref="root" @submit.prevent="onSubmit">，输入框回车即触发提交
 * - 提交完成后聚焦第一个仍有校验错误的字段（保存成功则表单已卸载，自动跳过）
 */
export function useFormSubmit(submit: () => Promise<void> | void) {
  const root = useTemplateRef<HTMLElement>('root')

  async function onSubmit(): Promise<void> {
    await submit()
    await nextTick()
    const el = root.value?.querySelector<HTMLElement>(
      '.has-error input, .has-error textarea, .has-error select, .has-error [role="radio"]',
    )
    el?.focus()
  }

  return { onSubmit }
}
