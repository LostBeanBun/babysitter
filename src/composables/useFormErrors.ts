import { ref, type Ref } from 'vue'

/**
 * 表单字段级校验错误：红框 + 输入框下方内联文案。
 * - set(field, msg) 标记字段错误（阻断提交前调用）
 * - clear(field) 在输入时清除单个字段错误
 * - clearAll() 打开表单 / 校验通过后调用
 * - formError 为表单级错误（如「三项至少填一项」），展示在字段下方
 */
export interface FormErrors {
  errors: Ref<Record<string, string>>
  formError: Ref<string>
  set: (field: string, msg: string) => void
  clear: (field: string) => void
  clearAll: () => void
  has: (field: string) => boolean
  get: (field: string) => string
}

export function useFormErrors(): FormErrors {
  const errors = ref<Record<string, string>>({})
  const formError = ref('')

  function set(field: string, msg: string): void {
    errors.value[field] = msg
  }

  function clear(field: string): void {
    delete errors.value[field]
  }

  function clearAll(): void {
    errors.value = {}
    formError.value = ''
  }

  function has(field: string): boolean {
    return !!errors.value[field]
  }

  function get(field: string): string {
    return errors.value[field] ?? ''
  }

  return { errors, formError, set, clear, clearAll, has, get }
}
