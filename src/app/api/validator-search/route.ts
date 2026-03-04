import { NextResponse } from "next/server";
import { schedulerApiFetch } from "@/lib/backend-api";

export async function GET(request: Request) {
  const search = new URL(request.url).search;

  try {
    const upstream = await schedulerApiFetch(`/validators/search${search}`);
    const payload = await upstream.json();

    if (payload && typeof payload === "object" && "meta" in payload) {
      delete (payload as Record<string, unknown>).meta;
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error("[validator-search-api-proxy] Failed to reach scheduler API", error);
    return NextResponse.json({ validators: [] }, { status: 502 });
  }
}
