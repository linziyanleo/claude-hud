# CodeMap: statusline width and merge-group rendering

## Scope
- Feature: expanded statusline width handling, `DEFAULT_MERGE_GROUPS`, and narrow terminal rendering.
- Active project: `claude-hud`
- Active workdir: `/Users/fanghu/Documents/Test/claude-hud`

## Entry Points
- `src/index.ts`
  - Reads Claude Code stdin JSON via `readStdin()`.
  - Loads user config via `loadConfig()`.
  - Builds `RenderContext`.
  - Calls `render(ctx)`.

- `src/render/index.ts`
  - Main render coordinator.
  - Resolves terminal width.
  - Renders compact or expanded layout.
  - Packs `display.mergeGroups` in expanded layout.
  - Splits/truncates rows to terminal width.

## Width Sources
- `src/types.ts`
  - `StdinData.columns` was added as an accepted stdin field.

- `src/utils/terminal.ts`
  - `getTerminalWidth({ preferEnv: true })` checks:
    1. `process.env.COLUMNS`
    2. `process.stdout.columns`
    3. `process.stderr.columns`
    4. `/dev/tty` via `tty.WriteStream`
  - `getAdaptiveBarWidth()` maps width to progress bar size:
    - `<60`: 4 cells
    - `60-99`: 6 cells
    - `>=100`: 10 cells

## Merge-Group Flow
- `src/config.ts`
  - `DEFAULT_ELEMENT_ORDER`:
    `project`, `context`, `usage`, `zenmux`, `promptCache`, `memory`, `environment`, `tools`, `agents`, `todos`
  - `DEFAULT_MERGE_GROUPS`:
    `context`, `usage`, `zenmux`, `promptCache`, `memory`, `environment`

- `src/render/index.ts`
  - `buildMergeGroupLookup()` maps elements to their group.
  - `collectMergeSequence()` collects consecutive group elements from `elementOrder`.
  - `renderElementLine()` dispatches each element renderer.
  - `renderExpanded()` currently greedily packs rendered group elements in declared order.
  - Greedy packing preserves order but can produce more rows than necessary for Claude Code statusline stability.

## Relevant Element Renderers
- `src/render/lines/identity.ts`
  - Renders context label, bar, percentage, optional token breakdown.

- `src/render/lines/usage.ts`
  - Renders 5h/7d usage, bars, percentages, reset countdown.
  - Already has `display.usageCompact`, but this is a user config mode, not a width-driven layout mode.

- `src/render/lines/zenmux.ts`
  - Renders ZenMux 5h/7d quota with bars and reset countdown.
  - No compact width-driven variant currently exists.

- `src/render/lines/memory.ts`
  - Renders approximate RAM usage with bar and `used / total (percent)`.
  - No compact width-driven variant currently exists.

- `src/render/lines/environment.ts`
  - Renders `CLAUDE.md`, rules, MCP, hooks counts.

## Existing Tests
- `tests/render-width.test.js`
  - Width wrapping and CJK width tests.
  - Current tests assert rows remain visible at narrow widths, but do not protect against statusline row-count overflow.
  - New regression tests should cover:
    - 99 columns with context+usage+zenmux+memory+environment enabled.
    - 80 columns with the same user-facing config.
    - Core rows remain visible while output stays within a safe row budget.

- `tests/terminal.test.js`
  - Adaptive bar width source and thresholds.

## External Behavior Constraint
- Official Claude Code statusline docs allow multiple output lines, but also warn:
  - status bar width is limited;
  - long output can truncate or wrap awkwardly;
  - multi-line status lines with ANSI/OSC escape codes are more prone to rendering issues.

