<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import FeedingForm from '../forms/FeedingForm.vue'
import DiaperForm from '../forms/DiaperForm.vue'
import PumpingForm from '../forms/PumpingForm.vue'
import SleepForm from '../forms/SleepForm.vue'
import GrowthForm from '../forms/GrowthForm.vue'
import SolidFoodForm from '../forms/SolidFoodForm.vue'
import MedicationForm from '../forms/MedicationForm.vue'
import VaccinationForm from '../forms/VaccinationForm.vue'
import TemperatureForm from '../forms/TemperatureForm.vue'
import MilestoneForm from '../forms/MilestoneForm.vue'
import type {
  RecordKind,
  FeedType,
  BreastSide,
  DiaperType,
  DiaperColor,
  DiaperAmount,
  PumpSide,
  VaccinationStatus,
  TemperatureMethod,
  MilestoneType,
} from '@/types'
import type { TimelineEntry } from '@/services/timeline'

/** 各表单编辑 props 结构（与表单组件 props.editing 一致） */
type FeedingFormProps = {
  id: number
  type: FeedType
  side?: BreastSide
  startTime: number
  endTime?: number
  duration?: number
  amount?: number
  notes?: string
}
type DiaperFormProps = {
  id: number
  type: DiaperType
  time: number
  color?: DiaperColor
  amount?: DiaperAmount
  notes?: string
}
type PumpingFormProps = {
  id: number
  side: PumpSide
  startTime: number
  endTime?: number
  duration?: number
  amount?: number
  notes?: string
}
type SleepFormProps = { id: number; startTime: number; endTime: number; notes?: string }
type GrowthFormProps = {
  id: number
  date: number
  weight?: number
  height?: number
  headCircumference?: number
  notes?: string
}
type SolidFoodFormProps = { id: number; time: number; food: string; amount?: string; notes?: string }
type MedicationFormProps = { id: number; time: number; name: string; dose?: string; notes?: string }
type VaccinationFormProps = {
  id: number
  date: number
  name: string
  dose?: string
  status: VaccinationStatus
  notes?: string
}
type TemperatureFormProps = {
  id: number
  time: number
  value: number
  method?: TemperatureMethod
  notes?: string
}
type MilestoneFormProps = { id: number; time: number; type: MilestoneType; notes?: string }

const props = defineProps<{
  state: { kind: RecordKind; editing?: TimelineEntry } | null
}>()
const emit = defineEmits<{ close: []; saved: []; cancelled: []; startRecord: [] }>()

const { t } = useI18n()

/** 编辑回填：原始记录完整透传（避免遗漏字段，如头围），id 以条目为准 */
const payload = computed<(Record<string, unknown> & { id: number }) | undefined>(() => {
  const e = props.state?.editing
  if (!e) return undefined
  return { ...e.raw, id: e.id }
})
</script>

<template>
  <BaseModal
    :show="state !== null"
    :title="state?.editing ? t('log.editTitle') : t('log.addTitle')"
    @close="emit('close')"
  >
    <FeedingForm
      v-if="state?.kind === 'feeding'"
      :editing="state?.editing ? (payload as FeedingFormProps) : undefined"
      @start-record="emit('startRecord')"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <DiaperForm
      v-else-if="state?.kind === 'diaper'"
      :editing="state?.editing ? (payload as DiaperFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <PumpingForm
      v-else-if="state?.kind === 'pumping'"
      :editing="state?.editing ? (payload as PumpingFormProps) : undefined"
      @start-record="emit('startRecord')"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <SleepForm
      v-else-if="state?.kind === 'sleep'"
      :editing="state?.editing ? (payload as SleepFormProps) : undefined"
      @start-record="emit('startRecord')"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <GrowthForm
      v-else-if="state?.kind === 'growth'"
      :editing="state?.editing ? (payload as GrowthFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <SolidFoodForm
      v-else-if="state?.kind === 'solidFood'"
      :editing="state?.editing ? (payload as SolidFoodFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <MedicationForm
      v-else-if="state?.kind === 'medication'"
      :editing="state?.editing ? (payload as MedicationFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <VaccinationForm
      v-else-if="state?.kind === 'vaccination'"
      :editing="state?.editing ? (payload as VaccinationFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <TemperatureForm
      v-else-if="state?.kind === 'temperature'"
      :editing="state?.editing ? (payload as TemperatureFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
    <MilestoneForm
      v-else-if="state?.kind === 'milestone'"
      :editing="state?.editing ? (payload as MilestoneFormProps) : undefined"
      @saved="emit('saved')"
      @cancelled="emit('cancelled')"
    />
  </BaseModal>
</template>
