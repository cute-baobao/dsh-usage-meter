/**
 * DeepSeek Harness usage recorder (host plane).
 *
 * A cordis Service plugin: listens to the `session/event` firehose, folds
 * `request/header` routes and `assistant/message` usage samples into a
 * per-model daily {@link UsageLedger}, persists every call as one JSONL line
 * under `$DSH_HOME/usage-meter/usage.jsonl`, and exposes the ledger through the
 * `usage-meter/summary` Typert remote endpoint the Web GUI dashboard calls.
 *
 * The service carries a `typertRemote` binding, so the API gateway claims
 * `/api/usage-meter/*` and dispatches the SRC-derived `summary` method without
 * any codegen.
 *
 * @module @dsh-usage-meter/usage-host
 */

import { join, resolve } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { Session } from '@deepseek-ai/dsh-session'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import s from '@deepseek-ai/schemastery'
import { applyEvent, createSessionFoldState, type SessionFoldState } from './fold.ts'
import { UsageLedger, type DayTimezone } from './ledger.ts'
import { JsonlUsageStore } from './store.ts'
import { registerUsageMeterRemote } from './typert.ts'
import type { CallRecord, UsageSummary } from './types.ts'

export type { CallRecord, UsageBucket, UsageDay, UsageSummary } from './types.ts'
export type { DayTimezone } from './ledger.ts'
export type { SessionFoldState } from './fold.ts'
export { dayKey, UsageLedger, zeroBucket } from './ledger.ts'
export { parseRecord, JsonlUsageStore } from './store.ts'
export { applyEvent, createSessionFoldState } from './fold.ts'

/** Deployment-varying configuration; every field has a safe default. */
export interface Config {
  /** Directory holding `usage.jsonl`; empty resolves to `$DSH_HOME/usage-meter`. */
  readonly dir?: string
  /** Day-bucketing timezone; defaults to the process timezone (`local`). */
  readonly timezone?: DayTimezone
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    dshHomePath: typeof dshHomePath
    usageMeter: UsageMeterService
  }
}

/** Ledger file name inside the configured directory. */
const LEDGER_FILE = 'usage.jsonl'

/** The recorded session id for records produced before any route is known. */
function resolveDir(ctx: Context, config: Config): string {
  const configured = config.dir
  return configured === undefined || configured.length === 0
    ? ctx.dshHomePath('usage-meter')
    : resolve(configured)
}

/**
 * The usage recorder service.
 * @typert service usageMeter
 */
export class UsageMeterService extends TypertRemoteService {
  static inject = ['sessions', 'dshHomePath', 'typert']

  /** Loader validation for the one deployment-varying policy. */
  static Config: s<Config> = s.object({
    dir: s.string().default(''),
    timezone: s.union([s.const('local'), s.const('utc')]).default('local'),
  })

  private readonly timezone: DayTimezone
  private readonly store: JsonlUsageStore
  private readonly sessionState = new Map<string, SessionFoldState>()
  private ledger: UsageLedger
  private writeTail: Promise<void> = Promise.resolve()

  /**
   * @param ctx - host context carrying the sessions store and `dshHomePath`.
   * @param config - validated plugin configuration.
   */
  constructor(ctx: Context, config: Config) {
    // Distinct wire namespace (hyphenated) from the cordis service key: the
    // gateway serves `/api/usage-meter/summary`, which the browser calls.
    super(ctx, 'usageMeter', { namespace: 'usage-meter' })
    this.timezone = config.timezone ?? 'local'
    this.store = new JsonlUsageStore(join(resolveDir(ctx, config), LEDGER_FILE))
    this.ledger = new UsageLedger(this.timezone)
    ctx.effect(() => async () => {
      await this.writeTail
    }, 'usage-meter: flush pending ledger writes')
  }

  /**
   * Load the persisted ledger, backfill every live session, register the
   * strict Typert endpoint, and subscribe to the event firehose.
   */
  protected async [Service.init](): Promise<void> {
    this.ledger = new UsageLedger(this.timezone, await this.store.load())
    // Strict registration makes the gateway claim /api/usage-meter/summary
    // without the SRC marker scan (instance-dependent across module copies).
    this.ctx.effect(() => registerUsageMeterRemote(this.ctx), 'usage-meter: typert contribution')
    // Backfill sessions already live in the store at install time; historical
    // sessions that were never loaded are not scanned (see README).
    for (const session of this.ctx.sessions.list()) this.backfill(session)
    this.ctx.on('session/event', (session, event) => {
      let state = this.sessionState.get(session.id)
      if (state === undefined) {
        state = createSessionFoldState()
        this.sessionState.set(session.id, state)
      }
      const record = applyEvent(state, session.id, event)
      if (record !== null) this.accept(record)
    })
  }

  /** Fold every event of one live session without re-emitting persisted writes. */
  private backfill(session: Session): void {
    const state = createSessionFoldState()
    this.sessionState.set(session.id, state)
    for (const event of session.events) {
      const record = applyEvent(state, session.id, event)
      if (record !== null) this.accept(record)
    }
  }

  /** Fold a record into the ledger and queue its persistence (failure contained). */
  private accept(record: CallRecord): void {
    this.ledger.record(record)
    this.writeTail = this.writeTail
      .catch((error: unknown) => {
        this.ctx.logger.warn(`usage-meter: a persisted usage record was dropped: ${String(error)}`)
      })
      .then(() => this.store.append(record))
  }

  /**
   * Snapshot the complete per-model daily usage.
   * @returns the current ledger summary.
   */
  @Remote('summary')
  async summary(): Promise<UsageSummary> {
    return this.ledger.summary()
  }
}

export default UsageMeterService
