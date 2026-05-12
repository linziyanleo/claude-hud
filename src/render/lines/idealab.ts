import type { RenderContext } from '../../types.js';
import { label, critical, RESET } from '../colors.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function quotaColor(percent: number): string {
  if (percent >= 90) return RED;
  if (percent >= 60) return YELLOW;
  return GREEN;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(1);
}

function formatRatio(used: number, limit: number, suffix: string, isAmount: boolean): string {
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const color = quotaColor(percent);
  const usedStr = isAmount ? formatAmount(used) : String(Math.round(used));
  const limitStr = isAmount ? formatAmount(limit) : String(Math.round(limit));
  return `${color}${usedStr}${RESET}/${limitStr}${suffix}`;
}

export function renderIdealabLine(ctx: RenderContext): string | null {
  if (ctx.config?.display?.showIdealabQuota === false) {
    return null;
  }
  if (!ctx.idealabQuota) {
    return null;
  }

  const colors = ctx.config?.colors;
  const ilLabel = label('IdeaLab', colors);

  if (ctx.idealabQuota.authError) {
    return `${ilLabel} ${critical('⚠ auth expired (refresh IDEALAB_COOKIE)', colors)}`;
  }

  const { todayAmountCost, dailyAmountLimit, todayUsedCount, dailyCallLimit } = ctx.idealabQuota;
  const cost = formatRatio(todayAmountCost, dailyAmountLimit, '$', true);
  const calls = formatRatio(todayUsedCount, dailyCallLimit, '', false);

  return `${ilLabel} cost: ${cost} | calls: ${calls}`;
}
