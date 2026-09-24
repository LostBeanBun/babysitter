'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SleepType } from '@/types'
import { SLEEP_TYPE_LABELS } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { db } from '@/db'
import { useBabies } from '@/stores/baby'
import { toast } from '@/stores/toast'
import { useActiveTimer } from '@/hooks/useActiveTimer'
import FormNotes from '@/components/common/FormNotes'
import FormActions from '@/components/common/FormActions'
import s from './SleepForm.module.css'

export interface SleepFormProps {
  editing?: { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
  onSaved?: () => void
  onCancelled?: () => void
  onStartRecord?: () => void
}

export default function SleepForm({ editing, onSaved, onCancelled, onStartRecord }: SleepFormProps) {
  const { t } = useTranslation()
  const { activeBabyId } = useBabies()
  const { getByKind, start: startTimer, reset: resetTimer } = useActiveTimer()

  const [type, setType] = useState<SleepType>(editing?.type ?? 'nap')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [startTime, setStartTime] = useState(() => toDateTimeLocal(editing?.startTime ?? Date.now()))
  const [endTime, setEndTime] = useState(editing?.endTime ? toDateTimeLocal(editing.endTime) : '')

  const activeEntry = getByKind('sleep')
  const isRecording = !!activeEntry
  const isEditing = !!editing && !isRecording

  const durStart = fromDateTimeLocal(startTime)
  const durEnd = endTime ? fromDateTimeLocal(endTime) : undefined
  const durationText = durStart && durEnd && durEnd > durStart ? formatDuration(durEnd - durStart) : null

  const submitLabel = isEditing ? t('common.saveEdit') : isRecording ? t('sleep.endRecord') : t('sleep.startRecord')

  useEffect(() => {
    const entry = getByKind('sleep')
    if (!entry) return
    let stale = false
    void db.sleeps.get(entry.recordId).then((record) => {
      if (!record || stale) return
      setType(record.type)
      setNotes(record.notes ?? '')
      setStartTime(toDateTimeLocal(record.startTime))
      setEndTime('')
    })
    return () => {
      stale = true
    }
  }, [getByKind])

  async function submit() {
    try {
      const startTs = fromDateTimeLocal(startTime) ?? Date.now()
      const end = endTime ? fromDateTimeLocal(endTime) : undefined

      if (isRecording && activeEntry) {
        const endTs = end ?? Date.now()
        if (endTs <= startTs) {
          alert(t('sleep.invalidOrder'))
          return
        }
        await db.sleeps.update(activeEntry.recordId, {
          endTime: endTs,
          duration: endTs - startTs,
          updatedAt: Date.now(),
        })
        resetTimer(activeEntry.id)
        onSaved?.()
        return
      }

      if (isEditing && editing) {
        if (!end) {
          alert(t('sleep.invalidRange'))
          return
        }
        if (end <= startTs) {
          alert(t('sleep.invalidOrder'))
          return
        }
        await db.sleeps.update(editing.id, {
          type,
          startTime: startTs,
          endTime: end,
          notes: notes || undefined,
          updatedAt: Date.now(),
        })
        onSaved?.()
        return
      }

      if (activeBabyId == null) throw new Error(t('errors.noBaby'))
      const now = Date.now()
      const id = await db.sleeps.add({
        babyId: activeBabyId,
        type,
        startTime: startTs,
        endTime: undefined,
        duration: undefined,
        notes: notes || undefined,
        createdAt: now,
        updatedAt: now,
      })
      if (id == null) throw new Error(t('errors.addSleepFail'))
      startTimer('sleep', id, startTs)
      onStartRecord?.()
    } catch {
      toast(t('errors.generic'))
    }
  }

  const typeEntries = Object.entries(SLEEP_TYPE_LABELS) as [SleepType, string][]

  return (
    <div className="sleep-form">
      <p className="form-label">{t('sleep.typeLabel')}</p>
      <div className={s['type-row']}>
        {typeEntries.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={type === key ? `${s['type-btn']} ${s.selected}` : s['type-btn']}
            onClick={() => setType(key)}
          >
            <span className={s['type-icon']}>{key === 'night' ? '🌙' : '😴'}</span>
            <span className={s['type-label']}>{t(label)}</span>
          </button>
        ))}
      </div>

      <div className={s['time-row']}>
        <div className="form-field">
          <label className="form-label">{t('sleep.startLabel')}</label>
          <input
            value={startTime}
            type="datetime-local"
            placeholder={t('common.selectDateTime')}
            className="form-input"
            disabled={isRecording}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="form-label">{t('sleep.endLabel')}</label>
          <input
            value={endTime}
            type="datetime-local"
            placeholder={t('common.selectDateTime')}
            className="form-input"
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {durationText && <p className={s['duration-hint']}>{durationText}</p>}

      <FormNotes value={notes} label={t('sleep.notesLabel')} placeholder={t('common.optional')} onChange={setNotes} />

      <FormActions editing={isEditing} submitLabel={submitLabel} onCancelled={onCancelled} onSave={submit} />
    </div>
  )
}
