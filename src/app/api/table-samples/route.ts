import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "table-samples endpoint has been removed from dashboard runtime. Use scheduler_war_api diagnostics instead." },
    { status: 410 }
  );
}
