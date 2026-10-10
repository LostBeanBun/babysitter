import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { DiaperChange } from '@/types'

/** 纸尿裤记录 store */
export const useDiaperStore = defineStore('diaper', () => {
  const { records: diapers, loading, add, update, remove } = useRecordStore<DiaperChange>({
    tableName: 'diapers',
    timeField: 'time',
    addFailKey: 'errors.addDiaperFail',
  })
  return { diapers, loading, add, update, remove }
})
