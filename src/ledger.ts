/**
 * In-memory aggregation: fold {@link CallRecord}s into per-model hourly buckets
 * and render {@link UsageSummary} snapshots. Pure — no I/O, no cordis.
 * @module @dsh-usage-meter/usage/ledger
 */

import type { CallRecord, UsageBucket, UsageHour, UsageSummary } from './types.ts'

/** Hour-bucketing timezone. */
export type HourTimezone = 'local' | 'utc'

/**
 * Hour key for a Unix epoch millisecond timestamp.
 * @param time - Unix epoch milliseconds.
 * @param timezone - `local` uses the process timezone, `utc` the UTC hour.
 * @returns `YYYY-MM-DD HH:00`.
 */
export function hourKey(time: number, timezone: HourTimezone): string {
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  if (timezone === 'utc') {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:00`
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00`
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
 * Durable per-model hourly usage. Seeded from persisted records at startup and
 * grown by the live event firehose; `summary()` snapshots the current state.
 */
export class UsageLedger {
  private readonly timezone: HourTimezone
  private readonly hours = new Map<string, Map<string, UsageBucket>>()

  /**
   * @param timezone - hour-bucketing timezone.
   * @param records - seed records (the persisted ledger tail, if any).
   */
  constructor(timezone: HourTimezone, records: readonly CallRecord[] = []) {
    this.timezone = timezone
    for (const record of records) this.record(record)
  }

  /** Fold one call record into the ledger. */
  record(record: CallRecord): void {
    const hour = hourKey(record.time, this.timezone)
    let models = this.hours.get(hour)
    if (models === undefined) {
      models = new Map<string, UsageBucket>()
      this.hours.set(hour, models)
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
    const hours: UsageHour[] = []
    for (const hour of [...this.hours.keys()].sort()) {
      const modelsMap = this.hours.get(hour) as Map<string, UsageBucket>
      const hourModels: Record<string, UsageBucket> = {}
      const hourTotals = zeroBucket()
      for (const model of [...modelsMap.keys()].sort()) {
        const bucket = modelsMap.get(model) as UsageBucket
        models.add(model)
        hourModels[model] = { ...bucket }
        addBucket(hourTotals, bucket)
        addBucket(totals, bucket)
      }
      hours.push({ hour, models: hourModels, totals: hourTotals })
    }
    return {
      generatedAt: Date.now(),
      timezone: this.timezone,
      models: [...models].sort(),
      hours,
      totals,
    }
  }
}
