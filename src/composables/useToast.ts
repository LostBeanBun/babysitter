import { reactive } from 'vue'

/** 轻量全局 Toast 消息系统（删除撤销 / 错误兜底 / PWA 更新提示共用） */
export interface ToastItem {
  id: number
  message: string
  /** 可选操作按钮文案（如「撤销」） */
  actionLabel?: string
  /** 操作按钮回调（执行后自动关闭该 toast） */
  onAction?: () => void
  /** 自动关闭时长 ms，0 表示常驻（需手动关闭） */
  duration: number
}

export const toastState = reactive<{ items: ToastItem[] }>({ items: [] })

let seq = 0

export function showToast(
  message: string,
  opts?: { actionLabel?: string; onAction?: () => void; duration?: number },
): number {
  const id = ++seq
  const duration = opts?.duration ?? 3000
  toastState.items.push({
    id,
    message,
    actionLabel: opts?.actionLabel,
    onAction: opts?.onAction,
    duration,
  })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id: number): void {
  const idx = toastState.items.findIndex((i) => i.id === id)
  if (idx >= 0) toastState.items.splice(idx, 1)
}