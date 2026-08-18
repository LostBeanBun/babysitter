<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useDiaperStore } from '@/stores/diaper'
import { usePumpingStore } from '@/stores/pumping'
import { useSleepStore } from '@/stores/sleep'
import { useGrowthStore } from '@/stores/growth'
import PageHeader from '@/components/common/PageHeader.vue'
import StatCard from '@/components/common/StatCard.vue'
import Timeline, { type TimelineEntry } from '@/components/timeline/Timeline.vue'
import Modal from '@/components/common/Modal.vue'
import FeedingForm from '@/components/forms/FeedingForm.vue'
import DiaperForm from '@/components/forms/DiaperForm.vue'
import PumpingForm from '@/components/forms/PumpingForm.vue'
import SleepForm from '@/components/forms/SleepForm.vue'
import GrowthForm from '@/components/forms/GrowthForm.vue'
import { startOfDay, formatDuration, formatAmount, toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { MS_PER_DAY, BABY_AVATARS, FEED_TYPE_LABELS } from '@/constants'
import { recommendedIntervalMs, recommendedIntervalLabel, avgFeedingIntervalMs, sinceLastFeedingMs, isFeedReminderOn } from '@/utils/feedingGuide'
import type { Feeding, DiaperChange, Pumping, Sleep, GrowthRecord, FeedType, DiaperType, DiaperColor, DiaperAmount, PumpSide, SleepType } from '@/types'

/** 各表单编辑 props 结构（与表单组件 props.editing 一致） */
type FeedingFormProps = { id: number; type: FeedType; startTime: number; endTime?: number; duration?: number; amount?: number; notes?: string }
type DiaperFormProps = { id: number; type: DiaperType; time: number; color?: DiaperColor; amount?: DiaperAmount; notes?: string }
type PumpingFormProps = { id: number; side: PumpSide; startTime: number; endTime?: number; duration?: number; amount?: number; notes?: string }
type SleepFormProps = { id: number; type: SleepType; startTime: number; endTime: number; notes?: string }
type GrowthFormProps = { id: number; date: number; weight?: number; height?: number; notes?: string }

const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const diaperStore = useDiaperStore()
const pumpingStore = usePumpingStore()
const sleepStore = useSleepStore()
const growthStore = useGrowthStore()

const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 60_000)

// 无宝宝时显示引导
const hasBaby = computed(() => babyStore.babies.length > 0)
const onboardingOpen = ref(false)
const onboardName = ref('')
const onboardBirthDate = ref('')
const onboardAvatar = ref('')

function openOnboarding() {
  onboardingOpen.value = true
}

async function onOnboarded() {
  const name = onboardName.value.trim()
  if (!name) return
  await babyStore.addBaby(name, undefined, onboardBirthDate.value || undefined, undefined, undefined, onboardAvatar.value || undefined)
  onboardName.value = ''
  onboardBirthDate.value = ''
  onboardAvatar.value = ''
  onboardingOpen.value = false
}

// 今日范围
const todayStart = computed(() => startOfDay(now.value))
const todayEnd = computed(() => todayStart.value + MS_PER_DAY - 1)

// 今日数据（按时间过滤）
const todayFeedings = computed(() => feedingStore.feedings.filter((f) => f.startTime >= todayStart.value && f.startTime <= todayEnd.value))
const todayDiapers = computed(() => diaperStore.diapers.filter((d) => d.time >= todayStart.value && d.time <= todayEnd.value))
const todayPumpings = computed(() => pumpingStore.pumpings.filter((p) => p.startTime >= todayStart.value && p.startTime <= todayEnd.value))
const todaySleeps = computed(() => sleepStore.sleeps.filter((s) => s.endTime >= todayStart.value && s.startTime <= todayEnd.value))
const todayGrowths = computed(() => growthStore.growths.filter((g) => g.date >= todayStart.value && g.date <= todayEnd.value))

