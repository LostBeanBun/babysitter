import { defineStore } from 'pinia'
import { useRecordStore } from '@/stores/createRecordStore'
import { startOfDay } from '@/utils/format'
import type { Vaccination } from '@/types'

/** 疫苗记录/提醒 store */
export const useVaccinationStore = defineStore('vaccination', () => {
  const { records: vaccinations, loading, add, update, remove } = useRecordStore<Vaccination>({
    tableName: 'vaccinations',
    timeField: 'date',
    normalize: (data) => ({ ...data, date: startOfDay(data.date) }),
  })
  return { vaccinations, loading, add, update, remove }
})
