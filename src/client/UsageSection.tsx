/**
 * Usage dashboard section for the DeepSeek Harness settings surface.
 * @module @dsh-usage-meter/usage/client/UsageSection
 */

import { useEffect, useState } from 'react'
import type {
  InjectFace,
  PropsLocale,
  PropsRenderSlots,
  PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageBucket, UsageHour, UsageSummary } from '../types.ts'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
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

/** Harness-aligned categorical hues for model segments. */
const MODEL_PALETTE = [
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#eab308',
  '#fb7185',
] as const

const REQUEST_PALETTE = [
  '#1677ff',
  '#5b8ff9',
  '#36cfc9',
  '#7c5cff',
  '#13c2c2',
] as const

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

/** `YYYY-MM-DD HH:00` → `HH:00` for the compact hourly axis. */
function shortHour(hour: string): string {
  return hour.split(' ').at(-1) ?? hour
}

function axisLabel(hour: string, hours: UsageHour[]): string {
  const dates = new Set(hours.map(item => item.hour.split(' ')[0]))
  if (dates.size <= 1) return shortHour(hour)
  const [date, time] = hour.split(' ')
  return `${date?.slice(5) ?? date} ${time ?? ''}`.trim()
}

function modelColor(model: string, models: string[], tone: 'tokens' | 'calls' = 'tokens'): string {
  const index = models.indexOf(model)
  const palette = tone === 'calls' ? REQUEST_PALETTE : MODEL_PALETTE
  return palette[index % palette.length] ?? palette[0]!
}

type ChartDatum = { hour: string; label: string; total: number; [model: string]: string | number }

type BarShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  dataKey?: string | number
  payload?: ChartDatum
}

function ModelBarShape(props: BarShapeProps, model: string, models: string[]): JSX.Element {
  const topModel = models.filter(candidate => Number(props.payload?.[candidate] ?? 0) > 0).at(-1)
  return <Rectangle {...props} radius={topModel === model ? [9, 9, 0, 0] : 0} />
}

function chartData(hours: UsageHour[], models: string[], getValue: (bucket: UsageBucket) => number): { data: ChartDatum[]; ticks: string[] } {
  const data: ChartDatum[] = hours.map(hour => {
    const values = models.reduce<Record<string, number>>((result, model) => {
      result[model] = getValue(hour.models[model] ?? emptyBucket)
      return result
    }, {})
    return { hour: hour.hour, label: axisLabel(hour.hour, hours), total: Object.values(values).reduce((sum, value) => sum + value, 0), ...values }
  })
  const ticks = [...new Set([data[0]?.label, data[Math.floor((data.length - 1) / 2)]?.label, data.at(-1)?.label].filter((value): value is string => value !== undefined))]
  return { data, ticks }
}

type UsageTooltipProps = TooltipProps<number, string> & {
  chartLabel: string
  models: string[]
}

export function UsageTooltip({ active, payload, chartLabel, models, tone = 'tokens' }: UsageTooltipProps & { tone?: 'tokens' | 'calls' }): JSX.Element | null {
  if (!active || payload === undefined || payload.length === 0) return null
  const datum = payload[0]?.payload as ChartDatum | undefined
  if (datum === undefined) return null
  const rows = models.map(model => ({ model, value: Number(datum[model] ?? 0) })).filter(row => row.value > 0)
  return (
    <div className={css.tooltip} role="status">
      <strong>{datum.hour}</strong>
      <div className={css.tooltipSummary}><span>{chartLabel}</span><b>{format(datum.total)}</b></div>
      {rows.map(row => (
        <div key={row.model} className={css.tooltipRow}>
          <span><span className={css.tooltipDot} style={{ background: modelColor(row.model, models, tone) }} />{row.model}</span>
          <b>{format(row.value)}</b>
        </div>
      ))}
    </div>
  )
}

