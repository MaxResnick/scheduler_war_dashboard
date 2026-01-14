import "server-only";

import { readFileSync } from "node:fs";
import { ClickHouse } from "clickhouse";

let client: ClickHouse | undefined;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readTlsFile(path: string, label: string): Buffer {
  try {
    return readFileSync(path);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown filesystem error.";
    throw new Error(`Failed to read ${label} at ${path}: ${message}`);
  }
}

export function getClickHouseClient(): ClickHouse {
  if (client) {
    return client;
  }

  const host = getRequiredEnv("CLICKHOUSE_HOST");
  const username = getRequiredEnv("CLICKHOUSE_USERNAME");
  const password = getRequiredEnv("CLICKHOUSE_PASSWORD");
  const database = process.env.CLICKHOUSE_DATABASE ?? "default";
  const port = parseInt(process.env.CLICKHOUSE_PORT ?? "9440", 10);

  const certPath = process.env.CLICKHOUSE_TLS_CERT_PATH;
  const keyPath = process.env.CLICKHOUSE_TLS_KEY_PATH;
  const caPath = process.env.CLICKHOUSE_TLS_CA_PATH;

  if ((certPath && !keyPath) || (!certPath && keyPath)) {
    throw new Error(
      "Both CLICKHOUSE_TLS_CERT_PATH and CLICKHOUSE_TLS_KEY_PATH must be provided for mutual TLS."
    );
  }

  const reqParams: any = {};

  if (certPath && keyPath) {
    reqParams.cert = readTlsFile(certPath, "CLICKHOUSE_TLS_CERT_PATH");
    reqParams.key = readTlsFile(keyPath, "CLICKHOUSE_TLS_KEY_PATH");
  }

  if (caPath) {
    reqParams.ca = readTlsFile(caPath, "CLICKHOUSE_TLS_CA_PATH");
  }

  const config: any = {
    url: `https://${host}`,
    port,
    basicAuth: {
      username,
      password
    },
    debug: false,
    isUseGzip: false,
    format: "json",
    config: {
      database
    },
    reqParams
  };

  client = new ClickHouse(config);

  return client;
}
