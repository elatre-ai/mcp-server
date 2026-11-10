import { z } from "zod/v4";

export const SERVER_NAME = "@elatre-ai/mcp-server";
export const SERVER_VERSION = "1.0.2";
export const SERVER_TITLE = "Elatre MCP Enterprise RBAC Auditor";

export const ASSESSMENT_DISCLAIMER =
  "This is a technical security-architecture and compliance-readiness assessment. It is not a formal audit, a legal compliance determination, an independent certification, or an official Elatre audit. A higher score means more of the stated controls were attested. It does not mean the organization is certified or compliant.";

export const COMPANY = {
  name: "Elatre",
  website: "https://elatre.com/",
  governancePage: "https://elatre.com/ai-ethics-and-governance/",
  governanceConsultingPage: "https://elatre.com/enterprise-ai-governance-data-readiness-consulting/",
} as const;

const originSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return new URL(value).origin === value;
    } catch {
      return false;
    }
  }, "Origins must be scheme, host, and optional port, with no path");

const configSchema = z.object({
  transport: z.enum(["stdio", "http"]),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(0).max(65535),
  authToken: z.string().min(16).max(512).optional(),
  allowUnauthenticated: z.boolean(),
  allowedHosts: z.array(z.string().trim().min(1).max(255)).min(1),
  allowedOrigins: z.array(originSchema),
  logLevel: z.enum(["error", "warn", "info", "debug"]),
  maxBodyBytes: z.number().int().min(1024).max(1_048_576),
  nodeEnv: z.string().min(1).max(40),
  trustProxy: z.boolean(),
  maxSessions: z.number().int().min(1).max(10_000),
  requestsPerMinute: z.number().int().min(1).max(10_000),
  bookingApiBaseUrl: z.string().trim().url().max(300),
});

export type AppConfig = z.infer<typeof configSchema>;

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requirePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} is out of range`);
  return parsed;
}

export function assertHttpSecurity(config: AppConfig): void {
  if (config.transport !== "http") return;
  if (config.nodeEnv === "production" && config.allowUnauthenticated) {
    throw new Error("MCP_ALLOW_UNAUTHENTICATED cannot be used when NODE_ENV is production");
  }
  if (config.nodeEnv === "production" && !config.authToken) {
    throw new Error("MCP_AUTH_TOKEN is required for HTTP when NODE_ENV is production");
  }
  if (!config.authToken && !config.allowUnauthenticated) {
    throw new Error("HTTP mode requires MCP_AUTH_TOKEN, or MCP_ALLOW_UNAUTHENTICATED=true outside production");
  }
  if (config.allowedHosts.some((host) => host === "*")) {
    throw new Error("MCP_ALLOWED_HOSTS cannot contain *");
  }
  if (config.allowedOrigins.some((origin) => origin === "*")) {
    throw new Error("MCP_ALLOWED_ORIGINS cannot contain *");
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const transport = env.MCP_TRANSPORT === "http" ? "http" : "stdio";
  const extraHosts = splitList(env.MCP_ALLOWED_HOSTS).map((host) => host.toLowerCase());
  const allowedHosts = Array.from(new Set(["localhost", "127.0.0.1", "::1", "[::1]", ...extraHosts]));
  const token = env.MCP_AUTH_TOKEN?.trim();
  const config = configSchema.parse({
    transport,
    host: env.MCP_HOST?.trim() || (
      transport === "http" ? "0.0.0.0" : "127.0.0.1"
    ),
    port: requirePositiveInt("PORT", env.PORT, 5999),

    authToken: token || undefined,
    allowUnauthenticated: env.MCP_ALLOW_UNAUTHENTICATED === "true",

    allowedHosts,
    allowedOrigins: splitList(env.MCP_ALLOWED_ORIGINS),

    logLevel: env.LOG_LEVEL || "info",
    maxBodyBytes: requirePositiveInt(
      "MCP_MAX_BODY_BYTES",
      env.MCP_MAX_BODY_BYTES,
      65_536
    ),

    nodeEnv: env.NODE_ENV?.trim() || "development",
    trustProxy: env.MCP_TRUST_PROXY === "true",

    maxSessions: requirePositiveInt(
      "MCP_MAX_SESSIONS",
      env.MCP_MAX_SESSIONS,
      100
    ),

    requestsPerMinute: requirePositiveInt(
      "MCP_REQUESTS_PER_MINUTE",
      env.MCP_REQUESTS_PER_MINUTE,
      120
    ),
    bookingApiBaseUrl: (env.BOOKING_API_BASE_URL?.trim() || "http://127.0.0.1:5001/api/v1").replace(/\/$/, ""),
  });

  if (config.transport === "http") {
    assertHttpSecurity(config);
  }

  return config;
}
