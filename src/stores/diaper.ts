import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { DiaperChange, DiaperType, DiaperColor, DiaperAmount } from '@/types'

const t = i18n.global.t

/** 纸尿裤记录 store */
export const useDiaperStore = defineStore('diaper', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: diapers, loading: loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as DiaperChange[])
      return db.diapers.where('[babyId+time]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as DiaperChange[],
    [activeBabyId],
  )

  async function add(data: {
    type: DiaperType
    time: number
    color?: DiaperColor
    amount?: DiaperAmount
    notes?: string
  }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.diapers.add({
      babyId,
      type: data.type,
      time: data.time,
      color: data.color,
      amount: data.amount,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addDiaperFail'))
    return id
  }

  async function update(id: number, patch: Partial<DiaperChange>) {
    await db.diapers.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.diapers.delete(id)
  }

  return { diapers, loading, add, update, remove }
})
