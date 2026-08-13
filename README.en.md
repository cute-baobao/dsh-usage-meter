# dsh-usage-meter

Track your [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) token usage — per model, per day — with a dashboard inside the Web GUI.

The plugin records every model call's **input, output, cache hits, and cache writes**, groups them by **model × calendar day**, persists the ledger locally, and renders a **用量统计 / Usage** page in the settings panel.

English | [中文](README.md)

## Features

- **Zero configuration**: install the plugin, restart `dsh web`, done. Every model call is recorded automatically.
- **Per-model daily breakdown**: calls, uncached input, output, cache-read (cache hit), cache-write, and billed totals.
- **Local persistence**: an append-only JSONL ledger at `$DSH_HOME/usage-meter/usage.jsonl`.
- **Web GUI dashboard**: a settings page showing cumulative totals and per-day per-model tables.
- **Safe & reversible**: a pure plugin — no core harness changes; uninstalling it leaves your data untouched.

## Requirements

- DeepSeek Harness with the **web profile** (`dsh web`).
- To build from source: Node `^22.19 || >=24` and pnpm.
- Packages are resolved from the npm `next` tag (`0.1.0-rc.6` line). Do **not** use the stale `latest` tag (`0.0.1-rc.1`), which references an unpublished dependency.

## Installation

### Option A — npm package (once published)

```sh
dsh plugin --profile web add @dsh-usage-meter/usage-bundle
```

The bundle layer mounts both the host recorder and the browser dashboard automatically.

### Option B — from this repository

```sh
# 1. Install the two packages into your web profile (absolute paths pass
#    through the CLI unchanged)
dsh plugin --profile web add \
  /path/to/dsh-usage-meter/packages/usage-host \
  /path/to/dsh-usage-meter/packages/usage-ui

# 2. Mount both plugin rows in the profile's user patch layer
cat >> "$DSH_HOME/profiles/web/cordis.patch.yml" <<'EOF'
- insert:
    - id: usage-meter
      name: '@dsh-usage-meter/usage-host'
    - id: usage-meter-ui
      name: '@dsh-usage-meter/usage-ui'
EOF
```

### Finish (both options)

**Restart `dsh web`** — host plugins are loaded at boot and do not hot-reload. Then open the Web GUI and you will see the **用量统计 / Usage** entry in the settings panel.

## Usage

Open Settings → **用量统计 / Usage**:

- **累计用量** — one row per model plus a grand total, covering the whole recorded span.
- **每日用量** — one table per day with per-model rows and the day total.
- Columns: 调用次数 (calls), 输入 (uncached input), 输出 (output), 缓存命中 (cache read), 缓存写入 (cache write), 计费合计 (billed).

## How usage is accounted

Counts follow DeepSeek's official billing vocabulary (they come straight from the harness `TokenUsage` fields; `inputTokens` is already cache-excluded):

| Column | Field | Meaning |
|---|---|---|
| 输入 | `inputTokens` | Uncached input tokens |
| 输出 | `outputTokens` | Output tokens |
| 缓存命中 | `cacheReadTokens` | Cache-hit tokens (`prompt_cache_hit_tokens`) |
| 缓存写入 | `cacheWriteTokens` | Cache-write tokens (DeepSeek does not currently report these; usually 0) |
| 计费合计 | `inputTokens + cacheReadTokens + cacheWriteTokens` | Total billed input-equivalent |

Days are bucketed by the **local timezone** by default; switch to UTC in the configuration if you prefer.

## Configuration

Override the host row in your profile's `cordis.patch.yml` (patch layers replace whole row configs, so restate every field you keep):

```yaml
- id: usage-meter
  name: '@dsh-usage-meter/usage-host'
  config:
    dir: ''              # data directory; empty = $DSH_HOME/usage-meter
    timezone: local      # day bucketing: local | utc
```

## Data & storage

`$DSH_HOME/usage-meter/usage.jsonl`, one JSON line per recorded call:

```json
{"time":1755130000000,"session":"session-1","provider":"deepseek-official","model":"deepseek-v4-flash","inputTokens":100,"outputTokens":20,"cacheReadTokens":30,"cacheWriteTokens":0}
```

- Recording starts at install time; sessions still live at startup are backfilled once. Older history is not retroactively scanned.
- Deleting the file (or the `usage-meter` directory) resets the counters.

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Dashboard shows 「读取用量数据失败」 / “Failed to load usage data” | The running `dsh web` process predates the plugin (or its last upgrade). Host plugins load only at boot — **restart `dsh web`** and refresh the page. |
| Settings page shows 「暂无用量记录」 / “No usage recorded yet” | No model calls have completed since install. Usage is recorded when an `assistant/message` carries a provider usage sample. |
| The settings entry is missing entirely | The profile patch rows are absent. Re-check the installation steps and the rows in `$DSH_HOME/profiles/web/cordis.patch.yml`. |
| No data for a session from before the install | Expected: history before the install time is not scanned (only live sessions at startup are backfilled). |

## How it works (maintainers)

- The host plugin `UsageMeterService` extends `TypertRemoteService` (`@deepseek-ai/dsh-typert-protocol`) and exposes `/api/usage-meter/summary` — the gateway derives the endpoint from the service binding, no code generation.
- The browser plugin registers into the `settings.section` slot and reads the snapshot over `connection.rpc.call('/api', 'usage-meter/summary', …)`.
- The client bundle is built with a tsdown preset vendored from the harness (`tsdown.preset.ts`): a `window.__ModuleLoader__.load(...)` closure factory with platform modules externalized and a purity gate against cross-plugin value imports.

## Development

```sh
pnpm install
pnpm typecheck   # tsc -b (src) + tsc -p tsconfig.tests.json (tests)
pnpm test        # vitest
pnpm build       # tsdown: host lib + client bundle
```

## License

MIT
