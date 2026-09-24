'use client'

import { useEffect } from 'react'
import { initTheme } from '@/stores/theme'
import { hydrateActiveTimer } from '@/hooks/useActiveTimer'
import { hydrateActiveBaby } from '@/stores/baby'
import '@/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTheme()
    // 活跃记录：首帧与 SSR 一致（空），挂载后再恢复，避免水合失败
    hydrateActiveTimer()
    // 当前宝宝：同上，刷新后恢复上次选择
    hydrateActiveBaby()

    // PWA：仅生产环境注册，避免 dev 下 SW 缓存干扰 HMR/客户端路由
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW register failed', err))
    }

    // 全局错误兜底
    const onErr = (e: PromiseRejectionEvent | ErrorEvent) => {
      console.error('[app error]', 'reason' in e ? e.reason : e)
    }
    window.addEventListener('unhandledrejection', onErr as EventListener)
    window.addEventListener('error', onErr as EventListener)
    return () => {
      window.removeEventListener('unhandledrejection', onErr as EventListener)
      window.removeEventListener('error', onErr as EventListener)
    }
  }, [])

  return <>{children}</>
}
