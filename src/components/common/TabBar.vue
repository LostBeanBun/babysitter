<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useBabyStore } from '@/stores/baby'
import { APP_TABS } from '@/router/tabs'

const route = useRoute()
const babyStore = useBabyStore()

/** 无宝宝（引导页）时不显示底部导航 */
const showTabbar = computed(() => babyStore.babies.length > 0)
</script>

<template>
  <nav v-if="showTabbar" class="tabbar">
    <RouterLink
      v-for="tab in APP_TABS"
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
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 640px;
  height: calc(var(--tabbar-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--surface-translucent);
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

/* PC/平板：底部导航与内容容器同宽并居中 */
@media (min-width: 700px) {
  .tabbar {
    max-width: 1200px;
  }
}
</style>
