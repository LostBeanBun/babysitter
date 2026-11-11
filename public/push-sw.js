/* 提醒通知点击：聚焦已打开的窗口并跳到通知指定页面（缺省首页）；没有窗口则新开
 * 由 vite-plugin-pwa 通过 workbox.importScripts 注入到生成的 sw.js
 */

/** 归一化 hash：空 / # / #/ 都视为首页，避免仅哈希差异触发多余导航 */
function normalizeHash(hash) {
  return hash === '' || hash === '#' || hash === '#/' ? '' : hash
}

/** 两个地址是否指向同一页面（忽略仅哈希差异） */
function samePage(a, b) {
  const x = new URL(a)
  const y = new URL(b)
  return (
    x.origin === y.origin &&
    x.pathname === y.pathname &&
    x.search === y.search &&
    normalizeHash(x.hash) === normalizeHash(y.hash)
  )
}

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
      if (!samePage(client.url, target)) {
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
