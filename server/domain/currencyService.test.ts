import { describe, expect, it, vi } from "vitest";

import { CurrencyService, type ExchangeRateProvider } from "./currencyService";

describe("CurrencyService", () => {
  it("returns fresh snapshot from provider and normalizes base currency", async () => {
    const provider: ExchangeRateProvider = {
      providerName: "test",
      fetchLatest: vi.fn(async () => ({
        base: "BRL" as const,
        fetchedAt: "2026-03-06T12:00:00.000Z",
        rates: { USD: 0.2, ARS: 210 },
      })),
    };

    const service = new CurrencyService(provider, 60_000);
    const snapshot = await service.getSnapshot("BRL");

    expect(snapshot.base).toBe("BRL");
    expect(snapshot.rates.BRL).toBe(1);
    expect(snapshot.rates.USD).toBe(0.2);
    expect(snapshot.stale).toBe(false);
  });

  it("falls back to last valid cached quote when provider fails", async () => {
    const provider: ExchangeRateProvider = {
      providerName: "test",
      fetchLatest: vi.fn()
        .mockResolvedValueOnce({
          base: "BRL" as const,
          fetchedAt: "2026-03-06T12:00:00.000Z",
          rates: { USD: 0.2 },
        })
        .mockRejectedValueOnce(new Error("network down")),
    };

    const service = new CurrencyService(provider, 0);
    await service.getSnapshot("BRL");
    const snapshot = await service.getSnapshot("BRL");

    expect(snapshot.stale).toBe(true);
    expect(snapshot.warning).toContain("cache");
    expect(snapshot.rates.USD).toBe(0.2);
  });

  it("returns base amount unchanged when target rate is unavailable", () => {
    const provider: ExchangeRateProvider = {
      providerName: "test",
      fetchLatest: vi.fn(),
    };

    const service = new CurrencyService(provider, 60_000);
    const converted = service.convertFromBase(1500, "USD", {
      base: "BRL",
        rates: {
          BRL: 1,
          USD: Number.NaN,
          EUR: Number.NaN,
          ARS: Number.NaN,
          CLP: Number.NaN,
          COP: Number.NaN,
        MXN: Number.NaN,
        PEN: Number.NaN,
        UYU: Number.NaN,
      },
      fetchedAt: "2026-03-06T12:00:00.000Z",
      provider: "test",
      stale: true,
    });

    expect(converted).toBe(1500);
  });
});
