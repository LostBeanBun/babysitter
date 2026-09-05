import { ref } from 'vue'

const sleepModalOpen = ref(false)

export function useSleepModal() {
  return { sleepModalOpen }
}
