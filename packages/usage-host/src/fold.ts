/**
 * Pure session-event fold: track the current provider/model per session from
 * `request/header` snapshots and project `assistant/message` usage samples into
 * {@link CallRecord}s. Extracted from the service so the aggregation logic is
 * unit-testable without a cordis context.
 * @module @dsh-usage-meter/usage-host/fold
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { CallRecord } from './types.ts'

/** Per-session fold state: the latest effective provider/model route. */
export interface SessionFoldState {
  provider: string | undefined
  model: string | undefined
}

/** Create the initial fold state for one session. */
export function createSessionFoldState(): SessionFoldState {
  return { provider: undefined, model: undefined }
}

/**
 * Fold one session event into the per-session state.
 * @param state - the session's fold state, mutated in place.
 * @param sessionId - session id stamped onto produced records.
 * @param event - the appended session event.
 * @returns the produced call record, or null when the event records no usage
 * (boundary markers, chunks, tool traffic, or a message without a usage sample).
 */
export function applyEvent(
  state: SessionFoldState,
  sessionId: string,
  event: SessionEvent,
): CallRecord | null {
  switch (event.type) {
    case 'request/header': {
      const { provider, model } = event.data.header.config
      state.provider = provider
      state.model = model
      return null
    }
    case 'assistant/message': {
      const usage = event.data.usage
      // No usage sample (adapter reported none) or no known route yet: nothing
      // to record — the fold state stays untouched.
      if (usage === undefined || state.model === undefined) return null
      return {
        time: event.time,
        session: sessionId,
        provider: state.provider ?? '',
        model: state.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
      }
    }
    default:
      return null
  }
}
