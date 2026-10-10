import { defineStore } from 'pinia'
import i18n from '@/i18n'
import { useRecordStore } from '@/stores/createRecordStore'
import type { Sleep } from '@/types'

const t = i18n.global.t

/** 睡眠记录 store */
export const useSleepStore = defineStore('sleep', () => {
  const { records: sleeps, loading, add, update, remove } = useRecordStore<Sleep>({
    tableName: 'sleeps',
    timeField: 'startTime',
    addFailKey: 'errors.addSleepFail',
    withDuration: true,
    validate: (data) => {
      if (data.endTime && data.startTime && data.endTime <= data.startTime) throw new Error(t('errors.sleepOrder'))
    },
  })
  return { sleeps, loading, add, update, remove }
})
