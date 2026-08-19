<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  Feeding,
  DiaperChange,
  Pumping,
  Sleep,
  GrowthRecord,
  SolidFood,
  Medication,
  Vaccination,
  Temperature,
} from '@/types'
import {
  FEED_TYPE_LABELS,
  DIAPER_TYPE_LABELS,
  DIAPER_COLOR_LABELS,
  DIAPER_AMOUNT_LABELS,
  PUMP_SIDE_LABELS,
  SLEEP_TYPE_LABELS,
  TEMP_METHOD_LABELS,
} from '@/constants'
import { formatTime, formatDuration, formatAmount, formatDate } from '@/utils/format'

const { t, locale } = useI18n()

export type TimelineKind = 'feeding' | 'diaper' | 'pumping' | 'sleep' | 'growth' | 'solidFood' | 'medication' | 'vaccination' | 'temperature'

/** 各记录类型的统一主色（时间轴/图标标识） */
const KIND_COLORS: Record<TimelineKind, string> = {
  feeding: '#E8906C',
  diaper: '#9A8FC8',
  pumping: '#D8A8C8',
  sleep: '#8FAED8',
  growth: '#8FBF9F',
  solidFood: '#D8905A',
  medication: '#D86A8A',
  vaccination: '#6AB0D8',
  temperature: '#E8A45A',
}

export interface TimelineEntry {
  id: number
  kind: TimelineKind
  time: number
  icon: string
  color: string
  /** 类型统一主色（时间轴节点颜色） */
  kindColor: string
  title: string
  detail: string
  duration?: number
  /** 自定义时间显示（如疫苗用日期） */
  timeLabel?: string
  raw: Feeding | DiaperChange | Pumping | Sleep | GrowthRecord | SolidFood | Medication | Vaccination | Temperature
}

const props = defineProps<{
  feedings: Feeding[]
  diapers: DiaperChange[]
  pumpings: Pumping[]
  sleeps: Sleep[]
  growths?: GrowthRecord[]
  solidFoods?: SolidFood[]
  medications?: Medication[]
  vaccinations?: Vaccination[]
  temperatures?: Temperature[]
  /** 是否按天分组显示（默认按时间倒序扁平显示） */
  grouped?: boolean
  /** 正在等待删除确认的条目 key（`kind-id`，与列表 key 一致，用于高亮选中的删除目标） */
  deletingKey?: string | null
}>()

const emit = defineEmits<{ edit: [entry: TimelineEntry]; delete: [entry: TimelineEntry] }>()

