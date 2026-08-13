# @dsh-usage-meter/usage-ui

usage meter 的浏览器半身：向 Web GUI 的设置页贡献一个「用量统计」section，通过 `connection.rpc.call('/api', 'usage-meter/summary', …)` 读取 host 聚合快照并渲染。

## 浏览器注册

- 注册进 `settings.section` 槽位（id `usage`），导航标签随 locale 变化。
- 数据只通过 inject 回调（`fetchSummary`）进入组件，组件内部用本地状态持有快照，不订阅外部源。
- 文本全部走 `usage.meter` locale 命名空间（zh/en）。

## 构建

`tsdown.config.ts` 使用仓库根目录移植自 DeepSeek Harness 的 `tsdown.preset.ts`（`clientBundle`）：产出 `lib/client.js`（`window.__ModuleLoader__.load` 闭包工厂），react / cordis / ui-slots 等平台模块外置，跨插件值导入被纯度门拒绝。改完代码必须重新 `pnpm --filter @dsh-usage-meter/usage-ui bundle`，`dsh web` 服务的是构建产物。

## Model Experience

None：纯展示层，不发起模型请求。

#### KV Cache effect

None：只读渲染 host 已聚合的数字。
