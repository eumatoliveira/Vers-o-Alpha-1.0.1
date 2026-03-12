import jsPDF from "jspdf";
import Papa from "papaparse";
import { normalizePlanTier } from "@shared/controlTowerRules";
import type { ControlTowerFact, ControlTowerFilterState } from "@shared/types";
import type { FormulaMetricKey } from "../state/FormulaCatalog";
import { FORMULA_CATALOG } from "../state/FormulaCatalog";

export interface ExportDashboardParams {
  format: "pdf" | "csv";
  scope?: string;
  plan?: string | null;
  filters: ControlTowerFilterState;
  data: ControlTowerFact[];
  formulaKeys?: FormulaMetricKey[];
  summary?: Record<string, number | string>;
}

function downloadFile(content: BlobPart, mimeType: string, fileName: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function makeFileBase(scope: string | undefined) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${scope ?? "dashboard"}-${stamp}`;
}

function triggerUrlDownload(url: string, fileName: string) {
  if (typeof window === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}

function buildCsv(params: ExportDashboardParams) {
  const csv = Papa.unparse(params.data.map(row => ({
    timestamp: row.timestamp,
    channel: row.channel,
    professional: row.professional,
    procedure: row.procedure,
    status: row.status,
    entries: row.entries,
    exits: row.exits,
    revenueValue: row.revenueValue,
    slotsAvailable: row.slotsAvailable,
    slotsEmpty: row.slotsEmpty,
    ticketMedio: row.ticketMedio,
    custoVariavel: row.custoVariavel,
    durationMinutes: row.durationMinutes,
    materialList: row.materialList.join(";"),
    waitMinutes: row.waitMinutes,
    npsScore: row.npsScore,
  })));
  downloadFile(csv, "text/csv;charset=utf-8", `${makeFileBase(params.scope)}.csv`);
}

function buildPdf(params: ExportDashboardParams) {
  const normalizedPlan = normalizePlanTier(params.plan);

  if (normalizedPlan === "essencial") {
    triggerUrlDownload(
      "/pdf-templates/GLX_Control_Tower_PDFESSENCIAL_Model.pdf",
      `GLX_PDF_Start_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    return;
  }

  if (normalizedPlan === "pro") {
    triggerUrlDownload(
      "/pdf-templates/GLX_Control_Tower_PRO_Premium_McKinsey_Style.pdf",
      `GLX_PDF_Pro_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    return;
  }

  if (normalizedPlan === "enterprise") {
    triggerUrlDownload(
      "/pdf-templates/GLX_Enterprise_Investor_Goldman_Style.pdf",
      `GLX_PDF_Enterprise_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    return;
  }

  const doc = new jsPDF();
  const formulas = params.formulaKeys ?? (Object.keys(FORMULA_CATALOG) as FormulaMetricKey[]);
  let cursorY = 14;
  const left = 14;

  const writeLine = (line: string, gap = 6) => {
    if (cursorY > 280) {
      doc.addPage();
      cursorY = 14;
    }
    doc.text(line, left, cursorY);
    cursorY += gap;
  };

  doc.setFontSize(14);
  writeLine("Control Tower Executive Export", 8);
  doc.setFontSize(10);
  writeLine(`Generated at: ${new Date().toISOString()}`);
  writeLine(`Scope: ${params.scope ?? "dashboard"}`);
  writeLine(`Filters: ${JSON.stringify(params.filters)}`);
  writeLine("");

  if (params.summary) {
    writeLine("Summary:");
    Object.entries(params.summary).forEach(([key, value]) => {
      writeLine(`- ${key}: ${value}`);
    });
    writeLine("");
  }

  writeLine("Rows:");
  writeLine(`- Total rows: ${params.data.length}`);
  const totalRevenue = params.data.reduce((sum, row) => sum + row.revenueValue, 0);
  writeLine(`- Revenue value (sum): ${totalRevenue.toFixed(2)}`);
  writeLine("");

  writeLine("Formulas:");
  formulas.slice(0, 16).forEach(metricKey => {
    const formula = FORMULA_CATALOG[metricKey];
    writeLine(`- ${formula.metricName.pt}: ${formula.formula}`);
  });

  const output = doc.output("arraybuffer");
  downloadFile(output, "application/pdf", `${makeFileBase(params.scope)}.pdf`);
}

export function exportDashboard(params: ExportDashboardParams) {
  if (params.format === "csv") {
    buildCsv(params);
    return;
  }
  buildPdf(params);
}
