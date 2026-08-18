<script setup lang="ts">
import { ref } from 'vue'
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/format'
import { useGrowthStore } from '@/stores/growth'

const props = defineProps<{
  editing?: {
    id: number
    date: number
    weight?: number
    height?: number
    notes?: string
  }
}>()
const emit = defineEmits<{ saved: []; cancelled: [] }>()

const growthStore = useGrowthStore()

const date = ref(toDateTimeLocal(props.editing?.date ?? Date.now()).slice(0, 10))
const weight = ref<string>(props.editing?.weight != null ? String(props.editing.weight) : '')
const height = ref<string>(props.editing?.height != null ? String(props.editing.height) : '')
const notes = ref(props.editing?.notes ?? '')

async function submit() {
  const d = fromDateTimeLocal(date.value + 'T00:00:00')
  if (d == null || isNaN(d)) {
    alert('请选择测量日期')
    return
  }
  const w = weight.value ? Number(weight.value) : undefined
  const h = height.value ? Number(height.value) : undefined
  if (w !== undefined && (isNaN(w) || w <= 0)) {
    alert('请输入有效的体重（kg）')
    return
  }
  if (h !== undefined && (isNaN(h) || h <= 0)) {
    alert('请输入有效的身高（cm）')
    return
  }
  if (w === undefined && h === undefined) {
    alert('请至少填写体重或身高')
    return
  }

  if (props.editing) {
    await growthStore.update(props.editing.id, {
      date: d,
      weight: w,
      height: h,
      notes: notes.value || undefined,
    })
  } else {
    await growthStore.add({ date: d, weight: w, height: h, notes: notes.value || undefined })
  }
  emit('saved')
}
</script>

<template>
  <div class="growth-form">
    <div class="form-field">
      <label class="form-label">测量日期</label>
      <input v-model="date" type="date" class="form-input" />
    </div>

    <div class="form-field">
      <label class="form-label">体重（kg）</label>
      <input v-model="weight" type="number" min="0" step="0.1" placeholder="例如 7.5" class="form-input" inputmode="decimal" />
    </div>

    <div class="form-field">
      <label class="form-label">身高（cm）</label>
      <input v-model="height" type="number" min="0" step="0.5" placeholder="例如 68" class="form-input" inputmode="decimal" />
    </div>

    <div class="form-field">
      <label class="form-label">备注</label>
      <input v-model="notes" type="text" placeholder="可选" class="form-input" />
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-outline" @click="emit('cancelled')">取消</button>
      <button type="button" class="btn btn-primary" @click="submit">{{ props.editing ? '保存修改' : '保存记录' }}</button>
    </div>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.form-actions .btn {
  flex: 1;
}
</style>