import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { initTheme } from './composables/useTheme'
import { showToast } from '@/composables/useToast'
import './styles/main.css'

// 应用启动即应用主题（含暗色），避免首屏闪烁
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')

// —— 全局错误兜底：捕获未处理异常并给出可见提示，避免白屏无反馈 ——
function handleGlobalError(err: unknown) {
  console.error('[app error]', err)
  let msg = i18n.global.t('errors.generic')
  // IndexedDB 写入失败（常见于存储满）给出可操作提示
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    msg = i18n.global.t('errors.storageFull')
  }
  showToast(msg)
}
app.config.errorHandler = handleGlobalError
window.addEventListener('unhandledrejection', (e) => handleGlobalError(e.reason))

// —— PWA：新版本提示（等待用户确认后刷新，避免静默更新打断使用）——
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showToast(i18n.global.t('pwa.updateReady'), {
      actionLabel: i18n.global.t('pwa.refresh'),
      duration: 0,
      onAction: () => updateSW(true),
    })
  },
  onOfflineReady() {
    showToast(i18n.global.t('pwa.offlineReady'))
  },
})
