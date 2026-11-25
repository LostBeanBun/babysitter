/**
 * TimelineList 交互回归：按天分组、渐进挂载（IntersectionObserver）、编辑/删除事件与高亮类。
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TimelineList from '@/components/timeline/TimelineList.vue'
import type { TimelineEntry } from '@/services/timeline'
import i18n from '@/i18n'

/** IntersectionObserver mock：jsdom 不实现，捕获实例以手动触发回调 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []
  unobserve = vi.fn((el: Element) => {
    this.observed = this.observed.filter((o) => o !== el)
  })
  disconnect = vi.fn(() => {
    this.observed = []
  })
  observe = vi.fn((el: Element) => {
    this.observed.push(el)
  })
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }
  trigger(entries: Array<Partial<IntersectionObserverEntry>>) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function entry(id: number, dayOffset: number, hour = 8): TimelineEntry {
  const time = new Date(2026, 10, 1 + dayOffset, hour).getTime()
  return {
    id,
    kind: 'feeding',
    time,
    icon: '🍼',
    color: '#E8906C',
    kindColor: '#E8906C',
    title: `喂养 ${id}`,
    detail: '120 ml',
    timeLabel: `${hour}:00`,
    raw: { createdAt: time - 3600_000 },
  } as TimelineEntry
}

/** 12 天分组，每天 2 条，共 24 条 */
function makeEntries(): TimelineEntry[] {
  const list: TimelineEntry[] = []
  for (let d = 0; d < 12; d++) list.push(entry(d * 2 + 1, d, 8), entry(d * 2 + 2, d, 9))
  return list
}

interface MountProps {
  entries?: TimelineEntry[]
  grouped?: boolean
  deletingKey?: string
  selectedKey?: string
}

function mountList(props: MountProps = {}): VueWrapper {
  return mount(TimelineList, {
    props: { entries: [], grouped: true, ...props },
    global: { plugins: [i18n] },
  })
}

describe('TimelineList', () => {
  it('按天分组渲染分组头，首屏只挂载前 10 组（渐进挂载）', () => {
    const wrapper = mountList({ entries: makeEntries() })
    expect(wrapper.findAll('.tl-group')).toHaveLength(12)
    // 前 10 组各 2 条已挂载，其余 2 组只有分组头占位
    expect(wrapper.findAll('.tl-item')).toHaveLength(20)
    wrapper.unmount()
  })

  it('滚动到未挂载分组时经 IntersectionObserver 补挂载', async () => {
    const wrapper = mountList({ entries: makeEntries() })
    expect(wrapper.findAll('.tl-item')).toHaveLength(20)

    const observer = MockIntersectionObserver.instances[0]
    expect(observer).toBeDefined()
    // 观察器只观察未挂载的分组容器（第 11、12 组）
    expect(observer.observed.length).toBeGreaterThanOrEqual(2)

    const pending = [...observer.observed]
    const day = (pending[pending.length - 1] as HTMLElement).dataset.day!
    observer.trigger(pending.map((target) => ({ isIntersecting: true, target })))

    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.tl-item')).toHaveLength(24)
    // 触发过的容器全部被 unobserve
    expect(observer.observed).toHaveLength(0)
    expect(observer.observed.some((el) => (el as HTMLElement).dataset.day === day)).toBe(false)
    wrapper.unmount()
  })

  it('点击条目触发 edit，点击删除按钮触发 delete 且不冒泡 edit', async () => {
    const entries = makeEntries()
    const wrapper = mountList({ entries })
    const item = wrapper.find('.tl-item')
    await item.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect((wrapper.emitted('edit')![0][0] as TimelineEntry).id).toBe(entries[0].id)

    const del = wrapper.find('.tl-delete')
    await del.trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect((wrapper.emitted('delete')![0][0] as TimelineEntry).id).toBe(entries[0].id)
    // 删除按钮 stop 冒泡：edit 仍只有一次
    expect(wrapper.emitted('edit')).toHaveLength(1)
    wrapper.unmount()
  })

  it('选中与待删除条目应用对应高亮类与 aria-current', () => {
    const entries = makeEntries()
    const targetKey = `${entries[1].kind}-${entries[1].id}`
    const wrapper = mountList({ entries, deletingKey: targetKey, selectedKey: targetKey })

    const selected = wrapper.find('.tl-item.tl-selected')
    expect(selected.exists()).toBe(true)
    expect(selected.classes()).toContain('tl-deleting')
    expect(selected.attributes('aria-current')).toBe('true')
    expect(wrapper.findAll('.tl-selected')).toHaveLength(1)
    wrapper.unmount()
  })

  it('分组头日期文案来自条目时间', () => {
    const wrapper = mountList({ entries: makeEntries() })
    const headers = wrapper.findAll('.tl-day')
    expect(headers).toHaveLength(12)
    expect(headers[0].text()).not.toBe('')
    // 首尾分组头不同
    expect(headers[0].text()).not.toBe(headers[11].text())
    wrapper.unmount()
  })
})
