<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { isDark, toggleTheme } from '@/composables/useTheme'
import { setLocale, type Locale } from '@/i18n'

const babyStore = useBabyStore()
const { t, locale } = useI18n()

const langOpen = ref(false)
const langWrapRef = ref<HTMLElement | null>(null)

function toggleLang() {
  langOpen.value = !langOpen.value
}

function chooseLang(l: Locale) {
  setLocale(l)
  langOpen.value = false
}

/** 点击外部区域关闭语言菜单 */
function onDocClick(e: MouseEvent) {
  if (langOpen.value && langWrapRef.value && !langWrapRef.value.contains(e.target as Node)) {
    langOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <header class="page-header">
    <div class="header-left">
      <span v-if="babyStore.activeBaby?.avatar" class="header-avatar">{{ babyStore.activeBaby.avatar }}</span>
      <div class="header-text">
        <h1 class="header-title">{{ babyStore.activeBaby?.name ?? t('app.name') }}</h1>
        <p v-if="babyStore.activeBaby" class="header-sub">{{ t('app.tagline') }}</p>
      </div>
    </div>
    <div class="header-right">
      <slot name="right" />
      <!-- 语言切换下拉菜单 -->
      <div ref="langWrapRef" class="lang-wrap">
        <button
          type="button"
          class="lang-toggle"
          :title="t('language.title')"
          :aria-label="t('language.title')"
          aria-haspopup="menu"
          :aria-expanded="langOpen"
          @click.stop="toggleLang"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
          <span class="lang-badge">{{ locale.startsWith('zh') ? '中' : 'EN' }}</span>
        </button>
        <div v-show="langOpen" class="lang-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            :class="{ active: locale === 'zh-CN' }"
            @click="chooseLang('zh-CN')"
          >
            中文
          </button>
          <button
            type="button"
            role="menuitem"
            :class="{ active: locale === 'en-US' }"
            @click="chooseLang('en-US')"
          >
            English
          </button>
        </div>
      </div>
      <!-- 明暗主题快捷切换（太阳/月亮图标） -->
      <button
        type="button"
        class="theme-toggle"
        :title="isDark ? t('theme.toLight') : t('theme.toDark')"
        :aria-label="isDark ? t('theme.toLight') : t('theme.toDark')"
        @click="toggleTheme"
      >
        <svg v-if="isDark" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
          <path
            d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm9 9a1 1 0 0 1-1 1h-2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1zM5 12a1 1 0 0 1-1 1H2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1zm1.05-5.95a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.41l1.42-1.42a1 1 0 0 1 1.41 0zm12.37 0a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.41l1.42-1.42a1 1 0 0 1 1.41 0zM12 19a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zm-4.95 2.05a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.41l-1.42 1.42a1 1 0 0 1-1.41 0zm9.9 0a1 1 0 0 1-1.41 0l-1.42-1.42a1 1 0 1 1 1.41-1.41l1.42 1.42a1 1 0 0 1 0 1.41z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 640px;
  height: calc(var(--header-height) + var(--safe-top));
  padding: var(--safe-top) 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--header-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--border);
  z-index: 40;
}

.header-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  letter-spacing: 0.01em;
}

/* 宝宝头像徽章：圆角方形渐变底 */
.header-avatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--primary-soft), var(--surface-2));
  border: 1px solid var(--border);
}

.header-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

/* 语言切换：圆形按钮 + 下拉菜单 */
.lang-wrap {
  position: relative;
}

.lang-toggle {
  width: 38px;
  height: 38px;
  min-height: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.12s ease,
    border-color 0.15s ease;
}

.lang-toggle:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.lang-toggle:active {
  transform: scale(0.92);
}

.lang-badge {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.lang-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 148px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
  animation: lang-pop 0.14s ease-out;
}

.lang-menu button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 14px;
  color: var(--text);
  text-align: left;
}

.lang-menu button:hover {
  background: var(--surface-2);
}

.lang-menu button.active {
  color: var(--primary);
  font-weight: 600;
}

.lang-menu button.active::after {
  content: '✓';
  font-size: 13px;
}

@keyframes lang-pop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 主题切换按钮：圆形图标按钮，不受全局 min-height 影响 */
.theme-toggle {
  width: 38px;
  height: 38px;
  min-height: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.12s ease,
    border-color 0.15s ease;
}

.theme-toggle:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.theme-toggle:active {
  transform: scale(0.92);
}

/* PC/平板：页头与内容容器同宽并居中 */
@media (min-width: 700px) {
  .page-header {
    max-width: 1200px;
    padding-left: 32px;
    padding-right: 32px;
  }
}
</style>
