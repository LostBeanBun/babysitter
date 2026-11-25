import { createRouter, createWebHashHistory } from 'vue-router'
import { watch } from 'vue'
import i18n from '@/i18n'

// 扩展路由 meta 类型：页面标题的 i18n key（缺省回退 app.name）。
// 注：此处必须放在导入了 vue-router 的模块文件里做模块扩展（Module Augmentation），
// 放在全局 d.ts（无 import/export）中会替换而非扩展 vue-router 的类型声明
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

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
  // 切换路由回到顶部；浏览器前进/后退恢复历史滚动位置
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

function applyDocumentTitle() {
  const titleKey = router.currentRoute.value.meta.title || 'app.name'
  document.title = `${i18n.global.t(titleKey)} · ${i18n.global.t('app.name')}`
}

router.afterEach(() => applyDocumentTitle())

// 语言切换后同步更新页面标题
watch(() => i18n.global.locale.value, () => applyDocumentTitle())

export default router
