# dsh-usage-meter

Per-model daily token usage for the DeepSeek Harness — recorded automatically, readable at a glance in the Web GUI settings.

English · [中文](README.md)

---

Token usage is buried in session logs — figuring out how many tokens each model burned per month, or how much hit the cache, means digging. dsh-usage-meter folds every model call's **input, output, cache hits, and cache writes** into per-model daily statistics, persists them locally, and renders a dashboard in the settings page.

**🎯 Usage shouldn't have to be decoded — it should be readable at a glance.**

## Highlights

- **Zero-config recording** — install, restart `dsh web`, done. Every model call is booked automatically.
- **Per-model × day aggregation** — one table per day, one row per model: calls, input, output, cache read, cache write, billed.
- **Input and cache, separated** — billed input splits into uncached / cache-read / cache-write, so the hit share is visible up front.
- **Local persistence** — an append-only JSONL ledger at `$DSH_HOME/usage-meter/usage.jsonl`: inspect it, delete it, move it.
- **Bilingual dashboard** — the **Usage** settings page ships in Chinese and English, following the Web GUI's language setting.

## What it shows

Settings → **Usage**:

```
Cumulative
  model               calls   input(uncached)  output  cache read  billed
  deepseek-v4-flash    10         3,762       6,477   2,913,280  2,917,042
  deepseek-v4-pro      16        22,671      20,127   5,240,832  5,263,503
  total                26        26,433      26,604   8,154,112  8,180,545

Daily · 2026-08-13  …(same breakdown, split into per-day tables with day totals)
```

| Column | Meaning |
|---|---|
| Calls | Model calls completed that day |
| Input (uncached) | Uncached input tokens (`inputTokens`) |
| Output | Output tokens (`outputTokens`) |
| Cache read | Cache-hit tokens (`cacheReadTokens`, DeepSeek's `prompt_cache_hit_tokens`) |
| Cache write | Cache-write tokens (`cacheWriteTokens`; DeepSeek does not currently report these, usually 0) |
| Billed | Input + cache read + cache write — the billed input-equivalent total |

With no data yet the page shows a single hint line; recording starts at install time and backfills the sessions still alive at startup.

## Configuration

Days are bucketed by the **local timezone** by default. To use UTC, override the host row in `$DSH_HOME/profiles/web/cordis.patch.yml` (patches replace whole row configs, so restate every field you keep):

```yaml
- id: usage-meter
  name: '@dsh-usage-meter/usage-host'
  config:
    dir: ''
    timezone: utc
```

## Install

### From npm (recommended)

```sh
dsh plugin --profile web add @dsh-usage-meter/usage-bundle @dsh-usage-meter/usage-host@0.1.1 --registry=https://registry.npmjs.org/
```

> **Why pin `usage-host@0.1.1` explicitly**: the profile enables pnpm's supply-chain release-age policy, which silently skips versions published less than a day ago during range resolution — a bare bundle install can land on the buggy `0.1.0` (dashboard shows “Failed to load usage data”). Requesting the exact version lets pnpm auto-exempt and install it. Once `0.1.1` passes the age window, the pin is no longer required.

### From a local checkout

```sh
dsh plugin --profile web add \
  /path/to/dsh-usage-meter/packages/usage-host \
  /path/to/dsh-usage-meter/packages/usage-ui
```

Then append two rows to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: usage-meter
      name: '@dsh-usage-meter/usage-host'
    - id: usage-meter-ui
      name: '@dsh-usage-meter/usage-ui'
```

Both paths require a **`dsh web` restart** (host plugins load only at boot). npm ships the built `lib/`, so no build runs at install time.

## Uninstall / Disable

To switch back to the default UI without uninstalling, add to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- id: usage-meter
  disabled: true
- id: usage-meter-ui
  disabled: true
```

Restart `dsh web`; remove the lines to re-enable. To uninstall completely:

```sh
dsh plugin --profile web remove @dsh-usage-meter/usage-bundle @dsh-usage-meter/usage-host
```

Uninstalling does not touch `~/.dsh/usage-meter/usage.jsonl` — reinstall continues from the same ledger.

## Build & develop

```sh
pnpm install
pnpm typecheck   # tsc -b + tsc -p tsconfig.tests.json
pnpm test        # vitest
pnpm build       # tsdown → lib/index.js (host) + lib/client.js (browser)
```

The client bundle is emitted as `window.__ModuleLoader__.load({ id, factory })`; CSS Modules are hashed by lightningcss and injected as a `<style data-plugin="…">` tag. To release a new npm version: `pnpm -r version patch && pnpm -r publish` (**must use pnpm** — `usage-bundle`'s `workspace:^` dependencies need pnpm's version rewrite).

## How it works

- **Two-plugin structure** — the host half (`usage-host`) records and aggregates; the browser half (`usage-ui`) renders the settings page; the host half's `apply()` is empty.
- **Host recording** — `UsageMeterService` (`TypertRemoteService`) listens to `session/event`, folds `request/header` model routes and `assistant/message` usage samples into per-model daily buckets, appends one JSONL line per call; the `/api/usage-meter/summary` endpoint is **strictly registered** via `ctx.typert.register()` so the gateway claims it directly (no SRC marker scan — the 0.1.1 fix).
- **Slot** — the browser plugin registers into `settings.section` (id `usage`); the registration is withdrawn with the plugin fiber.
- **Data** — the browser reads the snapshot over `connection.rpc.call('/api', 'usage-meter/summary', …)` into component-local state.
- **Locale** — owns the `usage.meter` namespace, Chinese and English, following the GUI language setting.

## License

MIT
