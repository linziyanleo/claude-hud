import type { RenderContext } from '../../types.js';
import type { ZenmuxQuotaWindow } from '../../types.js';
import { label, critical, RESET } from '../colors.js';
import { getAdaptiveBarWidth } from '../../utils/terminal.js';

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function getZenmuxColor(percent: number): string {
  if (percent >= 90) return RED;
  if (percent >= 60) return YELLOW;
  return GREEN;
}

function zenmuxBar(percent: number, width: number): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getZenmuxColor(safePercent);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

type RenderDensity = 'normal' | 'compact';

export function renderZenmuxLine(
  ctx: RenderContext,
  options: { density?: RenderDensity } = {},
): string | null {
  if (ctx.config?.display?.showZenmuxQuota === false) {
    return null;
  }

  if (!ctx.zenmuxQuota) {
    return null;
  }

  const colors = ctx.config?.colors;
  const { fiveHour, sevenDay, accountStatus } = ctx.zenmuxQuota;
  const zmLabel = label('ZenMux', colors);

  if (accountStatus !== 'healthy' && accountStatus !== 'monitored') {
    return `${zmLabel} ${critical(`⚠ Account ${accountStatus}`, colors)}`;
  }

  if (options.density === 'compact') {
    return `${zmLabel} ${formatCompactQuotaWindowPart('5h', fiveHour)} | ${formatCompactQuotaWindowPart('7d', sevenDay)}`;
  }

  const barWidth = getAdaptiveBarWidth();

  const fiveHourPart = formatQuotaWindowPart('5h', fiveHour, colors, barWidth);
  const sevenDayPart = formatQuotaWindowPart('7d', sevenDay, colors, barWidth);

  return `${zmLabel} ${fiveHourPart} | ${sevenDayPart}`;
}

function formatCompactQuotaWindowPart(
  windowLabel: '5h' | '7d',
  window: ZenmuxQuotaWindow,
): string {
  const pct = window.usagePercentage;
  const color = getZenmuxColor(pct);
  const warningPrefix = pct >= 90 ? '⚠ ' : '';
  return `${windowLabel}: ${color}${warningPrefix}${pct}%${RESET}`;
}

function formatQuotaWindowPart(
  windowLabel: '5h' | '7d',
  window: ZenmuxQuotaWindow,
  colors: RenderContext['config']['colors'] | undefined,
  barWidth: number,
): string {
  const pct = window.usagePercentage;
  const color = getZenmuxColor(pct);
  const percentStr = `${color}${pct}%${RESET}`;
  const bar = zenmuxBar(pct, barWidth);
  const reset = formatResetTime(window.resetsAt);

  const isAlert = pct >= 90;

  let body: string;
  if (isAlert) {
    body = reset
      ? `${bar} ${RED}⚠ ${pct}%${RESET} (in ${reset})`
      : `${bar} ${RED}⚠ ${pct}%${RESET}`;
  } else {
    body = reset
      ? `${bar} ${percentStr} (in ${reset})`
      : `${bar} ${percentStr}`;
  }

  return `${windowLabel}: ${body}`;
}

function formatResetTime(resetsAt: Date | null): string {
  if (!resetsAt) return '';
  const now = new Date();
  const diffMs = resetsAt.getTime() - now.getTime();
  if (diffMs <= 0) return '';

  const totalMins = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
