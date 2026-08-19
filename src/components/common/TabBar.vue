<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBabyStore } from '@/stores/baby'
import { APP_TABS } from '@/router/tabs'

const route = useRoute()
const babyStore = useBabyStore()
const { t } = useI18n()

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
      <span class="tabbar-label">{{ t(tab.label) }}</span>
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
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 16px rgba(61, 48, 41, 0.04);
  display: flex;
  z-index: 50;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 16px;
  margin: 6px 8px;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    transform 0.12s ease;
  min-height: 0;
}

.tabbar-item:active {
  transform: scale(0.94);
}

.tabbar-item.active {
  color: var(--primary-dark);
  background: var(--primary-soft);
}

.tabbar-icon {
  width: 23px;
  height: 23px;
  transition: transform 0.18s ease;
}

.tabbar-item.active .tabbar-icon {
  transform: translateY(-1px) scale(1.05);
}

.tabbar-label {
  font-size: 10.5px;
  font-weight: 600;
}

/* PC/平板：底部导航与内容容器同宽并居中 */
@media (min-width: 700px) {
  .tabbar {
    max-width: 1200px;
  }
}
</style>
