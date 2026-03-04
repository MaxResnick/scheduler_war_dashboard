import "server-only";

type QueryValue = string | number | boolean | null | undefined;

function getBaseUrl() {
  const base = process.env.SCHEDULER_API_BASE_URL;
  if (!base) {
    throw new Error("Missing SCHEDULER_API_BASE_URL");
  }
  return base.replace(/\/+$/, "");
}

function getApiKey() {
  const key = process.env.SCHEDULER_API_KEY;
  if (!key) {
    throw new Error("Missing SCHEDULER_API_KEY");
  }
  return key;
}

function withPrefix(path: string) {
  return path.startsWith("/v1/") ? path : `/v1${path.startsWith("/") ? path : `/${path}`}`;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${getBaseUrl()}${withPrefix(path)}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || typeof value === "undefined") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export async function schedulerApiFetch(
  path: string,
  options?: {
    query?: Record<string, QueryValue>;
    init?: RequestInit;
  }
): Promise<Response> {
  const url = buildUrl(path, options?.query);
  const headers = new Headers(options?.init?.headers);
  headers.set("x-internal-api-key", getApiKey());
  headers.set("accept", "application/json");

  return fetch(url, {
    ...options?.init,
    headers,
    cache: options?.init?.cache ?? "no-store"
  });
}

export async function schedulerApiGet<T>(
  path: string,
  query?: Record<string, QueryValue>
): Promise<T> {
  const response = await schedulerApiFetch(path, { query });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Scheduler API request failed (${response.status}): ${body || response.statusText}`
    );
  }
  return response.json() as Promise<T>;
}
