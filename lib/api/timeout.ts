export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Request exceeded the ${Math.round(timeoutMs / 1000)} second timeout.`
    );
    this.name = "ApiTimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new ApiTimeoutError(timeoutMs)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
