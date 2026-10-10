import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import type { SolidFood } from '@/types'

/** 辅食记录 store */
export const useSolidFoodStore = defineStore('solidFood', () => {
  const { records: solidFoods, loading, add, update, remove } = useRecordStore<SolidFood>({
    tableName: 'solidFoods',
    timeField: 'time',
  })
  return { solidFoods, loading, add, update, remove }
})
