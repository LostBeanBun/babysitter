import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import { startOfDay } from '@/utils/format'
import type { GrowthRecord } from '@/types'

/** 成长记录 store（体重/身高/头围） */
export const useGrowthStore = defineStore('growth', () => {
  const { records: growths, loading, add, update, remove } = useRecordStore<GrowthRecord>({
    tableName: 'growths',
    timeField: 'date',
    addFailKey: 'errors.addGrowthFail',
    normalize: (data) => ({ ...data, date: startOfDay(data.date) }),
  })
  return { growths, loading, add, update, remove }
})
