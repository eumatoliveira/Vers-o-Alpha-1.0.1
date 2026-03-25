import { describe, expect, it } from "vitest";
import { sanitizeIntegrationConfig, sanitizeUserForAdmin } from "./adminRouter";

describe("admin security sanitizers", () => {
  it("removes password hash and openId from admin user payloads", () => {
    const sanitized = sanitizeUserForAdmin({
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      openId: "openid-secret",
      passwordHash: "bcrypt-hash",
      loginMethod: "email",
      role: "admin",
      plan: "enterprise",
      preferredCurrency: "BRL",
      mfaEnabled: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    expect(sanitized).toMatchObject({
      id: 1,
      email: "admin@example.com",
      role: "admin",
    });
    expect("openId" in sanitized).toBe(false);
    expect("passwordHash" in sanitized).toBe(false);
  });

  it("removes integration secrets and keeps only presence flags", () => {
    const sanitized = sanitizeIntegrationConfig({
      id: 1,
      userId: 1,
      clientId: 1,
      provider: "kommo",
      accountDomain: "example.kommo.com",
      apiBaseUrl: undefined,
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      webhookSecret: "secret-webhook",
      webhookToken: "secret-token",
      userAgent: undefined,
      environment: undefined,
      metadata: {},
      enabled: true,
      updatedAt: new Date().toISOString(),
    });

    expect(sanitized).toMatchObject({
      provider: "kommo",
      enabled: true,
      hasAccessToken: true,
      hasRefreshToken: true,
      hasWebhookSecret: true,
      hasWebhookToken: true,
    });
    expect("accessToken" in (sanitized as Record<string, unknown>)).toBe(false);
    expect("refreshToken" in (sanitized as Record<string, unknown>)).toBe(false);
    expect("webhookSecret" in (sanitized as Record<string, unknown>)).toBe(false);
    expect("webhookToken" in (sanitized as Record<string, unknown>)).toBe(false);
  });
});
