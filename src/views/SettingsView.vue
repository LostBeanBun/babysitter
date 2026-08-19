<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { countAllRecords, clearAllData } from '@/db'
import { exportAllJson, exportBabyCsvs, importAllJson } from '@/services/export'
import { BABY_AVATARS } from '@/constants'
import { loadReminders, saveReminders, type ReminderConfig, type ReminderType } from '@/utils/reminderScheduler'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { Baby, BabyGender } from '@/types'

const babyStore = useBabyStore()
const { t } = useI18n()

const recordCounts = ref({
  feedings: 0,
  diapers: 0,
  pumpings: 0,
  sleeps: 0,
  growths: 0,
  solidFoods: 0,
  medications: 0,
  vaccinations: 0,
  temperatures: 0,
})
const babyModal = ref<{ mode: 'add' | 'edit'; id?: number } | null>(null)
const babyName = ref('')
const babyGender = ref<BabyGender | ''>('')
const babyBirthDate = ref('')
const babyAvatar = ref('')
const deleteBabyConfirm = ref<Baby | null>(null)
const exportSuccess = ref(false)
const importBusy = ref(false)
const importFileRef = ref<HTMLInputElement | null>(null)
const clearAllConfirm = ref(false)
const clearBusy = ref(false)

// —— 分享给朋友 ——
const shareFeedback = ref<string | null>(null)

/** 当前部署地址（分享链接） */
const shareUrl = computed(() => {
  const { origin, pathname } = window.location
  return `${origin}${pathname}`
})

async function handleShare() {
  shareFeedback.value = null
  const url = shareUrl.value
  const text = `${t('settings.shareText')} ${url}`
  if (navigator.share) {
    try {
      await navigator.share({ title: t('settings.shareTitle'), text, url })
      return
    } catch (e) {
      // 用户主动取消分享（AbortError）时静默退出，不降级复制
      if ((e as Error)?.name === 'AbortError') return
    }
  }
  // 降级：复制推荐语 + 链接到剪贴板
  try {
    await navigator.clipboard.writeText(text)
    shareFeedback.value = t('common.copied')
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      shareFeedback.value = t('common.copied')
    } catch {
      shareFeedback.value = `${t('settings.shareFallback')} ${url}`
    }
  }
  window.setTimeout(() => (shareFeedback.value = null), 3000)
}

const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))

// —— 提醒设置（多类提醒，默认全部关闭，由用户自行开启）——
const reminders = ref<ReminderConfig>(loadReminders())

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'default') {
    try {
      const p = await Notification.requestPermission()
      return p === 'granted'
    } catch {
      return false
    }
  }
  return false
}

async function toggleReminder(type: ReminderType) {
  reminders.value[type].enabled = !reminders.value[type].enabled
  if (reminders.value[type].enabled) await requestNotificationPermission()
  saveReminders(reminders.value)
}

function persistReminders() {
  saveReminders(reminders.value)
}

const reminderRows = computed(() => [
  { type: 'feed' as const, title: t('reminders.feed.title'), sub: t('reminders.feed.sub') },
  { type: 'sleep' as const, title: t('reminders.sleep.title'), sub: t('reminders.sleep.sub') },
  { type: 'medication' as const, title: t('reminders.medication.title'), sub: t('reminders.medication.sub') },
  { type: 'vaccination' as const, title: t('reminders.vaccination.title'), sub: t('reminders.vaccination.sub') },
  { type: 'diaper' as const, title: t('reminders.diaper.title'), sub: t('reminders.diaper.sub') },
])

onMounted(async () => {
  recordCounts.value = await countAllRecords()
})

function openAddBaby() {
  babyName.value = ''
  babyGender.value = ''
  babyBirthDate.value = ''
  babyAvatar.value = ''
  babyModal.value = { mode: 'add' }
}

function openEditBaby(b: Baby) {
  babyName.value = b.name
  babyGender.value = b.gender ?? ''
  babyBirthDate.value = b.birthDate ?? ''
  babyAvatar.value = b.avatar ?? ''
  babyModal.value = { mode: 'edit', id: b.id }
}

