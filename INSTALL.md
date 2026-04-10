# Claude HUD (Fork) — 安装指南

基于 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 的 fork 版本，新增 ZenMux 订阅用量显示功能。

## 前置要求

- Node.js >= 18.0.0
- Claude Code 已安装并可用
- （可选）[ZenMux](https://zenmux.ai) Management API Key

## 安装步骤

### 1. 克隆并构建

```bash
git clone <your-fork-url> ~/claude-hud
cd ~/claude-hud
npm ci
npm run build
```

### 2. 配置 Claude Code StatusLine

编辑 `~/.claude/settings.json`（如不存在则新建），添加 `statusLine` 配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/claude-hud/dist/index.js"
  }
}
```

> **注意**: 请将路径替换为你实际的项目路径。如果路径中有空格，需要用引号包裹。

### 3. 设置 ZenMux API Key（可选）

如需在 HUD 中显示 ZenMux 用量，需要设置 Management API Key。

**方式 A — 环境变量（推荐）**

在 shell 配置文件中添加：

```bash
# ~/.zshrc 或 ~/.bashrc
export ZENMUX_MANAGEMENT_API_KEY="your-management-api-key"
```

然后重新加载：

```bash
source ~/.zshrc
```

**方式 B — 内联到 command 中**

```json
{
  "statusLine": {
    "type": "command",
    "command": "ZENMUX_MANAGEMENT_API_KEY=your-key node ~/claude-hud/dist/index.js"
  }
}
```

> ZenMux Management API Key 在 [ZenMux 控制台](https://zenmux.ai) 创建，仅支持 Management API Key（非普通 API Key）。

### 4. 开启 ZenMux 用量显示

创建 HUD 配置文件：

```bash
mkdir -p ~/.claude/plugins/claude-hud
```

编辑 `~/.claude/plugins/claude-hud/config.json`：

```json
{
  "display": {
    "showZenmuxQuota": true,
    "zenmuxCacheTtlMs": 1000
  }
}
```

### 5. 重启 Claude Code

```bash
# 退出当前 Claude Code 实例，重新启动
claude
```

HUD 应该出现在输入框下方。

## ZenMux 用量行说明

开启后，HUD 新增一行显示 ZenMux 订阅用量：

```
ZenMux 5h: ██░░░░░░░░ 7% (in 2h 30m 15s) | 7d: ██░░░░░░░░ 6% (in 3d 12h 45m)
```

### 告警

- **用量 > 90%**: 红色 + ⚠ 图标告警
- **账号异常状态**（suspended/banned 等）: 红色告警提示

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `showZenmuxQuota` | boolean | `false` | 是否显示 ZenMux 用量行 |
| `zenmuxCacheTtlMs` | number | `1000` | API 响应缓存 TTL（毫秒） |

## 其他可选功能

在 `config.json` 中可以开启更多 HUD 功能：

```json
{
  "display": {
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showDuration": true,
    "showConfigCounts": true,
    "showSessionName": true,
    "showZenmuxQuota": true
  }
}
```

## 更新

修改代码后重新构建即可：

```bash
cd ~/claude-hud
npm run build
```

无需重新配置 `settings.json`，但需要重启 Claude Code 才能看到变更。

## 故障排查

### HUD 不显示

1. 确认 `~/.claude/settings.json` 中有 `statusLine` 配置
2. 手动运行命令测试：`node ~/claude-hud/dist/index.js`
3. 确认 Node.js 版本 >= 18
4. 重启 Claude Code

### ZenMux 用量不显示

1. 确认 `ZENMUX_MANAGEMENT_API_KEY` 环境变量已设置
2. 确认 `config.json` 中 `showZenmuxQuota` 为 `true`
3. 手动测试 API 是否可用：

   ```bash
   curl -H "Authorization: Bearer $ZENMUX_MANAGEMENT_API_KEY" \
     https://zenmux.ai/api/v1/management/subscription/detail
   ```
