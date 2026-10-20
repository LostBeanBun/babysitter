<script setup lang="ts">
import { computed, onMounted, onUpdated, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TimelineEntry } from '@/services/timeline'
import { formatTime } from '@/utils/format'

const { t, locale } = useI18n()

const props = defineProps<{
  /** 时间轴条目（已按时间倒序） */
  entries: TimelineEntry[]
  /** 是否按天分组显示（默认按时间倒序扁平显示） */
  grouped?: boolean
  /** 正在等待删除确认的条目 key（`kind-id`，与列表 key 一致，用于高亮选中的删除目标） */
  deletingKey?: string | null
  /** 当前选中/交互中的条目 key（`kind-id`，点击后持续高亮，直到选中另一条） */
  selectedKey?: string | null
}>()

const emit = defineEmits<{ edit: [entry: TimelineEntry]; delete: [entry: TimelineEntry] }>()

/** 条目唯一 key（`kind-id`，与列表 key、删除/选中状态共用） */
function entryKey(e: TimelineEntry): string {
  return e.kind + '-' + e.id
}

/** 按天分组 */
const groupedEntries = computed(() => {
  if (!props.grouped) return null
  const groups = new Map<string, TimelineEntry[]>()
  const localeTag = locale.value.startsWith('zh') ? 'zh-CN' : 'en-US'
  for (const e of props.entries) {
    const day = new Date(e.time).toLocaleDateString(localeTag, { month: 'long', day: 'numeric', weekday: 'short' })
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(e)
  }
  return Array.from(groups.entries())
})

// —— 渐进挂载：首屏只渲染前 N 天分组，其余在滚动接近时再渲染（挂载后不卸载）。 ——
// 长列表（一年可达数千条）一次性渲染 DOM/协调开销大，按天分组天然适合增量渲染：
// 新分组只会在视口下方出现，挂载时机在视口外，不会引起视口内容位移。
const INITIAL_GROUPS = 10
const GROUP_MOUNT_MARGIN = '200px 0px'

const mountedGroups = ref<Set<string>>(new Set())
const rootRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 分组数据变化时：前 N 天直接挂载（首屏与筛选切换后无需等待观察器） */
watch(
  groupedEntries,
  (groups) => {
    if (!groups) return
    for (const [day] of groups.slice(0, INITIAL_GROUPS)) mountedGroups.value.add(day)
  },
  { immediate: true },
)

/** 观察所有尚未观察的分组容器（渲染更新后补充新节点） */
function observeGroups() {
  if (!observer || !rootRef.value) return
  for (const el of rootRef.value.querySelectorAll<HTMLElement>('[data-tl-group]')) {
    if (el.dataset.observed === '1') continue
    el.dataset.observed = '1'
    observer.observe(el)
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const day = (entry.target as HTMLElement).dataset.day
        if (day) mountedGroups.value.add(day)
        observer?.unobserve(entry.target)
      }
    },
    { rootMargin: GROUP_MOUNT_MARGIN },
  )
  observeGroups()
})
/** 刚保存：createdAt 在 3s 内的最新一条（保存后回列表轻闪提示；同一时刻批量导入只闪最新一条） */
const savedKey = ref<string | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.entries,
  (list) => {
    const cutoff = Date.now() - 3000
    let best: TimelineEntry | null = null
    for (const e of list) {
      const at = e.raw.createdAt
      if (at >= cutoff && (best === null || at > best.raw.createdAt)) best = e
    }
    const key = best ? entryKey(best) : null
    if (!key || savedKey.value === key) return
    savedKey.value = key
    // 高亮只保持 1.8s：reduce 下用的是静态底色，必须靠计时移除，否则会一直亮着
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      savedKey.value = null
    }, 1800)
  },
  { immediate: true },
)
onUpdated(() => observeGroups())
onUnmounted(() => {
  observer?.disconnect()
  clearTimeout(savedTimer)
})
</script>

