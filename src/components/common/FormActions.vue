<script setup lang="ts">
/**
 * 表单操作按钮公共组件：统一「取消 / 保存（或保存修改）」按钮。
 */
import { useI18n } from 'vue-i18n'

defineProps<{ editing?: boolean }>()
defineEmits<{ cancelled: []; save: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="form-actions">
    <button type="button" class="btn btn-outline" @click="$emit('cancelled')">{{ t('common.cancel') }}</button>
    <button type="button" class="btn btn-primary" @click="$emit('save')">
      {{ editing ? t('common.saveEdit') : t('common.save') }}
    </button>
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