/**
 * Append-only JSONL persistence for the call ledger. Each line is one
 * {@link CallRecord} as JSON. Writes are serialized through a promise tail so
 * concurrent event appends cannot interleave partial lines; the service flushes
 * the tail on dispose.
 * @module @dsh-usage-meter/usage/store
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CallRecord } from './types.ts'

/** Non-negative integer counts expected on every record field. */
function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Parse one JSONL line into a record; unknown or malformed lines are dropped. */
export function parseRecord(line: string): CallRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  const { time, session, model, provider } = record
  if (typeof time !== 'number' || !Number.isFinite(time)) return null
  if (typeof session !== 'string') return null
  if (typeof model !== 'string' || model.length === 0) return null
  const inputTokens = record.inputTokens
  const outputTokens = record.outputTokens
  const cacheReadTokens = record.cacheReadTokens
  const cacheWriteTokens = record.cacheWriteTokens
  if (!isNonNegativeInt(inputTokens)
    || !isNonNegativeInt(outputTokens)
    || !isNonNegativeInt(cacheReadTokens)
    || !isNonNegativeInt(cacheWriteTokens)) {
    return null
  }
  return {
    time,
    session,
    provider: typeof provider === 'string' ? provider : '',
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  }
}

/** JSONL call-ledger store. */
export class JsonlUsageStore {
  private readonly file: string
  private tail: Promise<void> = Promise.resolve()

  /**
   * @param file - absolute path of the ledger file.
   */
  constructor(file: string) {
    this.file = file
  }

  /**
   * Read and parse every valid record in the ledger.
   * @returns the persisted records; an absent file yields an empty list.
   */
  async load(): Promise<CallRecord[]> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const records: CallRecord[] = []
    for (const line of text.split('\n')) {
      if (line.trim().length === 0) continue
      const record = parseRecord(line)
      if (record !== null) records.push(record)
    }
    return records
  }

  /**
   * Append one record, serialized behind every earlier append.
   * @param record - the record to persist.
   * @returns a promise settling when this record (and every earlier one) is on disk.
   */
  append(record: CallRecord): Promise<void> {
    const line = JSON.stringify(record)
    this.tail = this.tail.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      await appendFile(this.file, line + '\n', 'utf8')
    })
    return this.tail
  }

  /** Await every queued append. */
  flush(): Promise<void> {
    return this.tail
  }
}
