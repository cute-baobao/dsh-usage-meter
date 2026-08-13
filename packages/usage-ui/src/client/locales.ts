/**
 * Usage dashboard locale dictionary and its LocaleNamespaceMap merge, so
 * registered components receive a typed `t` bound to this namespace.
 * @module @dsh-usage-meter/usage-ui/client/locales
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'usage.meter' as const

export const zh = {
  'nav': '用量统计',
  'loading': '正在读取用量数据…',
  'error': '读取用量数据失败',
  'errorHint': '请确认 host 侧 usage-host 插件已安装；数据保存在 $DSH_HOME/usage-meter/usage.jsonl。',
  'empty': '暂无用量记录。运行几次对话后，这里会按「模型 × 天」展示 token 用量。',
  'totals.title': '累计用量',
  'day.title': '每日用量',
  'col.date': '日期',
  'col.model': '模型',
  'col.calls': '调用次数',
  'col.input': '输入（未命中缓存）',
  'col.output': '输出',
  'col.cacheRead': '缓存命中',
  'col.cacheWrite': '缓存写入',
  'col.billed': '计费合计',
  'day.total': '当日合计',
  'grand.total': '总计',
  'updatedAt': '更新时间',
  'dashboard.title': '用量概览',
  'metric.tokens': '累计 Tokens',
  'metric.tokensUnit': 'Tokens',
  'metric.calls': 'API 请求次数',
  'metric.callsUnit': '次请求',
  'metric.activeDays': '个活跃日期',
  'metric.models': '使用模型',
  'metric.modelsDetail': '已记录模型数',
  'chart.tokens': 'Tokens 趋势',
  'chart.calls': '请求次数趋势',
  'chart.daily': '按日聚合',
  'models.title': '模型明细',
  'models.description': '按模型累计',
} as const

export const en = {
  'nav': 'Usage',
  'loading': 'Loading usage data…',
  'error': 'Failed to load usage data',
  'errorHint': 'Make sure the host-side usage-host plugin is installed; data lives at $DSH_HOME/usage-meter/usage.jsonl.',
  'empty': 'No usage recorded yet. Run a few conversations and per-model daily token usage will show up here.',
  'totals.title': 'Cumulative usage',
  'day.title': 'Daily usage',
  'col.date': 'Date',
  'col.model': 'Model',
  'col.calls': 'Calls',
  'col.input': 'Input (uncached)',
  'col.output': 'Output',
  'col.cacheRead': 'Cache read',
  'col.cacheWrite': 'Cache write',
  'col.billed': 'Billed',
  'day.total': 'Day total',
  'grand.total': 'Total',
  'updatedAt': 'Updated at',
  'dashboard.title': 'Usage overview',
  'metric.tokens': 'Total tokens',
  'metric.tokensUnit': 'tokens',
  'metric.calls': 'API requests',
  'metric.callsUnit': 'requests',
  'metric.activeDays': 'active days',
  'metric.models': 'Models used',
  'metric.modelsDetail': 'recorded models',
  'chart.tokens': 'Token trend',
  'chart.calls': 'Request trend',
  'chart.daily': 'Daily aggregate',
  'models.title': 'Model breakdown',
  'models.description': 'Cumulative by model',
} as const

/** Union of the dictionary keys both locales define. */
export type UsageMeterLocaleKey = keyof typeof zh & keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'usage.meter': UsageMeterLocaleKey
  }
}
