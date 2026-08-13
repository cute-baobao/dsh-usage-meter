/**
 * In-memory aggregation: fold {@link CallRecord}s into per-model daily buckets
 * and render {@link UsageSummary} snapshots. Pure — no I/O, no cordis.
 * @module @dsh-usage-meter/usage-host/ledger
 */

import type { CallRecord, UsageBucket, UsageDay, UsageSummary } from './types.ts'

/** Day-bucketing timezone. */
export type DayTimezone = 'local' | 'utc'

/**
 * Calendar day key for a Unix epoch millisecond timestamp.
 * @param time - Unix epoch milliseconds.
 * @param timezone - `local` uses the process timezone, `utc` the UTC date.
 * @returns `YYYY-MM-DD`.
 */
export function dayKey(time: number, timezone: DayTimezone): string {
  if (timezone === 'utc') return new Date(time).toISOString().slice(0, 10)
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** An empty bucket; mutate with {@link addRecord}. */
export function zeroBucket(): UsageBucket {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    billedTokens: 0,
  }
}

/** Fold one call record into a bucket, mutating it in place. */
export function addRecord(bucket: UsageBucket, record: CallRecord): void {
  bucket.calls += 1
  bucket.inputTokens += record.inputTokens
  bucket.outputTokens += record.outputTokens
  bucket.cacheReadTokens += record.cacheReadTokens
  bucket.cacheWriteTokens += record.cacheWriteTokens
  bucket.billedTokens += record.inputTokens + record.cacheReadTokens + record.cacheWriteTokens
}

/** Accumulate `source` into `target`, mutating `target` in place. */
export function addBucket(target: UsageBucket, source: UsageBucket): void {
  target.calls += source.calls
  target.inputTokens += source.inputTokens
  target.outputTokens += source.outputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.billedTokens += source.billedTokens
}

/**
 * Durable per-model daily usage. Seeded from persisted records at startup and
 * grown by the live event firehose; `summary()` snapshots the current state.
 */
export class UsageLedger {
  private readonly timezone: DayTimezone
  private readonly days = new Map<string, Map<string, UsageBucket>>()

  /**
   * @param timezone - day-bucketing timezone.
   * @param records - seed records (the persisted ledger tail, if any).
   */
  constructor(timezone: DayTimezone, records: readonly CallRecord[] = []) {
    this.timezone = timezone
    for (const record of records) this.record(record)
  }

  /** Fold one call record into the ledger. */
  record(record: CallRecord): void {
    const date = dayKey(record.time, this.timezone)
    let models = this.days.get(date)
    if (models === undefined) {
      models = new Map<string, UsageBucket>()
      this.days.set(date, models)
    }
    let bucket = models.get(record.model)
    if (bucket === undefined) {
      bucket = zeroBucket()
      models.set(record.model, bucket)
    }
    addRecord(bucket, record)
  }

  /** Snapshot the complete ledger as a summary. */
  summary(): UsageSummary {
    const models = new Set<string>()
    const totals = zeroBucket()
    const days: UsageDay[] = []
    for (const date of [...this.days.keys()].sort()) {
      const modelsMap = this.days.get(date) as Map<string, UsageBucket>
      const dayModels: Record<string, UsageBucket> = {}
      const dayTotals = zeroBucket()
      for (const model of [...modelsMap.keys()].sort()) {
        const bucket = modelsMap.get(model) as UsageBucket
        models.add(model)
        dayModels[model] = { ...bucket }
        addBucket(dayTotals, bucket)
        addBucket(totals, bucket)
      }
      days.push({ date, models: dayModels, totals: dayTotals })
    }
    return {
      generatedAt: Date.now(),
      timezone: this.timezone,
      models: [...models].sort(),
      days,
      totals,
    }
  }
}
