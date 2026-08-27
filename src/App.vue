<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import TabBar from '@/components/common/TabBar.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import FloatingTimer from '@/components/common/FloatingTimer.vue'
import { useActiveTimer } from '@/composables/useActiveTimer'
import { useReminderLoop } from '@/composables/useReminderLoop'

// 全局提醒循环：任何路由下每分钟检查提醒并发送系统通知
useReminderLoop()

const router = useRouter()
const activeTimer = useActiveTimer()

/** 悬浮球点击：导航到记录页并打开对应计时表单 */
function openTimerForm() {
  const kind = activeTimer.kind.value
  if (kind) {
    router.push({ path: '/log', query: { timer: kind } })
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

    <!-- 全局悬浮计时球 -->
    <FloatingTimer :active="activeTimer.isActive.value" @open="openTimerForm" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  position: relative;
}
</style>
