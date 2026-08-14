import { describe, expect, it } from 'vitest'
import { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { applyEvent, createSessionFoldState } from '../src/fold.ts'

/** Build a minimal typed event for fold tests. */
function event(partial: SessionEvent): SessionEvent {
  return partial
}

function header(provider: string, model: string, time = 1): SessionEvent {
  return event({
    type: 'request/header',
    seq: 0,
    time,
    data: { header: { config: { provider, model } }, reason: 'initial' },
  })
}

function message(
  time: number,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number },
): SessionEvent {
  return event({
    type: 'assistant/message',
    seq: 1,
    time,
    surfaceOp: 'append',
    data: {
      turn: 1,
      step: 1,
      message: {
        id: MessageId('fold-test'),
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      },
      usage,
    },
  })
}

function unrelated(time = 2): SessionEvent {
  return event({ type: 'turn/start', seq: 0, time, data: { turn: 1 } })
}

describe('applyEvent', () => {
  it('ignores events before a route is known', () => {
    const state = createSessionFoldState()
    expect(applyEvent(state, 's1', unrelated())).toBeNull()
    expect(applyEvent(state, 's1', message(2, { inputTokens: 5, outputTokens: 3 }))).toBeNull()
  })

  it('tracks the latest request/header route and records usage under it', () => {
    const state = createSessionFoldState()
    expect(applyEvent(state, 's1', header('deepseek-official', 'deepseek-v4-flash', 1))).toBeNull()
    expect(applyEvent(state, 's1', header('deepseek-official', 'deepseek-reasoner', 2))).toBeNull()
    const record = applyEvent(state, 's1', message(3, {
      inputTokens: 10,
      outputTokens: 4,
      cacheReadTokens: 7,
    }))
    expect(record).toEqual({
      time: 3,
      session: 's1',
      provider: 'deepseek-official',
      model: 'deepseek-reasoner',
      inputTokens: 10,
      outputTokens: 4,
      cacheReadTokens: 7,
      cacheWriteTokens: 0,
    })
  })

  it('records nothing for a message without a usage sample', () => {
    const state = createSessionFoldState()
    applyEvent(state, 's1', header('p', 'm', 1))
    expect(applyEvent(state, 's1', event({
      type: 'assistant/message',
      seq: 1,
      time: 2,
      surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        message: {
          id: MessageId('no-usage'),
          role: 'assistant',
          content: [],
          source: { kind: 'model', provider: 'p', model: 'm' },
        },
      },
    }))).toBeNull()
  })

  it('keeps sessions isolated', () => {
    const first = createSessionFoldState()
    const second = createSessionFoldState()
    applyEvent(first, 'a', header('p1', 'm1', 1))
    applyEvent(second, 'b', header('p2', 'm2', 1))
    const fromFirst = applyEvent(first, 'a', message(2, { inputTokens: 1, outputTokens: 1 }))
    const fromSecond = applyEvent(second, 'b', message(2, { inputTokens: 2, outputTokens: 2 }))
    expect(fromFirst?.model).toBe('m1')
    expect(fromSecond?.model).toBe('m2')
  })
})
