<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormErrors } from '@/composables/useFormErrors'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useBabyStore } from '@/stores/baby'
import { useFeedingStore } from '@/stores/feeding'
import { useSleepStore } from '@/stores/sleep'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import OnboardingModal from '@/components/dashboard/OnboardingModal.vue'
import TodayOverview from '@/components/dashboard/TodayOverview.vue'
import RecordFormModal from '@/components/common/RecordFormModal.vue'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { FEED_TYPE_LABELS, KIND_META } from '@/constants'
import { useRecordModal } from '@/composables/useRecordModal'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { KIND_COLORS } from '@/services/timeline'
import type { TimelineEntry } from '@/services/timeline'
import type { FeedType, RecordKind, Vaccination } from '@/types'
import { useVaccinationStore } from '@/stores/vaccination'
import { formatDate } from '@/utils/format'

const babyStore = useBabyStore()
const feedingStore = useFeedingStore()
const sleepStore = useSleepStore()
const vaccinationStore = useVaccinationStore()

const { t } = useI18n()

const now = ref(Date.now())
const nowTimer = window.setInterval(() => (now.value = Date.now()), 60_000)
onUnmounted(() => window.clearInterval(nowTimer))
// 无宝宝时显示引导
const hasBaby = computed(() => babyStore.babies.length > 0)

const onboardingOpen = ref(false)

const activeTimer = useActiveTimer()
const { modalState, openAdd, onEdit, onStartRecord, onSaved, onCancelled } = useRecordModal()

// —— 奶睡一键（组合记录喂养 + 睡眠）——
const sleepFeedOpen = ref(false)
const sfType = ref<FeedType>('breast')
const sfAmount = ref('')
const sfStart = ref(toDateTimeLocal(Date.now()))
const sfSleepEnd = ref(toDateTimeLocal(Date.now() + 2 * 3600_000))
const sfNotes = ref('')
const sfErr = useFormErrors()

function openSleepFeed() {
  sfErr.clearAll()
  sleepFeedOpen.value = true
}

const FEED_TYPE_CHOICES = Object.entries(FEED_TYPE_LABELS).map(([value, label]) => ({
  value: value as FeedType,
  label,
}))

async function saveSleepFeed() {
  sfErr.clearAll()
  const start = fromDateTimeLocal(sfStart.value)
  const end = fromDateTimeLocal(sfSleepEnd.value)
  if (start == null || isNaN(start)) {
    sfErr.set('start', t('dashboard.selectStart'))
    return
  }
  if (end == null || isNaN(end) || end <= start) {
    sfErr.set('sleepEnd', t('dashboard.sleepEndAfter'))
    return
  }
  let amount: number | undefined
  if (sfType.value === 'bottle_formula' || sfType.value === 'bottle_breastmilk') {
    amount = sfAmount.value ? Number(sfAmount.value) : undefined
    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      sfErr.set('amount', t('dashboard.invalidAmount'))
      return
    }
  }
  await feedingStore.add({ type: sfType.value, side: sfType.value === 'breast' ? 'both' : undefined, startTime: start, amount })
  await sleepStore.add({ type: 'nap', startTime: start, endTime: end, notes: sfNotes.value || undefined })
  activeTimer.reset()
  sleepFeedOpen.value = false
  sfType.value = 'breast'
  sfAmount.value = ''
  sfStart.value = toDateTimeLocal(Date.now())
  sfSleepEnd.value = toDateTimeLocal(Date.now() + 2 * 3600_000)
  sfNotes.value = ''
}

const { onSubmit: onSleepFeedSubmit } = useFormSubmit(saveSleepFeed)

/** 快捷记录按钮（顺序与样式类一致于设计稿） */
const QUICK_KINDS: RecordKind[] = [
  'feeding',
  'diaper',
  'sleep',
  'pumping',
  'growth',
  'solidFood',
  'medication',
  'vaccination',
  'temperature',
  'milestone',
]

/** 样式类名与记录类型名有两处出入（feed/pump） */
function quickCss(kind: RecordKind): string {
  if (kind === 'feeding') return 'feed'
  if (kind === 'pumping') return 'pump'
  return kind
}

