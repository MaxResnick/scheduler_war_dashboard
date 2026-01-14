import { promises as fs } from "fs";
import path from "path";

import type { PropAmmFirstWin } from "@/lib/types";
import {
  fetchPropAmmFirstWins,
  fetchRecentSlotRange,
  fetchLatestCompletedEpochRange,
  fetchPropAmmFirstWinsIncremental
} from "@/lib/queries";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "prop-amm-cache")
  : path.join(process.cwd(), ".cache");
const RECENT_CACHE_PATH = path.join(CACHE_DIR, "prop-amm-winrates-recent.json");
const EPOCH_CACHE_PATH = path.join(CACHE_DIR, "prop-amm-winrates-epoch.json");

export type PropAmmWinrateCache = {
  startSlot: number;
  endSlot: number;
  generatedAt: string;
  wins: PropAmmFirstWin[];
  epoch?: number | null;
  label?: string;
};

async function readCache(filePath: string): Promise<PropAmmWinrateCache | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as PropAmmWinrateCache;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeCache(filePath: string, payload: PropAmmWinrateCache) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function isFresh(cache: PropAmmWinrateCache) {
  const generatedMs = new Date(cache.generatedAt).getTime();
  if (Number.isNaN(generatedMs)) return false;
  return Date.now() - generatedMs < CACHE_TTL_MS;
}

export async function getRecentPropAmmWinData(): Promise<PropAmmWinrateCache> {
  const existing = await readCache(RECENT_CACHE_PATH);
  if (existing && isFresh(existing)) {
    return existing;
  }

  const range = await fetchRecentSlotRange(6); // ~6 hours
  if (!range) {
    if (existing) {
      return existing;
    }
    throw new Error("Unable to determine slot range for recent prop AMM data");
  }

  const wins: PropAmmFirstWin[] = [];

  await fetchPropAmmFirstWinsIncremental(
    range.minSlot,
    range.maxSlot,
    2000,
    async (chunk) => {
      wins.push(...chunk);
      const partial: PropAmmWinrateCache = {
        startSlot: range.minSlot,
        endSlot: range.maxSlot,
        generatedAt: new Date().toISOString(),
        wins: [...wins],
        label: "Recent (~6 hours)"
      };
      await writeCache(RECENT_CACHE_PATH, partial);
    }
  );

  if (wins.length === 0) {
    throw new Error("No recent prop AMM transactions found in requested window");
  }

  const payload: PropAmmWinrateCache = {
    startSlot: range.minSlot,
    endSlot: range.maxSlot,
    generatedAt: new Date().toISOString(),
    wins,
    label: "Recent (~6 hours)"
  };

  await writeCache(RECENT_CACHE_PATH, payload);
  return payload;
}

export async function refreshEpochPropAmmWinData(
  options?: { chunkSize?: number; onChunk?: (progress: PropAmmWinrateCache) => Promise<void> | void }
): Promise<PropAmmWinrateCache> {
  const epochRange = await fetchLatestCompletedEpochRange();
  if (!epochRange) {
    throw new Error("Unable to determine latest completed epoch for prop AMM cache");
  }

  const chunkSize = options?.chunkSize ?? 1000;

  const wins: PropAmmFirstWin[] = [];

  const emitProgress = async () => {
    const progressCache: PropAmmWinrateCache = {
      startSlot: epochRange.minSlot,
      endSlot: epochRange.maxSlot,
      generatedAt: new Date().toISOString(),
      wins: [...wins],
      epoch: epochRange.epoch,
      label: `Epoch ${epochRange.epoch}`
    };
    await writeCache(EPOCH_CACHE_PATH, progressCache);
    if (options?.onChunk) {
      await options.onChunk(progressCache);
    }
  };

  await fetchPropAmmFirstWinsIncremental(
    epochRange.minSlot,
    epochRange.maxSlot,
    chunkSize,
    async (chunk) => {
      wins.push(...chunk);
      await emitProgress();
    }
  );

  const payload: PropAmmWinrateCache = {
    startSlot: epochRange.minSlot,
    endSlot: epochRange.maxSlot,
    generatedAt: new Date().toISOString(),
    wins,
    epoch: epochRange.epoch,
    label: `Epoch ${epochRange.epoch}`
  };

  await writeCache(EPOCH_CACHE_PATH, payload);
  return payload;
}

export async function getEpochPropAmmWinData(): Promise<PropAmmWinrateCache> {
  const existing = await readCache(EPOCH_CACHE_PATH);
  if (existing) {
    return existing;
  }
  return refreshEpochPropAmmWinData();
}
