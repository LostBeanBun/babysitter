import { describe, it, expect, vi, beforeEach } from 'vitest'
import { csvEscape, toCsv, buildBabyCsvRows, exportBabyCsvs, exportAllBabiesCsv, parseCsv, importAllCsv, type BabyCsvData } from '@/services/export'
import type { Feeding, Baby } from '@/types'

const { mockDb, downloadSpy } = vi.hoisted(() => {
  const makeTable = () => ({
    toArray: vi.fn<() => Promise<unknown[]>>(async () => []),
    where: vi.fn<(table: string) => { equals: (id: number) => { sortBy: (key: string) => Promise<unknown[]> } }>(() => ({
      equals: () => ({ sortBy: async () => [] }),
    })),
    clear: vi.fn<() => Promise<void>>(async () => {}),
    bulkAdd: vi.fn<(items: unknown[]) => Promise<void>>(async () => {}),
    add: vi.fn<() => Promise<number>>(async () => 1),
  })
  const mockDb = {
    babies: makeTable(),
    feedings: makeTable(),
    diapers: makeTable(),
    pumpings: makeTable(),
    sleeps: makeTable(),
    growths: makeTable(),
    solidFoods: makeTable(),
    medications: makeTable(),
    vaccinations: makeTable(),
    temperatures: makeTable(),
    milestones: makeTable(),
    transaction: vi.fn(async (_mode: string, _tables: any[], callback: Function) => {
      return await callback()
    }),
  }
  const downloadSpy = vi.fn()
  return { mockDb, downloadSpy }
})

vi.mock('@/db', () => ({ db: mockDb, DB_VERSION: 4 }))
vi.mock('@/i18n', () => ({
  default: {
    t: (key: string) => key,
    language: 'zh-CN',
    changeLanguage: async () => {},
    on: () => {},
    off: () => {},
  },
}))
vi.mock('@/utils/format', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/format')>()
  return { ...actual, downloadBlob: downloadSpy }
})

function makeFeeding(partial: Partial<Feeding>): Feeding {
  return {
    babyId: 1,
    type: 'bottle_formula',
    startTime: new Date(2026, 0, 1, 8, 0).getTime(),
    amount: 120,
    createdAt: 0,
    updatedAt: 0,
    notes: '含逗号, 与"引号"',
    ...partial,
  }
}

function makeBaby(partial: Partial<Baby>): Baby {
  return {
    id: 1,
    name: '小糯米',
    gender: 'girl',
    birthDate: '2026-01-01',
    avatarColor: '#FFF',
    createdAt: 0,
    ...partial,
  }
}

/** 读取最后一次下载的内容（downloadBlob 第一参数为 string 或 Blob） */
async function lastDownloadText(): Promise<string> {
  const [content] = downloadSpy.mock.calls[0]
  return typeof content === 'string' ? content : await content.text()
}

describe('csvEscape', () => {
  it('普通值原样输出', () => {
    expect(csvEscape('abc')).toBe('abc')
    expect(csvEscape(120)).toBe('120')
  })
  it('null/undefined 输出空串', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })
  it('含逗号/引号/换行时包裹引号并转义', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
    expect(csvEscape('a\nb')).toBe('"a\nb"')
  })
})

describe('toCsv', () => {
  it('多行 CRLF 拼接', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(csv).toBe('a,b\r\nc,d')
  })
  it('混合类型与转义', () => {
    const csv = toCsv([
      [1, 'x,y'],
      [null, 'z'],
    ])
    expect(csv).toBe('1,"x,y"\r\n,z')
  })
})

