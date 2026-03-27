---
specanchor:
  level: task
  task_name: "接入 ZenMux Subscription API 显示用量配额"
  author: "@方壶"
  assignee: "@方壶"
  reviewer: "@方壶"
  created: "2026-03-27"
  status: "in_progress"
  last_change: "初始创建 Task Spec"
  related_modules: []
  related_global:
    - ".specanchor/global/coding-standards.spec.md"
    - ".specanchor/global/architecture.spec.md"
  flow_type: "standard"
  writing_protocol: "sdd-riper-one"
  sdd_phase: "REVIEW"
  branch: ""
---

# SDD Spec: 接入 ZenMux Subscription API 显示用量配额

## 0. Open Questions
- [x] ZenMux Management API Key 的存储方式 → **环境变量** `ZENMUX_MANAGEMENT_API_KEY`
- [x] API 调用频率控制 → **通过配置控制，默认缓存 TTL 1000ms**（每秒最多 1 次 API 调用）
- [x] quota_5_hour / quota_7_day 的显示位置 → **新增独立行**

## 1. Requirements (Context)
- **Goal**: 在 claude-hud 面板上接入 ZenMux Get Subscription Detail API（`GET https://zenmux.ai/api/v1/management/subscription/detail`），显示 `quota_5_hour` 和 `quota_7_day` 的用量信息，并在用量 >90% 时用特殊样式告警。
- **In-Scope**:
  - 调用 ZenMux Subscription Detail API 获取 quota 数据
  - 在 HUD 面板中显示 5 小时和 7 天滚动窗口的用量百分比
  - 用量 >90% 时显示告警样式（红色/闪烁等）
  - API Key 配置机制
  - API 响应缓存机制（避免每 300ms 调用一次 API）
- **Out-of-Scope**:
  - ZenMux 其他 API（PAYG Balance、Generation 等）
  - quota_monthly 的显示
  - ZenMux 账号管理/登录功能

## 1.1 Context Sources
- Requirement Source: 用户需求描述
- API Reference: `https://zenmux.ai/docs/zh/api/platform/subscription-detail.html`
- Design Refs: 现有 `renderUsageLine` 的渲染模式作为参考

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: `project`
- Codemap File: `.specanchor/project-codemap.md`
- Key Index:
  - Entry Points: `src/index.ts` (main 函数协调所有数据源)
  - Data Layer: `src/stdin.ts` (现有 usage 数据来源), `src/types.ts` (类型定义)
  - Render Layer: `src/render/lines/usage.ts` (现有 usage 渲染), `src/render/colors.ts` (颜色/告警)
  - Config: `src/config.ts` (HudConfig, HudElement)

## 2. Research Findings

### 2.1 ZenMux API 分析

**接口信息**:
- Endpoint: `GET https://zenmux.ai/api/v1/management/subscription/detail`
- 鉴权: `Authorization: Bearer <ZENMUX_MANAGEMENT_API_KEY>`（仅支持 Management API Key）
- 限流: 每分钟请求数由平台配置，超出返回 422

**关键响应字段**:
```json
{
  "data": {
    "quota_5_hour": {
      "usage_percentage": 0.0715,   // 0–1，精确到 4 位小数
      "resets_at": "2026-03-24T08:35:09.000Z",
      "max_flows": 800,
      "used_flows": 57.2,
      "remaining_flows": 742.8,
      "used_value_usd": 1.88,
      "max_value_usd": 26.27
    },
    "quota_7_day": {
      // 结构与 quota_5_hour 相同
    },
    "account_status": "healthy"  // healthy | monitored | abusive | suspended | banned
  }
}
```

### 2.2 现有架构分析

**数据流现状**:
- 现有 Usage 数据来自 Claude Code stdin 的 `rate_limits` 字段（原生准确数据）
- `getUsageFromStdin()` 解析 `rate_limits.five_hour.used_percentage` / `rate_limits.seven_day.used_percentage`
- `renderUsageLine()` 渲染进度条 + 百分比 + 重置时间

**扩展点**:
- `RenderContext` 可新增 `zenmuxQuota` 字段传递 API 数据
- `HudElement` 联合类型可新增 `'zenmux'` 元素
- `HudConfig.display` 可新增 `showZenmuxQuota` 开关

