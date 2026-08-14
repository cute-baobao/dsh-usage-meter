# dsh-usage-meter

DeepSeek Harness 用量统计插件：自动记录模型调用的 token 用量，按「模型 × 小时」聚合，在 Web GUI 设置页以堆叠柱状图展示（每小时一根柱子，按模型分色）。

[🌐 English](README.en.md) · 中文

![用量统计仪表盘](docs/assets/usage-dashboard.png)

## 安装

```sh
pnpm dsh plugin --profile web add @dsh-usage-meter/usage
```

> 刚发布当天若解析失败，显式钉版本（如 `@dsh-usage-meter/usage@0.3.0`）即可。

重启 `dsh web`，设置 → 用量统计 即可查看。

## 卸载

```sh
pnpm dsh plugin --profile web remove @dsh-usage-meter/usage
```

## 数据

记录在 `$DSH_HOME/usage-meter/usage.jsonl`，启动时按小时重新聚合；界面中英双语，跟随 GUI 语言。

## 许可

MIT
