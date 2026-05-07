function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`env ${name} is not a number: ${v}`);
  return n;
}

export const config = {
  port: num("PORT", 3001),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://boson:boson@localhost:5433/boson",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  /** HS256 secret for JWT access tokens. */
  jwtSecret: process.env.BOSON_JWT_SECRET ?? "dev-insecure-change-me",
  /**
   * When `"1"`, `/v1/*` uses `user_id = 1` without verifying `Authorization`.
   * Intended for local development only.
   */
  authDisabled: process.env.BOSON_AUTH_DISABLED === "1",
} as const;

export type Config = typeof config;
