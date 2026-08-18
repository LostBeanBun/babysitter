import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export type Locale = 'zh-CN' | 'en-US'

const LOCALE_KEY = 'babysitter.locale'

function detectLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY)
  if (saved === 'zh-CN' || saved === 'en-US') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

const locale = detectLocale()
document.documentElement.lang = locale === 'en-US' ? 'en' : 'zh-CN'

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

/** 切换界面语言并持久化 */
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_KEY, locale)
  document.documentElement.lang = locale === 'en-US' ? 'en' : 'zh-CN'
}

export default i18n