<template>
  <div class="timeline" ref="rootRef">
    <template v-if="!grouped">
      <div
        v-for="e in entries"
        :key="entryKey(e)"
        class="tl-item"
        :class="{
          'tl-deleting': deletingKey != null && deletingKey === entryKey(e),
          'tl-saved': savedKey === entryKey(e),
          'tl-selected': selectedKey != null && selectedKey === entryKey(e),
        }"
        :aria-current="selectedKey != null && selectedKey === entryKey(e) ? 'true' : undefined"
        @click="emit('edit', e)"
      >
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
      <div
        v-for="[day, items] in groupedEntries!"
        :key="day"
        class="tl-group"
        data-tl-group="1"
        :data-day="day"
      >
        <p class="tl-day">{{ day }}</p>
        <template v-if="mountedGroups.has(day)">
          <div
            v-for="e in items"
            :key="e.kind + '-' + e.id"
            class="tl-item tl-timeline-item"
            :class="{
              'tl-deleting': deletingKey != null && deletingKey === entryKey(e),
              'tl-saved': savedKey === entryKey(e),
              'tl-selected': selectedKey != null && selectedKey === entryKey(e),
            }"
            :aria-current="selectedKey != null && selectedKey === entryKey(e) ? 'true' : undefined"
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
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tl-group {
  position: relative;
  margin-bottom: 12px;
}

.tl-day {
  position: relative;
  z-index: 1;
  display: inline-block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 4px 6px;
  padding: 0 10px;
  background: var(--surface-translucent);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
}

.tl-timeline-item {
  position: relative;
  gap: 12px;
}

/* 时间轴节点：同类型统一主色描边圆点 */
.tl-timeline-item .tl-timeline-node {
  background: var(--bg);
  box-shadow: inset 0 0 0 1.5px currentColor;
  flex-shrink: 0;
}

.tl-timeline-item + .tl-timeline-item {
  margin-top: 2px;
}

.tl-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  transition:
    background 0.25s var(--ease-out),
    transform 0.3s var(--spring);
}

@media (hover: hover) {
  .tl-item:hover {
    background: var(--fill-hover);
    backdrop-filter: var(--glass-blur-light);
    -webkit-backdrop-filter: var(--glass-blur-light);
  }
}

/* 按压高亮：触屏没有 hover（@media (hover: hover) 在 iOS 不生效），
   系统 tap 高亮又已全局关闭，这里用 :active 补回底色反馈 */
.tl-item:active {
  background: var(--fill-hover);
  box-shadow: inset 0 0 0 1px var(--glass-inset);
  transform: scale(0.985);
  transition-duration: 0.06s;
}

/* 选中态：点击后在列表中持续标识当前记录（类似 focus 环），直到选中另一条 */
.tl-item.tl-selected {
  background: var(--primary-soft);
  box-shadow: inset 0 0 0 1.5px var(--primary);
}

.tl-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--glass-inset);
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
  width: 44px;
  height: 44px;
  min-height: 0;
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

/* 刚保存的新条目：轻闪提示后淡出 */
@keyframes tl-saved-flash {
  from {
    background-color: var(--primary-glow);
  }
  to {
    background-color: transparent;
  }
}

.tl-item.tl-saved {
  animation: tl-saved-flash 1.8s var(--ease-out);
}

/* reduce 下全局把动画压到 0.01ms，用静态底色兜底；1.8s 后由组件移除类 */
@media (prefers-reduced-motion: reduce) {
  .tl-item.tl-saved {
    animation: none;
    background-color: var(--primary-glow);
    box-shadow: inset 0 0 0 1px var(--primary-soft);
  }
}

/* 删除待确认态：高亮被选中的条目 */
.tl-item.tl-deleting {
  background: var(--danger-soft);
  box-shadow: inset 0 0 0 1.5px var(--danger);
  animation: tl-deleting-pulse 1.4s ease-in-out infinite;
}

.tl-item.tl-deleting .tl-delete {
  background: var(--danger);
  color: var(--on-primary);
  opacity: 1;
  box-shadow: 0 2px 8px var(--danger-soft);
}

.tl-item.tl-deleting .tl-title {
  color: var(--danger);
}

@keyframes tl-deleting-pulse {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 1.5px var(--danger),
      0 0 0 0 var(--danger-soft);
  }
  50% {
    box-shadow:
      inset 0 0 0 1.5px var(--danger),
      0 0 0 4px var(--danger-soft);
  }
}

@media (hover: none) {
  .tl-delete {
    opacity: 0.85;
  }
}
</style>
