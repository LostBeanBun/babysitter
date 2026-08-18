<script setup lang="ts">
import { useBabyStore } from '@/stores/baby'

const babyStore = useBabyStore()
</script>

<template>
  <header class="page-header">
    <div class="header-left">
      <h1 class="header-title">{{ babyStore.activeBaby?.name ?? '宝宝日记' }}</h1>
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
  background: rgba(253, 246, 239, 0.92);
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

.header-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}
</style>