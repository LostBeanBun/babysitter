import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Sleep, SleepType } from '@/types'

const t = i18n.global.t

/** 睡眠记录 store */
export const useSleepStore = defineStore('sleep', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: sleeps, loading: loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Sleep[])
      return db.sleeps.where('[babyId+startTime]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray().then(a => a.filter(Boolean))
    },
    [] as Sleep[],
    [activeBabyId],
  )

  async function add(data: { type: SleepType; startTime: number; endTime: number; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    if (data.endTime <= data.startTime) throw new Error(t('errors.sleepOrder'))
    const now = Date.now()
    const duration = data.endTime - data.startTime
    const id = await db.sleeps.add({
      babyId,
      type: data.type,
      startTime: data.startTime,
      endTime: data.endTime,
      duration,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addSleepFail'))
    return id
  }

  async function update(id: number, patch: Partial<Sleep>) {
    await db.sleeps.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.sleeps.delete(id)
  }

  return { sleeps, loading, add, update, remove }
})
