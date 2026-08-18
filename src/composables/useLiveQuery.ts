import { liveQuery, type Observable } from 'dexie'
import { ref, watch, type Ref } from 'vue'

/**
 * 将 Dexie liveQuery 包装为 Vue 响应式数据。
 * 数据库任意相关表变化时自动重新查询并更新。
 * 支持传入依赖 ref（如 activeBabyId），依赖变化时自动重新订阅。
 *
 * 注意：本函数通常在 Pinia setup store 中使用，store 是单例且生命周期
 * 由 Pinia 管理，因此订阅不随组件卸载而取消（若组件卸载导致取消，
 * 单例 store 不会重新 setup，liveQuery 将永久失效）。需要释放时
 * 可调用返回的 stop() 手动停止。
 */
export function useLiveQuery<T>(querier: () => Promise<T>, initialValue: T, deps: Ref<unknown>[] = []) {
  const data: Ref<T> = ref(initialValue) as Ref<T>
  const error = ref<Error | null>(null)
  const loading = ref(true)

  let observable: Observable<T> | null = null
  let subscription: { unsubscribe: () => void } | null = null

  const subscribe = () => {
    subscription?.unsubscribe()
    observable = liveQuery(querier)
    subscription = observable.subscribe({
      next: (value) => {
        data.value = value
        loading.value = false
      },
      error: (e) => {
        error.value = e as Error
        loading.value = false
      },
    })
  }

  const stopWatch = watch([...deps], subscribe, { immediate: true })

  /** 手动停止订阅（store dispose 时调用） */
  function stop() {
    stopWatch()
    subscription?.unsubscribe()
  }

  return { data, error, loading, stop }
}
