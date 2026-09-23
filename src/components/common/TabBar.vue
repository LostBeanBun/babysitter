<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { APP_TABS } from '@/router/tabs'

const route = useRoute()
const babyStore = useBabyStore()
const { t } = useI18n()

const showTabbar = computed(() => babyStore.babies.length > 0)
</script>

<template>
  <nav v-if="showTabbar" class="tabbar" :aria-label="t('nav.dashboard')">
    <div class="tabbar-glass">
      <span class="tabbar-shine" aria-hidden="true" />
      <RouterLink
        v-for="tab in APP_TABS"
        :key="tab.name"
        :to="tab.path"
        class="tabbar-item"
        :class="{ active: route.name === tab.name }"
        :aria-current="route.name === tab.name ? 'page' : undefined"
      >
        <span class="tabbar-pill">
          <svg viewBox="0 0 24 24" fill="currentColor" class="tabbar-icon" aria-hidden="true">
            <path :d="tab.icon" />
          </svg>
        </span>
        <span class="tabbar-label">{{ t(tab.label) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
/* App Store / iOS Liquid Glass — 悬浮胶囊底栏 */
.tabbar {
  position: fixed;
  bottom: calc(var(--safe-bottom) + var(--tabbar-float-gap, 14px));
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 24px);
  max-width: 420px;
  z-index: 50;
  pointer-events: none;
}

.tabbar-glass {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 2px;
  height: var(--tabbar-height);
  padding: 5px;
  border-radius: calc(var(--tabbar-height) / 2);
  background: var(--surface);
  backdrop-filter: var(--glass-blur-heavy);
  -webkit-backdrop-filter: var(--glass-blur-heavy);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-float), inset 0 1px 0 var(--glass-shine), inset 0 -1px 0 var(--glass-edge);
  pointer-events: auto;
  overflow: hidden;
}

/* 顶部高光线（液态玻璃） */
.tabbar-shine {
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-shine), transparent);
  pointer-events: none;
}

.tabbar-item {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 2px;
  border-radius: 999px;
  color: var(--text-muted);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    color 0.25s var(--ease-out),
    background 0.35s var(--spring),
    transform 0.35s var(--spring);
}

.tabbar-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  border-radius: 999px;
  transition:
    background 0.35s var(--spring),
    transform 0.35s var(--spring),
    box-shadow 0.3s var(--ease-out);
}

.tabbar-item:active {
  transform: scale(var(--tap-scale));
}

.tabbar-item:active .tabbar-pill {
  transform: scale(var(--tap-scale));
}

.tabbar-item.active {
  color: var(--primary);
}

.tabbar-item.active .tabbar-pill {
  background: var(--primary-soft);
  box-shadow: inset 0 0 0 1px var(--glass-inset);
}

.tabbar-icon {
  width: 23px;
  height: 23px;
  transition: transform 0.35s var(--spring);
}

.tabbar-item.active .tabbar-icon {
  transform: scale(1.06);
}

.tabbar-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0.01em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-weight 0.2s ease;
}

.tabbar-item.active .tabbar-label {
  font-weight: 600;
}

@media (min-width: 700px) {
  .tabbar {
    max-width: 480px;
  }
}
</style>