const entries = computed<TimelineEntry[]>(() => {
  const list: TimelineEntry[] = []

  for (const f of props.feedings) {
    const color = f.type.startsWith('breast') ? '#F2A28C' : f.type === 'bottle_formula' ? '#C4A8E0' : '#8FB9D8'
    const detailParts: string[] = []
    if (f.amount != null) detailParts.push(formatAmount(f.amount))
    if (f.duration) detailParts.push(formatDuration(f.duration))
    const detail = detailParts.length ? detailParts.join(' · ') : t('common.recorded')
    list.push({
      id: f.id!,
      kind: 'feeding',
      time: f.startTime,
      icon: f.type.startsWith('breast') ? '🤱' : '🍼',
      color,
      kindColor: KIND_COLORS.feeding,
      title: t(FEED_TYPE_LABELS[f.type]),
      detail,
      duration: f.duration,
      raw: f,
    })
  }

  for (const d of props.diapers) {
    const detailParts: string[] = [t(DIAPER_TYPE_LABELS[d.type])]
    if (d.color) detailParts.push(t(DIAPER_COLOR_LABELS[d.color]))
    if (d.amount) detailParts.push(t(DIAPER_AMOUNT_LABELS[d.amount]))
    list.push({
      id: d.id!,
      kind: 'diaper',
      time: d.time,
      icon: d.type === 'wet' ? '💧' : d.type === 'dirty' ? '💩' : '🧷',
      color: '#9A8FC8',
      kindColor: KIND_COLORS.diaper,
      title: t(DIAPER_TYPE_LABELS[d.type]),
      detail: detailParts.slice(1).join(' · ') || t('common.changed'),
      raw: d,
    })
  }

  for (const p of props.pumpings) {
    const detailParts: string[] = []
    if (p.amount != null) detailParts.push(`${formatAmount(p.amount)}`)
    if (p.duration) detailParts.push(formatDuration(p.duration))
    list.push({
      id: p.id!,
      kind: 'pumping',
      time: p.startTime,
      icon: '🎀',
      color: '#D8A8C8',
      kindColor: KIND_COLORS.pumping,
      title: t('timeline.pumpTitle', { side: t(PUMP_SIDE_LABELS[p.side]) }),
      detail: detailParts.join(' · ') || t('common.recorded'),
      duration: p.duration,
      raw: p,
    })
  }

  for (const s of props.sleeps) {
    const dur = s.endTime - s.startTime
    list.push({
      id: s.id!,
      kind: 'sleep',
      time: s.startTime,
      icon: s.type === 'night' ? '🌙' : '😴',
      color: '#8FAED8',
      kindColor: KIND_COLORS.sleep,
      title: t(SLEEP_TYPE_LABELS[s.type]),
      detail: `${formatTime(s.startTime)} - ${formatTime(s.endTime)}${dur > 0 ? ` · ${formatDuration(dur)}` : ''}`,
      duration: dur,
      raw: s,
    })
  }

  for (const g of props.growths ?? []) {
    const detailParts: string[] = []
    if (g.weight != null) detailParts.push(t('timeline.weight', { value: g.weight }))
    if (g.height != null) detailParts.push(t('timeline.height', { value: g.height }))
    if (g.headCircumference != null) detailParts.push(t('timeline.headCircumference', { value: g.headCircumference }))
    list.push({
      id: g.id!,
      kind: 'growth',
      time: g.date,
      icon: '📏',
      color: '#8FBF9F',
      kindColor: KIND_COLORS.growth,
      title: t('growth.title'),
      detail: detailParts.join(' · ') || t('common.recorded'),
      timeLabel: formatDate(g.date),
      raw: g,
    })
  }

  for (const sf of props.solidFoods ?? []) {
    const detailParts: string[] = [sf.food]
    if (sf.amount) detailParts.push(sf.amount)
    list.push({
      id: sf.id!,
      kind: 'solidFood',
      time: sf.time,
      icon: '🍎',
      color: '#D8905A',
      kindColor: KIND_COLORS.solidFood,
      title: t('timeline.solidFood'),
      detail: detailParts.join(' · '),
      raw: sf,
    })
  }

  for (const m of props.medications ?? []) {
    const detailParts: string[] = [m.name]
    if (m.dose) detailParts.push(m.dose)
    list.push({
      id: m.id!,
      kind: 'medication',
      time: m.time,
      icon: '💊',
      color: '#D86A8A',
      kindColor: KIND_COLORS.medication,
      title: t('timeline.medication'),
      detail: detailParts.join(' · '),
      raw: m,
    })
  }

  for (const v of props.vaccinations ?? []) {
    const detailParts: string[] = [v.name]
    if (v.dose) detailParts.push(v.dose)
    detailParts.push(v.status === 'done' ? t('timeline.vaccinationDone') : t('timeline.vaccinationPlanned'))
    list.push({
      id: v.id!,
      kind: 'vaccination',
      time: v.date,
      icon: '💉',
      color: v.status === 'done' ? '#6AB0D8' : '#D8A45A',
      kindColor: KIND_COLORS.vaccination,
      title: t('timeline.vaccination'),
      detail: detailParts.join(' · '),
      timeLabel: formatDate(v.date),
      raw: v,
    })
  }

  for (const tmp of props.temperatures ?? []) {
    const detailParts: string[] = [t('timeline.temperatureValue', { value: tmp.value })]
    if (tmp.method) detailParts.push(t(TEMP_METHOD_LABELS[tmp.method]))
    list.push({
      id: tmp.id!,
      kind: 'temperature',
      time: tmp.time,
      icon: '🌡️',
      color: '#E8A45A',
      kindColor: KIND_COLORS.temperature,
      title: t('timeline.temperature'),
      detail: detailParts.join(' · '),
      raw: tmp,
    })
  }

  return list.sort((a, b) => b.time - a.time)
})

/** 按天分组 */
const groupedEntries = computed(() => {
  if (!props.grouped) return null
  const groups = new Map<string, TimelineEntry[]>()
  const localeTag = locale.value.startsWith('zh') ? 'zh-CN' : 'en-US'
  for (const e of entries.value) {
    const day = new Date(e.time).toLocaleDateString(localeTag, { month: 'long', day: 'numeric', weekday: 'short' })
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(e)
  }
  return Array.from(groups.entries())
})
</script>

