import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export type Locale = 'zh-CN' | 'en-US'

const LOCALE_KEY = 'babysitter.locale'

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN'
  const saved = localStorage.getItem(LOCALE_KEY)
  if (saved === 'zh-CN' || saved === 'en-US') return saved
  return 'zh-CN'
}

const locale = detectLocale()

if (typeof document !== 'undefined') {
  document.documentElement.lang = locale === 'en-US' ? 'en' : 'zh-CN'
}

void i18n.use(initReactI18next).init({
  lng: locale,
  fallbackLng: 'zh-CN',
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  interpolation: {
    escapeValue: false,
    // 与 vue-i18n / 语言包一致：使用 {n} 而非 i18next 默认的 {{n}}
    prefix: '{',
    suffix: '}',
  },
  returnNull: false,
})

/** 切换界面语言并持久化 */
export function setLocale(next: Locale) {
  void i18n.changeLanguage(next)
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_KEY, next)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'en-US' ? 'en' : 'zh-CN'
  }
}

export default i18n