// 今日汇总
const totalMilk = computed(() => todayFeedings.value.reduce((sum, f) => sum + (f.amount ?? 0), 0))
const feedCount = computed(() => todayFeedings.value.length)
const lastFeeding = computed(() => {
  const sorted = [...feedingStore.feedings].sort((a, b) => b.startTime - a.startTime)
  return sorted[0]
})
const lastFeedingLabel = computed(() => {
  if (!lastFeeding.value) return '暂无'
  const mins = Math.round((now.value - lastFeeding.value.startTime) / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} 小时前` : `${h} 小时${m} 分前`
})

// —— 喂奶间隔分析与提醒 ——
const activeBaby = computed(() => babyStore.babies.find((b) => b.id === babyStore.activeBabyId))
const feedReminderOn = ref(isFeedReminderOn())
const recommendedMs = computed(() => recommendedIntervalMs(activeBaby.value))
const avgGapMs = computed(() => avgFeedingIntervalMs(feedingStore.feedings.map((f) => f.startTime)))
const sinceMs = computed(() => (lastFeeding.value ? sinceLastFeedingMs(lastFeeding.value.startTime, now.value) : null))
/** 超过建议间隔且开关开启时提示 */
const overdue = computed(() => feedReminderOn.value && sinceMs.value != null && sinceMs.value > recommendedMs.value)
let lastNotifiedAt = 0
watch(now, () => {
  if (!overdue.value || !sinceMs.value) return
  if (Date.now() - lastNotifiedAt < 5 * 60_000) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification('🍼 该喂奶啦', {
    body: `距上次喂养已 ${formatDuration(sinceMs.value)}，超过建议间隔（${recommendedIntervalLabel(activeBaby.value)}）`,
    tag: 'feed-reminder',
  })
  lastNotifiedAt = Date.now()
})
const sleepTotal = computed(() => todaySleeps.value.reduce((sum, s) => {
  const s0 = Math.max(s.startTime, todayStart.value)
  const e0 = Math.min(s.endTime, todayEnd.value)
  return sum + Math.max(0, e0 - s0)
}, 0))

// —— 奶睡一键（组合记录喂养 + 睡眠）——
const sleepFeedOpen = ref(false)
const sfType = ref<FeedType>('bottle_breastmilk')
const sfAmount = ref('')
const sfStart = ref(toDateTimeLocal(Date.now()))
const sfSleepType = ref<SleepType>('nap')
const sfSleepEnd = ref(toDateTimeLocal(Date.now() + 2 * 3600_000))
const sfNotes = ref('')

const FEED_TYPE_CHOICES = Object.entries(FEED_TYPE_LABELS).map(([value, label]) => ({ value: value as FeedType, label }))

async function saveSleepFeed() {
  const start = fromDateTimeLocal(sfStart.value)
  const end = fromDateTimeLocal(sfSleepEnd.value)
  if (start == null || isNaN(start)) {
    alert('请选择开始时间')
    return
  }
  if (end == null || isNaN(end) || end <= start) {
    alert('睡眠结束时间需晚于开始时间')
    return
  }
  let amount: number | undefined
  if (sfType.value === 'bottle_formula' || sfType.value === 'bottle_breastmilk') {
    amount = sfAmount.value ? Number(sfAmount.value) : undefined
    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      alert('请输入有效的奶量（ml）')
      return
    }
  }
  await feedingStore.add({ type: sfType.value, startTime: start, amount })
  await sleepStore.add({ type: sfSleepType.value, startTime: start, endTime: end, notes: sfNotes.value || undefined })
  sleepFeedOpen.value = false
  sfType.value = 'bottle_breastmilk'
  sfAmount.value = ''
  sfStart.value = toDateTimeLocal(Date.now())
  sfSleepType.value = 'nap'
  sfSleepEnd.value = toDateTimeLocal(Date.now() + 2 * 3600_000)
  sfNotes.value = ''
}

// —— 每日小结 ——
const summaryOpen = ref(false)
const dailySummary = ref('')
const summaryCopied = ref(false)

function generateSummary() {
  const d = new Date(now.value)
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`
  const pumpTotal = todayPumpings.value.reduce((s, p) => s + (p.amount ?? 0), 0)
  const lines = [
    `📋 ${activeBaby.value?.name ?? '宝宝'}的一天 · ${dateLabel}`,
    `🍼 喂养 ${feedCount.value} 次${totalMilk.value > 0 ? `（奶量 ${formatAmount(totalMilk.value)}）` : ''}`,
    `😴 睡眠 ${formatDuration(sleepTotal.value)}`,
    `🧷 纸尿裤 ${todayDiapers.value.length} 次`,
    `🎀 吸奶 ${todayPumpings.value.length} 次${pumpTotal > 0 ? `（${formatAmount(pumpTotal)}）` : ''}`,
    `📏 成长记录 ${todayGrowths.value.length} 条`,
  ]
  dailySummary.value = lines.join('\n')
  summaryCopied.value = false
  summaryOpen.value = true
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(dailySummary.value)
    summaryCopied.value = true
    setTimeout(() => (summaryCopied.value = false), 2000)
  } catch {
    alert('复制失败，请长按文本手动复制')
  }
}

