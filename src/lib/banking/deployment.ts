export type DatabaseConnectionInfo = {
  databaseUrl: string;
  shadowDatabaseUrl: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  shadowDatabase: string;
};

export type DockerStackPlan = {
  services: ["app", "postgres"];
  appDependsOn: ["postgres"];
  exposedAppPort: number;
  exposedPostgresPort: number;
};

export function getDatabaseConnectionInfo(
  env: Record<string, string | undefined>,
): DatabaseConnectionInfo {
  const host = env.POSTGRES_HOST?.trim() || "localhost";
  const port = Number(env.POSTGRES_PORT?.trim() || "5432");
  const user = env.POSTGRES_USER?.trim() || "yah";
  const password = env.POSTGRES_PASSWORD?.trim() || "yah";
  const database = env.POSTGRES_DB?.trim() || "yah";
  const shadowDatabase = env.POSTGRES_SHADOW_DB?.trim() || `${database}_shadow`;

  return {
    host,
    port,
    user,
    password,
    database,
    shadowDatabase,
    databaseUrl: `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`,
    shadowDatabaseUrl: `postgresql://${user}:${password}@${host}:${port}/${shadowDatabase}?schema=public`,
  };
}

export function getDockerStackPlan(): DockerStackPlan {
  return {
    services: ["app", "postgres"],
    appDependsOn: ["postgres"],
    exposedAppPort: 3000,
    exposedPostgresPort: 5432,
  };
}
