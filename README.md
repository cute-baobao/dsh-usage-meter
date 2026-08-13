# dsh-usage-meter

记录 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 token 用量——按模型、按天——并在 Web GUI 里用仪表盘展示。

插件自动记录每一次模型调用的**输入、输出、缓存命中、缓存写入**，按**模型 × 自然日**聚合，持久化到本地，并在设置面板里渲染一个「用量统计」页面。

[English](README.en.md) | 中文

## 功能

- **零配置**：装好插件、重启 `dsh web` 即可，之后每次模型调用自动记录。
- **按模型 × 天明细**：调用次数、输入（未命中缓存）、输出、缓存命中（cache read）、缓存写入（cache write）、计费合计。
- **本地持久化**：追加式 JSONL 账本，位于 `$DSH_HOME/usage-meter/usage.jsonl`。
- **Web GUI 仪表盘**：设置页展示累计用量与每日分模型表格。
- **安全可逆**：纯插件实现，不改动 harness 核心；卸载后数据原样保留。

## 环境要求

- 安装了 **web profile** 的 DeepSeek Harness（`dsh web`）。
- 从源码构建需要 Node `^22.19 || >=24` 和 pnpm。
- 依赖解析自 npm 的 `next` 标签（`0.1.0-rc.6` 线）。**不要**使用陈旧的 `latest` 标签（`0.0.1-rc.1`），它引用了一个已下架的依赖。

## 安装

### 方式一：npm 包（发布后）

```sh
dsh plugin --profile web add @dsh-usage-meter/usage-bundle
```

bundle 层会自动挂载 host 记录器和浏览器仪表盘。

### 方式二：从本仓库安装

```sh
# 1. 把两个包装进 web profile（绝对路径不会被 CLI 改写）
dsh plugin --profile web add \
  /path/to/dsh-usage-meter/packages/usage-host \
  /path/to/dsh-usage-meter/packages/usage-ui

# 2. 在 profile 的用户 patch 层挂载两个插件行
cat >> "$DSH_HOME/profiles/web/cordis.patch.yml" <<'EOF'
- insert:
    - id: usage-meter
      name: '@dsh-usage-meter/usage-host'
    - id: usage-meter-ui
      name: '@dsh-usage-meter/usage-ui'
EOF
```

### 完成安装（两种方式都一样）

**重启 `dsh web`** ——宿主插件只在启动时加载，不会热更新。重启后打开 Web GUI，设置面板左侧会出现「用量统计」入口。

## 使用

打开 设置 → **用量统计**：

- **累计用量**：每个模型一行，外加总计行，覆盖全部记录区间。
- **每日用量**：每天一张表，含分模型行与当日合计。
- 列：调用次数、输入（未命中缓存）、输出、缓存命中、缓存写入、计费合计。

## 用量口径

统计口径与 DeepSeek 官方计费一致（字段直接来自 harness 的 `TokenUsage`，`inputTokens` 已剔除缓存命中部分）：

| 列 | 字段 | 含义 |
|---|---|---|
| 输入 | `inputTokens` | 未命中缓存的输入 tokens |
| 输出 | `outputTokens` | 输出 tokens |
| 缓存命中 | `cacheReadTokens` | 命中缓存的 tokens（`prompt_cache_hit_tokens`） |
| 缓存写入 | `cacheWriteTokens` | 缓存写入 tokens（DeepSeek 目前不单独上报，通常为 0） |
| 计费合计 | `inputTokens + cacheReadTokens + cacheWriteTokens` | 计费输入等价总量 |

按「天」分桶默认使用**本地时区**；如需 UTC 可在配置中切换。

## 配置

在 profile 的 `cordis.patch.yml` 里按 id 覆盖 host 行（patch 是整行替换，需要重述要保留的字段）：

```yaml
- id: usage-meter
  name: '@dsh-usage-meter/usage-host'
  config:
    dir: ''              # 数据目录；空 = $DSH_HOME/usage-meter
    timezone: local      # 按天分桶时区：local | utc
```

## 数据与存储

`$DSH_HOME/usage-meter/usage.jsonl`，每行一条调用记录：

```json
{"time":1755130000000,"session":"session-1","provider":"deepseek-official","model":"deepseek-v4-flash","inputTokens":100,"outputTokens":20,"cacheReadTokens":30,"cacheWriteTokens":0}
```

- 从安装时刻开始记录；启动时会把当时存活的会话回填一次，更早的历史不会追溯。
- 删除该文件（或整个 `usage-meter` 目录）即可清零重新统计。

## 故障排查

| 现象 | 原因与处理 |
|---|---|
| 仪表盘提示「读取用量数据失败」 | 正在运行的 `dsh web` 进程早于插件（或插件升级）启动。宿主插件只在启动时加载——**重启 `dsh web`** 并刷新页面。 |
| 设置页显示「暂无用量记录」 | 安装后还没有完成过模型调用。只有当 `assistant/message` 携带 provider 用量采样时才会计数。 |
| 设置页里没有「用量统计」入口 | profile 的 patch 行缺失。按安装步骤核对 `$DSH_HOME/profiles/web/cordis.patch.yml` 中的两行。 |
| 安装前的会话没有数据 | 符合预期：安装时间之前的历史不会扫描（仅启动时存活的会话会被回填）。 |

## 工作原理（维护者）

- host 插件 `UsageMeterService` 继承 `TypertRemoteService`（`@deepseek-ai/dsh-typert-protocol`），暴露 `/api/usage-meter/summary`——网关从服务绑定自动推导端点，无需代码生成。
- 浏览器插件注册进 `settings.section` 槽位，通过 `connection.rpc.call('/api', 'usage-meter/summary', …)` 读取聚合快照。
- 客户端 bundle 用移植自 harness 的 tsdown preset（`tsdown.preset.ts`）构建：`window.__ModuleLoader__.load(...)` 闭包工厂，平台模块外置，并带跨插件值导入纯度门。

## 开发

```sh
pnpm install
pnpm typecheck   # tsc -b（src）+ tsc -p tsconfig.tests.json（tests）
pnpm test        # vitest
pnpm build       # tsdown：host lib + client bundle
```

## 许可

MIT
