import { NextResponse } from "next/server";
import { getValidatorNames, searchValidators, getAllValidatorNames } from "@/lib/validators-app";

/**
 * GET /api/validator-names
 *
 * Query params:
 * - accounts: Comma-separated list of validator accounts to look up
 * - search: Search query to find validators by name or address
 * - all: If "true", return all cached validator names (for client-side search)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountsParam = url.searchParams.get("accounts");
  const searchQuery = url.searchParams.get("search");
  const allParam = url.searchParams.get("all");

  try {
    // Return all cached names for client-side use
    if (allParam === "true") {
      const allNames = await getAllValidatorNames();
      return NextResponse.json({ names: allNames });
    }

    // Search by name or address
    if (searchQuery) {
      const results = await searchValidators(searchQuery, 20);
      return NextResponse.json({ validators: results });
    }

    // Look up specific accounts
    if (accountsParam) {
      const accounts = accountsParam.split(",").map((a) => a.trim()).filter(Boolean);
      if (accounts.length === 0) {
        return NextResponse.json({ names: {} });
      }

      const namesMap = await getValidatorNames(accounts);
      const namesObject: Record<string, string | null> = {};
      namesMap.forEach((name, account) => {
        namesObject[account] = name;
      });

      return NextResponse.json({ names: namesObject });
    }

    return NextResponse.json({ error: "Provide 'accounts', 'search', or 'all=true' parameter" }, { status: 400 });
  } catch (error) {
    console.error("[validator-names] Error:", error);
    return NextResponse.json({ error: "Failed to fetch validator names" }, { status: 500 });
  }
}
