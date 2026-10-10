import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Milestone } from '@/types'

/** 里程碑记录 store */
export const useMilestoneStore = defineStore('milestone', () => {
  const { records: milestones, loading, add, update, remove } = useRecordStore<Milestone>({
    tableName: 'milestones',
    timeField: 'time',
  })
  return { milestones, loading, add, update, remove }
})
