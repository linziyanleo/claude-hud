---
specanchor:
  level: global
  type: architecture
  version: "1.0.0"
  author: "方壶"
  reviewers: []
  last_synced: "2026-03-27"
  last_change: "初始创建"
  applies_to: "**/*"
---

# 架构约定

## 目录结构约定
- 按功能层组织：`src/` 下按职责分文件（stdin、transcript、config、render）
- 渲染层分离：`src/render/` 负责所有输出，`src/render/lines/` 存放各行渲染器
- 入口文件：`src/index.ts`，支持依赖注入（`MainDeps`）用于测试

## 模块边界规则
- 数据层（stdin.ts、transcript.ts）不依赖渲染层
- 渲染层通过 `RenderContext` 接收所有数据，不直接调用数据层
- 配置层（config.ts）独立于数据层和渲染层
- 颜色工具（colors.ts）被所有渲染器共享

## 数据流约定
- 单次调用模型：每 ~300ms 被 Claude Code 调用一次
- stdin JSON → 解析 → 组装 RenderContext → render → stdout
- 所有 I/O 集中在 index.ts 的 main() 中协调

## 扩展约定
- 新增 HUD 行：在 `render/lines/` 下新建文件 + 在 `config.ts` 的 `HudElement` 联合类型中注册
- 新增数据源：在 `src/` 下新建文件 + 在 `RenderContext` 中添加字段 + 在 `main()` 中编排
