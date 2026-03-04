import { NextResponse } from "next/server";
import { schedulerApiFetch } from "@/lib/backend-api";

export async function GET(request: Request) {
  const search = new URL(request.url).search;

  try {
    const upstream = await schedulerApiFetch(`/axiom-routing${search}`);
    const payload = await upstream.json();

    if (payload && typeof payload === "object" && "meta" in payload) {
      delete (payload as Record<string, unknown>).meta;
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error("[axiom-routing-api-proxy] Failed to reach scheduler API", error);
    return NextResponse.json(
      { error: "Unable to load Axiom routing metrics." },
      { status: 502 }
    );
  }
}
