<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

/** 数字滚动：值变化时从上一显示值缓动到目标（挂载时从 0 滚入；reduced-motion 下直接显示） */
const props = defineProps<{
  value: number
  format: (n: number) => string
}>()

const display = ref(0)
let raf = 0

function tween(to: number): void {
  cancelAnimationFrame(raf)
  const from = display.value
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    display.value = to
    return
  }
  const start = performance.now()
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / 600)
    const eased = 1 - Math.pow(1 - t, 3)
    display.value = from + (to - from) * eased
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

watch(() => props.value, (v) => tween(v), { immediate: true })
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <span>{{ format(display) }}</span>
</template>
