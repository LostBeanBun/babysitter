/**
 * 删除撤销链路：确认删除 → 3 秒待删除窗口（可撤销）→ 到期真实删除。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDeleteUndo } from '@/composables/useDeleteUndo'
import { toastState } from '@/composables/useToast'

beforeEach(() => {
  vi.useFakeTimers()
  toastState.items.splice(0)
})

afterEach(() => {
  // 冲掉可能残留的待删除计时器，避免串到下一个用例
  vi.advanceTimersByTime(10_000)
  vi.useRealTimers()
  toastState.items.splice(0)
})

/** 取当前 toast 的撤销回调（scheduleDelete 会写入 onAction） */
function undoAction(): () => void {
  const item = toastState.items.at(-1)
  expect(item?.onAction).toBeTypeOf('function')
  return item!.onAction!
}

describe('useDeleteUndo', () => {
  it('确认后立即进入待删除态并弹出可撤销提示，但尚未真正删除', () => {
    const { isPending, scheduleDelete } = useDeleteUndo()
    const target = { kind: 'feeding', id: 101 }
    const del = vi.fn(async () => {})

    scheduleDelete(target, del, '已删除记录', '撤销')

    expect(isPending(target)).toBe(true)
    expect(del).not.toHaveBeenCalled()
    expect(toastState.items).toHaveLength(1)
    expect(toastState.items[0]).toMatchObject({ message: '已删除记录', actionLabel: '撤销' })
  })

  it('3 秒内点「撤销」→ 取消删除并退出待删除态', async () => {
    const { isPending, scheduleDelete } = useDeleteUndo()
    const target = { kind: 'diaper', id: 102 }
    const del = vi.fn(async () => {})

    scheduleDelete(target, del, '已删除记录', '撤销')
    undoAction()()

    expect(isPending(target)).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(del).not.toHaveBeenCalled()
  })

  it('3 秒到期后执行真实删除并退出待删除态', async () => {
    const { isPending, scheduleDelete } = useDeleteUndo()
    const target = { kind: 'sleep', id: 103 }
    const del = vi.fn(async () => {})

    scheduleDelete(target, del, '已删除记录', '撤销')
    await vi.advanceTimersByTimeAsync(2999)
    expect(del).not.toHaveBeenCalled()
    expect(isPending(target)).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(del).toHaveBeenCalledTimes(1)
    expect(isPending(target)).toBe(false)
  })

  it('同一记录重复确认只调度一次（避免重复删除与重复 toast）', async () => {
    const { scheduleDelete } = useDeleteUndo()
    const target = { kind: 'pumping', id: 104 }
    const del = vi.fn(async () => {})

    scheduleDelete(target, del, '已删除记录', '撤销')
    scheduleDelete(target, del, '已删除记录', '撤销')

    expect(toastState.items).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('不同记录各自独立：撤销一条不影响另一条', async () => {
    const { isPending, scheduleDelete } = useDeleteUndo()
    const a = { kind: 'feeding', id: 105 }
    const b = { kind: 'feeding', id: 106 }
    const delA = vi.fn(async () => {})
    const delB = vi.fn(async () => {})

    scheduleDelete(a, delA, '已删除记录', '撤销')
    scheduleDelete(b, delB, '已删除记录', '撤销')
    expect(toastState.items).toHaveLength(2)

    // 只撤销后一条（对应第二个 toast）
    toastState.items[1].onAction!()
    expect(isPending(a)).toBe(true)
    expect(isPending(b)).toBe(false)

    await vi.advanceTimersByTimeAsync(3000)
    expect(delA).toHaveBeenCalledTimes(1)
    expect(delB).not.toHaveBeenCalled()
  })

  it('undoDelete 可主动撤销（供需要立即恢复的场景使用）', async () => {
    const { isPending, scheduleDelete, undoDelete } = useDeleteUndo()
    const target = { kind: 'temperature', id: 107 }
    const del = vi.fn(async () => {})

    scheduleDelete(target, del, '已删除记录', '撤销')
    undoDelete(target)
    undoDelete(target) // 幂等

    expect(isPending(target)).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(del).not.toHaveBeenCalled()
  })
})
