import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { db, clearBabyData } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import type { Baby } from '@/types'
import { AVATAR_COLORS } from '@/constants'

const t = i18n.global.t
const ACTIVE_BABY_KEY = 'babysitter.activeBabyId'

/** 宝宝资料 store：管理宝宝列表、当前宝宝选择 */
export const useBabyStore = defineStore('baby', () => {
  const { data: babies, loading: babiesLoading } = useLiveQuery(
    () => db.babies.orderBy('createdAt').toArray(),
    [] as Baby[],
  )
  const activeBabyId = ref<number | null>(null)

  // 初始化时从 localStorage 恢复当前宝宝
  const savedId = localStorage.getItem(ACTIVE_BABY_KEY)
  if (savedId) activeBabyId.value = Number(savedId)

  function selectBaby(id: number) {
    activeBabyId.value = id
    localStorage.setItem(ACTIVE_BABY_KEY, String(id))
  }

  // 宝宝列表加载完成时，若当前未选中任何宝宝（或选中的宝宝已不存在），
  // 自动选中第一个宝宝。保证 feeding/diaper/pumping/sleep 等数据 store
  // 能按 activeBabyId 正确过滤；否则 UI 显示回退宝宝但数据全为空。
  watch(babies, (list) => {
    if (!list.length) return
    const found = list.find((b) => b.id === activeBabyId.value)
    if (!found) {
      const first = list[0]
      if (first?.id != null) selectBaby(first.id)
    }
  })

  const activeBaby = computed<Baby | null>(() => {
    if (!babies.value.length) return null
    const found = babies.value.find((b) => b.id === activeBabyId.value)
    // 若当前选择的宝宝不存在（如被删除），回退到第一个
    return found ?? babies.value[0]
  })

  /** 新增宝宝，自动切换为当前宝宝 */
  async function addBaby(
    name: string,
    gender?: Baby['gender'],
    birthDate?: string,
    birthWeight?: number,
    birthHeight?: number,
    avatar?: string,
  ): Promise<number> {
    const id = await db.babies.add({
      name,
      gender,
      birthDate,
      birthWeight,
      birthHeight,
      avatar,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: Date.now(),
    })
    if (id == null) throw new Error(t('errors.addBabyFail'))
    selectBaby(id)
    return id
  }

  async function updateBaby(id: number, patch: Partial<Baby>) {
    await db.babies.update(id, patch)
  }

  async function deleteBaby(id: number) {
    // 清理该宝宝全部业务数据（含成长记录），避免产生孤儿数据
    await clearBabyData(id)
    await db.babies.delete(id)
    if (activeBabyId.value === id) activeBabyId.value = null
  }

  return { babies, babiesLoading, activeBabyId, activeBaby, selectBaby, addBaby, updateBaby, deleteBaby }
})
