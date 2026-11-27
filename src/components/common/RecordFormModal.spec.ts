/**
 * 记录表单弹窗分发：按 kind 渲染对应表单、编辑载荷透传、标题随新增/编辑切换、事件透传。
 */
import { describe, it, expect } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import i18n from '@/i18n'
import RecordFormModal from '@/components/common/RecordFormModal.vue'
import type { RecordKind } from '@/types'
import type { TimelineEntry } from '@/services/timeline'

/** kind → 表单组件名（与 RecordFormModal 的 v-if 分支一致） */
const FORM_OF: Record<RecordKind, string> = {
  feeding: 'FeedingForm',
  diaper: 'DiaperForm',
  pumping: 'PumpingForm',
  sleep: 'SleepForm',
  growth: 'GrowthForm',
  solidFood: 'SolidFoodForm',
  medication: 'MedicationForm',
  vaccination: 'VaccinationForm',
  temperature: 'TemperatureForm',
  milestone: 'MilestoneForm',
}

const ALL_FORMS = Object.values(FORM_OF)

function formStub(name: string) {
  return {
    name,
    props: ['editing'],
    emits: ['saved', 'cancelled', 'startRecord'],
    template: `<div data-form="${name}" />`,
  }
}

const stubs = {
  BaseModal: {
    name: 'BaseModal',
    props: ['show', 'title'],
    emits: ['close'],
    template: '<div v-if="show" data-modal :data-title="title"><slot /></div>',
  },
  ...Object.fromEntries(ALL_FORMS.map((n) => [n, formStub(n)])),
}

function mountModal(state: { kind: RecordKind; editing?: TimelineEntry } | null): VueWrapper {
  return mount(RecordFormModal, {
    props: { state },
    global: { plugins: [i18n], stubs },
  })
}

function entry(kind: RecordKind, id = 7): TimelineEntry {
  return {
    id,
    kind,
    time: 1_700_000_000_000,
    icon: '🍼',
    color: '#000',
    kindColor: '#000',
    title: 't',
    detail: 'd',
    raw: { id, babyId: 1, createdAt: 0, updatedAt: 0 } as TimelineEntry['raw'],
  }
}

describe('RecordFormModal', () => {
  it('state 为 null 时不渲染弹窗与表单', () => {
    const wrapper = mountModal(null)
    expect(wrapper.find('[data-modal]').exists()).toBe(false)
    expect(wrapper.find('[data-form]').exists()).toBe(false)
  })

  it.each(Object.keys(FORM_OF) as RecordKind[])('kind=%s 只渲染对应表单', (kind) => {
    const wrapper = mountModal({ kind })
    const forms = wrapper.findAll('[data-form]')
    expect(forms).toHaveLength(1)
    expect(forms[0].attributes('data-form')).toBe(FORM_OF[kind])
  })

  it('新增时标题为「添加记录」', () => {
    const wrapper = mountModal({ kind: 'feeding' })
    expect(wrapper.find('[data-modal]').attributes('data-title')).toBe(i18n.global.t('log.addTitle'))
  })

  it('编辑时标题为「编辑记录」并透传完整编辑载荷', () => {
    const item = entry('growth', 21)
    const wrapper = mountModal({ kind: 'growth', editing: item })
    expect(wrapper.find('[data-modal]').attributes('data-title')).toBe(i18n.global.t('log.editTitle'))

    const form = wrapper.findComponent({ name: 'GrowthForm' })
    expect(form.props('editing')).toEqual({ ...item.raw, id: item.id })
  })

  it('表单事件透传给父组件', async () => {
    const wrapper = mountModal({ kind: 'sleep' })
    const form = wrapper.findComponent({ name: 'SleepForm' })

    form.vm.$emit('saved')
    form.vm.$emit('cancelled')
    form.vm.$emit('startRecord')

    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('cancelled')).toHaveLength(1)
    expect(wrapper.emitted('startRecord')).toHaveLength(1)
  })

  it('弹窗关闭事件透传', () => {
    const wrapper = mountModal({ kind: 'feeding' })
    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('close')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
