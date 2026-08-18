<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useBabyStore } from '@/stores/baby'

const route = useRoute()
const babyStore = useBabyStore()

const tabs = [
  { name: 'dashboard', path: '/', label: '今日', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
  { name: 'log', path: '/log', label: '记录', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' },
  { name: 'stats', path: '/stats', label: '统计', icon: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z' },
  { name: 'settings', path: '/settings', label: '设置', icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' },
]

const showTabbar = computed(() => babyStore.babies.length > 0)
</script>

<template>
  <div class="app-shell">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <nav v-if="showTabbar" class="tabbar">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.path"
        class="tabbar-item"
        :class="{ active: route.name === tab.name }"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" class="tabbar-icon" aria-hidden="true">
          <path :d="tab.icon" />
        </svg>
        <span class="tabbar-label">{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  position: relative;
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 640px;
  height: calc(var(--tabbar-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
  display: flex;
  z-index: 50;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.tabbar-item.active {
  color: var(--primary);
}

.tabbar-icon {
  width: 24px;
  height: 24px;
}

.tabbar-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
