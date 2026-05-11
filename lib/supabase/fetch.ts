const SUPABASE_FETCH_TIMEOUT_MS = 8000;

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS)
  });
}
