# Project Codemap — claude-hud

## 概述

Claude HUD 是一个 Claude Code 插件，显示实时多行 statusline。展示 context health、tool activity、agent status 和 todo progress。

## 目录结构

```
src/
├── index.ts              # 入口：读取 stdin → 解析 transcript → 调用 render
├── stdin.ts              # 解析 Claude Code 通过 stdin 传入的 JSON（model、context、rate_limits）
├── transcript.ts         # 解析 JSONL 格式的 transcript 文件（tools、agents、todos）
├── config.ts             # 加载/验证/合并用户配置（HudConfig）
├── config-reader.ts      # 读取 MCP/hooks/rules 等外部配置计数
├── git.ts                # Git 状态检测（branch、dirty、ahead/behind）
├── types.ts              # TypeScript 类型定义（StdinData、UsageData、RenderContext 等）
├── constants.ts          # 常量定义
├── memory.ts             # 系统内存使用检测
├── version.ts            # Claude Code 版本检测
├── speed-tracker.ts      # 速度追踪
├── extra-cmd.ts          # 额外命令参数解析与执行
├── claude-config-dir.ts  # Claude 配置目录定位
├── debug.ts              # 调试工具
├── utils/
│   └── terminal.ts       # 终端工具（宽度计算等）
└── render/
    ├── index.ts           # 渲染协调器：组装各行并输出
    ├── session-line.ts    # Compact 模式：单行显示所有信息
    ├── tools-line.ts      # 工具活动行（opt-in）
    ├── agents-line.ts     # Agent 状态行（opt-in）
    ├── todos-line.ts      # Todo 进度行（opt-in）
    ├── colors.ts          # ANSI 颜色辅助函数
    └── lines/
        ├── index.ts       # Barrel export
        ├── project.ts     # Line 1: model badge + project + git
        ├── identity.ts    # Line 2a: context bar
        ├── usage.ts       # Line 2b: usage bar（与 identity 组合）
        ├── memory.ts      # 内存使用行
        └── environment.ts # 配置计数行（opt-in）
```

## 数据流

```
Claude Code → stdin JSON → parse (stdin.ts)
                              ├── model / context_window / rate_limits → 原生准确数据
                              └── transcript_path → transcript.ts → tools / agents / todos
                                                  → render/index.ts → stdout → Claude Code 显示
```

## 技术栈

- **Runtime**: Node.js 18+ / Bun
- **Language**: TypeScript 5, ES2022, NodeNext modules
- **Build**: tsc 直接编译到 dist/
- **Test**: Node.js 内置 test runner + c8 coverage
- **Dependencies**: 零运行时依赖（纯 Node.js stdlib）
