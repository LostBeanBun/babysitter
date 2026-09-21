import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveTimer } from '@/composables/useActiveTimer'

describe('useActiveTimer', () => {
  beforeEach(() => {
    useActiveTimer().reset()
  })

  it('start 返回唯一 id', () => {
    const timer = useActiveTimer()
    const id1 = timer.start('sleep', 1, 1000)
    const id2 = timer.start('feeding', 2, 2000)
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
    expect(timer.records.value).toHaveLength(2)
  })

  it('同类记录不能重复添加', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1, 1000)
    const id2 = timer.start('sleep', 2, 2000)
    expect(id2).toBeNull()
    expect(timer.records.value).toHaveLength(1)
  })

  it('最多 3 条记录', () => {
    const timer = useActiveTimer()
    timer.start('feeding', 1, 1000)
    timer.start('sleep', 2, 2000)
    timer.start('pumping', 3, 3000)
    const id4 = timer.start('feeding', 4, 4000)
    expect(id4).toBeNull()
    expect(timer.records.value).toHaveLength(3)
  })

  it('reset(id) 按 id 清除', () => {
    const timer = useActiveTimer()
    const id1 = timer.start('sleep', 1, 1000)
    timer.start('feeding', 2, 2000)
    expect(id1).toBeTruthy()
    timer.reset(id1!)
    expect(timer.records.value).toHaveLength(1)
    expect(timer.records.value[0].kind).toBe('feeding')
  })

  it('reset() 清除全部', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1, 1000)
    timer.start('feeding', 2, 2000)
    timer.reset()
    expect(timer.records.value).toHaveLength(0)
    expect(timer.isActive.value).toBe(false)
  })

  it('getById 查找记录', () => {
    const timer = useActiveTimer()
    const id = timer.start('sleep', 42, 1000)
    expect(id).toBeTruthy()
    const entry = timer.getById(id!)
    expect(entry).toBeDefined()
    expect(entry!.kind).toBe('sleep')
    expect(entry!.recordId).toBe(42)
  })

  it('getByKind 查找记录', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1, 1000)
    timer.start('feeding', 2, 2000)
    const entry = timer.getByKind('feeding')
    expect(entry).toBeDefined()
    expect(entry!.recordId).toBe(2)
  })

  it('hasKind 判断同类是否已存在', () => {
    const timer = useActiveTimer()
    expect(timer.hasKind('sleep')).toBe(false)
    timer.start('sleep', 1, 1000)
    expect(timer.hasKind('sleep')).toBe(true)
    expect(timer.hasKind('feeding')).toBe(false)
  })

  it('无记录时 isActive 为 false', () => {
    const timer = useActiveTimer()
    expect(timer.isActive.value).toBe(false)
  })

  it('有记录时 isActive 为 true', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1, 1000)
    expect(timer.isActive.value).toBe(true)
  })
})
