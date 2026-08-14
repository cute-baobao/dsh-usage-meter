/**
 * Usage dashboard plugin, browser half — one `settings.section` page that
 * renders the per-model daily token usage snapshot served by the host
 * recorder over the `usage-meter/summary` remote endpoint.
 * @module @dsh-usage-meter/usage/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NS, en, zh } from './locales.ts'
import { fetchUsageSummary } from './remote.ts'
import { UsageSection, type UsageSectionInjected } from './UsageSection.tsx'

export type { UsageSectionInjected, UsageSectionProps } from './UsageSection.tsx'
export type { UsageMeterLocaleKey } from './locales.ts'

/** Required services: the slot registry, the locale service, and the RPC carrier. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Mount the usage dashboard section. Registration rides the slot service's
 * declaration injection, so it waits for the settings shell to declare
 * `settings.section` and is removed when that declaration collapses.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: (): UsageSectionInjected => ({
      fetchSummary: () => fetchUsageSummary(connection),
    }),
  }, UsageSection))
}
