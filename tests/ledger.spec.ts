import { describe, expect, it } from 'vitest'
import type { CallRecord } from '../src/types.ts'
import { addRecord, hourKey, UsageLedger, zeroBucket } from '../src/ledger.ts'

function record(time: number, model: string, overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    time,
    session: 's',
    provider: 'p',
    model,
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...overrides,
  }
}

describe('hourKey', () => {
  it('buckets by UTC hour', () => {
    // 2026-08-13T16:45:00Z — a timestamp whose local representation differs by
    // timezone, so the assertion pins the UTC behavior exactly.
    expect(hourKey(Date.UTC(2026, 7, 13, 16, 45, 0), 'utc')).toBe('2026-08-13 16:00')
  })

  it('buckets by local hour with zero padding', () => {
    const time = new Date(2026, 0, 5, 9, 30, 0).getTime()
    expect(hourKey(time, 'local')).toBe('2026-01-05 09:00')
  })
})

describe('UsageLedger', () => {
  it('aggregates per model per hour and sums billed tokens', () => {
    const ledger = new UsageLedger('utc', [
      record(Date.UTC(2026, 7, 13, 10, 20), 'flash', {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 30,
      }),
      record(Date.UTC(2026, 7, 13, 10, 50), 'flash', { inputTokens: 10, outputTokens: 5 }),
      record(Date.UTC(2026, 7, 14, 10, 10), 'reasoner', { inputTokens: 50, outputTokens: 9 }),
    ])
    const summary = ledger.summary()
    expect(summary.models).toEqual(['flash', 'reasoner'])
    expect(summary.hours.map(hour => hour.hour)).toEqual(['2026-08-13 10:00', '2026-08-14 10:00'])
    const first = summary.hours[0]
    expect(first?.models.flash).toEqual({
      calls: 2,
      inputTokens: 110,
      outputTokens: 25,
      cacheReadTokens: 30,
      cacheWriteTokens: 0,
      // 100 + 30 (cache read) + 10 — cached input is billed at its own rate.
      billedTokens: 140,
    })
    expect(first?.totals.calls).toBe(2)
    expect(summary.totals).toEqual({
      calls: 3,
      inputTokens: 160,
      outputTokens: 34,
      cacheReadTokens: 30,
      cacheWriteTokens: 0,
      billedTokens: 190,
    })
  })

  it('keeps records in distinct hours apart', () => {
    const ledger = new UsageLedger('utc', [
      record(Date.UTC(2026, 7, 13, 10, 59), 'flash'),
      record(Date.UTC(2026, 7, 13, 11, 0), 'flash'),
    ])
    const summary = ledger.summary()
    expect(summary.hours).toHaveLength(2)
    expect(summary.hours[0]?.models.flash?.calls).toBe(1)
    expect(summary.hours[1]?.models.flash?.calls).toBe(1)
  })

  it('seeds from records and continues folding', () => {
    const ledger = new UsageLedger('utc', [record(1, 'm', { inputTokens: 5, outputTokens: 2 })])
    ledger.record(record(1, 'm', { inputTokens: 3, outputTokens: 1 }))
    expect(ledger.summary().totals).toMatchObject({ calls: 2, inputTokens: 8, outputTokens: 3 })
  })

  it('addRecord folds billed tokens as input plus cache traffic', () => {
    const bucket = zeroBucket()
    addRecord(bucket, record(1, 'm', {
      inputTokens: 4,
      outputTokens: 1,
      cacheReadTokens: 6,
      cacheWriteTokens: 2,
    }))
    expect(bucket).toEqual({
      calls: 1,
      inputTokens: 4,
      outputTokens: 1,
      cacheReadTokens: 6,
      cacheWriteTokens: 2,
      billedTokens: 12,
    })
  })
})
