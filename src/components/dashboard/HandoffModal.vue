<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '@/components/common/BaseModal.vue'
import { showToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'

const props = defineProps<{
  show: boolean
  text: string
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const canShare = computed(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
)
const busy = ref(false)

async function handleCopy() {
  if (busy.value) return
  busy.value = true
  const ok = await copyText(props.text)
  busy.value = false
  showToast(ok ? t('common.copied') : t('care.copyFail'))
}

async function handleShare() {
  if (busy.value || !canShare.value) return
  busy.value = true
  try {
    await navigator.share({ title: t('care.shareTitle'), text: props.text })
  } catch (e) {
    // 用户主动取消分享时静默退出，不降级复制
    if ((e as Error)?.name !== 'AbortError') {
      const ok = await copyText(props.text)
      showToast(ok ? t('common.copied') : t('care.shareFail'))
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal
    :show="show"
    :title="t('care.handoff')"
    panel-class="handoff-panel"
    @close="emit('close')"
  >
    <pre class="handoff-text" tabindex="0">{{ text }}</pre>
    <div class="handoff-actions">
      <button type="button" class="btn btn-primary" :disabled="busy" @click="handleCopy">
        {{ t('care.copy') }}
      </button>
      <button
        v-if="canShare"
        type="button"
        class="btn btn-outline"
        :disabled="busy"
        @click="handleShare"
      >
        {{ t('care.share') }}
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
/* 交接摘要文字较多：面板用不透明底色，避免无 backdrop-filter 时透出页面文字 */
:global(.handoff-panel) {
  background: var(--bg);
}

.handoff-text {
  margin: 0 0 16px;
  padding: 14px;
  max-height: 48vh;
  overflow: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--fs-13);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.handoff-text:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.handoff-actions {
  display: flex;
  gap: 10px;
}

.handoff-actions .btn {
  flex: 1;
}

@media (max-width: 420px) {
  .handoff-actions {
    flex-direction: column;
  }
}
</style>
