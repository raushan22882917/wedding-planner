import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const boolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const optionalCsv = z
  .string()
  .optional()
  .transform(
    (value) =>
      value
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [],
  );
const optionalEnvironmentValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGINS: optionalCsv,
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_AUTH_REQUIRED: boolean.default("true"),
  DEMO_OWNER_ID: z
    .string()
    .uuid()
    .default("00000000-0000-0000-0000-000000000001"),
  SCRAPER_ALLOWED_HOSTS: optionalCsv,
  SCRAPER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(20000),
  SCRAPER_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(10000)
    .max(10000000)
    .default(2000000),
  SCRAPER_MAX_ITEMS_PER_RUN: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25),
  RUN_WORKER: boolean.default("true"),
  WORKER_POLL_MS: z.coerce.number().int().min(500).max(60000).default(2000),
  JINA_READER_BASE_URL: z.string().url().default("https://r.jina.ai"),
  EXA_PROVIDER: z.enum(["disabled", "api", "mcporter"]).default("disabled"),
  EXA_API_KEY: z.string().optional(),
  MCPORTER_BIN: z.string().default("mcporter"),
  MCPORTER_CONFIG: z.string().min(1).optional(),
  AGENT_REACH_SOCIAL_ENABLED: boolean.default("false"),
  AGENT_REACH_OPENCLI_BIN: z.string().default("opencli"),
  AGENT_REACH_TWITTER_BIN: z.string().default("twitter"),
  // Optional self-hosted OpenWA gateway. The API key is server-only and must
  // be an OpenWA OPERATOR key; MarryMap creates a private session per user.
  OPENWA_BASE_URL: optionalEnvironmentValue(z.string().url()),
  OPENWA_API_KEY: optionalEnvironmentValue(z.string().min(8)),
  OPENWA_USE_LOCAL_GATEWAY: boolean.default("true"),
  // Optional override for local development. This is read only by the API
  // process; it never reaches the browser.
  OPENWA_LOCAL_API_KEY_FILE: optionalEnvironmentValue(z.string().min(1)),
  // Dograh is optional. All values are server-only: a published API-trigger
  // workflow initiates consented outbound availability calls, while the runs
  // endpoint returns the stored outcome and gathered answers.
  DOGRAH_TRIGGER_URL: optionalEnvironmentValue(z.string().url()),
  DOGRAH_RUNS_BASE_URL: optionalEnvironmentValue(z.string().url()),
  DOGRAH_API_KEY: optionalEnvironmentValue(z.string().min(8)),
  DOGRAH_WORKFLOW_ID: optionalEnvironmentValue(
    z.coerce.number().int().positive(),
  ),
  DOGRAH_TELEPHONY_CONFIGURATION_ID: optionalEnvironmentValue(
    z.coerce.number().int().positive(),
  ),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  throw new Error(
    `Invalid environment configuration: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
  );
}
const environment = result.data;

if (
  environment.NODE_ENV === "production" &&
  !environment.SUPABASE_AUTH_REQUIRED
) {
  throw new Error("SUPABASE_AUTH_REQUIRED must be true in production");
}

if (environment.EXA_PROVIDER === "api" && !environment.EXA_API_KEY) {
  throw new Error("EXA_API_KEY is required when EXA_PROVIDER=api");
}

const openwaValues = [environment.OPENWA_BASE_URL, environment.OPENWA_API_KEY];
if (openwaValues.some(Boolean) && !openwaValues.every(Boolean)) {
  throw new Error("OPENWA_BASE_URL and OPENWA_API_KEY must be set together");
}

const dograhValues = [
  environment.DOGRAH_TRIGGER_URL,
  environment.DOGRAH_RUNS_BASE_URL,
  environment.DOGRAH_API_KEY,
  environment.DOGRAH_WORKFLOW_ID,
];
if (
  dograhValues.some((value) => value !== undefined) &&
  dograhValues.some((value) => value === undefined)
) {
  throw new Error(
    "DOGRAH_TRIGGER_URL, DOGRAH_RUNS_BASE_URL, DOGRAH_API_KEY, and DOGRAH_WORKFLOW_ID must be set together",
  );
}

// The checked-in OpenWA source is the default for local development. OpenWA
// creates a random, owner-only key on first boot; use that private local file
// rather than a shared development credential. Production must always provide
// both private values explicitly.
const useLocalOpenwa =
  environment.NODE_ENV === "development" &&
  environment.OPENWA_USE_LOCAL_GATEWAY;

function readLocalOpenwaKey(): string | undefined {
  if (!useLocalOpenwa) return undefined;
  const keyFile =
    environment.OPENWA_LOCAL_API_KEY_FILE ??
    resolve(process.cwd(), "../openwa/data/.api-key");
  try {
    const key = readFileSync(keyFile, "utf8").trim();
    return key || undefined;
  } catch {
    return undefined;
  }
}

const localOpenwaKey = readLocalOpenwaKey();

export const config = {
  ...environment,
  OPENWA_BASE_URL: useLocalOpenwa
    ? "http://127.0.0.1:2785"
    : environment.OPENWA_BASE_URL,
  OPENWA_API_KEY: useLocalOpenwa ? localOpenwaKey : environment.OPENWA_API_KEY,
};