async function saveBaby() {
  const name = babyName.value.trim()
  // 宝宝名称/性别/出生日期均为必填（出生日期用于月龄换算与生长曲线参考线）
  if (!name || !babyBirthDate.value) return
  if (babyModal.value?.mode === 'add' && !babyGender.value) return
  if (babyModal.value?.mode === 'edit' && babyModal.value.id != null) {
    await babyStore.updateBaby(babyModal.value.id, {
      name,
      gender: babyGender.value || undefined,
      birthDate: babyBirthDate.value,
      avatar: babyAvatar.value || undefined,
    })
  } else {
    await babyStore.addBaby(
      name,
      babyGender.value || undefined,
      babyBirthDate.value,
      undefined,
      undefined,
      babyAvatar.value || undefined,
    )
  }
  babyModal.value = null
}

async function confirmDeleteBaby() {
  const id = deleteBabyConfirm.value?.id
  if (id == null) return
  await babyStore.deleteBaby(id)
  deleteBabyConfirm.value = null
}

function babyAge(b: Baby): string {
  if (!b.birthDate) return t('settings.noBirthDate')
  const diff = Date.now() - new Date(b.birthDate + 'T00:00:00').getTime()
  if (diff < 0) return t('settings.birthdayUpcoming')
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return t('settings.ageDays', { n: days })
  }
  if (months < 12) return t('settings.ageMonths', { n: months })
  const years = Math.floor(months / 12)
  return t('settings.ageYears', { years, months: months % 12 })
}

async function handleExportJson() {
  await exportAllJson()
  exportSuccess.value = true
  setTimeout(() => (exportSuccess.value = false), 3000)
}

async function handleExportCsv() {
  if (activeBaby.value) await exportBabyCsvs(activeBaby.value)
}

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importBusy.value = true
  try {
    const result = await importAllJson(file)
    alert(
      t('settings.importSuccess', {
        babies: result.babies,
        feedings: result.feedings,
        diapers: result.diapers,
        pumpings: result.pumpings,
        sleeps: result.sleeps,
        growths: result.growths,
        solidFoods: result.solidFoods,
        medications: result.medications,
        vaccinations: result.vaccinations,
        temperatures: result.temperatures,
      }),
    )
    recordCounts.value = await countAllRecords()
  } catch {
    alert(t('settings.importFailed'))
  } finally {
    importBusy.value = false
    if (importFileRef.value) importFileRef.value.value = ''
  }
}

async function confirmClearAll() {
  clearBusy.value = true
  try {
    await clearAllData()
    // 同步重置内存中的当前宝宝，避免残留旧 id 在后续导入时"巧合命中"
    babyStore.activeBabyId = null
    localStorage.removeItem('babysitter.activeBabyId')
    recordCounts.value = {
      feedings: 0,
      diapers: 0,
      pumpings: 0,
      sleeps: 0,
      growths: 0,
      solidFoods: 0,
      medications: 0,
      vaccinations: 0,
      temperatures: 0,
    }
    clearAllConfirm.value = false
  } finally {
    clearBusy.value = false
  }
}
</script>

