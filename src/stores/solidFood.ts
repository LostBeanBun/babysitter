import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { SolidFood } from '@/types'

const t = i18n.global.t

/** 辅食记录 store */
export const useSolidFoodStore = defineStore('solidFood', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: solidFoods, loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as SolidFood[])
      return db.solidFoods.where('[babyId+time]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray().then(a => a.filter(Boolean))
    },
    [] as SolidFood[],
    [activeBabyId],
  )

  /** 新增辅食记录 */
  async function add(data: { time: number; food: string; amount?: string; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.solidFoods.add({
      babyId,
      time: data.time,
      food: data.food,
      amount: data.amount,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addRecordFail'))
    return id
  }

  async function update(id: number, patch: Partial<SolidFood>) {
    await db.solidFoods.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.solidFoods.delete(id)
  }

  return { solidFoods, loading, add, update, remove }
})
