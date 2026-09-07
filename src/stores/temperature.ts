import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Temperature, TemperatureMethod } from '@/types'

const t = i18n.global.t

/** 体温记录 store */
export const useTemperatureStore = defineStore('temperature', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: temperatures, loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Temperature[])
      return db.temperatures.where('[babyId+time]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray().then(a => a.filter(Boolean))
    },
    [] as Temperature[],
    [activeBabyId],
  )

  /** 新增体温记录 */
  async function add(data: { time: number; value: number; method?: TemperatureMethod; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.temperatures.add({
      babyId,
      time: data.time,
      value: data.value,
      method: data.method,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addRecordFail'))
    return id
  }

  async function update(id: number, patch: Partial<Temperature>) {
    await db.temperatures.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.temperatures.delete(id)
  }

  return { temperatures, loading, add, update, remove }
})