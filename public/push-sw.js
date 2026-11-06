/* 提醒通知点击：聚焦已打开的窗口并回到首页；没有窗口则新开
 * 由 vite-plugin-pwa 通过 workbox.importScripts 注入到生成的 sw.js
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // 相对应用根路径解析，兼容部署在子路径（如 GitHub Pages /<repo>/）
  const scope = new URL(self.registration.scope)
  const target = new URL(event.notification.data?.url || './', scope).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => {
        const url = new URL(c.url)
        return url.origin === scope.origin && url.pathname.startsWith(scope.pathname)
      })
      if (!client) return self.clients.openWindow(target)

      await client.focus()
      const url = new URL(client.url)
      const isHome = url.pathname === scope.pathname && (url.hash === '' || url.hash === '#/')
      if (!isHome) {
        try {
          await client.navigate(target)
        } catch {
          // 部分浏览器不允许 navigate，聚焦即可
        }
      }
      return undefined
    }),
  )
})
