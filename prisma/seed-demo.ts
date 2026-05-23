export function shouldSeedDemoData(env: Record<string, string | undefined>): boolean {
  return env.ENABLE_DEMO_DATA === "true";
}