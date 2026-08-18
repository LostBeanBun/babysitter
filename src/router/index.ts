import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 模式：GitHub Pages / Cloudflare Pages 静态托管无需额外配置
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '今日' } },
    { path: '/log', name: 'log', component: () => import('@/views/LogView.vue'), meta: { title: '记录' } },
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue'), meta: { title: '统计' } },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || '宝宝日记'
  document.title = `${title} · 宝宝日记`
})

export default router
