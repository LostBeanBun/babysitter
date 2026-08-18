<script setup lang="ts">
import { useBabyStore } from '@/stores/baby'
import { isDark, toggleTheme } from '@/composables/useTheme'

const babyStore = useBabyStore()
</script>

<template>
  <header class="page-header">
    <div class="header-left">
      <h1 class="header-title">
        <span v-if="babyStore.activeBaby?.avatar" class="header-avatar">{{ babyStore.activeBaby.avatar }}</span>
        {{ babyStore.activeBaby?.name ?? '宝宝日记' }}
      </h1>
      <p v-if="babyStore.activeBaby" class="header-sub">记录美好时光</p>
    </div>
    <div class="header-right">
      <slot name="right" />
      <!-- 明暗主题快捷切换（太阳/月亮图标） -->
      <button
        type="button"
        class="theme-toggle"
        :title="isDark ? '切换为浅色' : '切换为深色'"
        :aria-label="isDark ? '切换为浅色' : '切换为深色'"
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
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  z-index: 40;
}

.header-left {
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
}

.header-avatar {
  font-size: 18px;
  margin-right: 5px;
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

/* 主题切换按钮：圆形图标按钮，不受全局 min-height 影响 */
.theme-toggle {
  width: 36px;
  height: 36px;
  min-height: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.theme-toggle:active {
  background: var(--surface);
  color: var(--primary);
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
