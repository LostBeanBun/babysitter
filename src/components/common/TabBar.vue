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
  <nav v-if="showTabbar" class="tabbar">
    <RouterLink v-for="tab in APP_TABS" :key="tab.name" :to="tab.path" class="tabbar-item"
      :class="{ active: route.name === tab.name }">
      <div class="tabbar-pill">
        <svg viewBox="0 0 24 24" fill="currentColor" class="tabbar-icon" aria-hidden="true">
          <path :d="tab.icon" />
        </svg>
      </div>
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
  backdrop-filter: var(--glass-blur-heavy);
  -webkit-backdrop-filter: var(--glass-blur-heavy);
  border-top: 1px solid var(--glass-border);
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.04), inset 0 1px 0 var(--glass-shine);
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
  margin: 6px 6px;
  transition: color 0.2s ease;
  min-height: 0;
}

.tabbar-pill {
  width: 48px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition:
    background 0.3s var(--ease-out),
    transform 0.3s var(--spring);
}

.tabbar-item:active .tabbar-pill {
  transform: scale(0.92);
}

.tabbar-item.active {
  color: var(--primary);
}

.tabbar-item.active .tabbar-pill {
  background: var(--primary-soft);
}

.tabbar-icon {
  width: 22px;
  height: 22px;
  transition: transform 0.3s var(--spring);
}

.tabbar-item.active .tabbar-icon {
  transform: scale(1.08);
}

.tabbar-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

@media (min-width: 700px) {
  .tabbar {
    max-width: 1200px;
  }
}
</style>
