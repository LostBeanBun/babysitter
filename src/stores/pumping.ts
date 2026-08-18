import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Pumping, PumpSide } from '@/types'

const t = i18n.global.t

/** 吸奶记录 store */
export const usePumpingStore = defineStore('pumping', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: pumpings, loading: loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Pumping[])
      return db.pumpings.where('[babyId+startTime]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as Pumping[],
    [activeBabyId],
  )

  async function add(data: {
    side: PumpSide
    startTime: number
    endTime?: number
    amount?: number
    notes?: string
  }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const duration = data.endTime && data.endTime > data.startTime ? data.endTime - data.startTime : undefined
    const id = await db.pumpings.add({
      babyId,
      side: data.side,
      startTime: data.startTime,
      endTime: data.endTime,
      duration,
      amount: data.amount,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addPumpFail'))
    return id
  }

  async function update(id: number, patch: Partial<Pumping>) {
    await db.pumpings.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.pumpings.delete(id)
  }

  return { pumpings, loading, add, update, remove }
})
