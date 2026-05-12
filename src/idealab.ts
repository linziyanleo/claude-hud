import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { IdealabQuotaData } from './types.js';

const CACHE_FILE = path.join(os.tmpdir(), 'claude-hud-idealab-cache.json');
const DEFAULT_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5000;
const ENDPOINT = 'https://idealab.alibaba-inc.com/api/ailab/ak/teamapi/getOrCreate';
const DEFAULT_TEAM_CODE = 'API_TEAM_CODE_99';

interface CacheEntry {
  timestamp: number;
  teamCode: string;
  data: IdealabApiData;
  authError: boolean;
}

interface IdealabApiData {
  todayAmountCost?: number;
  dailyAmountLimit?: number;
  todayUsedCount?: number;
  dailyCallLimit?: number;
}

interface IdealabApiResponse {
  data?: IdealabApiData;
  success?: boolean;
}

type FetchOutcome =
  | { kind: 'ok'; data: IdealabApiData }
  | { kind: 'auth-error' }
  | { kind: 'error' };

function readCache(ttlMs: number, teamCode: string): CacheEntry | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(raw) as CacheEntry;
    if (cache.teamCode !== teamCode) return null;
    if (Date.now() - cache.timestamp >= ttlMs) return null;
    return cache;
  } catch {
    return null;
  }
}

function readStaleCache(teamCode: string): CacheEntry | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(raw) as CacheEntry;
    if (cache.teamCode !== teamCode) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf-8');
  } catch {
    // Cache write failure is non-critical
  }
}

async function callApi(cookie: string, teamCode: string): Promise<FetchOutcome> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json;charset=UTF-8',
        cookie,
        origin: 'https://idealab.alibaba-inc.com',
        referer: 'https://idealab.alibaba-inc.com/ideaTalk',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ teamCode }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) {
      return { kind: 'auth-error' };
    }
    if (!response.ok) {
      return { kind: 'error' };
    }

    const json = (await response.json()) as IdealabApiResponse;
    if (!json || !json.data) {
      return { kind: 'error' };
    }
    return { kind: 'ok', data: json.data };
  } catch {
    return { kind: 'error' };
  }
}

function transform(data: IdealabApiData): IdealabQuotaData | null {
  const todayAmountCost = Number(data.todayAmountCost);
  const dailyAmountLimit = Number(data.dailyAmountLimit);
  const todayUsedCount = Number(data.todayUsedCount);
  const dailyCallLimit = Number(data.dailyCallLimit);

  if (
    !Number.isFinite(todayAmountCost) ||
    !Number.isFinite(dailyAmountLimit) ||
    !Number.isFinite(todayUsedCount) ||
    !Number.isFinite(dailyCallLimit)
  ) {
    return null;
  }

  return {
    todayAmountCost,
    dailyAmountLimit,
    todayUsedCount,
    dailyCallLimit,
    authError: false,
  };
}

export async function fetchIdealabQuota(options?: {
  cacheTtlMs?: number;
  teamCode?: string;
}): Promise<IdealabQuotaData | null> {
  const cookie = process.env.IDEALAB_COOKIE;
  if (!cookie) {
    return null;
  }

  const teamCode = options?.teamCode || DEFAULT_TEAM_CODE;
  const ttl = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  const cached = readCache(ttl, teamCode);
  if (cached) {
    if (cached.authError) {
      return { todayAmountCost: 0, dailyAmountLimit: 0, todayUsedCount: 0, dailyCallLimit: 0, authError: true };
    }
    return transform(cached.data);
  }

  const outcome = await callApi(cookie, teamCode);
  if (outcome.kind === 'ok') {
    writeCache({ timestamp: Date.now(), teamCode, data: outcome.data, authError: false });
    return transform(outcome.data);
  }

  if (outcome.kind === 'auth-error') {
    writeCache({ timestamp: Date.now(), teamCode, data: {}, authError: true });
    return { todayAmountCost: 0, dailyAmountLimit: 0, todayUsedCount: 0, dailyCallLimit: 0, authError: true };
  }

  // Soft failure: fall back to stale cache so the line doesn't blink.
  const stale = readStaleCache(teamCode);
  if (stale) {
    if (stale.authError) {
      return { todayAmountCost: 0, dailyAmountLimit: 0, todayUsedCount: 0, dailyCallLimit: 0, authError: true };
    }
    return transform(stale.data);
  }

  return null;
}
