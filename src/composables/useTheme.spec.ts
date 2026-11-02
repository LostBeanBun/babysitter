import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const THEME_KEY = 'babysitter.theme'

/** 桩 matchMedia：jsdom 不实现，且 useTheme 在模块加载时就读取 */
function setupMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = []
  const mq = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: () => void) => {
      listeners.push(cb)
    },
    removeEventListener: () => {},
    addListener: (cb: () => void) => {
      listeners.push(cb)
    },
    removeListener: () => {},
    dispatchEvent: () => true,
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mq))
  return {
    setMatches(next: boolean) {
      mq.matches = next
      listeners.forEach((cb) => cb())
    },
  }
}

/** useTheme 在模块顶层读 localStorage / matchMedia，每个用例重新加载模块 */
async function loadTheme() {
  vi.resetModules()
  return import('@/composables/useTheme')
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("setTheme('dark') 写 localStorage + data-theme + meta theme-color", async () => {
    setupMatchMedia(false)
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('content', '#f2f0ed')
    document.head.appendChild(meta)

    const theme = await loadTheme()
    theme.setTheme('dark')

    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(meta.getAttribute('content')).toBe('#0f0e0c')
    expect(theme.themeMode.value).toBe('dark')
    expect(theme.isDark.value).toBe(true)
  })

  it("setTheme('light') → data-theme=light（即使系统是深色）", async () => {
    setupMatchMedia(true)
    const theme = await loadTheme()
    theme.setTheme('light')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(theme.isDark.value).toBe(false)
  })

  it('持久化损坏值 → 回退 system 并跟随系统', async () => {
    setupMatchMedia(true)
    localStorage.setItem(THEME_KEY, 'purple')

    const theme = await loadTheme()
    expect(theme.themeMode.value).toBe('system')
    expect(theme.isDark.value).toBe(true)
  })

  it('system 模式跟随 matchMedia 变化', async () => {
    const media = setupMatchMedia(false)
    const theme = await loadTheme()
    theme.initTheme()
    expect(theme.isDark.value).toBe(false)

    media.setMatches(true)
    expect(theme.isDark.value).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggle 在 light/dark 间切换并持久化', async () => {
    setupMatchMedia(false)
    const theme = await loadTheme()
    theme.setTheme('light')

    theme.toggleTheme()
    expect(theme.themeMode.value).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    theme.toggleTheme()
    expect(theme.themeMode.value).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('initTheme 仅在 system 模式响应系统变化', async () => {
    const media = setupMatchMedia(false)
    const theme = await loadTheme()
    theme.setTheme('dark')
    theme.initTheme()

    media.setMatches(true) // 系统变浅色，但用户固定深色
    expect(theme.themeMode.value).toBe('dark')
    expect(theme.isDark.value).toBe(true)
  })
})
