import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { __resetControlTowerMemory } from "./controlTowerRouter";

function createCtx(): TrpcContext {
  return {
    user: {
      id: 999,
      openId: "test-open-id",
      email: "client.test@example.com",
      name: "Client Test",
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
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const validRow = {
  id: "row-1",
  timestamp: new Date().toISOString(),
  channel: "meta",
  professional: "Ana",
  procedure: "Consulta",
  status: "realizado" as const,
  entries: 1000,
  exits: 350,
  slotsAvailable: 20,
  slotsEmpty: 4,
  ticketMedio: 380,
  custoVariavel: 130,
  durationMinutes: 45,
  materialList: ["resina"],
  waitMinutes: 12,
  npsScore: 84,
  baseOldRevenueCurrent: 24000,
  baseOldRevenuePrevious: 22000,
};

describe("controlTowerRouter", () => {
  beforeEach(() => {
    __resetControlTowerMemory();
  });

  it("commits ingestion batch when payload is valid", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.controlTower.commitIngestionBatch({
      fileName: "agenda.csv",
      fileType: "csv",
      rows: [validRow],
      metadata: { source: "test" },
    });

    expect(result.success).toBe(true);
    expect(result.insertedRows).toBe(1);
  });

  it("rejects invalid ingestion payload", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.controlTower.commitIngestionBatch({
        fileName: "empty.csv",
        fileType: "csv",
        rows: [],
      }),
    ).rejects.toThrow();
  });

  it("creates and updates RCA status", async () => {
    const caller = appRouter.createCaller(createCtx());

    const created = await caller.controlTower.createRca({
      alertId: "alert-p1-001",
      severity: "P1",
      title: "Impacto financeiro critico",
      rootCause: "Agenda com faltas em horario nobre",
      actionPlan: "Aplicar confirmacao ativa em 24h",
      owner: "Ana",
      dueDate: "2026-03-05",
      status: "open",
    });

    expect(created.success).toBe(true);
    const id = Number(created.record.id);
    expect(id).toBeGreaterThan(0);

    const updated = await caller.controlTower.updateRcaStatus({
      id,
      status: "in_progress",
    });
    expect(updated.success).toBe(true);

    const list = await caller.controlTower.listRca({});
    const item = list.find(rca => Number(rca.id) === id);
    expect(item?.status).toBe("in_progress");
  });
});
