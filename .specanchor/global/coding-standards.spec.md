---
specanchor:
  level: global
  type: coding-standards
  version: "1.0.0"
  author: "方壶"
  reviewers: []
  last_synced: "2026-03-27"
  last_change: "初始创建"
  applies_to: "**/*.ts"
---

# 编码规范

## 技术栈
- 语言：TypeScript 5，strict 模式
- 目标：ES2022，NodeNext 模块系统
- 运行时：Node.js 18+（纯 stdlib，零运行时依赖）

## 命名约定
- 文件命名：kebab-case（如 `tools-line.ts`、`config-reader.ts`）
- 类型/接口：PascalCase（如 `StdinData`、`HudConfig`、`RenderContext`）
- 函数：camelCase（如 `renderUsageLine`、`getContextPercent`）
- 常量：UPPER_SNAKE_CASE（如 `AUTOCOMPACT_BUFFER_PERCENT`、`DEFAULT_CONFIG`）

## 代码约定
- 模块导入使用 `.js` 后缀（NodeNext 要求）
- 类型导入使用 `import type`
- 导出函数签名使用显式返回类型
- 错误处理：catch 块使用空 catch 或 `error instanceof Error` 检查
- 颜色/样式：统一通过 `render/colors.ts` 的辅助函数，不直接写 ANSI 转义码

## Git 提交约定
- 格式：`<type>: <subject>`
- type：feat / fix / refactor / docs / chore / test
