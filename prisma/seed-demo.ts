export function shouldSeedDemoData(env: NodeJS.ProcessEnv): boolean {
  return env.ENABLE_DEMO_DATA === "true";
}