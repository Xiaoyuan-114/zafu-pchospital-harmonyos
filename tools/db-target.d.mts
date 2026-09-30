export function assertExperimentDatabase(
  mode: "migrate" | "migrate-dev" | "seed" | "test" | "reset-test",
  env?: NodeJS.ProcessEnv,
): string;
