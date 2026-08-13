# dsh-usage-meter

DeepSeek Harness 用量统计插件：记录每天、每个模型消耗的 token 用量（输入 / 输出 / 缓存命中 / 缓存写入），持久化到本地，并在 Web GUI 的设置页里渲染成仪表盘。

## 功能

- **Host 记录器**（`@dsh-usage-meter/usage-host`）：监听 session 事件流，把 `request/header` 的模型路由和 `assistant/message` 的 usage 采样折叠成「模型 × 天」的用量桶，每条调用以一行 JSON 追加写入 `$DSH_HOME/usage-meter/usage.jsonl`。
- **Web 仪表盘**（`@dsh-usage-meter/usage-ui`）：在 Web GUI 的设置页新增「用量统计」入口，展示累计用量、每日分模型明细（调用次数、输入、输出、缓存命中、缓存写入、计费合计）。
- **安装层**（`@dsh-usage-meter/usage-bundle`）：一条 cordis patch，同时挂载 host 记录器和浏览器 roster 行。

## 用量口径

与 DeepSeek 官方计费口径一致（字段来自 harness 的 `TokenUsage`，`inputTokens` 是不含缓存的输入）：

- `输入` = `inputTokens`（未命中缓存的输入）
- `缓存命中` = `cacheReadTokens`（DeepSeek 的 `prompt_cache_hit_tokens`）
- `计费合计` = `inputTokens + cacheReadTokens + cacheWriteTokens`
- `缓存写入` = `cacheWriteTokens`（DeepSeek 官方目前不单独上报，通常为 0）

按「天」分桶默认使用本地时区，可在配置里改为 `utc`。

## 仓库结构

```
packages/
  usage-host/      host 插件：聚合 + JSONL 持久化 + usage-meter Typert 远程服务
  usage-ui/        client 插件：Web GUI 设置页仪表盘
  usage-bundle/    可安装的 profile bundle（cordis.patch.yml）
```

## 安装

### 方式一：发布到 npm 后（推荐）

```sh
dsh plugin --profile web add @dsh-usage-meter/usage-bundle
```

bundle 依赖会自动装进 profile，patch 会挂载两个插件行。

### 方式二：从本仓库直接安装（未发布时）

```sh
# 1. 把两个包装进 web profile（绝对路径不会被 CLI 重写）
dsh plugin --profile web add \
  /path/to/dsh-usage-meter/packages/usage-host \
  /path/to/dsh-usage-meter/packages/usage-ui

# 2. 在 profile 的用户层挂载两个行
cat >> "$DSH_HOME/profiles/web/cordis.patch.yml" <<'EOF'
- insert:
    - id: usage-meter
      name: '@dsh-usage-meter/usage-host'
    - id: usage-meter-ui
      name: '@dsh-usage-meter/usage-ui'
EOF
```

两种方式完成后重启 `dsh web`，设置页左侧会出现「用量统计」入口。

### 配置

在 profile 的 `cordis.patch.yml` 里按 id 覆盖整行配置（patch 是整行替换，需要重述要保留的字段）：

```yaml
- id: usage-meter
  name: '@dsh-usage-meter/usage-host'
  config:
    dir: ''              # 数据目录；空 = $DSH_HOME/usage-meter
    timezone: local      # 按天分桶时区：local | utc
```

## 数据文件

`$DSH_HOME/usage-meter/usage.jsonl`，每行一条调用记录：

```json
{"time":1755130000000,"session":"session-1","provider":"deepseek-official","model":"deepseek-v4-flash","inputTokens":100,"outputTokens":20,"cacheReadTokens":30,"cacheWriteTokens":0}
```

记录从插件安装时刻开始收集；启动时会把当时已加载的会话回填一遍。插件安装之前的历史会话不会追溯（除非它们在安装时还活着）。

## 工作原理

- Host 侧 `UsageMeterService` 继承 `TypertRemoteService`（来自 `@deepseek-ai/dsh-typert-protocol`），自动向 API 网关暴露 `/api/usage-meter/summary`，浏览器直接通过该 RPC 读取聚合快照，无需任何代码生成。
- Client 侧通过 `ctx.slots.inject('settings.section', …)` 注册设置页（与 ui-settings-plugins 相同的方式），数据只走 inject 回调 + 组件本地状态。
- Client bundle 用移植自 harness 的 tsdown preset 构建：产出 `window.__ModuleLoader__.load(...)` 闭包工厂，react 等平台模块外置，跨插件值导入会被纯度门拒绝。

## 开发

```sh
pnpm install
pnpm typecheck   # tsc -b（src）+ tsc -p tsconfig.tests.json（tests）
pnpm test        # vitest
pnpm build       # tsdown：host lib + client bundle
```

依赖发布在 npm `next` 标签的 `0.1.0-rc.6` 系列（`latest` 标签是陈旧的 `0.0.1-rc.1`，依赖已下架的 `@deepseek-ai/dsh-compact`，不要使用）。

## 许可

MIT
