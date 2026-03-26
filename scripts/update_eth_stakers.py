#!/usr/bin/env python3
"""Load Ethereum staking entity snapshots from Dune into ClickHouse.

This script is designed for a daily cron job:
1. Execute a saved Dune query that returns rows shaped like ETH_Stakers.csv.
2. Poll until the query finishes.
3. Normalize Dune rows into the ClickHouse snapshot schema.
4. Insert the snapshot into ClickHouse over its HTTP interface.

The script intentionally uses only the Python standard library so it can run
from cron without any extra package installation.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


EXPECTED_COLUMNS = (
    "ranking",
    "entity",
    "entity_just_name",
    "entity_category",
    "amount_staked",
    "amount_staked_broken_down",
    "validators",
    "marketshare",
    "ow_change",
    "om_change",
    "sm_change",
    "earned_rewards",
    "last_deposit",
    "last_withdrawal",
)


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value and len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def env(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and (value is None or value == ""):
        raise SystemExit(f"Missing required environment variable: {name}")
    return value or ""


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value in (None, ""):
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise SystemExit(f"Environment variable {name} must be an integer") from exc


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value in (None, ""):
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise SystemExit(f"Environment variable {name} must be a boolean-like value")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--query-id",
        type=int,
        default=None,
        help="Override DUNE_QUERY_ID from the environment.",
    )
    parser.add_argument(
        "--snapshot-ts",
        default=None,
        help="Snapshot timestamp in ISO-8601 format. Defaults to current UTC time.",
    )
    parser.add_argument(
        "--create-table",
        action="store_true",
        help="Create the ClickHouse destination table before inserting.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and normalize rows without inserting them into ClickHouse.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optionally cap the number of normalized rows before insert.",
    )
    return parser.parse_args()


def parse_snapshot_ts(raw: str | None) -> dt.datetime:
    if raw is None:
        return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

    value = raw.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit("--snapshot-ts must be a valid ISO-8601 timestamp") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc).replace(microsecond=0)


def to_clickhouse_datetime(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def normalize_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_nullable_uint(value: Any) -> int | None:
    text = normalize_string(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError as exc:
        raise ValueError(f"Unable to parse integer value from {value!r}") from exc


def normalize_float(value: Any) -> float:
    text = normalize_string(value)
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError as exc:
        raise ValueError(f"Unable to parse float value from {value!r}") from exc


def normalize_nullable_date(value: Any) -> str | None:
    text = normalize_string(value)
    if not text or text.lower() in {"never", "null", "none", "n/a"}:
        return None

    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue

    raise ValueError(f"Unable to parse date value from {value!r}")


def get_case_insensitive(row: dict[str, Any], key: str) -> Any:
    if key in row:
        return row[key]

    lowered = key.lower()
    for candidate_key, candidate_value in row.items():
        if candidate_key.lower() == lowered:
            return candidate_value
    return None


def require_expected_columns(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    available = {column.lower() for column in rows[0].keys()}
    missing = [column for column in EXPECTED_COLUMNS if column.lower() not in available]
    if missing:
        raise SystemExit(
            "Dune result is missing expected columns: "
            + ", ".join(missing)
            + ". Make sure the saved query returns the CSV-compatible schema."
        )


def normalize_row(row: dict[str, Any], snapshot_ts: dt.datetime) -> dict[str, Any]:
    return {
        "snapshot_ts": to_clickhouse_datetime(snapshot_ts),
        "ranking": normalize_nullable_uint(get_case_insensitive(row, "ranking")),
        "entity": normalize_string(get_case_insensitive(row, "entity")),
        "entity_just_name": normalize_string(get_case_insensitive(row, "entity_just_name")),
        "entity_category": normalize_string(get_case_insensitive(row, "entity_category")),
        "amount_staked": normalize_float(get_case_insensitive(row, "amount_staked")),
        "amount_staked_broken_down": normalize_float(
            get_case_insensitive(row, "amount_staked_broken_down")
        ),
        "validators": normalize_float(get_case_insensitive(row, "validators")),
        "marketshare": normalize_float(get_case_insensitive(row, "marketshare")),
        "ow_change": normalize_float(get_case_insensitive(row, "ow_change")),
        "om_change": normalize_float(get_case_insensitive(row, "om_change")),
        "sm_change": normalize_float(get_case_insensitive(row, "sm_change")),
        "earned_rewards": normalize_float(get_case_insensitive(row, "earned_rewards")),
        "last_deposit": normalize_nullable_date(get_case_insensitive(row, "last_deposit")),
        "last_withdrawal": normalize_nullable_date(get_case_insensitive(row, "last_withdrawal")),
    }


def build_ssl_context(verify: bool) -> ssl.SSLContext:
    if verify:
        return ssl.create_default_context()
    return ssl._create_unverified_context()


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    context: ssl.SSLContext | None = None,
) -> dict[str, Any]:
    encoded = None
    request_headers = headers.copy() if headers else {}
    if payload is not None:
        encoded = json.dumps(payload).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    request = urllib.request.Request(url, data=encoded, method=method, headers=request_headers)
    try:
        with urllib.request.urlopen(request, context=context) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code} for {url}: {details}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Request failed for {url}: {exc}") from exc


class DuneClient:
    def __init__(self, api_key: str, api_base_url: str, verify_tls: bool) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.headers = {"X-Dune-API-Key": api_key}
        self.context = build_ssl_context(verify_tls)

    def execute_query(self, query_id: int, performance: str) -> str:
        payload = {"performance": performance, "query_parameters": {}}
        response = http_json(
            f"{self.api_base_url}/query/{query_id}/execute",
            method="POST",
            headers=self.headers,
            payload=payload,
            context=self.context,
        )
        execution_id = response.get("execution_id")
        if not execution_id:
            raise SystemExit(f"Unexpected Dune execute response: {json.dumps(response)}")
        return execution_id

    def wait_for_completion(
        self,
        execution_id: str,
        *,
        poll_interval_seconds: int,
        max_wait_seconds: int,
    ) -> dict[str, Any]:
        started = time.time()
        while True:
            response = http_json(
                f"{self.api_base_url}/execution/{execution_id}/status",
                headers=self.headers,
                context=self.context,
            )
            state = response.get("state", "UNKNOWN")
            print(f"[dune] execution {execution_id} status: {state}", file=sys.stderr)

            if state in {"QUERY_STATE_COMPLETED", "QUERY_STATE_COMPLETED_PARTIAL"}:
                return response
            if state in {"QUERY_STATE_FAILED", "QUERY_STATE_CANCELED", "QUERY_STATE_EXPIRED"}:
                error = response.get("error")
                raise SystemExit(
                    f"Dune execution {execution_id} failed with state {state}: {json.dumps(error)}"
                )

            if time.time() - started > max_wait_seconds:
                raise SystemExit(
                    f"Timed out waiting for Dune execution {execution_id} after {max_wait_seconds}s"
                )
            time.sleep(poll_interval_seconds)

    def fetch_all_rows(self, execution_id: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        next_offset = 0

        while True:
            query = urllib.parse.urlencode(
                {
                    "offset": next_offset,
                    "limit": 1000,
                    "allow_partial_results": "true",
                }
            )
            response = http_json(
                f"{self.api_base_url}/execution/{execution_id}/results?{query}",
                headers=self.headers,
                context=self.context,
            )
            result = response.get("result") or {}
            page_rows = result.get("rows") or []
            rows.extend(page_rows)

            next_offset = response.get("next_offset")
            if next_offset in (None, "", 0) and len(page_rows) < 1000:
                break
            if next_offset is None:
                break

        return rows


class ClickHouseClient:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        secure: bool,
        verify_tls: bool,
    ) -> None:
        scheme = "https" if secure else "http"
        self.base_url = f"{scheme}://{host}:{port}"
        self.database = database
        auth = f"{username}:{password}".encode("utf-8")
        self.headers = {
            "Authorization": f"Basic {base64.b64encode(auth).decode('ascii')}",
            "Content-Type": "text/plain; charset=utf-8",
        }
        self.context = build_ssl_context(verify_tls)

    def execute(self, sql: str) -> None:
        body = sql.encode("utf-8")
        url = f"{self.base_url}/?database={urllib.parse.quote(self.database)}"
        request = urllib.request.Request(url, data=body, method="POST", headers=self.headers)
        try:
            with urllib.request.urlopen(request, context=self.context) as response:
                response.read()
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"ClickHouse HTTP {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise SystemExit(f"ClickHouse request failed: {exc}") from exc

    def create_table_if_needed(self, table: str) -> None:
        ddl = f"""