// 弹窗状态
const modalState = ref<{ kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth'; editing?: TimelineEntry } | null>(null)
const confirmDelete = ref<TimelineEntry | null>(null)

function openAdd(kind: 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth') {
  modalState.value = { kind }
}

function onEdit(entry: TimelineEntry) {
  modalState.value = { kind: entry.kind, editing: entry }
}

function onDelete(entry: TimelineEntry) {
  confirmDelete.value = entry
}

async function confirmDeleteAction() {
  const e = confirmDelete.value
  if (!e) return
  if (e.kind === 'feeding') await feedingStore.remove(e.id)
  else if (e.kind === 'diaper') await diaperStore.remove(e.id)
  else if (e.kind === 'pumping') await pumpingStore.remove(e.id)
  else if (e.kind === 'sleep') await sleepStore.remove(e.id)
  else await growthStore.remove(e.id)
  confirmDelete.value = null
}

function onSaved() {
  modalState.value = null
}

// 编辑模式回填（按 kind 类型收窄）
const editPayload = computed(() => {
  const e = modalState.value?.editing
  if (!e) return undefined
  if (e.kind === 'feeding') {
    const f = e.raw as Feeding
    return { id: e.id, type: f.type, startTime: f.startTime, endTime: f.endTime, duration: f.duration, amount: f.amount, notes: f.notes }
  }
  if (e.kind === 'diaper') {
    const d = e.raw as DiaperChange
    return { id: e.id, type: d.type, time: d.time, color: d.color, amount: d.amount, notes: d.notes }
  }
  if (e.kind === 'pumping') {
    const p = e.raw as Pumping
    return { id: e.id, side: p.side, startTime: p.startTime, endTime: p.endTime, duration: p.duration, amount: p.amount, notes: p.notes }
  }
  if (e.kind === 'sleep') {
    const s = e.raw as Sleep
    return { id: e.id, type: s.type, startTime: s.startTime, endTime: s.endTime, notes: s.notes }
  }
  const g = e.raw as GrowthRecord
  return { id: e.id, date: g.date, weight: g.weight, height: g.height, notes: g.notes }
})
</script>

<template>
  <div class="page dashboard">
    <PageHeader>
      <template #right>
        <span class="date-badge">{{ new Date(now).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }) }}</span>
      </template>
    </PageHeader>

    <!-- 首次使用引导 -->
    <div v-if="!hasBaby" class="welcome">
      <div class="welcome-icon">👶</div>
      <h2 class="welcome-title">欢迎使用宝宝日记</h2>
      <p class="welcome-text">记录宝宝的每一次喂养、睡眠与成长瞬间。<br />数据完全保存在本地，隐私安全。</p>
      <button class="btn btn-primary btn-lg welcome-btn" @click="openOnboarding">开始使用</button>
      <button class="btn btn-outline welcome-btn" @click="$router.push('/settings')">已有数据？前往设置导入</button>
    </div>

    <template v-else>
    <!-- 喂奶提醒条 -->
    <div v-if="overdue" class="feed-reminder-banner">
      <span class="fr-icon">🍼</span>
      <div class="fr-text">
        <p class="fr-title">距上次喂养已 {{ formatDuration(sinceMs ?? 0) }}</p>
        <p class="fr-sub">已超过建议间隔（{{ recommendedIntervalLabel(activeBaby) }}），记得喂奶哦</p>
      </div>
    </div>

    <!-- 今日汇总 -->
    <div class="stats-grid">
      <StatCard label="最近喂养" :value="lastFeedingLabel" :sub="lastFeeding ? `建议 ${recommendedIntervalLabel(activeBaby)}` : undefined" icon="🍼" color="#E8906C" />
      <StatCard label="今日奶量" :value="formatAmount(totalMilk) || '0 ml'" icon="🥛" color="#C4A8E0" />
      <StatCard label="今日喂养" :value="`${feedCount} 次`" icon="🍽️" color="#F2A28C" />
      <StatCard label="今日睡眠" :value="formatDuration(sleepTotal)" icon="😴" color="#8FAED8" />
      <StatCard label="今日尿布" :value="`${todayDiapers.length} 次`" icon="🧷" color="#9A8FC8" />
      <StatCard label="今日吸奶" :value="`${todayPumpings.length} 次`" :sub="formatAmount(todayPumpings.reduce((s, p) => s + (p.amount ?? 0), 0)) || undefined" icon="🎀" color="#D8A8C8" />
    </div>

    <!-- 快捷记录 -->
    <p class="section-title">快速记录</p>
    <div class="quick-actions">
      <button class="quick-btn feed" @click="openAdd('feeding')">
        <span class="quick-icon">🍼</span>
        <span class="quick-label">喂养</span>
      </button>
      <button class="quick-btn diaper" @click="openAdd('diaper')">
        <span class="quick-icon">🧷</span>
        <span class="quick-label">纸尿裤</span>
      </button>
      <button class="quick-btn pump" @click="openAdd('pumping')">
        <span class="quick-icon">🎀</span>
        <span class="quick-label">吸奶</span>
      </button>
      <button class="quick-btn sleep" @click="openAdd('sleep')">
        <span class="quick-icon">😴</span>
        <span class="quick-label">睡眠</span>
      </button>
      <button class="quick-btn growth" @click="openAdd('growth')">
        <span class="quick-icon">📏</span>
        <span class="quick-label">成长</span>
      </button>
    </div>

    <!-- 喂奶间隔分析 -->
    <div v-if="avgGapMs != null" class="interval-card card">
      <div class="interval-item">
        <p class="interval-label">实际平均间隔</p>
        <p class="interval-value">{{ formatDuration(avgGapMs) }}</p>
      </div>
      <div class="interval-item">
        <p class="interval-label">建议间隔{{ activeBaby?.birthDate ? '（按月龄）' : '' }}</p>
        <p class="interval-value">{{ recommendedIntervalLabel(activeBaby) }}</p>
      </div>
    </div>

    <!-- 奶睡一键 -->
    <button class="btn btn-outline sleep-feed-btn" @click="sleepFeedOpen = true">
      <span class="sf-btn-icon">🍼😴</span>
      <span>奶睡一键记录（喂奶 + 睡眠）</span>
    </button>

    <!-- 今日记录 -->
    <div class="section-row">
      <p class="section-title">今日记录</p>
      <button class="btn btn-sm btn-outline" @click="generateSummary">📋 今日小结</button>
    </div>
    <div class="card">
      <Timeline
        v-if="todayFeedings.length + todayDiapers.length + todayPumpings.length + todaySleeps.length + todayGrowths.length > 0"
        :feedings="todayFeedings"
        :diapers="todayDiapers"
        :pumpings="todayPumpings"
        :sleeps="todaySleeps"
        :growths="todayGrowths"
        @edit="onEdit"
        @delete="onDelete"
      />
      <div v-else class="empty-inline">
        <p>今天还没有记录，点击上方按钮开始吧</p>
      </div>
    </div>

    <!-- 记录弹窗 -->
    <Modal :show="modalState !== null" :title="modalState?.editing ? '编辑记录' : '添加记录'" @close="modalState = null">
      <FeedingForm
        v-if="modalState?.kind === 'feeding'"
        :editing="modalState?.editing ? (editPayload as FeedingFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <DiaperForm
        v-else-if="modalState?.kind === 'diaper'"
        :editing="modalState?.editing ? (editPayload as DiaperFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <PumpingForm
        v-else-if="modalState?.kind === 'pumping'"
        :editing="modalState?.editing ? (editPayload as PumpingFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <SleepForm
        v-else-if="modalState?.kind === 'sleep'"
        :editing="modalState?.editing ? (editPayload as SleepFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
      <GrowthForm
        v-else-if="modalState?.kind === 'growth'"
        :editing="modalState?.editing ? (editPayload as GrowthFormProps) : undefined"
        @saved="onSaved"
        @cancelled="modalState = null"
      />
    </Modal>

    <!-- 删除确认 -->
    <Modal :show="confirmDelete !== null" title="删除记录" @close="confirmDelete = null">
      <p class="confirm-text">确定要删除这条{{ confirmDelete?.kind === 'feeding' ? '喂养' : confirmDelete?.kind === 'diaper' ? '纸尿裤' : confirmDelete?.kind === 'pumping' ? '吸奶' : confirmDelete?.kind === 'sleep' ? '睡眠' : '成长' }}记录吗？此操作不可撤销。</p>
      <div class="confirm-actions">
        <button class="btn btn-outline" @click="confirmDelete = null">取消</button>
        <button class="btn btn-danger-soft" @click="confirmDeleteAction">确认删除</button>
      </div>
    </Modal>
    </template>

    <!-- 奶睡组合弹窗 -->
    <Modal :show="sleepFeedOpen" title="奶睡一键记录" @close="sleepFeedOpen = false">
      <div class="form-field">
        <label class="form-label">喂养类型</label>
        <select v-model="sfType" class="form-input">
          <option v-for="c in FEED_TYPE_CHOICES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>
      <div v-if="sfType === 'bottle_formula' || sfType === 'bottle_breastmilk'" class="form-field">
        <label class="form-label">奶量（ml）</label>
        <input v-model="sfAmount" type="number" min="0" step="5" placeholder="例如 120" class="form-input" inputmode="numeric" />
      </div>
      <div class="form-field">
        <label class="form-label">开始时间</label>
        <input v-model="sfStart" type="datetime-local" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">睡眠类型</label>
        <select v-model="sfSleepType" class="form-input">
          <option value="nap">小睡</option>
          <option value="night">夜间睡眠</option>
        </select>
      </div>
      <div class="form-field">
        <label class="form-label">睡眠结束时间</label>
        <input v-model="sfSleepEnd" type="datetime-local" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">备注（可选）</label>
        <input v-model="sfNotes" type="text" placeholder="例如：奶睡 2 小时" class="form-input" />
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" @click="sleepFeedOpen = false">取消</button>
        <button class="btn btn-primary" @click="saveSleepFeed">一键记录</button>
      </div>
    </Modal>

    <!-- 今日小结弹窗 -->
    <Modal :show="summaryOpen" title="今日小结" @close="summaryOpen = false">
      <pre class="summary-text">{{ dailySummary }}</pre>
      <div class="form-actions">
        <button class="btn btn-outline" @click="summaryOpen = false">关闭</button>
        <button class="btn btn-primary" @click="copySummary">{{ summaryCopied ? '✓ 已复制' : '复制分享' }}</button>
      </div>
    </Modal>

    <!-- 首次引导添加宝宝弹窗 -->
    <Modal :show="onboardingOpen" title="添加宝宝" @close="onboardingOpen = false">
      <div class="form-field">
        <label class="form-label">宝宝名字 *</label>
        <input v-model="onboardName" type="text" placeholder="例如：小糯米" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">出生日期（可选）</label>
        <input v-model="onboardBirthDate" type="date" class="form-input" />
      </div>
      <div class="form-field">
        <label class="form-label">头像</label>
        <div class="avatar-picker">
          <button
            v-for="a in BABY_AVATARS"
            :key="a"
            type="button"
            class="avatar-option"
            :class="{ selected: onboardAvatar === a }"
            @click="onboardAvatar = a"
          >
            {{ a }}
          </button>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" :disabled="!onboardName.trim()" @click="onOnboarded">开始记录</button>
    </Modal>
  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  padding: 60px 24px 30px;
}

