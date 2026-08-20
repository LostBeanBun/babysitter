<script setup lang="ts">
import { RouterView } from 'vue-router'
import TabBar from '@/components/common/TabBar.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
</script>

<template>
  <div class="app-shell">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <TabBar />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  position: relative;
}
</style>
