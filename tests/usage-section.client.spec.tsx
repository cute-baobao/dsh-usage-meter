// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
// Type-only: brings the settings shell's SlotMap merge ('settings.section')
// into this compilation face, like the plugin's own client entry does.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { UsageSummary } from '../src/types.ts'
import { UsageSection, UsageTooltip, type UsageSectionProps } from '../src/client/UsageSection.tsx'

// jsdom + react 18: opt into the act environment so act() drives real effects.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Recharts' responsive container uses ResizeObserver in the browser; jsdom
// does not provide it, so the chart tests supply the smallest DOM-compatible
// observer surface.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: ResizeObserverStub })
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
  })
}

if (!(globalThis as { CSS?: unknown }).CSS) Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { supports: () => true } })

const svgPrototype = SVGElement.prototype as unknown as { getBBox?: () => DOMRect }
if (!svgPrototype.getBBox) svgPrototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}) } as DOMRect)

const t = (key: string): string => key

function props(overrides: Partial<UsageSectionProps> = {}): UsageSectionProps {
  return {
    close: () => {},
    t,
    fetchSummary: async () => emptySummary(),
    ...overrides,
  } as UsageSectionProps
}

function emptySummary(): UsageSummary {
  return {
    generatedAt: 1755130000000,
    timezone: 'local',
    models: [],
    hours: [],
    totals: {
      calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, billedTokens: 0,
    },
  }
}

function summaryWithHours(): UsageSummary {
  return {
    ...emptySummary(),
    models: ['flash'],
    hours: [{
      hour: '2026-08-13 22:00',
      models: {
        flash: {
          calls: 2, inputTokens: 110, outputTokens: 25, cacheReadTokens: 30, cacheWriteTokens: 0, billedTokens: 150,
        },
      },
      totals: {
        calls: 2, inputTokens: 110, outputTokens: 25, cacheReadTokens: 30, cacheWriteTokens: 0, billedTokens: 150,
      },
    }],
    totals: {
      calls: 2, inputTokens: 110, outputTokens: 25, cacheReadTokens: 30, cacheWriteTokens: 0, billedTokens: 150,
    },
  }
}

let container: HTMLDivElement
let root: Root

function render(sectionProps: UsageSectionProps): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<UsageSection {...sectionProps} />)
  })
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('UsageSection', () => {
  it('shows the empty state when no usage was recorded', async () => {
    render(props())
    await act(async () => {})
    expect(container.textContent).toContain('empty')
  })

  it('renders per-model hourly bars and totals once data arrives', async () => {
    render(props({ fetchSummary: async () => summaryWithHours() }))
    await act(async () => {})
    const text = container.textContent ?? ''
    expect(text).toContain('flash')
    // Billed total of the single hour appears both as a metric and model card.
    expect(text.match(/150/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('renders the active hour total and per-model usage in the chart tooltip', async () => {
    render(props())
    act(() => {
      root.render(<UsageTooltip
        active
        chartLabel="Requests"
        models={['flash']}
        payload={[{ payload: { hour: '2026-08-13 22:00', total: 2, flash: 2 }, dataKey: 'flash', value: 2 } as never]}
      />)
    })
    const tooltip = container.querySelector('[role="status"]')
    expect(tooltip?.textContent).toContain('2026-08-13 22:00')
    expect(tooltip?.textContent).toContain('flash')
    expect(tooltip?.textContent).toContain('2')
  })

  it('shows the error message when the fetch fails', async () => {
    render(props({ fetchSummary: async () => { throw new Error('boom') } }))
    await act(async () => {})
    expect(container.textContent).toContain('error')
    expect(container.textContent).toContain('boom')
  })
})
