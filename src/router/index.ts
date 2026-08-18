import { createRouter, createWebHashHistory } from 'vue-router'
import { watch } from 'vue'
import i18n from '@/i18n'

// 使用 hash 模式：GitHub Pages / Cloudflare Pages 静态托管无需额外配置
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'nav.dashboard' },
    },
    { path: '/log', name: 'log', component: () => import('@/views/LogView.vue'), meta: { title: 'nav.log' } },
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue'), meta: { title: 'nav.stats' } },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'nav.settings' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function applyDocumentTitle() {
  const titleKey = (router.currentRoute.value.meta.title as string) || 'app.name'
  document.title = `${i18n.global.t(titleKey)} · ${i18n.global.t('app.name')}`
}

router.afterEach(() => applyDocumentTitle())

// 语言切换后同步更新页面标题
watch(() => i18n.global.locale.value, () => applyDocumentTitle())

export default router
