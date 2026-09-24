'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedType, BreastSide } from '@/types'
import { FEED_TYPE_LIST, BREAST_SIDE_LIST } from '@/constants'
import { toDateTimeLocal, fromDateTimeLocal, formatDuration } from '@/utils/format'
import { db } from '@/db'
import { useBabies } from '@/stores/baby'
import { toast } from '@/stores/toast'
import { useActiveTimer } from '@/hooks/useActiveTimer'
import FormNotes from '@/components/common/FormNotes'
import FormActions from '@/components/common/FormActions'
import s from './FeedingForm.module.css'

export interface FeedingFormProps {
  editing?: {
    id: number
    type: FeedType
    side?: BreastSide
    startTime: number
    endTime?: number
    duration?: number
    amount?: number
    notes?: string
  }
  onSaved?: () => void
  onCancelled?: () => void
  onStartRecord?: () => void
}

export default function FeedingForm({ editing, onSaved, onCancelled, onStartRecord }: FeedingFormProps) {
  const { t } = useTranslation()
  const { activeBabyId } = useBabies()
  const { getByKind, start: startTimer, reset: resetTimer } = useActiveTimer()

  const [type, setType] = useState<FeedType>(editing?.type ?? 'breast')
  const [side, setSide] = useState<BreastSide>(editing?.side ?? 'left')
  const [amount, setAmount] = useState(editing?.amount != null ? String(editing.amount) : '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [startTime, setStartTime] = useState(() => toDateTimeLocal(editing?.startTime ?? Date.now()))
  const [endTime, setEndTime] = useState(editing?.endTime ? toDateTimeLocal(editing.endTime) : '')

  const isBreast = type === 'breast'
  const activeEntry = getByKind('feeding')
  const isRecording = !!activeEntry
  const isEditing = !!editing && !isRecording

  const durStart = fromDateTimeLocal(startTime)
  const durEnd = endTime ? fromDateTimeLocal(endTime) : undefined
  const durationText = durStart && durEnd && durEnd > durStart ? formatDuration(durEnd - durStart) : null

  const submitLabel = isEditing ? t('common.saveEdit') : isRecording ? t('feed.endRecord') : t('feed.startRecord')

  useEffect(() => {
    const entry = getByKind('feeding')
    if (!entry) return
    let stale = false
    void db.feedings.get(entry.recordId).then((record) => {
      if (!record || stale) return
      setType(record.type)
      setSide(record.side ?? 'left')
      setAmount(record.amount != null ? String(record.amount) : '')
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
        await db.feedings.update(activeEntry.recordId, {
          endTime: endTs,
          duration: endTs > startTs ? endTs - startTs : undefined,
          updatedAt: Date.now(),
        })
        resetTimer(activeEntry.id)
        onSaved?.()
        return
      }

      if (isEditing && editing) {
        await db.feedings.update(editing.id, {
          type,
          side: isBreast ? side : undefined,
          startTime: startTs,
          endTime: end,
          duration: end && end > startTs ? end - startTs : undefined,
          amount: isBreast ? undefined : amount ? Number(amount) : undefined,
          notes: notes || undefined,
          updatedAt: Date.now(),
        })
        onSaved?.()
        return
      }

      if (isBreast) {
        if (activeBabyId == null) throw new Error(t('errors.noBaby'))
        const now = Date.now()
        const id = await db.feedings.add({
          babyId: activeBabyId,
          type,
          side,
          startTime: startTs,
          endTime: undefined,
          duration: undefined,
          amount: undefined,
          notes: notes || undefined,
          createdAt: now,
          updatedAt: now,
        })
        if (id == null) throw new Error(t('errors.addFeedFail'))
        startTimer('feeding', id, startTs)
      } else {
        const amt = Number(amount)
        if (!amount || isNaN(amt) || amt <= 0) {
          alert(t('feed.invalidAmount'))
          return
        }
        if (activeBabyId == null) throw new Error(t('errors.noBaby'))
        const now = Date.now()
        const id = await db.feedings.add({
          babyId: activeBabyId,
          type,
          side: undefined,
          startTime: startTs,
          endTime: undefined,
          duration: undefined,
          amount: amt,
          notes: notes || undefined,
          createdAt: now,
          updatedAt: now,
        })
        if (id == null) throw new Error(t('errors.addFeedFail'))
        startTimer('feeding', id, startTs)
      }
      onStartRecord?.()
    } catch {
      toast(t('errors.generic'))
    }
  }

  return (
    <div className="feeding-form">
      <p className="form-label">{t('feed.typeLabel')}</p>
      <div className={s['type-grid']}>
        {FEED_TYPE_LIST.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={type === opt.value ? `${s['type-btn']} ${s.selected}` : s['type-btn']}
            style={
              type === opt.value ? { background: opt.color + '22', borderColor: opt.color, color: opt.color } : undefined
            }
            onClick={() => setType(opt.value)}
          >
            <span className={s['type-icon']}>{opt.icon}</span>
            <span className={s['type-label']}>{t(opt.label)}</span>
          </button>
        ))}
      </div>

      {isBreast && (
        <div className={s['side-row']}>
          {BREAST_SIDE_LIST.map((sd) => (
            <button
              key={sd.value}
              type="button"
              className={side === sd.value ? `${s['side-btn']} ${s.selected}` : s['side-btn']}
              onClick={() => setSide(sd.value)}
            >
              <span>{sd.icon}</span>
              <span>{t(sd.label)}</span>
            </button>
          ))}
        </div>
      )}

      {!isBreast && (
        <div className="form-field">
          <label className="form-label">{t('feed.amountLabel')}</label>
          <input
            value={amount}
            type="number"
            min={0}
            step={5}
            placeholder={t('feed.amountPlaceholder')}
            className="form-input"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      )}

      <div className={s['time-row']}>
        <div className="form-field">
          <label className="form-label">{t('feed.startLabel')}</label>
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
          <label className="form-label">{t('feed.endLabel')}</label>
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

      <FormNotes value={notes} label={t('feed.notesLabel')} placeholder={t('common.optional')} onChange={setNotes} />

      <FormActions editing={isEditing} submitLabel={submitLabel} onCancelled={onCancelled} onSave={submit} />
    </div>
  )
}
