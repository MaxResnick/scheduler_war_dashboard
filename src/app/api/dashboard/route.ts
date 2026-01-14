import { NextResponse } from "next/server";

import {
  fetchBlockMetadata,
  fetchBundleLandingSeries,
  fetchEntryVolume,
  fetchSlotStatusSummary,
  fetchTransactionThroughput
} from "@/lib/queries";

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
  const range = from && to ? { from, to } : defaultTimeRange(6);

  try {
    const [
      bundles,
      transactions,
      entries,
      slotStatus,
      blockMetadata
    ] = await Promise.all([
      fetchBundleLandingSeries(range),
      fetchTransactionThroughput(range),
      fetchEntryVolume(range),
      fetchSlotStatusSummary(range),
      fetchBlockMetadata(range)
    ]);

    return NextResponse.json({
      range,
      bundles,
      transactions,
      entries,
      slotStatus,
      blockMetadata
    });
  } catch (error) {
    console.error("[dashboard-api] Failed to load metrics", error);
    return NextResponse.json(
      { error: "Unable to load dashboard metrics." },
      { status: 500 }
    );
  }
}
