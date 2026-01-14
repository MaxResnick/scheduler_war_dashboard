import { NextResponse } from "next/server";

import { fetchTableSamples } from "@/lib/queries";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (limit !== undefined && (Number.isNaN(limit) || limit <= 0)) {
    return NextResponse.json(
      { error: "limit must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    const samples = await fetchTableSamples(limit);
    return NextResponse.json({ limit: limit ?? 5, samples });
  } catch (error) {
    console.error("[table-samples-api] Failed to load sample rows", error);
    const detail =
      error instanceof Error ? error.message : "Unknown error occurred.";
    return NextResponse.json(
      { error: "Unable to load table samples.", detail },
      { status: 500 }
    );
  }
}
