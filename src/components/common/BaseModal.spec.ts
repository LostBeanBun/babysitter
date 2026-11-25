/**
 * BaseModal 交互回归：滚动锁（含多实例叠加）、Escape 关闭、焦点陷阱与焦点归还。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import i18n from '@/i18n'

const slots = { default: '<button id="first">first</button><button id="last">last</button>' }

function mountModal(show = false): VueWrapper {
  return mount(BaseModal, {
    props: { show, title: '测试弹窗' },
    slots,
    global: { plugins: [i18n], stubs: { teleport: true } },
    attachTo: document.body,
  })
}

/** 等待打开后的 requestAnimationFrame 焦点回调 */
async function flushFocus() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

const wrappers: VueWrapper[] = []

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
  document.body.style.overflow = ''
})

describe('BaseModal', () => {
  it('打开时锁定 body 滚动，关闭后恢复', async () => {
    const wrapper = mountModal(false)
    wrappers.push(wrapper)
    expect(document.body.style.overflow).toBe('')

    await wrapper.setProps({ show: true })
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ show: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('两个实例叠加：关掉一个不提前恢复滚动，全部关闭才恢复', async () => {
    const m1 = mountModal(false)
    const m2 = mountModal(false)
    wrappers.push(m1, m2)

    await m1.setProps({ show: true })
    await m2.setProps({ show: true })
    expect(document.body.style.overflow).toBe('hidden')

    await m1.setProps({ show: false })
    expect(document.body.style.overflow).toBe('hidden')

    await m2.setProps({ show: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('Escape 触发 close 事件', async () => {
    const wrapper = mountModal(false)
    wrappers.push(wrapper)
    await wrapper.setProps({ show: true })
    await flushFocus()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('打开后焦点移入面板，Tab 在面板内循环', async () => {
    const wrapper = mountModal(false)
    wrappers.push(wrapper)
    await wrapper.setProps({ show: true })
    await flushFocus()

    const panel = wrapper.find('[role="dialog"]').element as HTMLElement
    expect(document.activeElement).toBe(panel)

    // 面板内可聚焦顺序：关闭按钮 → #first → #last
    const closeBtn = wrapper.find('.modal-close').element as HTMLElement
    const last = wrapper.find('#last').element as HTMLElement

    // 末尾焦点按 Tab → 回到第一个可聚焦元素（关闭按钮）
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(closeBtn)

    // 首个焦点按 Shift+Tab → 回到最后一个
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
  })

  it('关闭后把焦点归还给打开前的触发元素', async () => {
    const wrapper = mountModal(false)
    wrappers.push(wrapper)
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    await wrapper.setProps({ show: true })
    await flushFocus()
    await wrapper.setProps({ show: false })

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('点击遮罩（非面板区域）关闭', async () => {
    const wrapper = mountModal(false)
    wrappers.push(wrapper)
    await wrapper.setProps({ show: true })
    await flushFocus()

    await wrapper.find('.modal-mask').trigger('click.self')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
