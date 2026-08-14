import { describe, expect, it, vi } from 'vitest'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { fetchUsageSummary } from '../src/client/remote.ts'

function handleWithCall(call: (endpoint: string) => unknown): ConnectionHandle {
  return {
    api: {} as ConnectionHandle['api'],
    rpc: {
      call: vi.fn(async (_channel, endpoint: string, _payload) => {
        const value = call(endpoint)
        return { ok: true, value }
      }),
    },
  } as unknown as ConnectionHandle
}

describe('fetchUsageSummary', () => {
  it('decodes a successful summary payload', async () => {
    const payload = {
      generatedAt: 1,
      timezone: 'local',
      models: ['flash'],
      hours: [],
      totals: {
        calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, billedTokens: 0,
      },
    }
    const handle = handleWithCall(endpoint => {
      expect(endpoint).toBe('usage-meter/summary')
      return payload
    })
    await expect(fetchUsageSummary(handle)).resolves.toEqual(payload)
  })

  it('throws with the RPC error code when the call fails', async () => {
    const handle = {
      api: {},
      rpc: { call: vi.fn(async () => ({ ok: false, error: { code: 'internal', message: 'boom' } })) },
    } as unknown as ConnectionHandle
    await expect(fetchUsageSummary(handle)).rejects.toThrow(/boom/)
  })

  it('throws when the payload is not an object', async () => {
    const handle = handleWithCall(() => 42)
    await expect(fetchUsageSummary(handle)).rejects.toThrow(/non-object/)
  })
})
