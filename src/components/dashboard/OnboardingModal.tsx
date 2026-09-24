'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BaseModal from '@/components/common/BaseModal'
import { useBabies } from '@/stores/baby'
import { BABY_AVATARS } from '@/constants'
import type { BabyGender } from '@/types'
import s from './OnboardingModal.module.css'

export interface OnboardingModalProps {
  show: boolean
  onClose?: () => void
}

export default function OnboardingModal({ show, onClose }: OnboardingModalProps) {
  const { t } = useTranslation()
  const { addBaby } = useBabies()

  const [onboardName, setOnboardName] = useState('')
  const [onboardGender, setOnboardGender] = useState<BabyGender | ''>('')
  const [onboardBirthDate, setOnboardBirthDate] = useState('')
  const [onboardAvatar, setOnboardAvatar] = useState('')

  async function onOnboarded() {
    const name = onboardName.trim()
    // 名称/性别/出生日期均为必填（出生日期用于月龄换算与生长曲线参考线）
    if (!name || !onboardBirthDate || !onboardGender) return
    await addBaby(name, onboardGender, onboardBirthDate, undefined, undefined, onboardAvatar || undefined)
    setOnboardName('')
    setOnboardGender('')
    setOnboardBirthDate('')
    setOnboardAvatar('')
    onClose?.()
  }

  return (
    <BaseModal show={show} title={t('settings.addBaby')} onClose={onClose}>
      <div className="form-field">
        <label className="form-label">{t('settings.babyName')} *</label>
        <input
          value={onboardName}
          type="text"
          placeholder={t('dashboard.onboardingNamePh')}
          className="form-input"
          onChange={(e) => setOnboardName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">{t('settings.birthDate')} *</label>
        <input
          value={onboardBirthDate}
          type="date"
          placeholder={t('common.selectDate')}
          className="form-input"
          onChange={(e) => setOnboardBirthDate(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">{t('settings.genderLabel')} *</label>
        <div className={s['gender-picker']} role="radiogroup">
          <button
            type="button"
            className={onboardGender === 'boy' ? `${s['gender-option']} ${s.selected}` : s['gender-option']}
            aria-checked={onboardGender === 'boy'}
            role="radio"
            onClick={() => setOnboardGender('boy')}
          >
            <span className={s['gender-emoji']}>👦</span>
            {t('settings.genderBoy')}
          </button>
          <button
            type="button"
            className={onboardGender === 'girl' ? `${s['gender-option']} ${s.selected}` : s['gender-option']}
            aria-checked={onboardGender === 'girl'}
            role="radio"
            onClick={() => setOnboardGender('girl')}
          >
            <span className={s['gender-emoji']}>👧</span>
            {t('settings.genderGirl')}
          </button>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">{t('settings.avatarLabel')}</label>
        <div className="avatar-picker">
          {BABY_AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className={onboardAvatar === a ? `${s['avatar-option']} ${s.selected}` : s['avatar-option']}
              onClick={() => setOnboardAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn btn-primary btn-block btn-lg"
        disabled={!onboardName.trim() || !onboardBirthDate || !onboardGender}
        onClick={onOnboarded}
      >
        {t('common.start')}
      </button>
    </BaseModal>
  )
}
