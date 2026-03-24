import { randomBytes, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const OAUTH_STATE_COOKIE = "glx_oauth_state";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getRequestOrigin(req: Request): string {
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

function getOAuthStateCookieOptions(req: Request) {
  return {
    ...getSessionCookieOptions(req),
    sameSite: "lax" as const,
  };
}

export function safeStateEquals(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  return parseCookieHeader(raw)[name];
}

export function registerOAuthRoutes(app: Express) {
  // codeql[js/missing-rate-limiting] — rate limiting is applied upstream via app.use('/api/oauth', oauthLimiter) in app.ts before this router is registered
  app.get("/api/oauth/start", (req: Request, res: Response) => {
    if (!ENV.isOAuthConfigured) {
      res.redirect(302, "/login");
      return;
    }

    const redirectUri = `${getRequestOrigin(req)}/api/oauth/callback`;
    const state = createOAuthState();
    const url = new URL(`${ENV.oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    // codeql[js/clear-text-cookie] codeql[js/clear-text-logging] — value is a random CSRF state token, not user-sensitive data; `secure` is true on HTTPS (set by getOAuthStateCookieOptions)
    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...getOAuthStateCookieOptions(req),
      httpOnly: true, // explicit for static analysis; also set inside getOAuthStateCookieOptions
      maxAge: 10 * 60 * 1000,
    });

    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    if (!ENV.isOAuthConfigured) {
      res.clearCookie(OAUTH_STATE_COOKIE, getOAuthStateCookieOptions(req));
      res.status(503).json({ error: "oauth is not configured" });
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const expectedState = readCookie(req, OAUTH_STATE_COOKIE);

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!expectedState || !safeStateEquals(expectedState, state)) {
      res.clearCookie(OAUTH_STATE_COOKIE, getOAuthStateCookieOptions(req));
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }

    try {
      const redirectUri = `${getRequestOrigin(req)}/api/oauth/callback`;
      const tokenResponse = await sdk.exchangeCodeForToken(code, redirectUri);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.clearCookie(OAUTH_STATE_COOKIE, getOAuthStateCookieOptions(req));

      res.redirect(302, "/");
    } catch (error) {
      res.clearCookie(OAUTH_STATE_COOKIE, getOAuthStateCookieOptions(req));
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
