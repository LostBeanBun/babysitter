<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBabyStore } from '@/stores/baby'
import { countAllRecords, clearAllData } from '@/db'
import { exportAllJson, exportBabyCsvs, importAllJson } from '@/services/export'
import { BABY_AVATARS } from '@/constants'
import { setTheme, themeMode, type ThemeMode } from '@/composables/useTheme'
import { FEED_REMINDER_KEY } from '@/utils/feedingGuide'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { Baby } from '@/types'

const babyStore = useBabyStore()

const recordCounts = ref({ feedings: 0, diapers: 0, pumpings: 0, sleeps: 0, growths: 0 })
const babyModal = ref<{ mode: 'add' | 'edit'; id?: number } | null>(null)
const babyName = ref('')
const babyBirthDate = ref('')
const babyAvatar = ref('')
const deleteBabyConfirm = ref<Baby | null>(null)
const exportSuccess = ref(false)
const importBusy = ref(false)
const importFileRef = ref<HTMLInputElement | null>(null)
const clearAllConfirm = ref(false)
const clearBusy = ref(false)

const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))

// 喂奶提醒开关
const feedReminder = ref(localStorage.getItem(FEED_REMINDER_KEY) === 'on')

async function toggleFeedReminder() {
  feedReminder.value = !feedReminder.value
  localStorage.setItem(FEED_REMINDER_KEY, feedReminder.value ? 'on' : 'off')
  if (feedReminder.value && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      /* 用户拒绝或环境不支持时静默 */
    }
  }
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'system', label: '跟随系统', icon: '🖥️' },
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
]

onMounted(async () => {
  recordCounts.value = await countAllRecords()
})

function openAddBaby() {
  babyName.value = ''
  babyBirthDate.value = ''
  babyAvatar.value = ''
  babyModal.value = { mode: 'add' }
}

function openEditBaby(b: Baby) {
  babyName.value = b.name
  babyBirthDate.value = b.birthDate ?? ''
  babyAvatar.value = b.avatar ?? ''
  babyModal.value = { mode: 'edit', id: b.id }
}

