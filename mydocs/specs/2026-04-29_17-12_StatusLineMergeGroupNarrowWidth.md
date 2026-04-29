# SDD Spec: StatusLine MergeGroup Narrow Width

## 0. Open Questions
- [x] Claude Code statusline 是否存在硬性最大可见行数没有在官方文档中明确说明；当前按用户截图、本地复现和官方文档对长输出截断/换行风险的描述，采用保守行数预算处理。

## 1. Requirements (Context)
- **Goal**: 修复 expanded layout 下 `DEFAULT_MERGE_GROUPS` 在窄宽度下因为 merge-group 被拆成过多行而导致整组在 Claude Code UI 中消失的问题。
- **In-Scope**:
  - 保持 `context`、`usage`、`zenmux` 这些核心状态在窄宽度下可见。
  - 在 80-160 列区间尽量保留 `memory` 和 `environment`，但允许使用紧凑文案。
  - 当宽度更窄且不可能同时显示所有元素时，按优先级降级或隐藏低价值可选元素，避免核心行消失。
  - 保留已有宽度来源修复：`stdin.columns`、`COLUMNS`、TTY、fallback。
- **Out-of-Scope**:
  - 不改用户配置文件。
  - 不引入新的公开配置项，除非后续验证发现必须暴露。
  - 不重写整个 layout 系统。

## 1.1 Context Sources
- Requirement Source: 用户反馈：`memory` 被拆到另一行，宽度小于等于 99 时整行 merge-group 消失；随后确认宽度小于等于 160 也存在同类风险。
- Code Refs:
  - `src/render/index.ts`
  - `src/render/lines/zenmux.ts`
  - `src/render/lines/memory.ts`
  - `src/config.ts`
  - `tests/render-width.test.js`
- External Docs:
  - `https://code.claude.com/docs/en/statusline`
- Live Reproduction:
  - 使用当前用户配置构造 mock `RenderContext`，扫 `columns=80,90,98,99,100,110,120,160,240,300`。

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: `feature`
- Codemap File: `mydocs/codemap/2026-04-29_17-12_statusline_width_codemap.md`
- Key Index:
  - Entry Points: `src/index.ts`, `src/render/index.ts`
  - Core Logic: `renderExpanded()`, `renderElementLine()`, `wrapLineToWidth()`, `getAdaptiveBarWidth()`
  - Element Renderers: `identity.ts`, `usage.ts`, `zenmux.ts`, `memory.ts`, `environment.ts`

## 1.6 Context Bundle Snapshot (Lite)
- Bundle Level: `Lite`
- Bundle File: N/A
- Key Facts:
  - 当前用户配置启用了 expanded layout、usage bar、ZenMux、memory、config counts。
  - 当前默认 merge group 包含 `context`, `usage`, `zenmux`, `promptCache`, `memory`, `environment`。
  - 本地复现显示 `columns=80/90/98/99/100/160` 曾输出 4 行：项目行 + 3 行 merge-group。
  - `columns=240` 才降为 3 行；`columns=300` 才降为 2 行。
- Open Questions:
  - Claude Code UI 是否硬性限制 statusline 高度未公开；但用户截图与官方文档提示支持当前推断。

## 2. Research Findings
- 事实与约束:
  - `renderExpanded()` 当前只做按 `elementOrder` 的顺序贪心打包。
  - 顺序贪心能保证不超宽，但不能保证 statusline 输出行数安全。
  - 在用户配置下，99 列时输出：
    - 行 1: project/model/cost
    - 行 2: context + usage
    - 行 3: ZenMux
    - 行 4: memory + environment
  - `memory` 本身不是唯一超宽元素；根因是 merge-group 没有“行数预算”和“窄屏紧凑变体”，100-160 列仍可能因为 usage/ZenMux/memory 的完整形态拆出第 3 条信息行。
  - 只补 `stdin.columns` 只能让宽度更准，不能解决“行数过多导致宿主 statusline 渲染失效”。
- 风险与不确定项:
  - 如果继续要求所有 opt-in 元素在任意窄宽度都完整显示，会违反 statusline 的可用空间约束。
  - 需要定义可解释的降级优先级，避免为了显示 `memory` 牺牲核心状态。

## 2.1 Next Actions
- 进入 Plan。
- 本任务小而聚焦，跳过 Innovate；采用单方案修复：有行数预算的窄屏降级。

## 3. Innovate (Optional: Options & Decision)
### Skip
- Skipped: true
- Reason: 问题已定位到单一局部算法缺陷；不需要多方案架构权衡。

## 4. Plan (Contract)
### 4.1 File Changes
- `src/render/index.ts`
  - 增加 expanded merge-group 的窄屏行数预算逻辑。
  - 当 `terminalWidth <= 160` 且默认信息组会超过安全行数时，使用紧凑元素重渲染并重新打包。
  - 执行中补充事实：当前用户配置在 100/160 列仍会输出 4 行；如果只处理 `<=99`，同类宿主渲染风险会保留在 100-160 区间。
  - 如果紧凑后仍超过预算，按优先级移除低价值可选元素，保证核心元素不消失。

