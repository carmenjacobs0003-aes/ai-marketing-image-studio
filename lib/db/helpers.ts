// Supabase SSR v0.5 and supabase-js v2.48 expose incompatible generic client
// signatures for hand-authored database types in this project. Centralize the
// loose client boundary here while keeping query return types explicit at the
// repository layer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedSupabaseClient = any;

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export function requireDatabaseData<T>(
  data: T | null,
  error: { message: string } | null,
  fallbackMessage: string
): T {
  if (error) {
    throw new DatabaseError(error.message, error);
  }

  if (data === null) {
    throw new DatabaseError(fallbackMessage);
  }

  return data;
}

export function requireMutation(
  error: { message: string } | null,
  fallbackMessage = "Database mutation failed"
) {
  if (error) {
    throw new DatabaseError(error.message, error);
  }

  return { ok: true as const, message: fallbackMessage };
}

export function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
