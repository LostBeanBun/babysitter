import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Pumping } from '@/types'

/** 吸奶记录 store */
export const usePumpingStore = defineStore('pumping', () => {
  const { records: pumpings, loading, add, update, remove } = useRecordStore<Pumping>({
    tableName: 'pumpings',
    timeField: 'startTime',
    addFailKey: 'errors.addPumpFail',
    withDuration: true,
  })
  return { pumpings, loading, add, update, remove }
})
