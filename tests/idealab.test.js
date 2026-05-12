import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIdealabLine } from '../dist/render/lines/idealab.js';

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function baseCtx(overrides = {}) {
  return {
    config: {
      display: { showIdealabQuota: true },
      colors: { label: 'dim', critical: 'red' },
    },
    idealabQuota: null,
    ...overrides,
  };
}

test('renderIdealabLine returns null when quota data is absent', () => {
  assert.equal(renderIdealabLine(baseCtx()), null);
});

test('renderIdealabLine returns null when display is disabled', () => {
  const ctx = baseCtx({
    idealabQuota: {
      todayAmountCost: 12.3,
      dailyAmountLimit: 100,
      todayUsedCount: 45,
      dailyCallLimit: 500,
      authError: false,
    },
  });
  ctx.config.display.showIdealabQuota = false;
  assert.equal(renderIdealabLine(ctx), null);
});

test('renderIdealabLine formats cost and calls with both numerators in one line', () => {
  const ctx = baseCtx({
    idealabQuota: {
      todayAmountCost: 12.3,
      dailyAmountLimit: 100,
      todayUsedCount: 45,
      dailyCallLimit: 500,
      authError: false,
    },
  });
  const line = stripAnsi(renderIdealabLine(ctx));
  assert.equal(line, 'IdeaLab cost: 12.3/100$ | calls: 45/500');
});

test('renderIdealabLine rounds large amounts to integers', () => {
  const ctx = baseCtx({
    idealabQuota: {
      todayAmountCost: 1234.56,
      dailyAmountLimit: 5000,
      todayUsedCount: 999,
      dailyCallLimit: 1000,
      authError: false,
    },
  });
  const line = stripAnsi(renderIdealabLine(ctx));
  assert.equal(line, 'IdeaLab cost: 1235/5000$ | calls: 999/1000');
});

test('renderIdealabLine surfaces auth error so user knows to refresh cookie', () => {
  const ctx = baseCtx({
    idealabQuota: {
      todayAmountCost: 0,
      dailyAmountLimit: 0,
      todayUsedCount: 0,
      dailyCallLimit: 0,
      authError: true,
    },
  });
  const line = stripAnsi(renderIdealabLine(ctx));
  assert.match(line, /IdeaLab.*auth expired.*IDEALAB_COOKIE/);
});

test('renderIdealabLine handles zero limit without dividing by zero', () => {
  const ctx = baseCtx({
    idealabQuota: {
      todayAmountCost: 5,
      dailyAmountLimit: 0,
      todayUsedCount: 3,
      dailyCallLimit: 0,
      authError: false,
    },
  });
  const line = stripAnsi(renderIdealabLine(ctx));
  assert.equal(line, 'IdeaLab cost: 5.0/0.0$ | calls: 3/0');
});
