import { NextResponse } from "next/server";
import { getClickHouseClient } from "@/lib/clickhouse";

export async function GET() {
  try {
    const client = getClickHouseClient();

    const tables = [
      { name: "bundles", table: "bundles.bundles_landed_v2" },
      { name: "transactions", table: "bam.geyser_transactions" },
      { name: "entries", table: "bam.geyser_entries" },
      { name: "slotStatus", table: "bam.geyser_slot_status" },
      { name: "blockMetadata", table: "bam.geyser_block_metadata" }
    ];

    const schemas: Record<string, any> = {};

    for (const { name, table } of tables) {
      try {
        const query = `SELECT * FROM ${table} LIMIT 1 FORMAT JSON`;
        const result = await client.query(query).toPromise();

        // result is an array directly
        if (Array.isArray(result) && result.length > 0) {
          schemas[name] = {
            columns: Object.keys(result[0]),
            sample: result[0]
          };
        } else {
          schemas[name] = { columns: [], sample: null };
        }
      } catch (error) {
        schemas[name] = {
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    }

    return NextResponse.json({
      schemas,
      message: "Schemas for all tables"
    });
  } catch (error) {
    console.error("[test-schema] Failed to fetch schema", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch schema" },
      { status: 500 }
    );
  }
}
