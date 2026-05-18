import { describe, expect, it } from "vitest";

import {
  getDatabaseConnectionInfo,
  getDockerStackPlan,
} from "../deployment";

describe("getDatabaseConnectionInfo", () => {
  it("builds the default local postgres connection info", () => {
    const info = getDatabaseConnectionInfo({});

    expect(info.databaseUrl).toBe(
      "postgresql://yah:yah@localhost:5432/yah?schema=public",
    );
    expect(info.shadowDatabaseUrl).toBe(
      "postgresql://yah:yah@localhost:5432/yah_shadow?schema=public",
    );
  });

  it("respects explicit environment overrides", () => {
    const info = getDatabaseConnectionInfo({
      POSTGRES_USER: "hendrik",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "finance",
      POSTGRES_SHADOW_DB: "finance_shadow",
      POSTGRES_PORT: "5544",
    });

    expect(info.databaseUrl).toBe(
      "postgresql://hendrik:secret@localhost:5544/finance?schema=public",
    );
    expect(info.shadowDatabaseUrl).toBe(
      "postgresql://hendrik:secret@localhost:5544/finance_shadow?schema=public",
    );
  });
});

describe("getDockerStackPlan", () => {
  it("describes the app and postgres services for the container stack", () => {
    const plan = getDockerStackPlan();

    expect(plan.services).toEqual(["app", "postgres"]);
    expect(plan.appDependsOn).toEqual(["postgres"]);
    expect(plan.exposedAppPort).toBe(3000);
    expect(plan.exposedPostgresPort).toBe(5432);
  });
});