.welcome-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.welcome-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 28px;
}

.welcome-btn {
  min-width: 220px;
  margin-bottom: 10px;
}

.date-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface);
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.feed-reminder-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--primary-soft);
  border: 1.5px solid var(--primary);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 12px;
}

.feed-reminder-banner .fr-icon {
  font-size: 26px;
  flex-shrink: 0;
}

.feed-reminder-banner .fr-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.feed-reminder-banner .fr-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.interval-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 12px;
  padding: 14px 12px;
}

.sleep-feed-btn {
  width: 100%;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-weight: 700;
}

.sf-btn-icon {
  font-size: 18px;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 2px 10px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  flex-shrink: 0;
}

.section-row .section-title {
  margin: 0;
}

.summary-text {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text);
  background: var(--surface-2);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}

.interval-item {
  text-align: center;
}

.interval-label {
  font-size: 11px;
  color: var(--text-muted);
}

.interval-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
}

/* 统一卡片高度：网格内不受全局 .card + .card 相邻外边距规则影响，
   避免同一行卡片因 margin-top 差异导致高度参差不齐 */
.stats-grid .stat-card {
  margin: 0;
  min-height: 88px;
}

/* 小屏下统计卡更紧凑，避免长数值溢出 */
@media (max-width: 400px) {
  .stats-grid {
    gap: 8px;
  }

  .stats-grid .stat-card {
    min-height: 84px;
  }

  .welcome {
    padding: 40px 12px 24px;
  }

  .welcome-btn {
    min-width: 0;
    width: 100%;
    max-width: 260px;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

/* 小屏下快捷按钮更紧凑 */
@media (max-width: 400px) {
  .quick-actions {
    gap: 8px;
  }

  .quick-btn {
    padding: 12px 4px;
  }
}

/* PC/平板：统计卡 3 列避免单卡过宽；快捷按钮限宽居中避免拉伸 */
@media (min-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .quick-actions {
    max-width: 720px;
  }
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.quick-btn:active {
  transform: scale(0.95);
}

.quick-icon {
  font-size: 24px;
}

.quick-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-inline {
  text-align: center;
  padding: 24px 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.confirm-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 18px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.confirm-actions .btn {
  flex: 1;
}

.avatar-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
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
</style>