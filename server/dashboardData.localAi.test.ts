import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { __resetControlTowerMemory } from "./controlTowerRouter";
import { __resetDashboardDataMemory, linkUserToClient } from "./db";

function createCtx(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const adminUser: NonNullable<TrpcContext["user"]> = {
  id: 1001,
  openId: "admin-local-ai",
  email: "admin@glx.local",
  name: "Admin Local AI",
  loginMethod: "email",
  role: "admin",
  passwordHash: null,
  plan: "enterprise",
  preferredCurrency: "BRL",
  mfaEnabled: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const clientUser: NonNullable<TrpcContext["user"]> = {
  id: 2002,
  openId: "client-local-ai",
  email: "enterprise@glx.local",
  name: "Client Local AI",
  loginMethod: "email",
  role: "user",
  passwordHash: null,
  plan: "enterprise",
  preferredCurrency: "BRL",
  mfaEnabled: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("dashboardData.ingestWithLocalAi", () => {
  beforeEach(() => {
    __resetDashboardDataMemory();
    __resetControlTowerMemory();
  });

  it("syncs admin metrics and propagates facts to linked plan dashboards", async () => {
    const adminCaller = appRouter.createCaller(createCtx(adminUser));
    const clientCaller = appRouter.createCaller(createCtx(clientUser));
    const slug = `clinica-local-ai-${Date.now()}`;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);

    await adminCaller.dashboardData.createClient({
      name: "Clinica Local AI",
      slug,
      industry: "saude",
    });

    const clients = await adminCaller.dashboardData.getClients();
    const createdClient = clients.find((client) => client.slug === slug);

    expect(createdClient).toBeTruthy();
    await linkUserToClient(clientUser.id, createdClient!.id);

    const result = await adminCaller.dashboardData.ingestWithLocalAi({
      clientId: createdClient!.id,
      source: "api",
      fileName: "local-ai-seed.json",
      records: [
        {
          id: "seed-1",
          timestamp: now.toISOString(),
          channel: "Google",
          professional: "Dra. Ana",
          procedure: "Botox",
          status: "realizado",
          unit: "Jardins",
          leadId: "lead-001",
          patientId: "patient-001",
          firstContactAt: yesterday.toISOString(),
          confirmedAt: now.toISOString(),
          firstResponseAt: new Date(yesterday.getTime() + 3_600_000).toISOString(),
          consultationStartedAt: new Date(now.getTime() + 900_000).toISOString(),
          revenueGross: 1200,
          revenueNet: 1080,
          taxes: 80,
          directCost: 260,
          variableCost: 90,
          fixedCost: 50,
          marketingSpend: 120,
          slotsAvailable: 8,
          slotsEmpty: 1,
          waitMinutes: 12,
          npsScore: 10,
          checklistCompleted: 5,
          checklistTotal: 5,
          baseOldRevenueCurrent: 52000,
          baseOldRevenuePrevious: 47000,
        },
        {
          id: "seed-2",
          timestamp: now.toISOString(),
          channel: "Instagram",
          professional: "Dr. Silva",
          procedure: "Laser",
          status: "noshow",
          unit: "Paulista",
          leadId: "lead-002",
          patientId: "patient-002",
          firstContactAt: yesterday.toISOString(),
          confirmedAt: now.toISOString(),
          firstResponseAt: new Date(yesterday.getTime() + 7_200_000).toISOString(),
          revenueGross: 800,
          revenueNet: 720,
          taxes: 60,
          directCost: 120,
          variableCost: 70,
          fixedCost: 40,
          marketingSpend: 140,
          slotsAvailable: 6,
          slotsEmpty: 2,
          waitMinutes: 0,
          npsScore: 6,
          cancellationReason: "Sem confirmacao",
          checklistCompleted: 3,
          checklistTotal: 5,
          baseOldRevenueCurrent: 52000,
          baseOldRevenuePrevious: 47000,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.factsImported).toBe(2);
    expect(result.propagatedUserIds).toContain(clientUser.id);
    expect(result.adminPreview.ceo.faturamento).toBe("2000.00");
    expect(result.coverage.percent).toBeGreaterThan(0);
    expect(result.routing.plans.enterprise.modules.length).toBeGreaterThan(0);
    expect(result.adminPreview.operations.taxaOcupacao).toBeDefined();

    const adminData = await adminCaller.dashboardData.getAllData({
      clientId: createdClient!.id,
    });

    expect(adminData.ceoMetrics?.faturamento).toBe("2000.00");
    expect(adminData.financialData?.receitaLiquida).toBe("1800.00");
    expect(adminData.marketingData?.totalSpend).toBe("260.00");

    const clientDashboard = await clientCaller.controlTower.getDashboardData({
      period: "30d",
    });

    expect(clientDashboard.facts).toHaveLength(2);
    expect(clientDashboard.facts.map((fact) => fact.id)).toEqual(
      expect.arrayContaining(["seed-1", "seed-2"]),
    );
  });
});
