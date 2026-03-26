import "dotenv/config";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerSiteRoutes } from "../siteRouter";
import { serveStatic } from "./static";
import { registerKommoWebhookRouter } from "../infrastructure/webhooks/kommoRouter";
import { registerAsaasWebhookRouter } from "../infrastructure/webhooks/asaasRouter";
import { currencyService } from "../domain/currencyService";
import { exportRouter } from "../exportRouter";
import { v1Router } from "../publicApi/v1Router";
import { bootstrapDone } from "../authRouter";
import { getDb } from "../db";

// ═══════════════════════════════════════════════════════════════
// Port Discovery
// ═══════════════════════════════════════════════════════════════

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(port, () => {
      probe.close(() => resolve(true));
    });
    probe.on("error", () => resolve(false));
  });
}

export async function findAvailablePort(startPort: number = 3000): Promise<number> {
  const MAX_ATTEMPTS = 20;
  for (let port = startPort; port < startPort + MAX_ATTEMPTS; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + MAX_ATTEMPTS}`);
}

// ═══════════════════════════════════════════════════════════════
// In-memory Rate Limiter (no external dependency)
// Protects login, registration, and contact form endpoints
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

function createRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${opts.keyPrefix}:${ip}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set standard rate-limit headers
    res.setHeader("X-RateLimit-Limit", opts.maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, opts.maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > opts.maxRequests) {
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfterMs: entry.resetAt - now,
      });
      return;
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════
// Security Headers Middleware
// ═══════════════════════════════════════════════════════════════

const BUILDER_FRAME_ANCESTORS = "'self' https://builder.io https://*.builder.io";

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "0"); // Modern browsers use CSP instead
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Builder previews load the app inside an iframe, so we allow builder.io
  // explicitly via CSP and avoid X-Frame-Options which would block embeds.
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://wa.me; frame-ancestors ${BUILDER_FRAME_ANCESTORS};`
    );
  } else {
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: ws: wss:; frame-ancestors ${BUILDER_FRAME_ANCESTORS};`
    );
  }

  next();
}

function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }

  const hasCookieHeader = typeof req.headers.cookie === "string" && req.headers.cookie.length > 0;
  if (!hasCookieHeader) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  // x-forwarded-host is set by Vercel and other reverse proxies with the real hostname
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0].trim()
    || req.headers.host;

  const sameOrigin = (value: string | undefined) => {
    if (!value || !host) return false;
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };

  if (sameOrigin(origin) || sameOrigin(referer)) {
    next();
    return;
  }

  // tRPC-compatible error format so the client can parse it properly
  res.status(403).json({
    error: [{ error: { message: "CSRF validation failed", code: -32600 } }],
  });
}

function disablePublicAuthFlows(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  if (path === "/api/trpc/emailAuth.register") {
    res.status(403).json({
      error: "Cadastro público desativado. Solicite um convite do administrador.",
    });
    return;
  }

  next();
}

// ═══════════════════════════════════════════════════════════════
// Application Setup
// ═══════════════════════════════════════════════════════════════

function registerAppRoutes(app: Express) {
  // Security headers on every response
  app.use(securityHeaders);
  app.use(csrfProtection);
  app.use(disablePublicAuthFlows);

  // Body parsing with sensible limits (5MB default, not 50MB)
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // Rate limiters for sensitive endpoints
  const authLimiter = createRateLimiter({
    windowMs: process.env.NODE_ENV === "development" ? 60 * 1000 : 15 * 60 * 1000,
    maxRequests: process.env.NODE_ENV === "development" ? 100 : 10,
    keyPrefix: "auth",
  });
  const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 120,          // 120 req/min
    keyPrefix: "api",
  });
  const contactLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: "contact",
  });
  const oauthLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === "development" ? 100 : 30,
    keyPrefix: "oauth",
  });

  // Apply rate limiters to sensitive paths
  app.use("/api/trpc/emailAuth.login", authLimiter);
  app.use("/api/trpc/emailAuth.register", authLimiter);
  app.use("/api/trpc/emailAuth.recoverPassword", authLimiter);
  app.use("/api/contact", contactLimiter);
  app.use("/api/oauth", oauthLimiter);
  app.use("/api/trpc", apiLimiter);

  registerSiteRoutes(app);
  registerOAuthRoutes(app);
  registerKommoWebhookRouter(app);
  registerAsaasWebhookRouter(app);
  app.use("/api/export", exportRouter);
  app.use("/api/v1", v1Router);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({
      error: "not_found",
      message: `API route not found: ${req.originalUrl}`,
    });
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      next(error);
      return;
    }

    console.error("[API] Unhandled error:", error);

    if (res.headersSent) {
      next(error);
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected API error";

    res.status(500).json({
      error: "internal_server_error",
      message,
    });
  });
}

export async function createHttpApp(): Promise<Express> {
  await getDb();
  await bootstrapDone;

  const app = express();
  registerAppRoutes(app);
  serveStatic(app);
  return app;
}

export async function startServer() {
  const app = express();
  const server = createServer(app);

  registerAppRoutes(app);
  currencyService.startAutoRefresh();

  if (process.env.NODE_ENV === "development") {
    const importRuntimeModule = new Function(
      "modulePath",
      "return import(modulePath);",
    ) as (modulePath: string) => Promise<typeof import("./vite")>;
    const { setupVite } = await importRuntimeModule("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Eagerly establish DB connection so startup fails fast if DATABASE_URL is wrong
  await getDb();

  // Wait for user bootstrap to complete before accepting connections
  // so login requests never race against bcrypt hashing of demo users
  await bootstrapDone;

  server.listen(port, () => {
    console.log(`[Server] Listening on port ${port} (${process.env.NODE_ENV ?? "development"})`);
  });
}
