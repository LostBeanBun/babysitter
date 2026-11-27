/**
 * 记录弹窗状态分发：新增/编辑/删除确认、提示文案、按记录类型落到对应 store、悬浮球显隐。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import i18n from '@/i18n'
import { useRecordModal } from '@/composables/useRecordModal'
import { useSleepModal } from '@/composables/useSleepModal'
import type { RecordKind } from '@/types'
import type { TimelineEntry } from '@/services/timeline'

const { removers, showToastSpy } = vi.hoisted(() => ({
  removers: new Map<string, ReturnType<typeof vi.fn>>(),
  showToastSpy: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({ showToast: showToastSpy }))

// 用最小 store 替身替代 Dexie 查询：只保留 useRecordModal 用到的 remove
vi.mock('@/stores/createRecordStore', () => ({
  useRecordStore: (opts: { tableName: string }) => {
    const remove = vi.fn(async () => {})
    removers.set(opts.tableName, remove)
    return {
      records: { value: [] },
      loading: { value: false },
      error: { value: null },
      add: vi.fn(async () => 1),
      update: vi.fn(async () => {}),
      remove,
    }
  },
}))

const Harness = defineComponent({
  setup() {
    return { api: useRecordModal() }
  },
  render: () => null,
})

type Api = ReturnType<typeof useRecordModal>

function mountApi(): Api {
  const wrapper = mount(Harness, { global: { plugins: [i18n, createPinia()] } })
  return (wrapper.vm as unknown as { api: Api }).api
}

function entry(kind: RecordKind, id: number): TimelineEntry {
  return {
    id,
    kind,
    time: 1_700_000_000_000,
    icon: '🍼',
    color: '#000',
    kindColor: '#000',
    title: 't',
    detail: 'd',
    raw: { id, babyId: 1, createdAt: 0, updatedAt: 0 } as TimelineEntry['raw'],
  }
}

/** 各记录类型 → Dexie 表名（与 useRecordModal 的分发保持一致） */
const TABLE: Record<RecordKind, string> = {
  feeding: 'feedings',
  diaper: 'diapers',
  pumping: 'pumpings',
  sleep: 'sleeps',
  growth: 'growths',
  solidFood: 'solidFoods',
  medication: 'medications',
  vaccination: 'vaccinations',
  temperature: 'temperatures',
  milestone: 'milestones',
}

beforeEach(() => {
  vi.useFakeTimers()
  removers.clear()
  showToastSpy.mockClear()
  useSleepModal().sleepModalOpen.value = false
})

afterEach(() => {
  vi.advanceTimersByTime(10_000)
  vi.useRealTimers()
})

describe('useRecordModal', () => {
  it('openAdd 打开对应表单并隐藏睡眠悬浮球；关闭后恢复', async () => {
    const api = mountApi()
    const { sleepModalOpen } = useSleepModal()

    api.openAdd('feeding')
    expect(api.modalState.value).toEqual({ kind: 'feeding' })
    await nextTick()
    expect(sleepModalOpen.value).toBe(true)

    api.onCancelled()
    expect(api.modalState.value).toBeNull()
    await nextTick()
    expect(sleepModalOpen.value).toBe(false)
  })

  it('onEdit 携带编辑条目打开表单', () => {
    const api = mountApi()
    const item = entry('diaper', 11)
    api.onEdit(item)
    expect(api.modalState.value).toEqual({ kind: 'diaper', editing: item })
  })

  it('onSaved / onStartRecord 关闭弹窗并提示，onCancelled 静默关闭', () => {
    const api = mountApi()

    api.openAdd('sleep')
    api.onSaved()
    expect(api.modalState.value).toBeNull()
    expect(showToastSpy).toHaveBeenCalledWith(i18n.global.t('common.recordSaved'))

    api.openAdd('sleep')
    api.onStartRecord()
    expect(api.modalState.value).toBeNull()
    expect(showToastSpy).toHaveBeenCalledWith(i18n.global.t('common.recordStarted'))

    showToastSpy.mockClear()
    api.openAdd('sleep')
    api.onCancelled()
    expect(api.modalState.value).toBeNull()
    expect(showToastSpy).not.toHaveBeenCalled()
  })

  it('onDelete 打开删除确认（视图关闭时清空 confirmDelete）', () => {
    const api = mountApi()
    const item = entry('feeding', 12)

    api.onDelete(item)
    expect(api.confirmDelete.value).toEqual(item)

    api.confirmDelete.value = null
    expect(api.confirmDelete.value).toBeNull()
  })

  it('confirmDeleteAction 进入 3 秒撤销窗口，到期才真正删除', async () => {
    const api = mountApi()
    const item = entry('feeding', 13)

    api.onDelete(item)
    await api.confirmDeleteAction()

    expect(api.confirmDelete.value).toBeNull()
    expect(showToastSpy).toHaveBeenCalledWith(i18n.global.t('common.deletedToast'), {
      actionLabel: i18n.global.t('common.undo'),
      onAction: expect.any(Function),
    })
    expect(removers.get('feedings')).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    expect(removers.get('feedings')).toHaveBeenCalledWith(13)
  })

  it('撤销窗口内点击撤销则不删除', async () => {
    const api = mountApi()
    const item = entry('pumping', 14)

    api.onDelete(item)
    await api.confirmDeleteAction()

    const opts = showToastSpy.mock.calls[0][1] as { onAction: () => void }
    opts.onAction()

    await vi.advanceTimersByTimeAsync(3000)
    expect(removers.get('pumpings')).not.toHaveBeenCalled()
  })

  it('每种记录类型删除时落到对应数据表', async () => {
    const kinds = Object.keys(TABLE) as RecordKind[]

    for (const [i, kind] of kinds.entries()) {
      const api = mountApi()
      api.onDelete(entry(kind, 100 + i))
      await api.confirmDeleteAction()
      await vi.advanceTimersByTimeAsync(3000)
      expect(removers.get(TABLE[kind]), kind).toHaveBeenCalledWith(100 + i)
    }
  })
})
