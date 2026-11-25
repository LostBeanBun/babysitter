/**
 * ToastContainer 交互回归：消息渲染、操作按钮回调、自动/手动关闭。
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import { showToast, toastState, dismissToast } from '@/composables/useToast'
import i18n from '@/i18n'

function mountToast() {
  return mount(ToastContainer, {
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  toastState.items.splice(0)
})

afterEach(() => {
  vi.useRealTimers()
  toastState.items.splice(0)
})

describe('ToastContainer', () => {
  it('渲染消息文本，自动关闭时长到后移除', async () => {
    const wrapper = mountToast()
    showToast('已删除', { duration: 3000 })
    await nextTick()
    expect(wrapper.text()).toContain('已删除')

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(wrapper.text()).not.toContain('已删除')
    expect(toastState.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('操作按钮点击后执行回调并关闭', async () => {
    const onAction = vi.fn()
    const wrapper = mountToast()
    showToast('已删除', { actionLabel: '撤销', onAction, duration: 5000 })
    await nextTick()

    const btn = wrapper.find('.toast-action')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(toastState.items).toHaveLength(0)
    expect(wrapper.text()).not.toContain('已删除')
    wrapper.unmount()
  })

  it('duration 0 显示常驻关闭按钮，点击后关闭', async () => {
    const wrapper = mountToast()
    showToast('常驻提示', { duration: 0 })
    await nextTick()

    const close = wrapper.find('.toast-close')
    expect(close.exists()).toBe(true)
    await close.trigger('click')

    expect(toastState.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('dismissToast 按 id 移除', async () => {
    const wrapper = mountToast()
    const id1 = showToast('第一条', { duration: 0 })
    showToast('第二条', { duration: 0 })
    await nextTick()
    expect(wrapper.text()).toContain('第一条')

    dismissToast(id1)
    await nextTick()
    expect(wrapper.text()).not.toContain('第一条')
    expect(wrapper.text()).toContain('第二条')
    wrapper.unmount()
  })
})
