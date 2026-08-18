import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { Baby } from '@/types'
import { AVATAR_COLORS } from '@/constants'

const ACTIVE_BABY_KEY = 'babysitter.activeBabyId'

/** 宝宝资料 store：管理宝宝列表、当前宝宝选择 */
export const useBabyStore = defineStore('baby', () => {
  const { data: babies, loading: babiesLoading } = useLiveQuery(() => db.babies.orderBy('createdAt').toArray(), [] as Baby[])
  const activeBabyId = ref<number | null>(null)

  // 初始化时从 localStorage 恢复当前宝宝
  const savedId = localStorage.getItem(ACTIVE_BABY_KEY)
  if (savedId) activeBabyId.value = Number(savedId)

  const activeBaby = computed<Baby | null>(() => {
    if (!babies.value.length) return null
    const found = babies.value.find((b) => b.id === activeBabyId.value)
    // 若当前选择的宝宝不存在（如被删除），回退到第一个
    return found ?? babies.value[0]
  })

  function selectBaby(id: number) {
    activeBabyId.value = id
    localStorage.setItem(ACTIVE_BABY_KEY, String(id))
  }

  /** 新增宝宝，自动切换为当前宝宝 */
  async function addBaby(name: string, gender?: Baby['gender'], birthDate?: string, birthWeight?: number, birthHeight?: number): Promise<number> {
    const id = await db.babies.add({
      name,
      gender,
      birthDate,
      birthWeight,
      birthHeight,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: Date.now(),
    })
    if (id == null) throw new Error('新增宝宝失败')
    selectBaby(id)
    return id
  }

  async function updateBaby(id: number, patch: Partial<Baby>) {
    await db.babies.update(id, patch)
  }

  async function deleteBaby(id: number) {
    await db.transaction('rw', db.babies, db.feedings, db.diapers, db.pumpings, db.sleeps, async () => {
      await db.feedings.where('babyId').equals(id).delete()
      await db.diapers.where('babyId').equals(id).delete()
      await db.pumpings.where('babyId').equals(id).delete()
      await db.sleeps.where('babyId').equals(id).delete()
      await db.babies.delete(id)
    })
    if (activeBabyId.value === id) activeBabyId.value = null
  }

  return { babies, babiesLoading, activeBabyId, activeBaby, selectBaby, addBaby, updateBaby, deleteBaby }
})