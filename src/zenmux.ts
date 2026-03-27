import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ZenmuxQuotaData, ZenmuxQuotaWindow } from './types.js';

const CACHE_FILE = path.join(os.tmpdir(), 'claude-hud-zenmux-cache.json');
const DEFAULT_CACHE_TTL_MS = 1000;

interface CacheEntry {
  timestamp: number;
  data: ZenmuxApiResponse;
}

interface ZenmuxQuotaRaw {
  usage_percentage: number;
  resets_at: string | null;
  max_flows: number;
  used_flows: number;
  remaining_flows: number;
  used_value_usd: number;
  max_value_usd: number;
}

interface ZenmuxApiResponse {
  quota_5_hour: ZenmuxQuotaRaw;
  quota_7_day: ZenmuxQuotaRaw;
  account_status: string;
}

function parseQuotaWindow(raw: ZenmuxQuotaRaw): ZenmuxQuotaWindow {
  return {
    usagePercentage: Math.round(Math.min(100, Math.max(0, raw.usage_percentage * 100))),
    resetsAt: raw.resets_at ? new Date(raw.resets_at) : null,
    maxFlows: raw.max_flows,
    usedFlows: raw.used_flows,
    remainingFlows: raw.remaining_flows,
  };
}

function transformResponse(data: ZenmuxApiResponse): ZenmuxQuotaData {
  return {
    fiveHour: parseQuotaWindow(data.quota_5_hour),
    sevenDay: parseQuotaWindow(data.quota_7_day),
    accountStatus: data.account_status,
  };
}

function readCache(ttlMs: number): ZenmuxApiResponse | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(raw) as CacheEntry;
    if (Date.now() - cache.timestamp < ttlMs) {
      return cache.data;
    }
    return null;
  } catch {
    return null;
  }
}

function readStaleCache(): ZenmuxApiResponse | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(raw) as CacheEntry;
    return cache.data;
  } catch {
    return null;
  }
}

function writeCache(data: ZenmuxApiResponse): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf-8');
  } catch {
    // Cache write failure is non-critical
  }
}

async function callApi(apiKey: string): Promise<ZenmuxApiResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      'https://zenmux.ai/api/v1/management/subscription/detail',
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { success: boolean; data: ZenmuxApiResponse };
    if (!json.success || !json.data) {
      return null;
    }
    return json.data;
  } catch {
    return null;
  }
}

export async function fetchZenmuxQuota(cacheTtlMs?: number): Promise<ZenmuxQuotaData | null> {
  const apiKey = process.env.ZENMUX_MANAGEMENT_API_KEY;
  if (!apiKey) {
    return null;
  }

  const ttl = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  const cached = readCache(ttl);
  if (cached) {
    return transformResponse(cached);
  }

  const fresh = await callApi(apiKey);
  if (fresh) {
    writeCache(fresh);
    return transformResponse(fresh);
  }

  const stale = readStaleCache();
  if (stale) {
    return transformResponse(stale);
  }

  return null;
}
