import { ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const THEME_KEY = 'babysitter.theme'
const mq = window.matchMedia('(prefers-color-scheme: dark)')

const saved = (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system'

function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && mq.matches)
}

/** 当前主题模式（设置页绑定） */
export const themeMode = ref<ThemeMode>(saved)
/** 当前是否暗色（响应式，ECharts 等动态颜色使用） */
export const isDark = ref(resolveDark(saved))

function apply() {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  // 同步 PWA 浏览器 UI 主题色
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isDark.value ? '#1d1916' : '#FDF6EF')
}

/** 切换主题并持久化 */
export function setTheme(mode: ThemeMode) {
  themeMode.value = mode
  isDark.value = resolveDark(mode)
  localStorage.setItem(THEME_KEY, mode)
  apply()
}

/** 在明暗之间切换（页头快捷按钮用） */
export function toggleTheme() {
  setTheme(isDark.value ? 'light' : 'dark')
}

/** 应用启动时初始化（须在挂载前同步调用，避免闪烁） */
export function initTheme() {
  apply()
  // 跟随系统模式下，系统切换时实时响应
  const onChange = () => {
    if (themeMode.value === 'system') {
      isDark.value = mq.matches
      apply()
    }
  }
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
  else (mq as MediaQueryList).addListener(onChange)
}