async function saveBaby() {
  const name = babyName.value.trim()
  if (!name) return
  if (babyModal.value?.mode === 'edit' && babyModal.value.id != null) {
    await babyStore.updateBaby(babyModal.value.id, {
      name,
      birthDate: babyBirthDate.value || undefined,
      avatar: babyAvatar.value || undefined,
    })
  } else {
    await babyStore.addBaby(
      name,
      undefined,
      babyBirthDate.value || undefined,
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
  if (!b.birthDate) return '未设置生日'
  const diff = Date.now() - new Date(b.birthDate + 'T00:00:00').getTime()
  if (diff < 0) return '生日未到'
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return `${days} 天`
  }
  if (months < 12) return `${months} 个月`
  const years = Math.floor(months / 12)
  return `${years} 岁 ${months % 12} 个月`
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
      `导入成功！宝宝 ${result.babies} 个，喂养 ${result.feedings} 条，纸尿裤 ${result.diapers} 条，吸奶 ${result.pumpings} 条，睡眠 ${result.sleeps} 条，成长 ${result.growths} 条`,
    )
    recordCounts.value = await countAllRecords()
  } catch {
    alert('导入失败：文件格式不正确')
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
    recordCounts.value = { feedings: 0, diapers: 0, pumpings: 0, sleeps: 0, growths: 0 }
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
    <p class="section-title">宝宝</p>
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
            <p class="baby-name">{{ b.name }}{{ b.id === babyStore.activeBabyId ? '（当前）' : '' }}</p>
            <p class="baby-meta">{{ babyAge(b) }}</p>
          </div>
          <div class="baby-actions">
            <button class="icon-btn" title="编辑" @click.stop="openEditBaby(b)">✏️</button>
            <button class="icon-btn" title="删除" @click.stop="deleteBabyConfirm = b">🗑️</button>
          </div>
        </div>
      </div>
      <button class="btn btn-outline btn-block" @click="openAddBaby">+ 添加宝宝</button>
    </div>

    <!-- 数据管理 -->
    <p class="section-title">数据管理</p>
    <div class="card">
      <p class="data-tip">数据保存在本地浏览器（IndexedDB），不会上传到任何服务器。</p>
      <div class="data-counts">
        <span>喂养 {{ recordCounts.feedings }} 条</span>
        <span>纸尿裤 {{ recordCounts.diapers }} 条</span>
        <span>吸奶 {{ recordCounts.pumpings }} 条</span>
        <span>睡眠 {{ recordCounts.sleeps }} 条</span>
        <span>成长 {{ recordCounts.growths }} 条</span>
      </div>
      <button class="btn btn-primary btn-block" :disabled="activeBaby === undefined" @click="handleExportJson">
        <span class="btn-label">{{ activeBaby ? `导出 ${activeBaby.name} 的数据备份 (JSON)` : '请先选择宝宝' }}</span>
      </button>
      <button class="btn btn-outline btn-block" @click="handleExportCsv">导出全部数据 (CSV 表格)</button>
      <button class="btn btn-outline btn-block" :disabled="importBusy" @click="importFileRef?.click()">
        {{ importBusy ? '导入中…' : '导入 JSON 备份' }}
      </button>
      <input ref="importFileRef" type="file" accept="application/json,.json" hidden @change="handleImportFile" />
      <p v-if="exportSuccess" class="export-ok">✓ 已导出备份文件</p>
      <button class="btn btn-danger-soft btn-block" @click="clearAllConfirm = true">清空全部数据</button>
    </div>

    <!-- 外观 -->
    <p class="section-title">外观</p>
    <div class="card">
      <div class="theme-options">
        <button
          v-for="t in THEME_OPTIONS"
          :key="t.value"
          class="theme-option"
          :class="{ active: themeMode === t.value }"
          @click="setTheme(t.value)"
        >
          <span class="theme-icon">{{ t.icon }}</span>
          <span class="theme-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- 喂奶提醒 -->
    <p class="section-title">喂奶提醒</p>
    <div class="card">
      <div class="reminder-row">
        <div class="reminder-info">
          <p class="reminder-title">🍼 喂奶间隔提醒</p>
          <p class="reminder-sub">超过建议间隔时，在今日页提示并发送浏览器通知</p>
        </div>
        <button
          class="switch"
          :class="{ on: feedReminder }"
          role="switch"
          :aria-checked="feedReminder"
          @click="toggleFeedReminder"
        >
          <span class="switch-knob"></span>
        </button>
      </div>
      <p class="reminder-hint">
        按宝宝月龄自动给出建议间隔：0-1月 约2.5h · 1-3月 约3h · 3-6月 约3.5h · 6-9月 约4h · 9-12月 约4.5h · 12月以上
        约5h
      </p>
    </div>

    <!-- 关于 -->
    <p class="section-title">关于</p>
    <div class="card">
      <p class="about-text">温馨简约的宝宝喂养记录工具</p>
      <p class="about-text">支持喂养（亲喂/瓶喂/配方奶）、纸尿裤、吸奶、睡眠记录</p>
      <p class="about-text">支持趋势统计与周期对比、数据导出导入</p>
      <p class="about-text muted">v1.0.0 · 纯前端 · 数据本地存储</p>
    </div>

    <!-- 宝宝编辑弹窗 -->
    <BaseModal
      :show="babyModal !== null"
      :title="babyModal?.mode === 'edit' ? '编辑宝宝' : '添加宝宝'"
      @close="babyModal = null"
    >
      <div class="form-field">
        <label class="form-label">宝宝名字 *</label>
        <input v-model="babyName" type="text" placeholder="例如：小糯米" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">出生日期（可选）</label>
        <input v-model="babyBirthDate" type="date" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">头像</label>
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
        <button class="btn btn-outline" @click="babyModal = null">取消</button>
        <button class="btn btn-primary" :disabled="!babyName.trim()" @click="saveBaby">保存</button>
      </div>
    </BaseModal>

    <!-- 删除宝宝确认 -->
    <BaseModal :show="deleteBabyConfirm !== null" title="删除宝宝" @close="deleteBabyConfirm = null">
      <p class="confirm-text">
        确定删除「{{ deleteBabyConfirm?.name }}」吗？<br />该宝宝的全部记录也会一并删除，此操作不可撤销。
      </p>
      <div class="form-actions">
        <button class="btn btn-outline" @click="deleteBabyConfirm = null">取消</button>
        <button class="btn btn-danger-soft" @click="confirmDeleteBaby">确认删除</button>
      </div>
    </BaseModal>

    <!-- 清空数据确认 -->
    <BaseModal :show="clearAllConfirm" title="清空全部数据" @close="clearAllConfirm = false">
      <p class="confirm-text">将删除所有宝宝及其全部记录，此操作不可撤销。确定继续吗？</p>
      <div class="form-actions">
        <button class="btn btn-outline" @click="clearAllConfirm = false">取消</button>
        <button class="btn btn-danger-soft" :disabled="clearBusy" @click="confirmClearAll">确认清空</button>
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
  padding: 10px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.12s ease;
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
  border-radius: 10px;
  border: none;
  background: transparent;
  font-size: 17px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease;
}

.icon-btn:active {
  background: var(--surface-2);
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
  color: var(--text-secondary);
  background: var(--surface-2);
  padding: 4px 10px;
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

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  transition: all 0.12s ease;
}

.theme-option.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.theme-icon {
  font-size: 22px;
}

.theme-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.theme-option.active .theme-label {
  color: var(--primary-dark);
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}
</style>
