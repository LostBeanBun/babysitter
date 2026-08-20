import { defineStore, storeToRefs } from 'pinia'
import { db } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { Milestone } from '@/types'

const t = i18n.global.t

/** 里程碑记录 store */
export const useMilestoneStore = defineStore('milestone', () => {
  const babyStore = useBabyStore()
  const { activeBabyId } = storeToRefs(babyStore)

  const { data: milestones, loading } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as Milestone[])
      return db.milestones.where('[babyId+time]').between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER]).toArray()
    },
    [] as Milestone[],
    [activeBabyId],
  )

  /** 新增里程碑记录 */
  async function add(data: { time: number; type: Milestone['type']; notes?: string }): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    const now = Date.now()
    const id = await db.milestones.add({
      babyId,
      time: data.time,
      type: data.type,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    })
    if (id == null) throw new Error(t('errors.addRecordFail'))
    return id
  }

  async function update(id: number, patch: Partial<Milestone>) {
    await db.milestones.update(id, { ...patch, updatedAt: Date.now() })
  }

  async function remove(id: number) {
    await db.milestones.delete(id)
  }

  return { milestones, loading, add, update, remove }
})