<template>
  <div class="page settings-page">
    <PageHeader />

    <!-- 宝宝管理 -->
    <p class="section-title">{{ t('settings.babyManage') }}</p>
    <div class="card">
      <div class="baby-list">
        <div
          v-for="b in babyStore.babies"
          :key="b.id"
          class="baby-item"
          :class="{ active: b.id === babyStore.activeBabyId }"
          @click="b.id != null && babyStore.selectBaby(b.id)"
        >
          <div class="baby-avatar" :style="{ background: b.avatarColor }">{{ b.avatar ?? b.name[0] }}</div>
          <div class="baby-info">
            <p class="baby-name">{{ b.name }}{{ b.id === babyStore.activeBabyId ? t('common.current') : '' }}</p>
            <p class="baby-meta">
              {{ b.gender ? t(b.gender === 'boy' ? 'settings.genderBoy' : 'settings.genderGirl') : t('settings.genderUnknown') }}
              · {{ babyAge(b) }}
            </p>
          </div>
          <div class="baby-actions">
            <button class="icon-btn" :title="t('common.edit')" @click.stop="openEditBaby(b)">✏️</button>
            <button class="icon-btn" :title="t('common.delete')" @click.stop="deleteBabyConfirm = b">🗑️</button>
          </div>
        </div>
      </div>
      <button class="btn btn-outline btn-block" @click="openAddBaby">+ {{ t('settings.addBaby') }}</button>
    </div>

    <!-- 数据管理 -->
    <p class="section-title">{{ t('settings.dataManage') }}</p>
    <div class="card">
      <p class="data-tip">{{ t('settings.dataTip') }}</p>
      <div class="data-counts">
        <span>{{ t('log.filters.feeding') }} {{ t('common.records', { n: recordCounts.feedings }) }}</span>
        <span>{{ t('log.filters.diaper') }} {{ t('common.records', { n: recordCounts.diapers }) }}</span>
        <span>{{ t('log.filters.pumping') }} {{ t('common.records', { n: recordCounts.pumpings }) }}</span>
        <span>{{ t('log.filters.sleep') }} {{ t('common.records', { n: recordCounts.sleeps }) }}</span>
        <span>{{ t('log.filters.growth') }} {{ t('common.records', { n: recordCounts.growths }) }}</span>
        <span>{{ t('log.filters.solidFood') }} {{ t('common.records', { n: recordCounts.solidFoods }) }}</span>
        <span>{{ t('log.filters.medication') }} {{ t('common.records', { n: recordCounts.medications }) }}</span>
        <span>{{ t('log.filters.vaccination') }} {{ t('common.records', { n: recordCounts.vaccinations }) }}</span>
        <span>{{ t('log.filters.temperature') }} {{ t('common.records', { n: recordCounts.temperatures }) }}</span>
      </div>
      <button class="btn btn-primary btn-block" :disabled="activeBaby === undefined" @click="handleExportJson">
        <span class="btn-label">{{
          activeBaby ? t('settings.exportBabyJson', { name: activeBaby.name }) : t('common.noBaby')
        }}</span>
      </button>
      <button class="btn btn-outline btn-block" @click="handleExportCsv">{{ t('settings.exportAllCsv') }}</button>
      <button class="btn btn-outline btn-block" :disabled="importBusy" @click="importFileRef?.click()">
        {{ importBusy ? t('common.importing') : t('common.importJson') }}
      </button>
      <input ref="importFileRef" type="file" accept="application/json,.json" hidden @change="handleImportFile" />
      <p v-if="exportSuccess" class="export-ok">{{ t('settings.exportOk') }}</p>
      <button class="btn btn-danger-soft btn-block" @click="clearAllConfirm = true">
        {{ t('settings.clearAll') }}
      </button>
    </div>

    <!-- 提醒设置 -->
    <p class="section-title">{{ t('settings.reminderSectionTitle') }}</p>
    <div class="card">
      <p class="data-tip">{{ t('settings.reminderTip') }}</p>
      <div v-for="r in reminderRows" :key="r.type" class="reminder-block">
        <div class="reminder-row">
          <div class="reminder-info">
            <p class="reminder-title">{{ r.title }}</p>
            <p class="reminder-sub">{{ r.sub }}</p>
          </div>
          <button
            class="switch"
            :class="{ on: reminders[r.type].enabled }"
            role="switch"
            :aria-checked="reminders[r.type].enabled"
            @click="toggleReminder(r.type)"
          >
            <span class="switch-knob"></span>
          </button>
        </div>
        <div v-if="reminders[r.type].enabled" class="reminder-param">
          <template v-if="r.type === 'feed'">
            <label class="reminder-param-label">{{ t('reminders.intervalLabel') }}</label>
            <input
              v-model.number="reminders.feed.intervalHours"
              type="number"
              min="0"
              step="0.5"
              class="form-input reminder-param-input"
              @change="persistReminders"
            />
            <p class="reminder-param-hint">{{ t('reminders.feed.hint') }}</p>
          </template>
          <template v-else-if="r.type === 'sleep'">
            <label class="reminder-param-label">{{ t('reminders.sleepTimeLabel') }}</label>
            <input
              v-model="reminders.sleep.time"
              type="time"
              class="form-input reminder-param-input"
              @change="persistReminders"
            />
          </template>
          <template v-else-if="r.type === 'medication'">
            <label class="reminder-param-label">{{ t('reminders.intervalLabel') }}</label>
            <input
              v-model.number="reminders.medication.intervalHours"
              type="number"
              min="1"
              step="1"
              class="form-input reminder-param-input"
              @change="persistReminders"
            />
            <p class="reminder-param-hint">{{ t('reminders.medication.hint') }}</p>
          </template>
          <template v-else-if="r.type === 'diaper'">
            <label class="reminder-param-label">{{ t('reminders.intervalLabel') }}</label>
            <input
              v-model.number="reminders.diaper.intervalHours"
              type="number"
              min="1"
              step="1"
              class="form-input reminder-param-input"
              @change="persistReminders"
            />
            <p class="reminder-param-hint">{{ t('reminders.diaper.hint') }}</p>
          </template>
        </div>
      </div>
    </div>

    <!-- 分享给朋友 -->
    <p class="section-title">{{ t('settings.shareSection') }}</p>
    <div class="card">
      <p class="data-tip">{{ t('settings.shareTip') }}</p>
      <button class="btn btn-primary btn-block" @click="handleShare">{{ t('settings.shareBtn') }}</button>
      <p v-if="shareFeedback" class="export-ok">{{ shareFeedback }}</p>
    </div>

    <!-- 关于 -->
    <p class="section-title">{{ t('settings.about') }}</p>
    <div class="card">
      <p class="about-text">{{ t('settings.aboutText1') }}</p>
      <p class="about-text">{{ t('settings.aboutText2') }}</p>
      <p class="about-text">{{ t('settings.aboutText3') }}</p>
      <p class="about-text muted">{{ t('settings.aboutMuted') }}</p>
    </div>

    <!-- 宝宝编辑弹窗 -->
    <BaseModal
      :show="babyModal !== null"
      :title="babyModal?.mode === 'edit' ? t('settings.editBaby') : t('settings.addBaby')"
      @close="babyModal = null"
    >
      <div class="form-field">
        <label class="form-label">{{ t('settings.babyName') }} *</label>
        <input v-model="babyName" type="text" :placeholder="t('settings.babyNamePh')" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.genderLabel') }} {{ babyModal?.mode === 'add' ? '*' : '' }}</label>
        <div class="gender-picker" role="radiogroup">
          <button
            type="button"
            class="gender-option"
            :class="{ selected: babyGender === 'boy' }"
            :aria-checked="babyGender === 'boy'"
            role="radio"
            @click="babyGender = 'boy'"
          >
            <span class="gender-emoji">👦</span>{{ t('settings.genderBoy') }}
          </button>
          <button
            type="button"
            class="gender-option"
            :class="{ selected: babyGender === 'girl' }"
            :aria-checked="babyGender === 'girl'"
            role="radio"
            @click="babyGender = 'girl'"
          >
            <span class="gender-emoji">👧</span>{{ t('settings.genderGirl') }}
          </button>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.birthDate') }} *</label>
        <input v-model="babyBirthDate" type="date" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('settings.avatarLabel') }}</label>
        <div class="avatar-picker">
          <button
            v-for="a in BABY_AVATARS"
            :key="a"
            type="button"
            class="avatar-option"
            :class="{ selected: babyAvatar === a }"
            @click="babyAvatar = a"
          >
            {{ a }}
          </button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" @click="babyModal = null">{{ t('common.cancel') }}</button>
        <button
          class="btn btn-primary"
          :disabled="!babyName.trim() || !babyBirthDate || (babyModal?.mode === 'add' && !babyGender)"
          @click="saveBaby"
        >
          {{ t('settings.saveBaby') }}
        </button>
      </div>
    </BaseModal>

    <!-- 删除宝宝确认 -->
    <BaseModal
      :show="deleteBabyConfirm !== null"
      :title="t('settings.deleteBabyTitle')"
      @close="deleteBabyConfirm = null"
    >
      <p class="confirm-text">{{ t('settings.deleteBabyText', { name: deleteBabyConfirm?.name ?? '' }) }}</p>
      <div class="form-actions">
        <button class="btn btn-outline" @click="deleteBabyConfirm = null">{{ t('common.cancel') }}</button>
        <button class="btn btn-danger-soft" @click="confirmDeleteBaby">{{ t('log.confirmDelete') }}</button>
      </div>
    </BaseModal>

    <!-- 清空数据确认 -->
    <BaseModal :show="clearAllConfirm" :title="t('settings.clearConfirmTitle')" @close="clearAllConfirm = false">
      <p class="confirm-text">{{ t('settings.clearConfirmText') }}</p>
      <div class="form-actions">
        <button class="btn btn-outline" @click="clearAllConfirm = false">{{ t('common.cancel') }}</button>
        <button class="btn btn-danger-soft" :disabled="clearBusy" @click="confirmClearAll">
          {{ t('settings.confirmClear') }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.baby-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.baby-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all 0.15s ease;
}