/** 点击疫苗提醒：打开对应计划记录编辑；记录已被删除时回退为新增 */
function onEditVaccination(v: Vaccination) {
  const current = vaccinationStore.vaccinations.find((x) => x.id === v.id)
  if (!current) {
    openAdd('vaccination')
    return
  }
  const entry: TimelineEntry = {
    id: current.id!,
    kind: 'vaccination',
    time: current.date,
    icon: '💉',
    color: current.status === 'done' ? '#6AB0D8' : '#D8A45A',
    kindColor: KIND_COLORS.vaccination,
    title: current.name,
    detail: current.dose ?? '',
    timeLabel: formatDate(current.date),
    raw: current,
  }
  onEdit(entry)
}
</script>

<template>
  <div class="page dashboard">
    <PageHeader />

    <!-- 首次使用引导 -->
    <div v-if="!hasBaby" class="welcome">
      <div class="welcome-icon">👶</div>
      <h2 class="welcome-title">{{ t('dashboard.welcomeTitle') }}</h2>
      <p class="welcome-text">{{ t('dashboard.welcomeText1') }}<br />{{ t('dashboard.welcomeText2') }}</p>
      <button class="btn btn-primary btn-lg welcome-btn" @click="onboardingOpen = true">{{ t('dashboard.startBtn') }}</button>
      <button class="btn btn-outline welcome-btn" @click="$router.push('/settings')">
        {{ t('dashboard.importHint') }}
      </button>
    </div>

    <template v-else>
      <!-- 今日概览（提醒条 + 统计卡 + 小结按钮） -->
      <TodayOverview :now="now" @edit="onEditVaccination" />

      <!-- 快捷记录 -->
      <p class="section-title">{{ t('dashboard.quickRecord') }}</p>
      <div class="quick-actions">
        <button v-for="k in QUICK_KINDS" :key="k" class="quick-btn" :class="quickCss(k)" @click="openAdd(k)">
          <span class="quick-icon">{{ KIND_META[k].icon }}</span>
          <span class="quick-label">{{ t(KIND_META[k].labelKey) }}</span>
        </button>
      </div>

      <!-- 奶睡一键（与快捷记录同组） -->
      <button class="btn btn-outline sleep-feed-btn" @click="openSleepFeed">
        <span class="sf-btn-icon">🍼😴</span>
        <span>{{ t('dashboard.sleepFeedButton') }}</span>
      </button>

      <!-- 记录弹窗 -->
      <RecordFormModal
        :state="modalState"
        @close="modalState = null"
        @saved="onSaved"
        @cancelled="onCancelled"
        @start-record="onStartRecord"
      />
    </template>

    <!-- 奶睡组合弹窗 -->
    <BaseModal :show="sleepFeedOpen" :title="t('dashboard.sleepFeedTitle')" @close="activeTimer.reset(); sleepFeedOpen = false">
      <form ref="root" @submit.prevent="onSleepFeedSubmit">
      <div class="form-field">
        <label class="form-label">{{ t('feed.typeLabel') }}</label>
        <select v-model="sfType" class="form-input">
          <option v-for="c in FEED_TYPE_CHOICES" :key="c.value" :value="c.value">{{ t(c.label) }}</option>
        </select>
      </div>
      <div
        v-if="sfType === 'bottle_formula' || sfType === 'bottle_breastmilk'"
        class="form-field"
        :class="{ 'has-error': sfErr.has('amount') }"
      >
        <label class="form-label">{{ t('dashboard.sleepFeedAmount') }}</label>
        <input
          v-model="sfAmount"
          type="number"
          min="0"
          step="5"
          :placeholder="t('dashboard.sleepFeedAmountPh')"
          class="form-input"
          inputmode="numeric"
          @input="sfErr.clear('amount')"
        />
        <p v-if="sfErr.get('amount')" class="field-error">{{ sfErr.get('amount') }}</p>
      </div>
      <div class="form-field" :class="{ 'has-error': sfErr.has('start') }">
        <label class="form-label">{{ t('feed.startLabel') }}</label>
        <input
          v-model="sfStart"
          type="datetime-local" step="1"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          @input="sfErr.clear('start')"
        />
        <p v-if="sfErr.get('start')" class="field-error">{{ sfErr.get('start') }}</p>
      </div>
      <div class="form-field" :class="{ 'has-error': sfErr.has('sleepEnd') }">
        <label class="form-label">{{ t('sleep.endLabel') }}</label>
        <input
          v-model="sfSleepEnd"
          type="datetime-local" step="1"
          :placeholder="t('common.selectDateTime')"
          class="form-input"
          @input="sfErr.clear('sleepEnd')"
        />
        <p v-if="sfErr.get('sleepEnd')" class="field-error">{{ sfErr.get('sleepEnd') }}</p>
      </div>
      <div class="form-field">
        <label class="form-label">{{ t('sleep.notesLabel') }}（{{ t('common.optional') }}）</label>
        <input v-model="sfNotes" type="text" :placeholder="t('dashboard.sleepFeedNotesPh')" class="form-input" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" @click="activeTimer.reset(); sleepFeedOpen = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn btn-primary">{{ t('dashboard.oneTapRecord') }}</button>
      </div>
      </form>
    </BaseModal>

    <!-- 首次引导添加宝宝弹窗 -->
    <OnboardingModal :show="onboardingOpen" @close="onboardingOpen = false" />

  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  padding: 48px var(--space-6) var(--space-6);
}