- `src/render/lines/zenmux.ts`
  - 增加宽度驱动的 compact render 选项。
  - compact 模式显示百分比，省略 bar 和 reset countdown。

- `src/render/lines/usage.ts`
  - 增加宽度驱动的 compact render 选项。
  - compact 模式显示 5h/7d 百分比，省略 bar 和 reset countdown，避免最终 wrap 阶段把 weekly 段拆成额外行。

- `src/render/lines/memory.ts`
  - 增加宽度驱动的 compact render 选项。
  - compact 模式显示 `used / total (percent)`，省略 bar。

- `tests/render-width.test.js`
  - 增加 99 列回归：当前用户配置下总输出不超过 3 行，且 `Context`、`Usage`、`ZenMux`、`Approx RAM/内存`、`CLAUDE.md` 可见。
  - 增加 80 列回归：核心 `Context`、`Usage`、`ZenMux` 可见，总输出不超过 3 行；可选元素允许紧凑或按优先级隐藏。
  - 更新旧的“32 列必须显示所有元素”测试，使其符合 statusline 空间约束。

### 4.2 Signatures
- `type RenderDensity = 'normal' | 'compact'`
- `type RenderElementOptions = { alignProgressLabels?: boolean; density?: RenderDensity }`
- `function renderElementLine(ctx: RenderContext, element: HudElement, options?: RenderElementOptions): string | null`
- `function renderUsageLine(ctx: RenderContext, alignLabels?: boolean, options?: { density?: RenderDensity }): string | null`
- `function renderZenmuxLine(ctx: RenderContext, options?: { density?: RenderDensity }): string | null`
- `function renderMemoryLine(ctx: RenderContext, options?: { density?: RenderDensity }): string | null`
- `function packMergeRows(renderedGroupLines: Array<{ element: HudElement; line: string }>, terminalWidth: number | null): Array<{ elements: HudElement[]; line: string }>`
- `function renderMergeSequence(ctx: RenderContext, mergeSequence: HudElement[], terminalWidth: number | null): Array<{ line: string; isActivity: boolean }>`

### 4.3 Implementation Checklist
- [x] 1. 在 `src/render/index.ts` 抽出当前 merge-group 贪心打包为 `packMergeRows()`，保持现有行为不变。
- [x] 2. 增加 `RenderDensity` / `RenderElementOptions`，让 `renderElementLine()` 可以把 `density` 传给 `usage`、`zenmux` 和 `memory`。
- [x] 3. 在 `src/render/lines/usage.ts` 增加 compact 模式：保留 5h/7d 百分比，省略 bar 和 reset countdown。
- [x] 4. 在 `src/render/lines/zenmux.ts` 增加 compact 模式：保留 `ZenMux 5h: 97% | 7d: 55%`，省略 bar 和 reset countdown。
- [x] 5. 在 `src/render/lines/memory.ts` 增加 compact 模式：保留 `内存 9.2 GB / 24 GB (38%)`，省略 bar。
- [x] 6. 增加 `renderMergeSequence()`：先 normal 打包；若 `terminalWidth <= 160` 且 group rows 超过 2，则 compact 重渲染 `usage` / `zenmux` / `memory` 后重打包；仍超过 2 时，按 `memory -> promptCache -> environment` 顺序移除可选元素后重打包。
- [x] 7. 用 `renderMergeSequence()` 替换 `renderExpanded()` 中的内联 merge-group 打包逻辑。
- [x] 8. 更新 `tests/render-width.test.js`，覆盖 160、99、80、32 列的行数预算和核心元素可见性。
- [x] 9. 运行验证：
  - `npm run build && node --test tests/render-width.test.js tests/terminal.test.js`
  - `npm test`
  - `git diff --check`

## 5. Execute Log
- [x] Step 1: Added width source support so render honors `stdin.columns`, temporarily exports `COLUMNS` during render, and can fall back to `/dev/tty`.
- [x] Step 2: Reproduced the merge-group failure mode as a row-budget issue: narrow widths produced project + 3 information rows.
- [x] Step 3: Added merge-group packing helpers, compact density renderers, and narrow-width row budget fallback.
- [x] Step 4: Updated regression tests for 32, 80, 99, 160, stdin `columns`, and terminal fallback behavior.
- [x] Step 5: Verified targeted tests and full test suite.

## 6. Review Verdict
- Spec coverage: PASS
- Behavior check: PASS
- Regression risk: Low-Medium; layout behavior changes only when the default merge group would exceed the narrow-width row budget.
- Follow-ups: None required for this fix.

## 7. Plan-Execution Diff
- Initial user-visible threshold was `<=99`, but live reproduction showed the same 4-line failure shape still existed through `<=160`; the contract was updated before implementation to apply the row budget at `<=160`.
- `usage` compact density was added alongside `zenmux` and `memory` because the weekly reset segment could still force an extra row after compacting only ZenMux/memory.
