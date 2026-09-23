<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '@/components/common/BaseModal.vue'
import { useBabyStore } from '@/stores/baby'
import { BABY_AVATARS } from '@/constants'
import type { BabyGender } from '@/types'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const babyStore = useBabyStore()

const onboardName = ref('')
const onboardGender = ref<BabyGender | ''>('')
const onboardBirthDate = ref('')
const onboardAvatar = ref('')

async function onOnboarded() {
  const name = onboardName.value.trim()
  // 名称/性别/出生日期均为必填（出生日期用于月龄换算与生长曲线参考线）
  if (!name || !onboardBirthDate.value || !onboardGender.value) return
  await babyStore.addBaby(
    name,
    onboardGender.value,
    onboardBirthDate.value,
    undefined,
    undefined,
    onboardAvatar.value || undefined,
  )
  onboardName.value = ''
  onboardGender.value = ''
  onboardBirthDate.value = ''
  onboardAvatar.value = ''
  emit('close')
}
</script>

<template>
  <BaseModal :show="show" :title="t('settings.addBaby')" @close="emit('close')">
    <div class="form-field">
      <label class="form-label">{{ t('settings.babyName') }} *</label>
      <input v-model="onboardName" type="text" :placeholder="t('dashboard.onboardingNamePh')" class="form-input" />
    </div>
    <div class="form-field">
      <label class="form-label">{{ t('settings.birthDate') }} *</label>
      <input v-model="onboardBirthDate" type="date" :placeholder="t('common.selectDate')" class="form-input" />
    </div>
    <div class="form-field">
      <label class="form-label">{{ t('settings.genderLabel') }} *</label>
      <div class="gender-picker" role="radiogroup">
        <button
          type="button"
          class="gender-option"
          :class="{ selected: onboardGender === 'boy' }"
          :aria-checked="onboardGender === 'boy'"
          role="radio"
          @click="onboardGender = 'boy'"
        >
          <span class="gender-emoji">👦</span>{{ t('settings.genderBoy') }}
        </button>
        <button
          type="button"
          class="gender-option"
          :class="{ selected: onboardGender === 'girl' }"
          :aria-checked="onboardGender === 'girl'"
          role="radio"
          @click="onboardGender = 'girl'"
        >
          <span class="gender-emoji">👧</span>{{ t('settings.genderGirl') }}
        </button>
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">{{ t('settings.avatarLabel') }}</label>
      <div class="avatar-picker">
        <button
          v-for="a in BABY_AVATARS"
          :key="a"
          type="button"
          class="avatar-option"
          :class="{ selected: onboardAvatar === a }"
          @click="onboardAvatar = a"
        >
          {{ a }}
        </button>
      </div>
    </div>
    <button
      class="btn btn-primary btn-block btn-lg"
      :disabled="!onboardName.trim() || !onboardBirthDate || !onboardGender"
      @click="onOnboarded"
    >
      {{ t('common.start') }}
    </button>
  </BaseModal>
</template>

<style scoped>
.avatar-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.avatar-option {
  min-height: 40px;
  padding: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s var(--spring);
}

:global([data-theme='dark']) .avatar-option {
  background: rgba(58, 58, 62, 0.7);
}

.avatar-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  transform: scale(1.06);
}

.gender-picker {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.gender-option {
  min-height: 44px;
  padding: 6px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: var(--glass-blur-light);
  -webkit-backdrop-filter: var(--glass-blur-light);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.3s var(--spring);
}

:global([data-theme='dark']) .gender-option {
  background: rgba(58, 58, 62, 0.7);
}

.gender-option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
  transform: scale(1.02);
}

.gender-emoji {
  font-size: 16px;
}
</style>