describe('buildBabyCsvRows', () => {
  const data: BabyCsvData = {
    feedings: [makeFeeding({})],
    diapers: [],
    pumpings: [],
    sleeps: [],
    growths: [],
    solidFoods: [],
    medications: [],
    vaccinations: [],
    temperatures: [],
    milestones: [],
  }

  it('生成记录行并保留全部字段', () => {
    const rows = buildBabyCsvRows(data)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toHaveLength(10)
    // 数据行使用当前语言标签
    expect(row[0]).toBe('喂养')
    expect(row[1]).toBe('2026-01-01')
    expect(row[2]).toBe('08:00')
    expect(row[6]).toBe('120 ml')
  })

  it('备注含逗号/引号时经 toCsv 正确转义', () => {
    const csv = toCsv([buildBabyCsvRows(data)[0]])
    expect(csv).toContain('"含逗号, 与""引号"""')
  })

  it('提供 babyName 时首列插入宝宝名', () => {
    const rows = buildBabyCsvRows(data, '小糯米')
    expect(rows[0][0]).toBe('小糯米')
    expect(rows[0]).toHaveLength(11)
    const anonymous = buildBabyCsvRows(data)
    expect(anonymous[0]).toHaveLength(10)
  })
})

describe('exportBabyCsvs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.feedings.where.mockReturnValue({
      equals: () => ({ sortBy: async () => [makeFeeding({})] }),
    })
  })

  it('按宝宝导出时查询该宝宝数据并下载 CSV', async () => {
    await exportBabyCsvs(makeBaby({ id: 7 }))
    expect(mockDb.feedings.where).toHaveBeenCalledWith('babyId')
    expect(downloadSpy).toHaveBeenCalledTimes(1)
    const [, filename, type] = downloadSpy.mock.calls[0]
    expect(filename).toContain('exportCsv.allFileName')
    expect(type).toBe('text/csv;charset=utf-8')
    const text = await lastDownloadText()
    expect(text.startsWith('\ufeff')).toBe(true)
    // 表头使用本地化键
    expect(text).toContain('exportCsv.recordType')
    // 数据行使用当前语言标签
    expect(text).toContain('喂养')
  })
})

describe('exportAllBabiesCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.babies.toArray.mockResolvedValue([
      makeBaby({ id: 1, name: '大宝' }),
      makeBaby({ id: 2, name: '二宝' }),
    ])
    mockDb.feedings.where.mockReturnValue({
      equals: () => ({
        sortBy: async () => [makeFeeding({ babyId: 1 }), makeFeeding({ babyId: 2 })],
      }),
    })
    mockDb.diapers.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.pumpings.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.sleeps.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.growths.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.solidFoods.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.medications.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.vaccinations.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.temperatures.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
    mockDb.milestones.where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
  })

  it('合并所有宝宝为单个 CSV，首列为宝宝名', async () => {
    await exportAllBabiesCsv()
    expect(mockDb.babies.toArray).toHaveBeenCalled()
    expect(downloadSpy).toHaveBeenCalledTimes(1)
    const [, filename, type] = downloadSpy.mock.calls[0]
    expect(filename).toContain('exportCsv.allBabiesFileName')
    expect(type).toBe('text/csv;charset=utf-8')
    const text = await lastDownloadText()
    // 表头含宝宝名列
    expect(text).toContain('exportCsv.babyName')
    // 两个宝宝的数据行各自带宝宝名
    expect(text).toContain('大宝')
    expect(text).toContain('二宝')
    const lines = text.split('\r\n')
    // 表头 + 2 个宝宝 × 2 条喂养
    expect(lines.length).toBe(5)
  })

  it('无宝宝时仅输出表头', async () => {
    mockDb.babies.toArray.mockResolvedValue([])
    await exportAllBabiesCsv()
    const text = await lastDownloadText()
    const lines = text.split('\r\n')
    expect(lines.length).toBe(1)
  })
})

