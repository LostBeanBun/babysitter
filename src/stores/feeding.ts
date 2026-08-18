import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Feeding, FeedType } from '@/types'

const t = i18n.global.t

/** 喂养记录 store */
export const useFeedingStore = defineStore('feeding', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: feedings, loading: loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Feeding[])
      return db.feedings.where('[babyId+startTime]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as Feeding[],
    [activeBabyId],
  )

  /** 新增喂养记录 */
  async function add(data: {
    type: FeedType
    startTime: number
    endTime?: number
    amount?: number
    notes?: string
  }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const duration = data.endTime && data.endTime > data.startTime ? data.endTime - data.startTime : undefined
    const id = await db.feedings.add({
      babyId,
      type: data.type,
      startTime: data.startTime,
      endTime: data.endTime,
      duration,
      amount: data.amount,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addFeedFail'))
    return id
  }

  async function update(id: number, patch: Partial<Feeding>) {
    await db.feedings.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.feedings.delete(id)
  }

  return { feedings, loading, add, update, remove }
})
