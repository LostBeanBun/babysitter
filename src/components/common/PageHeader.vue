<script setup lang="ts">
import { useBabyStore } from '@/stores/baby'

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
    <slot name="right" />
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

/* PC/平板：页头铺满全屏 */
@media (min-width: 700px) {
  .page-header {
    max-width: none;
    padding-left: 32px;
    padding-right: 32px;
  }
}
</style>