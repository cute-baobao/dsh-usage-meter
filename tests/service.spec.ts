import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { MessageId } from '@deepseek-ai/dsh-llm/brand'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it } from 'vitest'
import UsageMeterService from '../src/index.ts'

function event(partial: SessionEvent): SessionEvent {
  return partial
}

function header(provider: string, model: string, time: number): SessionEvent {
  return event({
    type: 'request/header',
    seq: 0,
    time,
    data: { header: { config: { provider, model } }, reason: 'initial' },
  })
}

function message(
  time: number,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
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
        id: MessageId('service-test'),
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'model', provider: 'p', model: 'm' },
      },
      usage: {
        inputTokens,
        outputTokens,
        ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
      },
    },
  })
}

const dirs: string[] = []

async function mount(): Promise<{ ctx: Context; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-meter-test-'))
  dirs.push(dir)
  const ctx = new Context()
  await ctx.plugin(TypertRegistry)
  ctx.provide('dshHomePath', dshHomePath)
  ctx.provide('sessions', { list: () => [] } as never)
  await ctx.plugin(UsageMeterService, { dir, timezone: 'utc' })
  return { ctx, dir }
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('UsageMeterService', () => {
  it('exposes the usage-meter wire namespace and one summary Remote method', async () => {
    const { ctx } = await mount()
    expect(ctx.usageMeter.typertRemote).toMatchObject({
      serviceKey: 'usageMeter',
      namespace: 'usage-meter',
    })
    expect(remoteMethods(ctx.usageMeter)).toEqual([
      { method: 'summary', invocation: { kind: 'direct' } },
    ])
  })

  it('registers the strict Typert endpoint the gateway claims', async () => {
    const { ctx } = await mount()
    const descriptor = ctx.typert.local.get('usage-meter/summary')
    expect(descriptor).toMatchObject({
      namespace: 'usage-meter',
      method: 'summary',
      service: 'usageMeter',
      invocation: { kind: 'direct' },
    })
    expect(ctx.typert.local.get('usageMeter/summary')).toBeUndefined()
  })

  it('folds session events into a summary and persists the JSONL ledger', async () => {
    const { ctx, dir } = await mount()
    const session = Session.create(SessionId('s1'))
    ctx.emit('session/event', session, header('deepseek-official', 'flash', Date.UTC(2026, 7, 13, 10)))
    ctx.emit('session/event', session, message(Date.UTC(2026, 7, 13, 10, 30), 100, 20, 30))
    ctx.emit('session/event', session, message(Date.UTC(2026, 7, 13, 11), 10, 5))

    const summary = await ctx.usageMeter.summary()
    expect(summary.models).toEqual(['flash'])
    // The two messages land in different hours (10:30 and 11:00 UTC).
    expect(summary.hours.map(hour => hour.hour)).toEqual(['2026-08-13 10:00', '2026-08-13 11:00'])
    expect(summary.hours[0]?.models.flash).toMatchObject({
      calls: 1,
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 30,
      billedTokens: 130,
    })
    expect(summary.hours[1]?.models.flash).toMatchObject({
      calls: 1,
      inputTokens: 10,
      outputTokens: 5,
      billedTokens: 10,
    })
    expect(summary.totals).toMatchObject({ calls: 2, inputTokens: 110, outputTokens: 25, billedTokens: 140 })

    // Disposing the fiber runs the flush effect that awaits pending writes.
    await ctx.fiber.dispose()
    const persisted = await readFile(join(dir, 'usage.jsonl'), 'utf8')
    const lines = persisted.split('\n').filter(Boolean)
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      session: 's1',
      model: 'flash',
      inputTokens: 100,
      cacheReadTokens: 30,
    })
  })

  it('reloads the persisted ledger on a fresh mount', async () => {
    const { ctx, dir } = await mount()
    const session = Session.create(SessionId('s2'))
    ctx.emit('session/event', session, header('deepseek-official', 'flash', Date.UTC(2026, 7, 13, 10)))
    ctx.emit('session/event', session, message(Date.UTC(2026, 7, 13, 10, 30), 7, 3))
    await ctx.fiber.dispose()

    // A second mount over the same directory must start from the persisted
    // ledger instead of zero.
    const fresh = new Context()
    await fresh.plugin(TypertRegistry)
    fresh.provide('dshHomePath', dshHomePath)
    fresh.provide('sessions', { list: () => [] } as never)
    await fresh.plugin(UsageMeterService, { dir, timezone: 'utc' })
    const reloaded = await fresh.usageMeter.summary()
    expect(reloaded.totals).toMatchObject({ calls: 1, inputTokens: 7, outputTokens: 3 })
    await fresh.fiber.dispose()
  })
})
