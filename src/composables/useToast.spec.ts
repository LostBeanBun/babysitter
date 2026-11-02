import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toastState, showToast, dismissToast } from '@/composables/useToast'

describe('useToast', () => {
  beforeEach(() => {
    toastState.items.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认 duration=3000 且按顺序追加', () => {
    showToast('第一条')
    showToast('第二条', { duration: 500 })

    expect(toastState.items).toHaveLength(2)
    expect(toastState.items[0].message).toBe('第一条')
    expect(toastState.items[0].duration).toBe(3000)
    expect(toastState.items[1].duration).toBe(500)
  })

  it('默认时长到期自动移除', () => {
    showToast('自动关闭')
    vi.advanceTimersByTime(2999)
    expect(toastState.items).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toastState.items).toHaveLength(0)
  })

  it('自定义 duration 到期自动移除', () => {
    showToast('短 toast', { duration: 500 })
    vi.advanceTimersByTime(499)
    expect(toastState.items).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toastState.items).toHaveLength(0)
  })

  it('duration:0 常驻，不会自动移除', () => {
    showToast('常驻', { duration: 0 })
    vi.advanceTimersByTime(100_000)
    expect(toastState.items).toHaveLength(1)
  })

  it('dismissToast 立即移除指定项且幂等', () => {
    const id = showToast('手动关闭', { duration: 0 })
    dismissToast(id)
    dismissToast(id)
    dismissToast(999_999)

    expect(toastState.items).toHaveLength(0)
  })

  it('透传 actionLabel / onAction 并返回自增 id', () => {
    const onAction = vi.fn()
    const first = showToast('有操作', { actionLabel: '撤销', onAction, duration: 0 })
    const second = showToast('第二条', { duration: 0 })

    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    const item = toastState.items[0]
    expect(item.actionLabel).toBe('撤销')
    expect(item.onAction).toBe(onAction)
    expect(item.duration).toBe(0)
  })

  it('移除一项不影响其他 toast', () => {
    const a = showToast('a', { duration: 0 })
    showToast('b', { duration: 0 })

    dismissToast(a)
    expect(toastState.items.map((i) => i.message)).toEqual(['b'])
  })
})