CREATE TABLE IF NOT EXISTS {self.database}.{table}
(
  snapshot_ts DateTime,
  ranking Nullable(UInt32),
  entity String,
  entity_just_name String,
  entity_category String,
  amount_staked Float64,
  amount_staked_broken_down Float64,
  validators Float64,
  marketshare Float64,
  ow_change Float64,
  om_change Float64,
  sm_change Float64,
  earned_rewards Float64,
  last_deposit Nullable(Date),
  last_withdrawal Nullable(Date),
  updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(snapshot_ts)
ORDER BY (snapshot_ts, entity_just_name)
"""
        self.execute(ddl.strip())

    def insert_rows(self, table: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            print("[clickhouse] no rows to insert", file=sys.stderr)
            return

        sql = (
            f"INSERT INTO {self.database}.{table} "
            "FORMAT JSONEachRow\n"
            + "\n".join(json.dumps(row, separators=(",", ":"), ensure_ascii=False) for row in rows)
        )
        self.execute(sql)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")
    load_dotenv(repo_root / ".env.local")

    args = parse_args()

    dune_query_id = args.query_id or int(env("DUNE_QUERY_ID", required=True))
    snapshot_ts = parse_snapshot_ts(args.snapshot_ts)

    dune_client = DuneClient(
        api_key=env("DUNE_API_KEY", required=True),
        api_base_url=env("DUNE_API_BASE_URL", "https://api.dune.com/api/v1"),
        verify_tls=env_bool("DUNE_TLS_VERIFY", True),
    )

    clickhouse_client = ClickHouseClient(
        host=env("CLICKHOUSE_HOST", required=True),
        port=env_int("CLICKHOUSE_PORT", 9440),
        database=env("CLICKHOUSE_DATABASE", required=True),
        username=env("CLICKHOUSE_USERNAME", required=True),
        password=env("CLICKHOUSE_PASSWORD", required=True),
        secure=env_bool("CLICKHOUSE_SECURE", True),
        verify_tls=env_bool("CLICKHOUSE_TLS_REJECT_UNAUTHORIZED", True),
    )
    clickhouse_table = env("ETH_STAKERS_CLICKHOUSE_TABLE", "eth_stakers_snapshots")

    execution_id = dune_client.execute_query(
        dune_query_id,
        performance=env("DUNE_QUERY_PERFORMANCE", "medium"),
    )
    print(f"[dune] started execution {execution_id} for query {dune_query_id}", file=sys.stderr)

    dune_client.wait_for_completion(
        execution_id,
        poll_interval_seconds=env_int("DUNE_POLL_INTERVAL_SECONDS", 10),
        max_wait_seconds=env_int("DUNE_MAX_WAIT_SECONDS", 600),
    )

    rows = dune_client.fetch_all_rows(execution_id)
    require_expected_columns(rows)
    normalized_rows = [normalize_row(row, snapshot_ts) for row in rows]

    if args.limit is not None:
        normalized_rows = normalized_rows[: args.limit]

    print(
        f"[etl] normalized {len(normalized_rows)} rows for snapshot {to_clickhouse_datetime(snapshot_ts)}",
        file=sys.stderr,
    )

    if args.dry_run:
        preview = normalized_rows[:3]
        print(json.dumps(preview, indent=2, ensure_ascii=False))
        return 0

    if args.create_table:
        clickhouse_client.create_table_if_needed(clickhouse_table)
        print(
            f"[clickhouse] ensured table {clickhouse_client.database}.{clickhouse_table} exists",
            file=sys.stderr,
        )

    clickhouse_client.insert_rows(clickhouse_table, normalized_rows)
    print(
        f"[clickhouse] inserted {len(normalized_rows)} rows into "
        f"{clickhouse_client.database}.{clickhouse_table}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