describe('parseCsv', () => {
  it('解析简单 CSV', () => {
    const rows = parseCsv('a,b,c\r\n1,2,3')
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('处理 BOM', () => {
    const rows = parseCsv('\ufeffa,b\r\n1,2')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('处理引号转义', () => {
    const rows = parseCsv('a,b\r\n"hello, world","a""b"')
    expect(rows).toEqual([['a', 'b'], ['hello, world', 'a"b']])
  })

  it('处理字段内换行', () => {
    const rows = parseCsv('a,b\r\n"line1\nline2",c')
    expect(rows).toEqual([['a', 'b'], ['line1\nline2', 'c']])
  })

  it('处理 \\r\\n 和 \\n 混合', () => {
    const rows = parseCsv('a,b\n1,2\r\n3,4')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('跳过末尾空行', () => {
    const rows = parseCsv('a,b\n1,2\n\n')
    // 新行为：末尾空行被跳过，不产生额外空行
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('importAllCsv', () => {
  beforeEach(() => {
    // 手动重置所需 mock，避免 clearAllMocks 影响 transaction 等共享 mock
    vi.clearAllMocks()
    // 为所有表配置空返回
    const tables = ['babies', 'feedings', 'diapers', 'pumpings', 'sleeps', 'growths', 'solidFoods', 'medications', 'vaccinations', 'temperatures', 'milestones']
    for (const t of tables) {
      ;(mockDb as Record<string, any>)[t].where.mockReturnValue({ equals: () => ({ sortBy: async () => [] }) })
      ;(mockDb as Record<string, any>)[t].clear.mockResolvedValue(undefined)
      ;(mockDb as Record<string, any>)[t].bulkAdd.mockResolvedValue(undefined)
    }
    // babies 表额外需要 add 方法（用于导入时创建宝宝）
    mockDb.babies.add = vi.fn().mockImplementation(async (b) => b.id || 1)
    // transaction mock 会被 clearAllMocks 清除，需重新设置
    mockDb.transaction = vi.fn(async (_mode: string, _tables: any[], callback: Function) => {
      return await callback()
    })
    // downloadSpy 也需要重置
    downloadSpy.mockClear()
  })

  it('仅表头无数据抛出错误', async () => {
    const csv = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const file = new File([csv], 'empty.csv', { type: 'text/csv' })
    await expect(importAllCsv(file)).rejects.toThrow('exportCsv.invalidFile')
  })

  it('导出→导入往返：喂养字段还原', async () => {
    // 构造与导出格式一致的 CSV（mock i18n 下 t 返回 key，标签用 zh 硬编码 + 内部键值双兼容）
    const headers = [
      'exportCsv.recordType',
      'exportCsv.date',
      'exportCsv.time',
      'exportCsv.endDate',
      'exportCsv.endTime',
      'exportCsv.item',
      'exportCsv.value',
      'exportCsv.duration',
      'exportCsv.status',
      'exportCsv.notes',
    ].join(',')
    // recordType 用内部键值 feeding；item 用内部键值 bottle_formula
    const row = ['feeding', '2026-01-01', '08:00', '', '', 'bottle_formula', '120 ml', '30', '', '备注1'].join(',')
    const csv = `${headers}\r\n${row}`
    const file = new File([csv], 'roundtrip.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.feedings).toBe(1)
    expect(mockDb.feedings.bulkAdd).toHaveBeenCalledTimes(1)
    const added = (mockDb.feedings.bulkAdd as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(added.amount).toBe(120)
    expect(added.type).toBe('bottle_formula')
    expect(added.notes).toBe('备注1')
    expect(added.babyId).toBe(1)
  })

  it('喂养 breast·left 与旧格式 breast_both 均可解析', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const csv = [
      headers,
      ['feeding', '2026-01-01', '08:00', '', '', 'breast·left', '', '', '', ''].join(','),
      ['feeding', '2026-01-01', '09:00', '', '', 'breast_both', '', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'feed.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.feedings).toBe(2)
    const calls = (mockDb.feedings.bulkAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(calls[0].type).toBe('breast')
    expect(calls[0].side).toBe('left')
    expect(calls[1].type).toBe('breast')
    expect(calls[1].side).toBe('both')
  })

  it('成长记录解析 weight/height/头围', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const csv = [
      headers,
      ['growth', '2026-01-01', '', '', '', '', '8.5 kg · 70.2 cm · 44 cm', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'growth.csv', { type: 'text/csv' })
    await importAllCsv(file)
    const added = (mockDb.growths.bulkAdd as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(added.weight).toBe(8.5)
    expect(added.height).toBe(70.2)
    expect(added.headCircumference).toBe(44)
  })

  it('疫苗状态中英与内部键值均可解析', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const csv = [
      headers,
      ['vaccination', '2026-01-01', '', '', '', '乙肝疫苗', '第 1 剂', '', '已接种', ''].join(','),
      ['vaccination', '2026-01-02', '', '', '', '百白破', '', '', 'Planned', ''].join(','),
      ['vaccination', '2026-01-03', '', '', '', '脊灰', '', '', '未知', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'vac.csv', { type: 'text/csv' })
    await importAllCsv(file)
    const calls = (mockDb.vaccinations.bulkAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(calls[0].status).toBe('done')
    expect(calls[1].status).toBe('planned')
    expect(calls[2].status).toBe('planned') // 未知 → planned
  })

  it('英文表头 Baby 识别宝宝名列', async () => {
    const headers = [
      'Baby',
      'exportCsv.recordType',
      'exportCsv.date',
      'exportCsv.time',
      'exportCsv.endDate',
      'exportCsv.endTime',
      'exportCsv.item',
      'exportCsv.value',
      'exportCsv.duration',
      'exportCsv.status',
      'exportCsv.notes',
    ].join(',')
    const csv = [
      headers,
      ['小明', 'feeding', '2026-01-01', '08:00', '', '', 'bottle_formula', '100 ml', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'en.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.babies).toBe(1)
    expect(mockDb.babies.add).toHaveBeenCalledWith(expect.objectContaining({ name: '小明' }))
    expect(result.feedings).toBe(1)
  })

  it('中文表头「宝宝」识别宝宝名列（跨语言导出头）', async () => {
    const headers = [
      '宝宝',
      'exportCsv.recordType',
      'exportCsv.date',
      'exportCsv.time',
      'exportCsv.endDate',
      'exportCsv.endTime',
      'exportCsv.item',
      'exportCsv.value',
      'exportCsv.duration',
      'exportCsv.status',
      'exportCsv.notes',
    ].join(',')
    const csv = [
      headers,
      ['糯米', 'feeding', '2026-01-01', '08:00', '', '', 'bottle_formula', '100 ml', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'zh.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.babies).toBe(1)
    expect(mockDb.babies.add).toHaveBeenCalledWith(expect.objectContaining({ name: '糯米' }))
  })

  it('未知记录类型行被跳过、不中断导入', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const csv = [
      headers,
      ['not_a_type', '2026-01-01', '08:00', '', '', 'x', '', '', '', ''].join(','),
      ['feeding', '2026-01-01', '08:00', '', '', 'bottle_formula', '120 ml', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'mixed.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.feedings).toBe(1)
  })

  it('date/time 为空的行被丢弃', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    const csv = [
      headers,
      ['feeding', '', '', '', '', 'bottle_formula', '120 ml', '', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'nodate.csv', { type: 'text/csv' })
    const result = await importAllCsv(file)
    expect(result.feedings).toBe(0)
  })

  it('睡眠 duration 按分钟导出后回导（单位正确）', async () => {
    const headers = 'exportCsv.recordType,exportCsv.date,exportCsv.time,exportCsv.endDate,exportCsv.endTime,exportCsv.item,exportCsv.value,exportCsv.duration,exportCsv.status,exportCsv.notes'
    // 2 小时睡眠 → 导出分钟数 120
    const csv = [
      headers,
      ['sleep', '2026-01-01', '20:00', '2026-01-01', '22:00', 'nap', '', '120', '', ''].join(','),
    ].join('\r\n')
    const file = new File([csv], 'sleep.csv', { type: 'text/csv' })
    await importAllCsv(file)
    const added = (mockDb.sleeps.bulkAdd as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(added.endTime - added.startTime).toBe(2 * 3600_000)
  })
})