.baby-item:active {
  transform: scale(0.99);
}

@media (max-width: 400px) {
  .baby-item {
    gap: 10px;
    padding: 10px;
  }

  .baby-avatar {
    width: 38px;
    height: 38px;
    font-size: 16px;
  }

  .baby-actions {
    gap: 4px;
  }
}

.baby-item.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  box-shadow: 0 0 0 3px rgba(238, 122, 85, 0.12);
}

.baby-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.baby-info {
  flex: 1;
  min-width: 0;
}

.baby-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.baby-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.baby-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: var(--surface-2);
  font-size: 17px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s ease,
    transform 0.12s ease;
}

.icon-btn:active {
  background: var(--surface-3);
  transform: scale(0.92);
}

.data-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  line-height: 1.6;
}

.reminder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reminder-info {
  flex: 1;
  min-width: 0;
}

.reminder-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.reminder-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
  line-height: 1.5;
}

.reminder-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 12px;
  line-height: 1.7;
}

.reminder-block {
  padding: 4px 0 12px;
}

.reminder-block + .reminder-block {
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}

.reminder-param {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border-radius: 10px;
}

.reminder-param-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.reminder-param-input {
  width: 88px;
  min-height: 34px;
  padding: 4px 8px;
  border-radius: 8px;
}

.reminder-param-hint {
  width: 100%;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
}

