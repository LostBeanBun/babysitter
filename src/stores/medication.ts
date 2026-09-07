import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Medication } from '@/types'

const t = i18n.global.t

/** 用药记录 store */
export const useMedicationStore = defineStore('medication', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: medications, loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Medication[])
      return db.medications.where('[babyId+time]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray().then(a => a.filter(Boolean))
    },
    [] as Medication[],
    [activeBabyId],
  )

  /** 新增用药记录 */
  async function add(data: { time: number; name: string; dose?: string; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.medications.add({
      babyId,
      time: data.time,
      name: data.name,
      dose: data.dose,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addRecordFail'))
    return id
  }

  async function update(id: number, patch: Partial<Medication>) {
    await db.medications.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.medications.delete(id)
  }

  return { medications, loading, add, update, remove }
})