import { afterEach, describe, expect, it } from "vitest";
import { env, isDevFixtureAllowed, resetEnvCache } from "@/server/env";

const saved = { ...process.env };
function withEnv(vars: Record<string, string | undefined>) {
  resetEnvCache();
  for (const k of ["APP_ENV", "IDENTITY_MODE", "IDENTITY_ENCRYPTION_KEY", "IDENTITY_HMAC_KEY"]) delete process.env[k];
  Object.assign(process.env, vars);
}
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

describe("environment guard", () => {
  it("defaults to identity verification disabled", () => {
    withEnv({});
    expect(env().IDENTITY_MODE).toBe("disabled");
    expect(isDevFixtureAllowed()).toBe(false);
  });

  it("refuses the identity fixture in staging and production", () => {
    withEnv({ APP_ENV: "production", IDENTITY_MODE: "dev_fixture", IDENTITY_ENCRYPTION_KEY: "x", IDENTITY_HMAC_KEY: "y" });
    expect(() => env()).toThrow(/forbidden/);
    withEnv({ APP_ENV: "staging", IDENTITY_MODE: "dev_fixture" });
    expect(() => env()).toThrow(/forbidden/);
  });

  it("requires identity encryption keys in production", () => {
    withEnv({ APP_ENV: "production", IDENTITY_MODE: "disabled" });
    expect(() => env()).toThrow(/required in production/);
  });

  it("allows the fixture only in development", () => {
    withEnv({ APP_ENV: "development", IDENTITY_MODE: "dev_fixture" });
    expect(isDevFixtureAllowed()).toBe(true);
  });
});
