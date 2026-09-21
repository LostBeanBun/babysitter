<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import TabBar from '@/components/common/TabBar.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import FloatingTimer from '@/components/common/FloatingTimer.vue'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useReminderLoop } from '@/composables/useReminderLoop'

useReminderLoop()

const router = useRouter()
const activeTimer = useActiveTimer()

function openTimerForm(timerId: string) {
  const entry = activeTimer.getById(timerId)
  if (entry) {
    router.push({ path: '/log', query: { timer: entry.kind } })
  }
}
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

    <FloatingTimer :active="activeTimer.isActive.value" @open="openTimerForm" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  position: relative;
}
</style>
