/**
 * Wire vocabulary shared by the host recorder and the browser dashboard.
 * Counts are DISJOINT (matching `TokenUsage` in @deepseek-ai/dsh-llm):
 * `inputTokens` is uncached input only; cached input is reported separately.
 * DeepSeek bills `input + cacheRead + cacheWrite`, reported as `billedTokens`.
 * @module @dsh-usage-meter/usage-host/types
 */

/** One completed model call recorded from an `assistant/message` usage sample. */
export interface CallRecord {
  /** Unix epoch milliseconds of the assembled message. */
  time: number
  /** Session id that produced the call. */
  session: string
  /** Provider route that served the call (from the latest `request/header`). */
  provider: string
  /** Model id that served the call (from the latest `request/header`). */
  model: string
  /** Uncached input tokens. */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Cache-hit (cache-read) tokens. */
  cacheReadTokens: number
  /** Cache-write tokens (DeepSeek does not currently report these). */
  cacheWriteTokens: number
}

/** Aggregated token figures for one model within one day (or a whole span). */
export interface UsageBucket {
  /** Number of recorded calls. */
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** inputTokens + cacheReadTokens + cacheWriteTokens. */
  billedTokens: number
}

/** One calendar day's per-model buckets plus the day total. */
export interface UsageDay {
  /** Local or UTC calendar date, `YYYY-MM-DD`, per the configured timezone. */
  date: string
  /** Per-model buckets, keyed by model id, sorted ascending. */
  models: Record<string, UsageBucket>
  /** Sum over every model of that day. */
  totals: UsageBucket
}

/** Complete snapshot served by the `usage-meter/summary` remote method. */
export interface UsageSummary {
  /** Snapshot timestamp (Unix epoch milliseconds). */
  generatedAt: number
  /** Day-bucketing timezone. */
  timezone: 'local' | 'utc'
  /** Distinct model ids seen, sorted ascending. */
  models: string[]
  /** Days ascending by date. */
  days: UsageDay[]
  /** Sum over the whole recorded span. */
  totals: UsageBucket
}
