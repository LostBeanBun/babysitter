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

export interface TimelineEntry {
  id: number
  kind: TimelineKind
  time: number
  icon: string
  color: string
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
      title: t(SLEEP_TYPE_LABELS[s.type]),
      detail: `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`,
      duration: dur,
      raw: s,
    })
  }

  for (const g of props.growths ?? []) {
    const detailParts: string[] = []
    if (g.weight != null) detailParts.push(t('timeline.weight', { value: g.weight }))
    if (g.height != null) detailParts.push(t('timeline.height', { value: g.height }))
    list.push({
      id: g.id!,
      kind: 'growth',
      time: g.date,
      icon: '📏',
      color: '#8FBF9F',
      title: t('growth.title'),
      detail: detailParts.join(' · ') || t('common.recorded'),
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
      <div v-for="e in entries" :key="e.kind + '-' + e.id" class="tl-item" @click="emit('edit', e)">
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
        <div v-for="e in items" :key="e.kind + '-' + e.id" class="tl-item" @click="emit('edit', e)">
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.tl-group {
  margin-bottom: 18px;
}

.tl-day {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 4px 8px;
}

.tl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.12s ease;
}

.tl-item:hover {
  background: var(--surface-2);
}

.tl-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
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
}

.tl-detail {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

.tl-delete {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    background 0.12s ease;
  flex-shrink: 0;
}

.tl-item:hover .tl-delete {
  opacity: 1;
}

.tl-delete:active,
.tl-delete:focus-visible {
  background: var(--danger-soft);
  color: var(--danger);
  opacity: 1;
}

@media (hover: none) {
  .tl-delete {
    opacity: 0.85;
  }
}
</style>
