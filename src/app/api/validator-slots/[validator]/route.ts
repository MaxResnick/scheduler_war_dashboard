import { NextResponse } from "next/server";
import { getClickHouseClient } from "@/lib/clickhouse";

const VALIDATOR_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export async function GET(
  _req: Request,
  { params }: { params: { validator: string } }
) {
  const validator = params.validator;

  if (!validator || !VALIDATOR_REGEX.test(validator)) {
    return NextResponse.json(
      { error: "Invalid validator address" },
      { status: 400 }
    );
  }

  try {
    const client = getClickHouseClient();

    const query = `
      SELECT
        slot,
        any(block_height) AS block_height,
        any(total_fee_lamports) AS total_fee_lamports
      FROM bam.geyser_block_metadata
      WHERE validator_identity = base58Decode('${validator}')
      GROUP BY slot
      ORDER BY slot DESC
      LIMIT 20
      FORMAT JSON
    `;

    const rows = (await client.query(query).toPromise()) as {
      slot: number;
      block_height: number;
      total_fee_lamports: number;
    }[];

    return NextResponse.json({ slots: rows });
  } catch (error) {
    console.error("[validator-slots] Failed to fetch slots", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch validator slots"
      },
      { status: 500 }
    );
  }
}
