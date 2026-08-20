import { ref } from 'vue'
import { showToast } from '@/composables/useToast'

/**
 * 删除撤销：确认删除后先将记录从视图隐藏并进入 3 秒待删除期，
 * 期间可通过 Toast「撤销」按钮恢复；超时后执行真实删除。
 * 视图层需用 isPending() 过滤待删除记录。
 */
export interface DeleteTarget {
  kind: string
  id: number
}

const pending = ref(new Set<string>())
const timers = new Map<string, number>()

function keyOf(e: DeleteTarget): string {
  return e.kind + '-' + e.id
}

export function useDeleteUndo() {
  function isPending(e: DeleteTarget): boolean {
    return pending.value.has(keyOf(e))
  }

  /** 撤销（对外暴露，供需要主动撤销的场景使用） */
  function undoDelete(e: DeleteTarget): void {
    const k = keyOf(e)
    const timer = timers.get(k)
    if (timer != null) window.clearTimeout(timer)
    timers.delete(k)
    pending.value.delete(k)
  }

  /** 进入待删除状态：显示可撤销 Toast，3 秒后执行 doDelete */
  function scheduleDelete(
    e: DeleteTarget,
    doDelete: () => Promise<void>,
    message: string,
    undoLabel: string,
  ): void {
    const k = keyOf(e)
    if (pending.value.has(k)) return
    pending.value.add(k)
    const timer = window.setTimeout(async () => {
      pending.value.delete(k)
      timers.delete(k)
      await doDelete()
    }, 3000)
    timers.set(k, timer)
    showToast(message, {
      actionLabel: undoLabel,
      onAction: () => undoDelete(e),
    })
  }

  return { isPending, scheduleDelete, undoDelete }
}