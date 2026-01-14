import { NextResponse } from "next/server";
import { getClickHouseClient } from "@/lib/clickhouse";

const VALIDATOR_REGEX = /^[1-9A-HJ-NP-Za-km-z]{0,64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  if (!query || query.length < 2 || !VALIDATOR_REGEX.test(query)) {
    return NextResponse.json({ validators: [] });
  }

  try {
    const client = getClickHouseClient();

    const sql = `
      SELECT DISTINCT base58Encode(validator_identity) AS validator
      FROM bam.geyser_block_metadata
      WHERE startsWith(base58Encode(validator_identity), '${query}')
      LIMIT 20
      FORMAT JSON
    `;

    const rows = (await client.query(sql).toPromise()) as { validator: string }[];

    return NextResponse.json({ validators: rows.map((r) => r.validator) });
  } catch (error) {
    console.error("[validator-search] failed", error);
    return NextResponse.json({ validators: [] }, { status: 500 });
  }
}
