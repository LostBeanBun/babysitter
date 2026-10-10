import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Feeding } from '@/types'

/** 喂养记录 store */
export const useFeedingStore = defineStore('feeding', () => {
  const { records: feedings, loading, add, update, remove } = useRecordStore<Feeding>({
    tableName: 'feedings',
    timeField: 'startTime',
    addFailKey: 'errors.addFeedFail',
    withDuration: true,
  })
  return { feedings, loading, add, update, remove }
})