.switch {
  position: relative;
  width: 48px;
  height: 28px;
  min-height: 0; /* 覆盖全局 button 的 min-height:44px，保持开关比例 */
  border-radius: 999px;
  border: none;
  background: var(--border);
  transition: background 0.2s ease;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
}

.switch.on {
  background: var(--primary);
}

.switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.switch.on .switch-knob {
  transform: translateX(20px);
}

.data-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.data-counts span {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: 4px 11px;
  border-radius: 999px;
}

.btn-block {
  margin-top: 10px;
}

.btn-block .btn-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.export-ok {
  font-size: 12px;
  color: #7fae6c;
  text-align: center;
  margin-top: 8px;
}

.about-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.about-text.muted {
  color: var(--text-muted);
  font-size: 12px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.7;
  margin-bottom: 18px;
}

.avatar-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.gender-picker {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.gender-option {
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;
}

.gender-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
  transform: scale(1.02);
}

.gender-emoji {
  font-size: 16px;
}

/* PC/平板：设置页为表单型页面，限宽居中避免内容被拉得过宽 */
@media (min-width: 900px) {
  .settings-page {
    max-width: 720px;
    margin: 0 auto;
  }

  .avatar-picker {
    max-width: 480px;
    margin: 0 auto;
  }
}

.avatar-option {
  min-height: 40px;
  padding: 4px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.avatar-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  transform: scale(1.06);
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}
</style>