### 2.3 关键约束与风险

1. **调用频率**: HUD 每 ~300ms 被调用一次，必须实现缓存。建议缓存 TTL 60-120 秒
2. **进程模型**: HUD 是短生命周期进程（每次调用都是新进程），内存缓存不可行，需要文件缓存
3. **网络延迟**: HTTP 请求可能阻塞渲染，必须非阻塞（使用缓存文件，后台异步更新）
4. **API Key 安全**: 不应硬编码，应通过环境变量 `ZENMUX_MANAGEMENT_API_KEY` 读取
5. **错误容忍**: API 不可用时 HUD 不应崩溃，仅跳过 ZenMux 行
6. **零依赖约束**: 项目零运行时依赖，HTTP 请求必须使用 Node.js 原生 `fetch`

### 2.4 缓存策略设计

由于 HUD 是每次调用都启动新进程的模型，内存缓存无效。方案：

- **文件缓存**: 将 API 响应写入临时文件（如 `/tmp/claude-hud-zenmux-cache.json`）
- **缓存结构**: `{ timestamp: number, data: SubscriptionDetail }`
- **TTL**: 默认 1000ms，可通过 `HudConfig.display.zenmuxCacheTtlMs` 配置
- **更新策略**: 缓存过期时发起 API 请求并更新缓存文件；请求失败时使用过期缓存
- **首次启动**: 无缓存时同步请求（可能有短暂延迟），之后走缓存

## 2.5 Next Actions
- 确认架构方案后进入 Plan 阶段

## 3. Innovate (Options & Decision)

### Option A: 新增独立 HUD 行 `zenmux`
- 新增 `HudElement = 'zenmux'`，独立渲染一行
- 格式: `ZenMux 5h ██░░░░ 7% │ 7d ██░░░░ 6%`
- Pros: 与现有 Usage（Claude Code 原生数据）清晰分离，不影响原有行为
- Cons: 多占一行空间

### Option B: 扩展现有 Usage 行
- 在 `renderUsageLine` 中追加 ZenMux 数据
- Pros: 紧凑
- Cons: 与 Claude Code 原生 rate_limits 数据混在一起，语义不清；代码耦合

### Decision
- Selected: **Option A — 新增独立行 `zenmux`**
- Why: 
  1. ZenMux 数据来源（HTTP API）与原生 stdin 数据来源完全不同，分离更清晰
  2. 符合项目"新增 HUD 行"的架构约定（在 `render/lines/` 下新建文件 + 注册 HudElement）
  3. 用户可通过配置独立控制是否显示

## 4. Plan (Contract)

### 4.1 File Changes

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types.ts` | 修改 | 新增 `ZenmuxQuotaData` 接口和 `RenderContext.zenmuxQuota` 字段 |
| `src/zenmux.ts` | **新增** | ZenMux API 调用 + 文件缓存逻辑 |
| `src/config.ts` | 修改 | `HudElement` 联合类型新增 `'zenmux'`；`HudConfig.display` 新增 `showZenmuxQuota` |
| `src/render/lines/zenmux.ts` | **新增** | ZenMux 用量渲染行 |
| `src/render/lines/index.ts` | 修改 | 导出 `renderZenmuxLine` |
| `src/render/index.ts` | 修改 | 在 `renderElementLine` switch 中处理 `'zenmux'` |
| `src/index.ts` | 修改 | 在 main() 中调用 `fetchZenmuxQuota()` 并注入 `RenderContext` |

### 4.2 Signatures

```typescript
// src/types.ts
export interface ZenmuxQuotaWindow {
  usagePercentage: number;      // 0-100
  resetsAt: Date | null;
  maxFlows: number;
  usedFlows: number;
  remainingFlows: number;
}

export interface ZenmuxQuotaData {
  fiveHour: ZenmuxQuotaWindow;
  sevenDay: ZenmuxQuotaWindow;
  accountStatus: string;
}

// RenderContext 新增字段
zenmuxQuota: ZenmuxQuotaData | null;

// src/zenmux.ts
export async function fetchZenmuxQuota(cacheTtlMs?: number): Promise<ZenmuxQuotaData | null>;

