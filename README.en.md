# dsh-usage-meter

A DeepSeek Harness usage recorder: automatically tracks token usage per model call, aggregates it by model × day, and shows it in the Web GUI settings page.

English · [中文](README.md)

![Usage dashboard](docs/assets/usage-dashboard.png)

## Features

- Records each model call's **input / output / cache read / cache write**, aggregated by model × day
- Shows cumulative and daily breakdowns (calls, billed totals, …) in the **Usage** settings page
- Persists data to `$DSH_HOME/usage-meter/usage.jsonl`
- Bilingual (Chinese / English), following the Web GUI language setting

## Install

```sh
npx -p @deepseek-ai/dsh dsh plugin --profile web add @dsh-usage-meter/usage@0.2.0 --registry=https://registry.npmjs.org/
```

> Same npx distribution as the official `npx @deepseek-ai/dsh web`; if you run dsh from source (`pnpm dsh web`), replace the leading `npx -p @deepseek-ai/dsh dsh` with `pnpm dsh`.
>
> The pin is because the profile's pnpm supply-chain policy silently skips versions published less than a day ago — right after a release a bare package name may fail to resolve, while an explicit version installs immediately.

Restart `dsh web`, then open Settings → Usage.

## Uninstall

```sh
dsh plugin --profile web remove @dsh-usage-meter/usage
```

## License

MIT
