import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Vaccination } from '@/types'

const t = i18n.global.t

/** 疫苗记录/提醒 store */
export const useVaccinationStore = defineStore('vaccination', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: vaccinations, loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Vaccination[])
      return db.vaccinations.where('[babyId+date]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as Vaccination[],
    [activeBabyId],
  )

  /** 新增疫苗记录/提醒 */
  async function add(data: {
    date: number
    name: string
    dose?: string
    status: 'planned' | 'done'
    notes?: string
  }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.vaccinations.add({
      babyId,
      date: data.date,
      name: data.name,
      dose: data.dose,
      status: data.status,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addRecordFail'))
    return id
  }

  async function update(id: number, patch: Partial<Vaccination>) {
    await db.vaccinations.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.vaccinations.delete(id)
  }

  return { vaccinations, loading, add, update, remove }
})