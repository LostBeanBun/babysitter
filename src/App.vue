<script setup lang="ts">
import { RouterView } from 'vue-router'
import TabBar from '@/components/common/TabBar.vue'
</script>

<template>
  <div class="app-shell">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <TabBar />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  position: relative;
}
</style>