<template>
  <div class="timeline">
    <template v-if="!grouped">
      <div v-for="e in entries" :key="e.kind + '-' + e.id" class="tl-item" :class="{ 'tl-deleting': deletingKey != null && deletingKey === e.kind + '-' + e.id }" @click="emit('edit', e)">
        <div class="tl-icon" :style="{ background: e.color + '22' }">
          <span>{{ e.icon }}</span>
        </div>
        <div class="tl-body">
          <div class="tl-title-row">
            <span class="tl-title">{{ e.title }}</span>
            <span class="tl-time">{{ e.timeLabel ?? formatTime(e.time) }}</span>
          </div>
          <p class="tl-detail">{{ e.detail }}</p>
        </div>
        <button class="tl-delete" :aria-label="t('timeline.deleted')" @click.stop="emit('delete', e)">✕</button>
      </div>
    </template>

    <template v-else>
      <div v-for="[day, items] in groupedEntries!" :key="day" class="tl-group">
        <p class="tl-day">{{ day }}</p>
        <div
          v-for="e in items"
          :key="e.kind + '-' + e.id"
          class="tl-item tl-timeline-item"
          :class="{ 'tl-deleting': deletingKey != null && deletingKey === e.kind + '-' + e.id }"
          @click="emit('edit', e)"
        >
          <div
            class="tl-icon tl-timeline-node"
            :style="{ color: e.kindColor, borderColor: e.kindColor }"
          >
            <span>{{ e.icon }}</span>
          </div>
          <div class="tl-body">
            <div class="tl-title-row">
              <span class="tl-title">{{ e.title }}</span>
              <span class="tl-time">{{ e.timeLabel ?? formatTime(e.time) }}</span>
            </div>
            <p class="tl-detail">{{ e.detail }}</p>
          </div>
          <button class="tl-delete" :aria-label="t('timeline.deleted')" @click.stop="emit('delete', e)">✕</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tl-group {
  position: relative;
  margin-bottom: 18px;
}

/* 时间轴竖线：贯穿同一天的记录（对齐节点中心：item padding-left 12 + 节点半宽 21） */
.tl-group::before {
  content: '';
  position: absolute;
  left: 32px;
  top: 34px;
  bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: var(--border);
}

.tl-day {
  position: relative;
  z-index: 1;
  display: inline-block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 4px 8px;
  padding: 0 6px;
  background: var(--bg);
  border-radius: 999px;
}

/* 时间轴节点：不透明底色遮住轴线，同类型统一主色描边 */
.tl-timeline-item {
  position: relative;
  gap: 12px;
}

.tl-timeline-item .tl-timeline-node {
  background: var(--bg);
  box-shadow:
    inset 0 0 0 1.5px currentColor,
    0 0 0 3px var(--bg);
  flex-shrink: 0;
}

.tl-timeline-item + .tl-timeline-item {
  margin-top: 2px;
}

.tl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 16px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.12s ease;
}

.tl-item:hover {
  background: var(--surface-2);
}

.tl-item:active {
  transform: scale(0.99);
}

.tl-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.03);
}

.tl-body {
  flex: 1;
  min-width: 0;
}

.tl-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.tl-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tl-time {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  background: var(--surface-2);
  padding: 2px 8px;
  border-radius: 999px;
}

.tl-detail {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 3px;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

.tl-delete {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    background 0.12s ease,
    color 0.12s ease;
  flex-shrink: 0;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.tl-item:hover .tl-delete {
  opacity: 1;
}

.tl-delete:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.tl-delete:active,
.tl-delete:focus-visible {
  background: var(--danger-soft);
  color: var(--danger);
  opacity: 1;
}

/* 删除待确认态：高亮被选中的条目 */
.tl-item.tl-deleting {
  background: var(--danger-soft);
  box-shadow: inset 0 0 0 1.5px var(--danger);
  animation: tl-deleting-pulse 1.4s ease-in-out infinite;
}

.tl-item.tl-deleting .tl-delete {
  background: var(--danger);
  color: #fff;
  opacity: 1;
  box-shadow: 0 2px 8px rgba(217, 122, 82, 0.4);
}

.tl-item.tl-deleting .tl-title {
  color: var(--danger);
}

@keyframes tl-deleting-pulse {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 1.5px var(--danger),
      0 0 0 0 rgba(217, 122, 82, 0.18);
  }
  50% {
    box-shadow:
      inset 0 0 0 1.5px var(--danger),
      0 0 0 4px rgba(217, 122, 82, 0.08);
  }
}

@media (hover: none) {
  .tl-delete {
    opacity: 0.85;
  }
}
</style>
