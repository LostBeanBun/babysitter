import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { GrowthRecord } from '@/types'

const t = i18n.global.t

/** 成长记录 store（体重/身高） */
export const useGrowthStore = defineStore('growth', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: growths, loading: loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as GrowthRecord[])
      return db.growths.where('[babyId+date]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as GrowthRecord[],
    [activeBabyId],
  )

  /** 新增成长记录 */
  async function add(data: { date: number; weight?: number; height?: number; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.growths.add({
      babyId,
      date: data.date,
      weight: data.weight,
      height: data.height,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addGrowthFail'))
    return id
  }

  async function update(id: number, patch: Partial<GrowthRecord>) {
    await db.growths.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.growths.delete(id)
  }

  return { growths, loading, add, update, remove }
})
