import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Medication } from '@/types'

/** 用药记录 store */
export const useMedicationStore = defineStore('medication', () => {
  const { records: medications, loading, add, update, remove } = useRecordStore<Medication>({
    tableName: 'medications',
    timeField: 'time',
  })
  return { medications, loading, add, update, remove }
})