function StackedBarChart({ hours, models, getValue, label, tone }: {
  hours: UsageHour[]
  models: string[]
  getValue: (bucket: UsageBucket) => number
  label: string
  tone: 'tokens' | 'calls'
}): JSX.Element {
  const { data, ticks } = chartData(hours, models, getValue)

  return (
    <div className={css.chartWrap}>
      <div className={css.legend} role="list">
        {models.map(model => (
          <span key={model} className={css.legendItem} role="listitem">
            <span className={css.legendSwatch} style={{ background: modelColor(model, models, tone) }} />
            {model}
          </span>
        ))}
      </div>
      <div className={css.chart}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid className={css.gridLine} vertical={false} />
            <XAxis dataKey="label" ticks={ticks} tickLine={false} axisLine={false} tick={{ fill: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }} tickFormatter={formatCompact} />
            <Tooltip cursor={false} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, outline: 'none' }} content={<UsageTooltip chartLabel={label} models={models} tone={tone} />} />
            {models.map(model => <Bar key={model} dataKey={model} stackId="usage" fill={modelColor(model, models, tone)} maxBarSize={42} shape={(props: unknown) => ModelBarShape(props as BarShapeProps, model, models)} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function HourlyLineChart({ hours, models, label }: { hours: UsageHour[]; models: string[]; label: string }): JSX.Element {
  const { data, ticks } = chartData(hours, models, bucket => bucket.calls)
  return (
    <div className={css.chartWrap}>
      <div className={css.legend} role="list">
        {models.map(model => <span key={model} className={css.legendItem} role="listitem"><span className={css.legendSwatch} style={{ background: modelColor(model, models, 'calls') }} />{model}</span>)}
      </div>
      <div className={css.chart}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid className={css.gridLine} vertical={false} />
            <XAxis dataKey="label" ticks={ticks} tickLine={false} axisLine={false} tick={{ fill: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }} tickFormatter={formatCompact} />
            <Tooltip cursor={false} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 20, outline: 'none' }} content={<UsageTooltip chartLabel={label} models={models} tone="calls" />} />
            {models.map(model => <Line key={model} type="monotone" dataKey={model} stroke={modelColor(model, models, 'calls')} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--dsw-alias-bg-module-platform)' }} />)}
          </LineChart>
        </ResponsiveContainer>
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
  if (summary.hours.length === 0) return <p className={css.message}>{t('empty')}</p>

  const totals = summary.totals
  const tokens = tokenTotal(totals)
  const models = summary.models
  const modelBuckets = models.reduce<Record<string, UsageBucket>>((result, model) => {
    const total = summary.hours.reduce<UsageBucket>((sum, hour) => addBuckets(sum, hour.models[model] ?? emptyBucket), emptyBucket)
    result[model] = total
    return result
  }, {})

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
        <MetricCard accent="violet" label={t('metric.calls')} value={format(totals.calls)} detail={`${summary.hours.length} ${t('metric.activeHours')}`} />
        <MetricCard accent="cyan" label={t('metric.models')} value={format(models.length)} detail={t('metric.modelsDetail')} />
      </section>

      <section className={css.primaryPanel}>
        <div className={css.panelHeading}>
          <div><p className={css.panelLabel}>{t('chart.tokens')}</p><strong>{formatCompact(tokens)}</strong></div>
          <span className={css.range}>{t('chart.hourly')}</span>
        </div>
        <StackedBarChart hours={summary.hours} models={models} getValue={tokenTotal} label={t('metric.tokens')} tone="tokens" />
      </section>

      <section className={css.modelSection}>
        <div className={css.sectionHeading}><h3>{t('models.title')}</h3><span>{t('models.description')}</span></div>
        <div className={css.modelGrid}>
          {models.map(model => {
            const bucket = modelBuckets[model] ?? emptyBucket
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

      <section className={css.requestSection} aria-label={t('chart.calls')}>
        <div className={css.panelHeading}><div><p className={css.panelLabel}>{t('chart.calls')}</p><strong>{format(totals.calls)}</strong></div><span className={css.range}>{t('chart.hourly')}</span></div>
        <div className={css.modelChartGrid}>
          {models.map(model => {
            const bucket = modelBuckets[model] ?? emptyBucket
            return (
              <article key={model} className={css.modelChartCard}>
                <div className={css.modelChartHeading}><strong>{model}</strong><span>{format(bucket.calls)} {t('metric.callsUnit')}</span></div>
                <HourlyLineChart hours={summary.hours} models={[model]} label={t('metric.calls')} />
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export type { UsageMeterLocaleKey }
