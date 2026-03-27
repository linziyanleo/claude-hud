import type { RenderContext } from '../../types.js';
import type { ZenmuxQuotaWindow } from '../../types.js';
import { label, critical, getQuotaColor, quotaBar, RESET } from '../colors.js';
import { getAdaptiveBarWidth } from '../../utils/terminal.js';

export function renderZenmuxLine(ctx: RenderContext): string | null {
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

  const barWidth = getAdaptiveBarWidth();

  const fiveHourPart = formatQuotaWindowPart('5h', fiveHour, colors, barWidth);
  const sevenDayPart = formatQuotaWindowPart('7d', sevenDay, colors, barWidth);

  return `${zmLabel} ${fiveHourPart} | ${sevenDayPart}`;
}

function formatQuotaWindowPart(
  windowLabel: '5h' | '7d',
  window: ZenmuxQuotaWindow,
  colors: RenderContext['config']['colors'] | undefined,
  barWidth: number,
): string {
  const pct = window.usagePercentage;
  const color = getQuotaColor(pct, colors);
  const percentStr = `${color}${pct}%${RESET}`;
  const bar = quotaBar(pct, barWidth, colors);
  const reset = formatResetTime(window.resetsAt);

  const isAlert = pct >= 90;

  let body: string;
  if (isAlert) {
    const alertColor = critical('', colors).replace(RESET, '');
    body = reset
      ? `${bar} ${alertColor}⚠ ${pct}%${RESET} (resets in ${reset})`
      : `${bar} ${alertColor}⚠ ${pct}%${RESET}`;
  } else {
    body = reset
      ? `${bar} ${percentStr} (resets in ${reset})`
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
