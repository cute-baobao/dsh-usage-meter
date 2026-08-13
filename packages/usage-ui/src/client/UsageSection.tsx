/**
 * Usage dashboard section for the DeepSeek Harness settings surface.
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
  fetchSummary: () => Promise<UsageSummary>
}

export type UsageSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & PropsRenderSlots<never>
  & InjectFace<UsageSectionInjected>

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: UsageSummary }

type ChartPoint = { label: string; value: number; date: string }

const emptyBucket: UsageBucket = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  billedTokens: 0,
}

function format(value: number): string {
  return value.toLocaleString()
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function tokenTotal(bucket: UsageBucket): number {
  return bucket.billedTokens || bucket.inputTokens + bucket.outputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens
}

function addBuckets(left: UsageBucket, right: UsageBucket): UsageBucket {
  return {
    calls: left.calls + right.calls,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    billedTokens: left.billedTokens + right.billedTokens,
  }
}

function shortDate(date: string): string {
  const [, month = '', day = date] = date.split('-')
  return month ? `${month}/${day}` : date
}

function pointsFor(summary: UsageSummary, getValue: (bucket: UsageBucket) => number): ChartPoint[] {
  return summary.days.map(day => ({ date: day.date, label: shortDate(day.date), value: getValue(day.totals) }))
}

function modelBuckets(summary: UsageSummary): Record<string, UsageBucket> {
  return summary.models.reduce<Record<string, UsageBucket>>((models, model) => {
    const total = summary.days.reduce<UsageBucket>((sum, day) => addBuckets(sum, day.models[model] ?? emptyBucket), emptyBucket)
    models[model] = total
    return models
  }, {})
}

function linePath(points: ChartPoint[], width: number, height: number, padding: number): string {
  const max = Math.max(...points.map(point => point.value), 1)
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padding + index * (plotWidth / (points.length - 1))
    const y = height - padding - (point.value / max) * plotHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

function areaPath(line: string, points: ChartPoint[], width: number, height: number, padding: number): string {
  const firstX = points.length === 1 ? width / 2 : padding
  const lastX = points.length === 1 ? width / 2 : width - padding
  return `${line} L ${lastX.toFixed(1)} ${(height - padding).toFixed(1)} L ${firstX.toFixed(1)} ${(height - padding).toFixed(1)} Z`
}

function UsageChart({ points, tone, label }: { points: ChartPoint[]; tone: 'blue' | 'violet'; label: string }): JSX.Element {
  const width = 640
  const height = 220
  const padding = 28
  const max = Math.max(...points.map(point => point.value), 1)
  const line = linePath(points, width, height, padding)
  const area = areaPath(line, points, width, height, padding)
  const grid = [0, 0.5, 1]

  return (
    <div className={css.chartWrap}>
      <svg className={css.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`usage-${tone}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop className={tone === 'violet' ? css.violetStart : css.areaStart} offset="0%" />
            <stop className={tone === 'violet' ? css.violetEnd : css.areaEnd} offset="100%" />
          </linearGradient>
        </defs>
        {grid.map(level => {
          const y = height - padding - level * (height - padding * 2)
          return <line key={level} className={css.gridLine} x1={padding} x2={width - padding} y1={y} y2={y} />
        })}
        <path className={`${css.area} ${tone === 'violet' ? css.violetArea : ''}`} d={area} />
        <path className={`${css.line} ${tone === 'violet' ? css.violetLine : ''}`} d={line} />
        {points.map((point, index) => {
          const x = points.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (points.length - 1))
          const y = height - padding - (point.value / max) * (height - padding * 2)
          return (
            <g key={point.date} className={css.point}>
              <title>{`${point.date}: ${format(point.value)}`}</title>
              <circle cx={x} cy={y} r="4" />
            </g>
          )
        })}
      </svg>
      <div className={css.axis} aria-hidden="true">
        <span>{points[0]?.label}</span>
        {points.length > 2 ? <span>{points[Math.floor((points.length - 1) / 2)]?.label}</span> : null}
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: 'blue' | 'violet' | 'cyan' }): JSX.Element {
  return (
    <article className={`${css.metricCard} ${css[accent]}`}>
      <span className={css.metricLabel}>{label}</span>
      <strong className={css.metricValue}>{value}</strong>
      <span className={css.metricDetail}>{detail}</span>
    </article>
  )
}

/** Render one usage dashboard page. */
export function UsageSection({ t, fetchSummary }: UsageSectionProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    fetchSummary()
      .then(summary => { if (alive) setState({ kind: 'ready', summary }) })
      .catch((error: unknown) => { if (alive) setState({ kind: 'error', message: String(error) }) })
    return () => { alive = false }
  }, [fetchSummary])

  if (state.kind === 'loading') return <p className={css.message}>{t('loading')}</p>
  if (state.kind === 'error') {
    return <div className={css.message}><p className={css.error}>{t('error')}</p><p>{t('errorHint')}</p><p className={css.errorDetail}>{state.message}</p></div>
  }

  const { summary } = state
  if (summary.days.length === 0) return <p className={css.message}>{t('empty')}</p>

  const totals = summary.totals
  const tokens = tokenTotal(totals)
  const callsPoints = pointsFor(summary, bucket => bucket.calls)
  const tokenPoints = pointsFor(summary, tokenTotal)
  const models = modelBuckets(summary)

  return (
    <main className={css.section}>
      <header className={css.header}>
        <div>
          <h2 className={css.heading}>{t('dashboard.title')}</h2>
        </div>
        <p className={css.updatedAt}>{t('updatedAt')} · {new Date(summary.generatedAt).toLocaleString()}</p>
      </header>

      <section className={css.metrics} aria-label={t('dashboard.title')}>
        <MetricCard accent="blue" label={t('metric.tokens')} value={formatCompact(tokens)} detail={`${format(tokens)} ${t('metric.tokensUnit')}`} />
        <MetricCard accent="violet" label={t('metric.calls')} value={format(totals.calls)} detail={`${summary.days.length} ${t('metric.activeDays')}`} />
        <MetricCard accent="cyan" label={t('metric.models')} value={format(summary.models.length)} detail={t('metric.modelsDetail')} />
      </section>

      <section className={css.primaryPanel}>
        <div className={css.panelHeading}>
          <div><p className={css.panelLabel}>{t('chart.tokens')}</p><strong>{formatCompact(tokens)}</strong></div>
          <span className={css.range}>{summary.days[0]?.date} — {summary.days.at(-1)?.date}</span>
        </div>
        <UsageChart points={tokenPoints} tone="blue" label={t('chart.tokens')} />
      </section>

      <section className={css.modelSection}>
        <div className={css.sectionHeading}><h3>{t('models.title')}</h3><span>{t('models.description')}</span></div>
        <div className={css.modelGrid}>
          {summary.models.map(model => {
            const bucket = models[model] ?? emptyBucket
            return (
              <article key={model} className={css.modelCard}>
                <div className={css.modelTop}><span className={css.modelName}>{model}</span><span>{format(bucket.calls)} {t('metric.callsUnit')}</span></div>
                <strong>{formatCompact(tokenTotal(bucket))}</strong>
                <span className={css.modelTokens}>{t('metric.tokensUnit')}</span>
                <div className={css.modelStats}><span>{t('col.input')}<b>{formatCompact(bucket.inputTokens)}</b></span><span>{t('col.output')}<b>{formatCompact(bucket.outputTokens)}</b></span></div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={css.secondaryPanel}>
        <div className={css.panelHeading}><div><p className={css.panelLabel}>{t('chart.calls')}</p><strong>{format(totals.calls)}</strong></div><span className={css.range}>{t('chart.daily')}</span></div>
        <UsageChart points={callsPoints} tone="violet" label={t('chart.calls')} />
      </section>
    </main>
  )
}

export type { UsageMeterLocaleKey }
