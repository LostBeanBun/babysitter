import { nextTick, useTemplateRef } from 'vue'

const ERROR_FOCUS = '.has-error input, .has-error textarea, .has-error select, .has-error [role="radio"]'

/**
 * 表单提交包装：
 * - 根节点为 <form ref="root" @submit.prevent="onSubmit">，输入框回车即触发提交
 * - 提交期间防重入并禁用提交按钮（进行态），结束后恢复
 * - 提交完成后聚焦第一个仍有校验错误的字段并轻晃提示（保存成功则表单已卸载，自动跳过）
 */
export function useFormSubmit(submit: () => Promise<void> | void) {
  const root = useTemplateRef<HTMLElement>('root')
  let busy = false

  async function onSubmit(): Promise<void> {
    if (busy) return
    busy = true
    const buttons = Array.from(root.value?.querySelectorAll<HTMLButtonElement>('button[type="submit"]') ?? [])
    buttons.forEach((b) => {
      b.disabled = true
    })
    try {
      await submit()
      await nextTick()
      const el = root.value?.querySelector<HTMLElement>(ERROR_FOCUS)
      el?.focus()
      const field = el?.closest<HTMLElement>('.has-error')
      if (field) {
        field.classList.remove('shake')
        field.getBoundingClientRect()
        field.classList.add('shake')
        window.setTimeout(() => field.classList.remove('shake'), 450)
      }
    } finally {
      busy = false
      buttons.forEach((b) => {
        b.disabled = false
      })
    }
  }

  return { onSubmit }
}
