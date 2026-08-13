/**
 * Wire call helpers for the `usage-meter` host remote. The client calls the
 * gateway's shared `/api` channel with the SRC-derived endpoint shape the
 * gateway dispatches to the host `UsageMeterService`.
 * @module @dsh-usage-meter/usage-ui/client/remote
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { UsageSummary } from '@dsh-usage-meter/usage-host/types'

/** Gateway channel carrying every Typert remote endpoint. */
const API_CHANNEL = '/api' as const

/** Wire endpoint served by the host usage recorder. */
const SUMMARY_ENDPOINT = 'usage-meter/summary' as const

/**
 * Fetch the current usage summary from the host recorder.
 * @param connection - the browser connection handle (carrier of the RPC call).
 * @returns the decoded summary.
 * @throws when the RPC fails or the payload is not an object.
 */
export async function fetchUsageSummary(connection: ConnectionHandle): Promise<UsageSummary> {
  const result = await connection.rpc.call(API_CHANNEL, SUMMARY_ENDPOINT, { args: {} })
  if (!result.ok) {
    throw new Error(`usage-meter/summary failed: ${result.error.code}: ${result.error.message}`)
  }
  const value = result.value
  if (typeof value !== 'object' || value === null) {
    throw new Error('usage-meter/summary returned a non-object payload')
  }
  return value as UsageSummary
}
