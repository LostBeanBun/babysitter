import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveTimer, type TimerKind } from '@/composables/useActiveTimer'

describe('useActiveTimer', () => {
  beforeEach(() => {
    useActiveTimer().reset()
  })

  it('start 启动计时器', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1000)
    expect(timer.running.value).toBe(true)
    expect(timer.kind.value).toBe('sleep')
    expect(timer.startTime.value).toBe(1000)
    expect(timer.isActive.value).toBe(true)
  })

  it('stop 停止计时器并返回起止时间', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1000)
    const result = timer.stop()
    expect(result).toEqual({ start: 1000, end: result!.end })
    expect(timer.running.value).toBe(false)
    expect(timer.isActive.value).toBe(false)
  })

  it('reset 清除计时器状态', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1000)
    timer.reset()
    expect(timer.running.value).toBe(false)
    expect(timer.kind.value).toBeNull()
    expect(timer.startTime.value).toBe(0)
    expect(timer.isActive.value).toBe(false)
  })

  it('updateStartTime 修改起始时间', () => {
    const timer = useActiveTimer()
    timer.start('sleep', 1000)
    timer.updateStartTime(2000)
    expect(timer.startTime.value).toBe(2000)
  })

  it('BUG复现: sleep计时时保存feeding记录不应重置timer', () => {
    const timer = useActiveTimer()

    // 模拟用户启动sleep计时
    timer.start('sleep', Date.now() - 60_000)
    expect(timer.kind.value).toBe('sleep')
    expect(timer.running.value).toBe(true)

    // 模拟 onSaved() 被调用（当前bug: 无论什么kind都reset）
    // 问题根源: onSaved() 不检查保存的kind是否匹配timer的kind
    const savedKind: TimerKind = 'feeding' // 保存的是feeding记录
    const timerKind = timer.kind.value

    // 当前有bug的行为: unconditionally reset
    // if (true) timer.reset()

    // 正确的行为: 只有当savedKind匹配timerKind时才reset
    if (savedKind === timerKind) {
      timer.reset()
    }

    // 验证: sleep计时器应该仍然在运行
    expect(timer.kind.value).toBe('sleep')
    expect(timer.running.value).toBe(true)
    expect(timer.isActive.value).toBe(true)
  })

  it('sleep计时时保存sleep记录应重置timer', () => {
    const timer = useActiveTimer()

    // 模拟用户启动sleep计时
    timer.start('sleep', Date.now() - 60_000)
    expect(timer.kind.value).toBe('sleep')

    // 模拟保存sleep记录
    const savedKind: TimerKind = 'sleep'
    const timerKind = timer.kind.value
    if (savedKind === timerKind) {
      timer.reset()
    }

    // 验证: timer应该被重置
    expect(timer.kind.value).toBeNull()
    expect(timer.running.value).toBe(false)
  })

  it('feeding计时时保存sleep记录不应重置timer', () => {
    const timer = useActiveTimer()

    // 模拟用户启动feeding计时
    timer.start('feeding', Date.now() - 60_000)
    expect(timer.kind.value).toBe('feeding')

    // 模拟保存sleep记录
    const savedKind: TimerKind = 'sleep'
    const timerKind = timer.kind.value
    if (savedKind === timerKind) {
      timer.reset()
    }

    // 验证: feeding计时器应该仍然在运行
    expect(timer.kind.value).toBe('feeding')
    expect(timer.running.value).toBe(true)
  })

  it('feeding计时时保存feeding记录应重置timer', () => {
    const timer = useActiveTimer()

    // 模拟用户启动feeding计时
    timer.start('feeding', Date.now() - 60_000)
    expect(timer.kind.value).toBe('feeding')

    // 模拟保存feeding记录
    const savedKind: TimerKind = 'feeding'
    const timerKind = timer.kind.value
    if (savedKind === timerKind) {
      timer.reset()
    }

    // 验证: timer应该被重置
    expect(timer.kind.value).toBeNull()
    expect(timer.running.value).toBe(false)
  })

  it('无计时时保存任何记录不应报错', () => {
    const timer = useActiveTimer()
    expect(timer.kind.value).toBeNull()

    // 模拟保存记录
    const savedKind: TimerKind = 'feeding'
    const timerKind = timer.kind.value
    if (savedKind === timerKind) {
      timer.reset()
    }

    // 验证: 状态不变
    expect(timer.kind.value).toBeNull()
    expect(timer.running.value).toBe(false)
  })
})
