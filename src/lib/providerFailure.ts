export function providerFailure(status: number, body: unknown) {
  const error = (body as { error?: { code?: unknown; type?: unknown; message?: unknown } } | null)?.error;
  const codes = [error?.code, error?.type];
  if (codes.some(code => ["insufficient_quota", "billing_hard_limit_reached", "billing_not_active", "credit_balance_exhausted"].includes(String(code)))) return "quota";
  if (typeof error?.message === "string" && /^you have no credits remaining\b/i.test(error.message)) return "quota";
  if (status === 429) return codes.includes("rate_limit_exceeded") ? "rate_limit" : "unclassified_429";
  return status >= 500 ? "server_error" : "provider_error";
}

export function retryDelay(response: Response, failure: string, attempt: number): number | null {
  if (attempt >= 3 || !["rate_limit", "unclassified_429", "server_error"].includes(failure)) return null;
  const value = response.headers.get("retry-after");
  const ms = value === null ? NaN : /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  if (ms > 10_000) return null;
  return Math.min(10_000, Math.max(Number.isFinite(ms) ? ms : 0, 500 * 2 ** (attempt - 1)) + Math.random() * 250);
}
