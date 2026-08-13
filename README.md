# dsh-usage-meter

为 DeepSeek Harness 记录按「模型 × 天」的 token 用量——自动采集，Web GUI 设置页一目了然。

[🌐 English](README.en.md) · 中文

---

dsh 的用量信息散在会话日志里，想按月看每个模型烧了多少 token、缓存命中多少，得自己翻。dsh-usage-meter 把每次模型调用的 **输入 / 输出 / 缓存命中 / 缓存写入** 自动折叠成每日分模型统计，持久化到本地，并在设置页渲染成仪表盘。

**🎯 用量不该靠猜——打开设置页就能看到。**

## 亮点

- **零配置自动记录** — 装好、重启 `dsh web`，之后每次模型调用自动入账，无需任何操作。
- **按模型 × 天聚合** — 每天一张表，每个模型一行：调用次数、输入、输出、缓存命中、缓存写入、计费合计。
- **输入与缓存分开统计** — 计费输入拆成未命中缓存 / 缓存命中 / 缓存写入三份，命中多少一眼可见。
- **本地持久化** — 追加式 JSONL 账本 `$DSH_HOME/usage-meter/usage.jsonl`，可查、可删、可迁移。
- **双语仪表盘** — 设置页「用量统计」中英双语，跟随 Web GUI 的语言设置。

## 截图

设置 → **用量统计**：

![DeepSeek Harness 设置页中的用量概览仪表盘](docs/assets/usage-dashboard.png)

页面展示累计 Tokens、请求次数、模型数、按日趋势与模型明细；悬浮请求趋势图可查看当天每个模型的请求次数。

| 列 | 含义 |
|---|---|
| 调用次数 | 该模型当天完成的模型调用数 |
| 输入（未缓存） | 未命中缓存的输入 tokens（`inputTokens`） |
| 输出 | 输出 tokens（`outputTokens`） |
| 缓存命中 | 命中缓存的 tokens（`cacheReadTokens`，即 DeepSeek `prompt_cache_hit_tokens`） |
| 缓存写入 | 缓存写入 tokens（`cacheWriteTokens`，DeepSeek 暂不单独上报，通常为 0） |
| 计费合计 | 输入 + 缓存命中 + 缓存写入，即计费输入等价总量 |

还没有任何数据时，整页只显示一句提示；数据从安装时刻开始累计，启动时会把当时存活的会话回填一次。

## 配置

默认按**本地时区**分天；想按 UTC 分天，在 `$DSH_HOME/profiles/web/cordis.patch.yml` 覆盖 host 行（patch 是整行替换，需重述保留字段）：

```yaml
- id: usage-meter
  name: '@dsh-usage-meter/usage-host'
  config:
    dir: ''
    timezone: utc
```

## 安装

### 从 npm 安装（推荐）

```sh
dsh plugin --profile web add @dsh-usage-meter/usage-bundle @dsh-usage-meter/usage-host@0.1.1 --registry=https://registry.npmjs.org/
```

> **为什么显式钉 `usage-host@0.1.1`**：profile 启用了 pnpm 供应链 release-age 策略，发布不足 1 天的版本在范围解析时会被**静默跳过**——只写 bundle 可能装到有 bug 的 `0.1.0`（仪表盘报「读取用量数据失败」）。显式指定版本时 pnpm 会自动放行并安装。等 `0.1.1` 过了一天窗口后就不需要钉版本了。

### 从本地代码库安装

```sh
dsh plugin --profile web add \
  /path/to/dsh-usage-meter/packages/usage-host \
  /path/to/dsh-usage-meter/packages/usage-ui
```

再在 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加两行：

```yaml
- insert:
    - id: usage-meter
      name: '@dsh-usage-meter/usage-host'
    - id: usage-meter-ui
      name: '@dsh-usage-meter/usage-ui'
```

两种方式装完都要 **重启 `dsh web`**（宿主插件只在启动时加载）。npm 分发的是构建好的 `lib/`，安装时不需要跑构建脚本。

## 卸载 / 禁用

不想卸载、只想临时换回默认界面——在 `$DSH_HOME/profiles/web/cordis.patch.yml` 加：

```yaml
- id: usage-meter
  disabled: true
- id: usage-meter-ui
  disabled: true
```

重启 `dsh web` 即生效，删掉这几行恢复。彻底卸载：

```sh
dsh plugin --profile web remove @dsh-usage-meter/usage-bundle @dsh-usage-meter/usage-host
```

卸载不影响 `~/.dsh/usage-meter/usage.jsonl` 里的历史数据，重装后会接着统计。

## 构建与开发

```sh
pnpm install
pnpm typecheck   # tsc -b + tsc -p tsconfig.tests.json
pnpm test        # vitest
pnpm build       # tsdown → lib/index.js (host) + lib/client.js (browser)
```

客户端 bundle 以 `window.__ModuleLoader__.load({ id, factory })` 闭包工厂输出，CSS Modules 由 lightningcss 哈希化并注入 `<style data-plugin="…">`。发布 npm 新版本：`pnpm -r version patch && pnpm -r publish`（**必须用 pnpm**——`usage-bundle` 的 `workspace:^` 依赖需要它改写成 `^版本号`）。

## 工作原理

- **双插件结构** — host 半身（`usage-host`）负责记录与聚合，浏览器半身（`usage-ui`）负责设置页渲染；host 半身的 `apply()` 为空。
- **Host 记录** — `UsageMeterService`（`TypertRemoteService`）监听 `session/event`，把 `request/header` 的模型路由和 `assistant/message` 的 usage 采样折叠进每日分模型桶，逐条追加 JSONL；端点 `/api/usage-meter/summary` 通过 `ctx.typert.register()` 严格注册，网关直接认领（不依赖 SRC 标记扫描，见 0.1.1 修复）。
- **槽位** — 浏览器插件注册进 `settings.section`（id `usage`），随插件 fiber 一并注销。
- **数据** — 浏览器通过 `connection.rpc.call('/api', 'usage-meter/summary', …)` 读取聚合快照，组件用本地状态持有。
- **本地化** — 自持 `usage.meter` 命名空间，中文 + English，跟随 GUI 语言设置。

## 许可

MIT
