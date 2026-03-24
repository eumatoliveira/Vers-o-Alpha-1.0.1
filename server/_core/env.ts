import { randomBytes } from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";
const jwtSecret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID?.trim() ?? "";
const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL?.trim() ?? "";
const oAuthServerUrl = process.env.OAUTH_SERVER_URL?.trim() ?? "";
type BootstrapDemoPlan = "essencial" | "pro" | "enterprise";

const parseEmailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

const VALID_BOOTSTRAP_DEMO_PLANS = new Set<BootstrapDemoPlan>([
  "essencial",
  "pro",
  "enterprise",
]);

const parseBootstrapDemoUsers = (value: string | undefined) =>
  (value ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [rawEmail, rawPassword, rawPlan, ...rawNameParts] = entry
        .split("|")
        .map((part) => part.trim());

      const email = rawEmail?.toLowerCase();
      const password = rawPassword ?? "";
      const plan = (rawPlan ?? "").toLowerCase() as BootstrapDemoPlan;
      const name = rawNameParts.join("|").trim();

      if (!email || !password || !VALID_BOOTSTRAP_DEMO_PLANS.has(plan)) {
        console.warn(
          `[ENV] Ignoring invalid BOOTSTRAP_DEMO_USERS entry: "${entry}". Expected "email|password|essencial|Nome".`
        );
        return [];
      }

      return [
        {
          email,
          password,
          plan,
          name: name || "Conta de Teste GLX",
        },
      ];
    });

const bootstrapTestClientName = process.env.BOOTSTRAP_TEST_CLIENT_NAME?.trim() || "Conta de Teste GLX";
const defaultDevelopmentDemoUsers = [
  {
    email: "cliente@glx.local",
    password: "Cliente123!",
    plan: "essencial" as const,
    name: "Cliente Local GLX",
  },
  {
    email: "pro@glx.local",
    password: "Pro123!",
    plan: "pro" as const,
    name: "Pro Local GLX",
  },
  {
    email: "enterprise@glx.local",
    password: "Enterprise123!",
    plan: "enterprise" as const,
    name: "Enterprise Local GLX",
  },
];

if (isProduction && !jwtSecret) {
  throw new Error("[ENV] Missing JWT_SECRET in production. Set JWT_SECRET before starting the server.");
}

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("[ENV] Missing DATABASE_URL in production. Set DATABASE_URL before starting the server.");
}

const developmentSecret = `dev-${randomBytes(24).toString("hex")}`;

export const ENV = {
  appId,
  oauthPortalUrl,
  cookieSecret: jwtSecret || developmentSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl,
  isOAuthConfigured:
    appId.length > 0 &&
    oauthPortalUrl.length > 0 &&
    oAuthServerUrl.length > 0,
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  isDevelopment,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  kommoClientId: process.env.KOMMO_CLIENT_ID?.trim() ?? "",
  kommoClientSecret: process.env.KOMMO_CLIENT_SECRET?.trim() ?? "",
  kommoWebhookSecret: process.env.KOMMO_WEBHOOK_SECRET?.trim() ?? "",
  asaasAccessToken: process.env.ASAAS_ACCESS_TOKEN?.trim() ?? "",
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "",
  asaasApiBaseUrl: process.env.ASAAS_API_BASE_URL?.trim() ?? "https://api.asaas.com/v3",
  asaasUserAgent: process.env.ASAAS_USER_AGENT?.trim() ?? "glx-control-tower/1.0",
  exchangeRateApiBaseUrl: process.env.EXCHANGE_RATE_API_BASE_URL?.trim() ?? "https://api.frankfurter.dev/v1/latest",
  exchangeRateCacheTtlMs: Number(process.env.EXCHANGE_RATE_CACHE_TTL_MS ?? 30 * 60 * 1000),
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
  bootstrapTestClientEmails: parseEmailList(process.env.BOOTSTRAP_TEST_CLIENT_EMAILS),
  bootstrapTestClientPassword: process.env.BOOTSTRAP_TEST_CLIENT_PASSWORD ?? "",
  bootstrapTestClientName,
  bootstrapDemoUsers: (() => {
    const parsed = parseBootstrapDemoUsers(process.env.BOOTSTRAP_DEMO_USERS);
    if (parsed.length > 0) return parsed;
    return isDevelopment ? defaultDevelopmentDemoUsers : [];
  })(),
};
