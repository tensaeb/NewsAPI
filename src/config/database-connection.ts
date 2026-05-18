import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppEnv } from "./env.js";

export type PgPoolConfig = {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean; ca?: string };
};

const SSL_QUERY_PARAMS = [
  "sslmode",
  "sslrootcert",
  "sslaccept",
  "sslcert",
  "sslkey",
  "sslidentity",
] as const;

const DEFAULT_CA_PATHS = ["certs/aiven-ca.pem", "certs/ca.pem"];

function toHttpUrl(connectionString: string): string {
  return connectionString.replace(/^postgres(ql)?:/, "https:");
}

function fromHttpUrl(httpUrl: string, preferPostgresql: boolean): string {
  return httpUrl.replace(/^https:/, preferPostgresql ? "postgresql:" : "postgres:");
}

function readSslMode(connectionString: string): string | null {
  try {
    return new URL(toHttpUrl(connectionString)).searchParams.get("sslmode");
  } catch {
    return null;
  }
}

function sslIsEnabled(sslmode: string | null): boolean {
  if (!sslmode) return false;
  return sslmode !== "disable" && sslmode !== "allow";
}

/**
 * pg v8+ treats sslmode=require in the URL as verify-full, ignoring ssl.rejectUnauthorized.
 * Remove SSL query params when we pass an explicit `ssl` object to pg-boss / node-pg.
 */
export function stripSslQueryParams(connectionString: string): string {
  const preferPostgresql = connectionString.startsWith("postgresql://");
  const url = new URL(toHttpUrl(connectionString));
  for (const key of SSL_QUERY_PARAMS) {
    url.searchParams.delete(key);
  }
  return fromHttpUrl(url.toString(), preferPostgresql);
}

function loadCaCertificate(): string | undefined {
  const candidates = [
    process.env.DATABASE_SSL_CA_PATH,
    ...DEFAULT_CA_PATHS,
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    const absolute = resolve(candidate);
    if (existsSync(absolute)) {
      return readFileSync(absolute, "utf8");
    }
  }
  return undefined;
}

/** Normalizes Aiven-style `postgres://` URLs for Prisma (`postgresql://`). */
export function normalizeDatabaseUrl(connectionString: string): string {
  return connectionString.replace(/^postgres:\/\//, "postgresql://");
}

/**
 * SSL for pg-boss / node-pg (Aiven and other cloud Postgres providers).
 */
export function resolvePgPoolConfig(env: AppEnv): PgPoolConfig {
  const normalized = normalizeDatabaseUrl(env.DATABASE_URL);
  const sslmode = readSslMode(normalized);

  if (!sslIsEnabled(sslmode)) {
    return { connectionString: normalized };
  }

  // Must not keep sslmode=require in the URL when passing `ssl` — pg v8 maps it to verify-full.
  const connectionString = stripSslQueryParams(normalized);
  const ca = loadCaCertificate();

  if (ca) {
    return {
      connectionString,
      ssl: { rejectUnauthorized: true, ca },
    };
  }

  const override = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const rejectUnauthorized =
    override === "true" ? true : override === "false" ? false : env.NODE_ENV === "production";

  return {
    connectionString,
    ssl: { rejectUnauthorized },
  };
}

/** Prisma connection URL (postgresql scheme + optional sslrootcert for Aiven). */
export function resolvePrismaDatabaseUrl(env: AppEnv): string {
  const pool = resolvePgPoolConfig(env);
  const url = new URL(toHttpUrl(normalizeDatabaseUrl(env.DATABASE_URL)));

  const caPath = [process.env.DATABASE_SSL_CA_PATH, ...DEFAULT_CA_PATHS].find((p) =>
    p ? existsSync(resolve(p)) : false,
  );

  if (caPath && pool.ssl?.ca) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslrootcert", resolve(caPath));
    return fromHttpUrl(url.toString(), true);
  }

  if (pool.ssl?.rejectUnauthorized === false) {
    url.searchParams.set("sslaccept", "accept_invalid_certs");
    return fromHttpUrl(url.toString(), true);
  }

  return normalizeDatabaseUrl(env.DATABASE_URL);
}
