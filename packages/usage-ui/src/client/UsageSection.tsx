/**
 * Usage dashboard section: one `settings.section` page rendering the
 * per-model daily token usage snapshot fetched from the host recorder. The
 * component is a pure reader — all data arrives through the injected
 * `fetchSummary` callback and lives in local state.
 * @module @dsh-usage-meter/usage-ui/client/UsageSection
 */

import { useEffect, useState } from 'react'
import type {
  InjectFace,
  PropsLocale,
  PropsRenderSlots,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageBucket, UsageSummary } from '@dsh-usage-meter/usage-host/types'
import { NS, type UsageMeterLocaleKey } from './locales.ts'
import css from './UsageSection.module.css'

/** Registration-side business face: the one fetch the section needs. */
export interface UsageSectionInjected {
  /** Fetch the current usage summary from the host recorder. */
  fetchSummary: () => Promise<UsageSummary>
}

/** Props the renderer binds for the section. */
export type UsageSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & PropsRenderSlots<never>
  & InjectFace<UsageSectionInjected>

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: UsageSummary }

function format(value: number): string {
  return value.toLocaleString()
}

/** One data row of a bucket; renders the numeric columns past the model cell. */
function BucketCells({ bucket }: { bucket: UsageBucket }): JSX.Element {
  return (
    <>
      <td className={css.num}>{format(bucket.calls)}</td>
      <td className={css.num}>{format(bucket.inputTokens)}</td>
      <td className={css.num}>{format(bucket.outputTokens)}</td>
      <td className={css.num}>{format(bucket.cacheReadTokens)}</td>
      <td className={css.num}>{format(bucket.cacheWriteTokens)}</td>
      <td className={`${css.num} ${css.billed}`}>{format(bucket.billedTokens)}</td>
    </>
  )
}

/** Column header row shared by every table. */
function HeaderRow({ t, withDate }: { t: (key: UsageMeterLocaleKey) => string; withDate: boolean }): JSX.Element {
  return (
    <tr>
      {withDate ? <th>{t('col.date')}</th> : null}
      <th>{t('col.model')}</th>
      <th className={css.num}>{t('col.calls')}</th>
      <th className={css.num}>{t('col.input')}</th>
      <th className={css.num}>{t('col.output')}</th>
      <th className={css.num}>{t('col.cacheRead')}</th>
      <th className={css.num}>{t('col.cacheWrite')}</th>
      <th className={css.num}>{t('col.billed')}</th>
    </tr>
  )
}

/** One ordered model row set for a `Record<model, bucket>` map. */
function ModelRows({ models }: { models: Record<string, UsageBucket> }): JSX.Element[] {
  return Object.keys(models).sort().map(model => (
    <tr key={model}>
      <td className={css.model}>{model}</td>
      <BucketCells bucket={models[model] as UsageBucket} />
    </tr>
  ))
}

/** Render one usage dashboard page. */
export function UsageSection({ t, fetchSummary }: UsageSectionProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    fetchSummary()
      .then(summary => {
        if (alive) setState({ kind: 'ready', summary })
      })
      .catch((error: unknown) => {
        if (alive) setState({ kind: 'error', message: String(error) })
      })
    return () => {
      alive = false
    }
  }, [fetchSummary])

  if (state.kind === 'loading') {
    return <p className={css.message}>{t('loading')}</p>
  }
  if (state.kind === 'error') {
    return (
      <div className={css.message}>
        <p className={css.error}>{t('error')}</p>
        <p className={css.errorHint}>{t('errorHint')}</p>
        <p className={css.errorDetail}>{state.message}</p>
      </div>
    )
  }

  const { summary } = state
  if (summary.days.length === 0) {
    return <p className={css.message}>{t('empty')}</p>
  }

  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('totals.title')}</h2>
      <table className={css.table}>
        <thead><HeaderRow t={t} withDate={false} /></thead>
        <tbody>
          <ModelRows models={summary.models.reduce<Record<string, UsageBucket>>(
            (acc, model) => {
              const bucket = summary.days.reduce<UsageBucket | undefined>((sum, day) => {
                const current = day.models[model]
                if (current === undefined) return sum
                if (sum === undefined) return { ...current }
                return {
                  calls: sum.calls + current.calls,
                  inputTokens: sum.inputTokens + current.inputTokens,
                  outputTokens: sum.outputTokens + current.outputTokens,
                  cacheReadTokens: sum.cacheReadTokens + current.cacheReadTokens,
                  cacheWriteTokens: sum.cacheWriteTokens + current.cacheWriteTokens,
                  billedTokens: sum.billedTokens + current.billedTokens,
                }
              }, undefined)
              if (bucket !== undefined) acc[model] = bucket
              return acc
            },
            {},
          )} />
          <tr className={css.totalRow}>
            <td className={css.model}>{t('grand.total')}</td>
            <BucketCells bucket={summary.totals} />
          </tr>
        </tbody>
      </table>

      <h2 className={css.heading}>{t('day.title')}</h2>
      <div className={css.days}>
        {summary.days.map(day => (
          <table key={day.date} className={css.table}>
            <caption className={css.dayCaption}>{day.date}</caption>
            <thead><HeaderRow t={t} withDate={false} /></thead>
            <tbody>
              <ModelRows models={day.models} />
              <tr className={css.totalRow}>
                <td className={css.model}>{t('day.total')}</td>
                <BucketCells bucket={day.totals} />
              </tr>
            </tbody>
          </table>
        ))}
      </div>

      <p className={css.updatedAt}>
        {t('updatedAt')}: {new Date(summary.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

export type { UsageMeterLocaleKey }
