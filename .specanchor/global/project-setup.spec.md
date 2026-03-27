---
specanchor:
  level: global
  type: project-setup
  version: "1.0.0"
  author: "方壶"
  reviewers: []
  last_synced: "2026-03-27"
  last_change: "初始创建"
  applies_to: "**/*"
---

# 项目启动指南

## 基本信息
- 项目名称：claude-hud（fork 自 jarrod-watts/claude-hud）
- 类型：Claude Code statusline 插件
- 许可证：MIT

## 环境要求
- Node.js >= 18.0.0
- 包管理器：npm
- 零运行时依赖

## 启动命令
- 安装：`npm ci`
- 构建：`npm run build`（tsc → dist/）
- 开发：`npm run dev`（tsc --watch）
- 测试：`npm test`
- 覆盖率：`npm run test:coverage`

## 插件配置
- 插件 manifest：`.claude-plugin/plugin.json`（仅元数据）
- StatusLine 配置：用户 `~/.claude/settings.json` 中的 `statusLine` 字段
- HUD 自身配置：`~/.claude/plugins/claude-hud/config.json`
