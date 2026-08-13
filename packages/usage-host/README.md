# @dsh-usage-meter/usage-host

Host 侧用量记录器：把 session 事件流折叠成「模型 × 天」的 token 用量，持久化到 `$DSH_HOME/usage-meter/usage.jsonl`，并作为 `usage-meter/summary` Typert 远程服务暴露给 Web GUI。

## 服务

`UsageMeterService extends TypertRemoteService`（service key `usageMeter`）：

- 构造时订阅 `session/event` 事件流；`request/header` 记录当前路由（provider/model），`assistant/message` 带 usage 采样时产生一条调用记录。
- 启动时（`Service.init`）先加载持久化的 JSONL，再把 `ctx.sessions.list()` 里的存活会话回填一遍。
- `@Remote('summary')`：返回完整聚合快照（累计 + 每日分模型桶）。
- 写盘通过 promise 尾串行化，插件卸载时 flush。

## 配置

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `dir` | string | `''` | 数据目录；空字符串解析为 `$DSH_HOME/usage-meter` |
| `timezone` | `'local' \| 'utc'` | `'local'` | 按天分桶时区 |

## 数据

`usage.jsonl` 每行一条调用记录（见根 README「数据文件」）。`usage-meter/summary` 返回 `UsageSummary`：

```ts
interface UsageSummary {
  generatedAt: number          // 快照时间（epoch ms）
  timezone: 'local' | 'utc'
  models: string[]             // 出现过的模型，升序
  days: UsageDay[]             // 按日期升序
  totals: UsageBucket          // 全量累计
}
```

## Model Experience

None：记录器只读 session 事件日志与聚合结果，不发起任何模型请求，也不修改模型可见的输入。

#### KV Cache effect

None：既不组装也不发送 provider 请求；`cacheReadTokens`/`cacheWriteTokens` 只是把适配器已上报的用量原样折叠。