.welcome-icon {
  font-size: var(--fs-display);
  margin-bottom: var(--space-3);
}

.welcome-title {
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.welcome-text {
  font-size: var(--fs-14);
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 22px;
}

.welcome-btn {
  min-width: 220px;
  margin-bottom: 10px;
}

.welcome-btn + .welcome-btn {
  margin-left: var(--space-3);
}

.sleep-feed-btn {
  width: 100%;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  font-weight: 700;
}

.sf-btn-icon {
  font-size: var(--fs-18);
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions .btn {
  flex: 1;
}

/* 小屏下统计卡单列展示：双列时图标占位过大、数值与说明文字被挤压换行 */
@media (max-width: 520px) {
  .welcome {
    padding: 32px var(--space-3) var(--space-5);
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
  gap: 8px;
}

/* 小屏下快捷按钮 3×3 网格：按钮更大、触控友好、英文长标签完整显示 */
@media (max-width: 520px) {
  .quick-actions {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
}

/* PC/平板：快捷按钮限宽居中避免拉伸 */
@media (min-width: 900px) {
  .quick-actions {
    margin: 0 auto;
  }
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0; /* 允许 grid track 收缩，避免长标签撑破容器 */
  padding: 10px 6px;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: transparent;
  transition:
    transform var(--dur-slow) var(--spring),
    background var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
}

.quick-btn:active {
  transform: scale(var(--tap-scale));
  background: var(--surface-2);
}

.quick-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xl);
  flex-shrink: 0;
  line-height: 1;
  box-shadow: inset 0 0 0 1px var(--glass-inset), var(--shadow-glass);
  transition: transform var(--dur-slow) var(--spring);
}

.quick-btn:active .quick-icon {
  transform: scale(var(--tap-scale));
}

/* 每种记录类型的图标专属渐变色（浅色容器 + 主题色），暗色下整体降亮 */
.quick-btn.feed .quick-icon {
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.28), rgba(255, 107, 53, 0.16));
}

.quick-btn.diaper .quick-icon {
  background: linear-gradient(135deg, rgba(175, 82, 222, 0.28), rgba(175, 82, 222, 0.16));
}

.quick-btn.pump .quick-icon {
  background: linear-gradient(135deg, rgba(255, 45, 85, 0.26), rgba(255, 45, 85, 0.14));
}

.quick-btn.sleep .quick-icon {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.26), rgba(0, 122, 255, 0.14));
}

.quick-btn.growth .quick-icon {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.26), rgba(52, 199, 89, 0.14));
}

.quick-btn.solidFood .quick-icon {
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.28), rgba(255, 149, 0, 0.16));
}

.quick-btn.medication .quick-icon {
  background: linear-gradient(135deg, rgba(255, 45, 85, 0.22), rgba(175, 82, 222, 0.16));
}

.quick-btn.vaccination .quick-icon {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.24), rgba(52, 199, 89, 0.14));
}

.quick-btn.temperature .quick-icon {
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.26), rgba(255, 59, 48, 0.14));
}

.quick-btn.milestone .quick-icon {
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.24), rgba(255, 214, 10, 0.16));
}

.quick-label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