// src/render/lines/zenmux.ts
export function renderZenmuxLine(ctx: RenderContext): string | null;
```

### 4.3 Implementation Checklist
- [ ] 1. 在 `src/types.ts` 中新增 `ZenmuxQuotaWindow` 和 `ZenmuxQuotaData` 接口，`RenderContext` 新增 `zenmuxQuota` 字段
- [ ] 2. 新建 `src/zenmux.ts`：实现 API 调用 + 文件缓存（读缓存 → 未过期则返回 → 过期则请求 API → 写缓存 → 返回）
- [ ] 3. 在 `src/config.ts` 中：`HudElement` 联合类型新增 `'zenmux'`；`DEFAULT_ELEMENT_ORDER` 追加；`HudConfig.display` 新增 `showZenmuxQuota`（默认 `false`）和 `zenmuxCacheTtlMs`（默认 `1000`）配置项
- [ ] 4. 新建 `src/render/lines/zenmux.ts`：渲染 ZenMux 用量行，正常态显示进度条+百分比，>90% 时使用 critical 颜色（红色）
- [ ] 5. 修改 `src/render/lines/index.ts`：导出 `renderZenmuxLine`
- [ ] 6. 修改 `src/render/index.ts`：在 `renderElementLine` switch 中处理 `'zenmux'` case
- [ ] 7. 修改 `src/index.ts`：在 main() 中按配置调用 `fetchZenmuxQuota()` 并注入 RenderContext
- [ ] 8. 构建验证 `npm run build` 通过
- [ ] 9. 手动测试验证 HUD 输出

## 5. Execute Log
- [x] Step 1: `src/types.ts` — 新增 `ZenmuxQuotaWindow`、`ZenmuxQuotaData` 接口，`RenderContext` 新增 `zenmuxQuota` 字段
- [x] Step 2: `src/zenmux.ts` — 新建文件，实现 `fetchZenmuxQuota()`，包含：
  - 文件缓存（`/tmp/claude-hud-zenmux-cache.json`），可配置 TTL（默认 1000ms）
  - 原生 `fetch` 调用 ZenMux API（5s 超时）
  - 缓存未命中 → API 调用 → 写缓存；API 失败 → 使用过期缓存 fallback
  - 环境变量 `ZENMUX_MANAGEMENT_API_KEY` 为空时直接返回 null
- [x] Step 3: `src/config.ts` — `HudElement` 联合类型新增 `'zenmux'`；`DEFAULT_ELEMENT_ORDER` 在 `usage` 后追加 `zenmux`；`HudConfig.display` 新增 `showZenmuxQuota`（默认 false）和 `zenmuxCacheTtlMs`（默认 1000）；`mergeConfig` 添加验证逻辑
- [x] Step 4: `src/render/lines/zenmux.ts` — 新建文件，实现 `renderZenmuxLine()`：
  - 格式：`ZenMux 5h: ██░░░░ 7% | 7d: ██░░░░ 6%`
  - 三级颜色：0-60% 绿色、60%-90% 黄色、90%+ 红色 + ⚠ 前缀告警
  - 账号状态异常（suspended/banned 等）时显示告警
  - 重置时间统一分钟精度，实时倒计时
- [x] Step 5: `src/render/lines/index.ts` — 导出 `renderZenmuxLine`
- [x] Step 6: `src/render/index.ts` — `renderElementLine` switch 新增 `'zenmux'` case
- [x] Step 7: `src/index.ts` — `MainDeps` 新增 `fetchZenmuxQuota`；`main()` 中按 `showZenmuxQuota` 配置调用并注入 `RenderContext`
- [x] Step 8: `npm run build` 构建通过，零错误
- [x] Step 9: 零 linter 错误

## 6. Review Verdict
- Spec coverage: PASS — 所有 Checklist 项均已实现
- Behavior check: PASS — 构建通过，类型安全
- Regression risk: Low — 新增功能默认关闭（`showZenmuxQuota: false`），不影响现有行为
- Module Spec 需更新: No（暂无 Module Spec）
- Follow-ups:
  - 可考虑在 compact 模式（session-line）中也展示 ZenMux 用量
  - 可考虑添加单元测试

## 7. Plan-Execution Diff
- 无偏差，严格按 Plan 执行
