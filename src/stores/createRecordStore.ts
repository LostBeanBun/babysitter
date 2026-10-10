import { storeToRefs } from 'pinia'
import { db, type BabySitterDB } from '@/db'
import i18n from '@/i18n'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useBabyStore } from '@/stores/baby'
import type { BaseRecord } from '@/types'

const t = i18n.global.t

/** 记录表的最小结构类型（避开 Dexie 泛型主键约束） */
interface RecordTable<T> {
  add(item: T): Promise<number>
  get(id: number): Promise<T | undefined>
  update(id: number, patch: Partial<Record<string, unknown>>): Promise<number>
  delete(id: number): Promise<void>
  where(index: string): {
    between(low: unknown[], high: unknown[]): { toArray(): Promise<T[]> }
  }
}

/** 新增入参：记录类型去掉 id/babyId/createdAt/updatedAt（duration 由工厂派生） */
export type RecordAddInput<T> = Omit<T, 'id' | 'babyId' | 'createdAt' | 'updatedAt' | 'duration'>

export interface RecordStoreOptions<T extends BaseRecord> {
  /** Dexie 表名 */
  tableName: keyof BabySitterDB
  /** 复合索引 [babyId+timeField] 的时间字段名 */
  timeField: 'startTime' | 'time' | 'date'
  /** 新增失败的 i18n key，默认 errors.addRecordFail */
  addFailKey?: string
  /** 是否从 startTime/endTime 派生 duration（喂养/吸奶/睡眠） */
  withDuration?: boolean
  /** 落库前校验（抛错即失败，如睡眠结束时间校验） */
  validate?: (input: RecordAddInput<T>) => void
  /** 落库前归一化（如成长/疫苗的 date 归一到当天 0 点） */
  normalize?: (input: RecordAddInput<T>) => RecordAddInput<T>
}

function calcDuration(startTime?: number, endTime?: number): number | undefined {
  return endTime != null && startTime != null && endTime > startTime ? endTime - startTime : undefined
}

/**
 * 按宝宝维度的记录 CRUD Store 工厂：
 * 封装 liveQuery 查询、activeBabyId 校验、createdAt/updatedAt 时间戳、
 * update/remove，以及可选的 duration 派生与归一化。
 */
export function useRecordStore<T extends BaseRecord>(opts: RecordStoreOptions<T>) {
  const { activeBabyId } = storeToRefs(useBabyStore())
  const table = db[opts.tableName] as unknown as RecordTable<T>

  const { data: records, loading, error } = useLiveQuery(
    () => {
      const babyId = activeBabyId.value
      if (babyId == null) return Promise.resolve([] as T[])
      return table
        .where(`[babyId+${opts.timeField}]`)
        .between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER])
        .toArray()
        .then((rows) => rows.filter(Boolean))
    },
    [] as T[],
    [activeBabyId],
  )

  async function add(input: RecordAddInput<T>): Promise<number> {
    const babyId = activeBabyId.value
    if (babyId == null) throw new Error(t('errors.noBaby'))
    opts.validate?.(input)
    const data = opts.normalize ? opts.normalize(input) : input
    const now = Date.now()
    const row = { ...data, babyId, createdAt: now, updatedAt: now } as T
    if (opts.withDuration) {
      const rec = row as { startTime?: number; endTime?: number; duration?: number }
      rec.duration = calcDuration(rec.startTime, rec.endTime)
    }
    const id = await table.add(row)
    if (id == null) throw new Error(t(opts.addFailKey ?? 'errors.addRecordFail'))
    return id
  }

  /** 更新记录；涉及 startTime/endTime 时自动重算 duration */
  async function update(id: number, patch: Partial<T>) {
    const next: Partial<T> = { ...patch, updatedAt: Date.now() }
    if (opts.withDuration && ('startTime' in patch || 'endTime' in patch)) {
      const cur = await table.get(id)
      if (cur) {
        const curRec = cur as { startTime?: number; endTime?: number }
        const patchRec = patch as { startTime?: number; endTime?: number }
        const startTime = patchRec.startTime ?? curRec.startTime
        const endTime = patchRec.endTime ?? curRec.endTime
        ;(next as { duration?: number }).duration = calcDuration(startTime, endTime)
      }
    }
    await table.update(id, next as Partial<Record<string, unknown>>)
  }

  async function remove(id: number) {
    await table.delete(id)
  }

  return { records, loading, add, update, remove, error }
}
