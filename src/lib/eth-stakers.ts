import "server-only";
import { readFileSync } from "fs";
import { join } from "path";

export type EthStaker = {
  name: string;
  category: string;
  amountStaked: number;
  marketshare: number;
};

export function loadEthStakers(): EthStaker[] {
  const csv = readFileSync(join(process.cwd(), "ETH_Stakers.csv"), "utf-8");
  const lines = csv.trim().split("\n");
  // skip header
  const stakers: EthStaker[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Parse CSV carefully — fields may contain commas inside quotes
    const line = lines[i];
    const cols = line.split(",");
    const name = (cols[2] ?? "").trim();
    const category = (cols[3] ?? "").trim();
    const amountStaked = parseFloat(cols[4] ?? "0");
    const marketshare = parseFloat(cols[7] ?? "0");

    if (!name || !category || amountStaked <= 0) continue;

    stakers.push({ name, category, amountStaked, marketshare });
  }

  return stakers;
}
