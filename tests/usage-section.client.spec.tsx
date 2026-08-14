// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
// Type-only: brings the settings shell's SlotMap merge ('settings.section')
// into this compilation face, like the plugin's own client entry does.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { UsageSummary } from '../src/types.ts'
import { UsageSection, type UsageSectionProps } from '../src/client/UsageSection.tsx'

// jsdom + react 18: opt into the act environment so act() drives real effects.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
    days: [],
    totals: {
      calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, billedTokens: 0,
    },
  }
}

function summaryWithDays(): UsageSummary {
  return {
    ...emptySummary(),
    models: ['flash'],
    days: [{
      date: '2026-08-13',
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

  it('renders per-model daily rows and totals once data arrives', async () => {
    render(props({ fetchSummary: async () => summaryWithDays() }))
    await act(async () => {})
    const text = container.textContent ?? ''
    expect(text).toContain('2026-08-13')
    expect(text).toContain('flash')
    // Billed total of the single day appears both as a model row and totals.
    expect(text.match(/150/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('shows the active date total and per-model request count on the requests chart', async () => {
    render(props({ fetchSummary: async () => summaryWithDays() }))
    await act(async () => {})
    const charts = container.querySelectorAll('svg')
    const requestChart = charts.item(1) as SVGSVGElement
    Object.defineProperty(requestChart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 640 }),
    })
    act(() => {
      requestChart.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 320 }))
    })
    const tooltip = container.querySelector('[role="status"]')
    expect(tooltip?.textContent).toContain('2026-08-13')
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
