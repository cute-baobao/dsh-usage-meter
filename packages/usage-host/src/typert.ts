/**
 * Strict Typert registration for the usage-meter remote endpoint.
 *
 * The gateway claims endpoints either from strict definitions (`typert.local`,
 * populated by `ctx.typert.register()` / generated `./typert` artifacts) or
 * from a source scan of services carrying `typertRemote` bindings. The SRC
 * scan reads `@Remote` markers through a module-private table in
 * `@deepseek-ai/dsh-typert-protocol`; when the harness runs from source
 * (tsx + tsconfig paths) while this package resolves the protocol from the
 * profile's node_modules, the two tables are distinct instances and the scan
 * sees no markers. A strict registration is instance-independent, so the
 * service registers its endpoint explicitly instead of relying on SRC
 * derivation.
 * @module @dsh-usage-meter/usage-host/typert
 */

import type {} from '@deepseek-ai/dsh-typert-registry'
import type { TypertDisposer } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'

/** The package's host-face contribution, registered for the calling fiber. */
export function registerUsageMeterRemote(ctx: Context): TypertDisposer {
  return ctx.typert.register({
    package: '@dsh-usage-meter/usage-host',
    face: 'host',
    schemas: [],
    model: { services: [], events: [], objects: [] },
    invocations: [
      {
        id: 'usageMeter#usage-meter/summary',
        service: 'usageMeter',
        namespace: 'usage-meter',
        method: 'summary',
        invocation: { kind: 'direct' },
        parameters: [],
        result: { mode: 'src-json' },
      },
    ],
  })
}
