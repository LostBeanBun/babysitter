import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Temperature } from '@/types'

/** 体温记录 store */
export const useTemperatureStore = defineStore('temperature', () => {
  const { records: temperatures, loading, add, update, remove } = useRecordStore<Temperature>({
    tableName: 'temperatures',
    timeField: 'time',
  })
  return { temperatures, loading, add, update, remove }
})
