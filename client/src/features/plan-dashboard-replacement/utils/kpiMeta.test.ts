import { describe, expect, it } from "vitest";
import { resolveKpiMeta } from "./kpiMeta";

describe("resolveKpiMeta", () => {
  it("resolves NPS metadata according to the PDF rule", () => {
    const meta = resolveKpiMeta("NPS Geral", "integrated");

    expect(meta.formula).toContain("media das notas");
    expect(meta.sources[0]).toContain("Pesquisa NPS");
    expect(meta.fields).toContain("score");
  });

  it("marks fallback mode when real integrations are not available", () => {
    const meta = resolveKpiMeta("Receita Liquida", "fallback");

    expect(meta.sources[0]).toContain("Fallback interno");
    expect(meta.formula).toContain("Cancelamentos");
    expect(meta.formula).toContain("Estornos");
  });

  it("uses the PDF formula for break-even", () => {
    const meta = resolveKpiMeta("Break-even", "integrated");

    expect(meta.formula).toContain("Despesas Fixas Totais");
    expect(meta.formula).toContain("Margem de Contribuicao");
    expect(meta.note).toContain("contribuicao monetaria");
  });

  it("returns a generic explanation for unknown KPIs", () => {
    const meta = resolveKpiMeta("Indicador Proprietario GLX", "integrated");

    expect(meta.formula).toContain("Indicador calculado");
    expect(meta.note).toBeTruthy();
  });
});
