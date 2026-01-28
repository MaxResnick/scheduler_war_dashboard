import { NextResponse } from "next/server";

import { fetchSlotLeaderSequence } from "@/lib/queries";
import { getAllValidators, getValidatorName } from "@/lib/validators-app";
import type {
  AxiomRoutingPayload,
  LeaderTransition,
  TransitionStats,
  SlotData
} from "@/lib/types";

// Only these 4 scheduler types
const ALLOWED_TYPES = new Set(["AgaveBam", "Frankendancer", "JitoLabs", "Harmonic"]);

// Simple in-memory cache to prevent excessive queries
const cache = new Map<string, { data: AxiomRoutingPayload; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minute cache

function defaultTimeRange(hoursBack: number) {
  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const range = from && to ? { from, to } : defaultTimeRange(2);

  // Parse custom accounts if provided
  const accountsParam = url.searchParams.get("accounts");
  const customAccounts = accountsParam
    ? accountsParam.split(",").map((a) => a.trim()).filter((a) => a.length > 0)
    : undefined;

  // Check cache first to prevent excessive queries
  // Include accounts in cache key
  const cacheKey = `${range.from}-${range.to}-${customAccounts?.join(",") ?? "default"}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const [slotSequence, allValidators] = await Promise.all([
      fetchSlotLeaderSequence(range, customAccounts),
      getAllValidators()
    ]);

    // Build validator type map
    const validatorTypeMap = new Map<string, string>();
    for (const v of allValidators) {
      validatorTypeMap.set(v.account, v.softwareClient);
    }

    // Helper to get slot data with validator info
    const getSlotData = (idx: number): SlotData | null => {
      if (idx < 0 || idx >= slotSequence.length) return null;
      const s = slotSequence[idx];
      return {
        slot: s.slot,
        validator: s.validator,
        validatorName: getValidatorName(s.validator),
        validatorType: validatorTypeMap.get(s.validator) ?? "Unknown",
        axiomTxCount: s.axiomTxCount,
        totalTxCount: s.totalTxCount,
        totalComputeUnits: s.totalComputeUnits
      };
    };

    // Find ALL transitions between the 4 allowed types
    const transitions: LeaderTransition[] = [];

    for (let i = 0; i < slotSequence.length - 1; i++) {
      const current = slotSequence[i];
      const next = slotSequence[i + 1];

      const currentType = validatorTypeMap.get(current.validator) ?? "Unknown";
      const nextType = validatorTypeMap.get(next.validator) ?? "Unknown";

      // Only include transitions between our 4 allowed types (and where type changes)
      if (
        ALLOWED_TYPES.has(currentType) &&
        ALLOWED_TYPES.has(nextType) &&
        currentType !== nextType
      ) {
        // Build 8-slot sequence
        const slotSequenceWindow: SlotData[] = [];
        for (let offset = -3; offset <= 4; offset++) {
          const slotData = getSlotData(i + offset);
          if (slotData) {
            slotSequenceWindow.push(slotData);
          }
        }

        transitions.push({
          fromSlot: current.slot,
          fromValidator: current.validator,
          fromValidatorName: getValidatorName(current.validator),
          fromValidatorType: currentType,
          fromAxiomTxCount: current.axiomTxCount,
          fromTotalTxCount: current.totalTxCount,
          toSlot: next.slot,
          toValidator: next.validator,
          toValidatorName: getValidatorName(next.validator),
          toValidatorType: nextType,
          toAxiomTxCount: next.axiomTxCount,
          toTotalTxCount: next.totalTxCount,
          slotSequence: slotSequenceWindow
        });
      }
    }

    // Calculate stats by transition type (A → B)
    const statsByType = new Map<string, {
      count: number;
      totalFromAxiom: number;
      totalToAxiom: number;
      totalFromTotal: number;
      totalToTotal: number;
    }>();

    for (const t of transitions) {
      const key = `${t.fromValidatorType} → ${t.toValidatorType}`;
      const existing = statsByType.get(key) ?? {
        count: 0,
        totalFromAxiom: 0,
        totalToAxiom: 0,
        totalFromTotal: 0,
        totalToTotal: 0
      };
      existing.count++;
      existing.totalFromAxiom += t.fromAxiomTxCount;
      existing.totalToAxiom += t.toAxiomTxCount;
      existing.totalFromTotal += t.fromTotalTxCount;
      existing.totalToTotal += t.toTotalTxCount;
      statsByType.set(key, existing);
    }

    const transitionStats: TransitionStats[] = Array.from(statsByType.entries())
      .map(([type, stats]) => ({
        transitionType: type,
        count: stats.count,
        avgBamAxiomTx: stats.count > 0 ? stats.totalFromAxiom / stats.count : 0,
        avgFollowerAxiomTx: stats.count > 0 ? stats.totalToAxiom / stats.count : 0,
        avgBamTotalTx: stats.count > 0 ? stats.totalFromTotal / stats.count : 0,
        avgFollowerTotalTx: stats.count > 0 ? stats.totalToTotal / stats.count : 0,
        axiomTxRatio: stats.totalFromAxiom > 0
          ? stats.totalToAxiom / stats.totalFromAxiom
          : stats.totalToAxiom > 0 ? Infinity : 1
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate overall stats for allowed types
    const allowedSlots = slotSequence.filter(
      s => ALLOWED_TYPES.has(validatorTypeMap.get(s.validator) ?? "Unknown")
    );
    const bamSlots = allowedSlots.filter(
      s => (validatorTypeMap.get(s.validator) ?? "Unknown") === "AgaveBam"
    );
    const nonBamSlots = allowedSlots.filter(
      s => (validatorTypeMap.get(s.validator) ?? "Unknown") !== "AgaveBam"
    );

    const totalBamSlots = bamSlots.length;
    const totalAxiomTxOnBam = bamSlots.reduce((sum, s) => sum + s.axiomTxCount, 0);
    const totalAxiomTxOnNonBam = nonBamSlots.reduce((sum, s) => sum + s.axiomTxCount, 0);

    const payload: AxiomRoutingPayload = {
      range,
      transitions,
      transitionStats,
      totalBamSlots,
      totalAxiomTxOnBam,
      avgAxiomTxPerBamSlot: totalBamSlots > 0 ? totalAxiomTxOnBam / totalBamSlots : 0,
      avgAxiomTxPerNonBamSlot: nonBamSlots.length > 0 ? totalAxiomTxOnNonBam / nonBamSlots.length : 0
    };

    // Cache the result
    cache.set(cacheKey, { data: payload, timestamp: Date.now() });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[axiom-routing-api] Failed to load metrics", error);
    return NextResponse.json(
      { error: "Unable to load Axiom routing metrics." },
      { status: 500 }
    );
  }
}
