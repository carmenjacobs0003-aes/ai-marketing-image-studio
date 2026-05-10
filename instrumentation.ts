export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerSentry } = await import("@/lib/sentry");
    registerSentry();
  }
}
