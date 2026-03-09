import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Page } from "puppeteer";
import { browserPool } from "./BrowserPool";

export type ExportPlan = "essential" | "pro" | "enterprise";

export type ExportAppointment = {
  date: string;
  weekday: string;
  professional: string;
  channel: string;
  unit: string;
  procedure: string;
  status: string;
  severity: string;
  revenue: number;
  cost: number;
  nps: number | null;
  waitMinutes: number;
  isReturn: boolean;
  leadSource: string;
  cac: number;
};

export type ExportPayload = {
  clinicName: string;
  plan: ExportPlan;
  language: "PT" | "EN" | "ES";
  currency: string;
  filters: Record<string, string>;
  appointments?: ExportAppointment[];
};

type ExportCopy = {
  reportTitle: string;
  executiveSummary: string;
  summaryIntro: string;
  kpi: string;
  value: string;
  trend: string;
  status: string;
  analysisTitle: string;
  analysisPrefix: string;
  sourceTableTitle: string;
  sourceModule: string;
  sourceKpis: string;
  sourceSystem: string;
  generatedAt: string;
  period: string;
  page: string;
  of: string;
  confidential: string;
  version: string;
  noData: string;
};

type PlanBlueprint = {
  title: string;
  subtitle: string;
  sources: Record<string, string>;
};

type RuleRow = {
  kpi: string;
  value: string;
  target: string;
  status: string;
  action: string;
  severity: number;
};

type ChartCapture = {
  title: string;
  image: Buffer;
};

type SectionCapture = {
  title: string;
  kpis: Array<{ label: string; value: string }>;
  charts: ChartCapture[];
  ruleRows: RuleRow[];
};

type SummaryRow = {
  kpi: string;
  value: string;
  trend: string;
  statusLabel: string;
  severity: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const BRAND_DARK = rgb(0.059, 0.09, 0.165);
const BRAND_BLUE = rgb(0.145, 0.388, 0.922);
const BRAND_LIGHT = rgb(0.937, 0.965, 1);
const ACCENT_ORANGE = rgb(0.945, 0.451, 0.086);
const ACCENT_GREEN = rgb(0.086, 0.639, 0.29);
const ACCENT_RED = rgb(0.863, 0.149, 0.149);
const ACCENT_AMBER = rgb(0.851, 0.467, 0.024);
const GRAY = rgb(0.392, 0.455, 0.545);
const GRID = rgb(0.886, 0.91, 0.949);
const WHITE = rgb(1, 1, 1);
const LIGHT_ROW = rgb(0.973, 0.98, 0.988);

const COPY_BY_LANGUAGE: Record<ExportPayload["language"], ExportCopy> = {
  PT: {
    reportTitle: "Dashboard KPI",
    executiveSummary: "Resumo Executivo - KPIs Criticos",
    summaryIntro: "Visao geral",
    kpi: "KPI",
    value: "Valor",
    trend: "Tendencia",
    status: "Status",
    analysisTitle: "Leitura executiva",
    analysisPrefix: "Analise:",
    sourceTableTitle: "Fontes dos dados",
    sourceModule: "Modulo",
    sourceKpis: "KPIs",
    sourceSystem: "Sistema de origem",
    generatedAt: "Gerado em",
    period: "Periodo",
    page: "Pagina",
    of: "de",
    confidential: "GLX Partners | Documento confidencial",
    version: "v2026.03",
    noData: "Sem dados suficientes para compor esta secao.",
  },
  EN: {
    reportTitle: "KPI Dashboard",
    executiveSummary: "Executive Summary - Critical KPIs",
    summaryIntro: "Overview",
    kpi: "KPI",
    value: "Value",
    trend: "Trend",
    status: "Status",
    analysisTitle: "Executive readout",
    analysisPrefix: "Analysis:",
    sourceTableTitle: "Data sources",
    sourceModule: "Module",
    sourceKpis: "KPIs",
    sourceSystem: "Source system",
    generatedAt: "Generated at",
    period: "Period",
    page: "Page",
    of: "of",
    confidential: "GLX Partners | Confidential",
    version: "v2026.03",
    noData: "Not enough data to compose this section.",
  },
  ES: {
    reportTitle: "Dashboard KPI",
    executiveSummary: "Resumen Ejecutivo - KPIs Criticos",
    summaryIntro: "Vision general",
    kpi: "KPI",
    value: "Valor",
    trend: "Tendencia",
    status: "Estado",
    analysisTitle: "Lectura ejecutiva",
    analysisPrefix: "Analisis:",
    sourceTableTitle: "Fuentes de datos",
    sourceModule: "Modulo",
    sourceKpis: "KPIs",
    sourceSystem: "Sistema origen",
    generatedAt: "Generado en",
    period: "Periodo",
    page: "Pagina",
    of: "de",
    confidential: "GLX Partners | Confidencial",
    version: "v2026.03",
    noData: "No hay datos suficientes para esta seccion.",
  },
};

const PLAN_BLUEPRINTS: Record<ExportPlan, PlanBlueprint> = {
  essential: {
    title: "Relatorio Executivo Essential",
    subtitle: "Capa de leitura para operacao, agenda, marketing e financeiro.",
    sources: {
      "VISAO CEO": "Control Tower consolidado / cockpit executivo",
      "AGENDA & NO-SHOW": "CRM / agenda clinica / confirmacoes",
      "FINANCEIRO EXECUTIVO": "ERP / financeiro operacional",
      "MARKETING & CAPTACAO": "CRM / midia / captacao",
      "OPERACAO & EXPERIENCIA": "NPS / atendimento / operacao",
    },
  },
  pro: {
    title: "Relatorio Executivo Pro",
    subtitle: "Leitura tatico-executiva com unit economics, agenda e operacao.",
    sources: {
      "VISAO CEO": "Control Tower consolidado / cockpit executivo",
      "WAR ROOM": "Camada de alertas / prioridades / SLA",
      "FINANCEIRO AVANCADO": "ERP / forecast / margem / caixa",
      "AGENDA/OTIMIZACAO": "CRM / agenda / overbooking / ocupacao",
      "MARKETING/UNIT ECONOMICS": "CRM / midia / CAC / LTV",
      "INTEGRACOES": "Conectores CRM / billing / performance",
      "OPERACAO & EXPERIENCIA": "NPS / atendimento / operacao",
      "EQUIPE": "Produtividade / pessoas / capacidade",
    },
  },
  enterprise: {
    title: "Relatorio Executivo Enterprise",
    subtitle: "Leitura multiunidade, investidor e governanca para rede.",
    sources: {
      "VISAO CEO": "Control Tower consolidado / cockpit executivo",
      "WAR ROOM": "Camada de alertas / prioridades / SLA",
      "FINANCEIRO INVESTIDOR": "ERP / DRE / valuation / investor pack",
      "AGENDA/OTIMIZACAO": "CRM / agenda / ocupacao / no-show",
      "MARKETING/UNIT ECONOMICS": "CRM / midia / CAC / LTV",
      "MULTI-UNIDADE": "BI multi-site / comparativo de unidades",
      "INTEGRACOES": "Conectores CRM / billing / performance",
      "OPERACAO & EXPERIENCIA": "NPS / atendimento / operacao",
      "EQUIPE": "Produtividade / pessoas / capacidade",
      "GOVERNANCA": "Camada de dados / qualidade / compliance",
    },
  },
};

function normalizePdfText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string | null | undefined) {
  return normalizePdfText(value)
    .replace(/[^\w/& -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function resolveRenderBaseUrl() {
  return process.env.INTERNAL_RENDER_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
}

function getStatusSeverity(status: string) {
  const normalized = normalizeKey(status);
  if (!normalized) return 0;
  if (normalized.includes("P1") || normalized.includes("CRITIC")) return 3;
  if (normalized.includes("P2") || normalized.includes("ATEN") || normalized.includes("WARN")) return 2;
  if (normalized.includes("P3")) return 1;
  return 0;
}

function getSeverityColor(severity: number) {
  if (severity >= 3) return ACCENT_RED;
  if (severity >= 2) return ACCENT_AMBER;
  return ACCENT_GREEN;
}

function getSeverityLabel(severity: number) {
  if (severity >= 3) return "Critico";
  if (severity >= 2) return "Atencao";
  return "No trilho";
}

function getTrendLabel(severity: number) {
  if (severity >= 3) return "↓ Acao imediata";
  if (severity >= 2) return "→ Monitorar";
  return "↑ Estavel";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = normalizePdfText(text);
  if (!safe) return [""];

  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    lines.push(word);
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(page: PDFPage, text: string, opts: {
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
}) {
  const lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  let cursor = opts.y;
  for (const line of lines) {
    page.drawText(line, {
      x: opts.x,
      y: cursor,
      font: opts.font,
      size: opts.size,
      color: opts.color,
    });
    cursor -= opts.lineHeight;
  }
  return cursor;
}

function formatGeneratedAt(payload: ExportPayload) {
  const locale = payload.language === "EN" ? "en-US" : payload.language === "ES" ? "es-ES" : "pt-BR";
  return new Date().toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSubtitle(payload: ExportPayload, copy: ExportCopy) {
  const period = normalizePdfText(payload.filters.period || payload.filters.periodo || "");
  const generatedAt = formatGeneratedAt(payload);
  return `${copy.generatedAt} ${generatedAt}${period ? ` | ${copy.period} ${period}` : ""}`;
}

function resolveSource(plan: ExportPlan, sectionTitle: string) {
  const blueprint = PLAN_BLUEPRINTS[plan];
  const normalized = normalizeKey(sectionTitle).replace(/[|]/g, "");

  for (const [key, source] of Object.entries(blueprint.sources)) {
    if (normalized.includes(key)) {
      return source;
    }
  }

  return "Control Tower GLX / camada executiva";
}

function buildAnalysis(section: SectionCapture, source: string, copy: ExportCopy) {
  const topKpi = section.kpis[0];
  const alert = [...section.ruleRows].sort((a, b) => b.severity - a.severity)[0];
  const chartTitle = section.charts[0]?.title;
  const fragments = [`${copy.analysisPrefix}`];

  if (topKpi) {
    fragments.push(`${section.title} esta ancorado por ${topKpi.label} em ${topKpi.value}.`);
  } else {
    fragments.push(`${section.title} consolida a leitura executiva desta camada do plano.`);
  }

  if (alert && alert.severity > 0) {
    fragments.push(`O ponto mais sensivel no momento e ${alert.kpi} (${alert.value}) frente a meta ${alert.target}.`);
    fragments.push(`A causa provavel esta nas variacoes observadas em ${chartTitle || section.title}.`);
    fragments.push(`Acao recomendada: ${alert.action || "priorizar plano corretivo e acompanhamento semanal."}`);
  } else {
    fragments.push(`Os indicadores estao majoritariamente estaveis nesta secao, sem ruptura critica nas regras de negocio.`);
    fragments.push(`Recomendacao: manter cadencia de revisao e usar ${chartTitle || "o painel"} para antecipar desvios.`);
  }

  fragments.push(`Fonte principal: ${source}.`);
  return fragments.join(" ");
}

function buildSummaryRows(sections: SectionCapture[]) {
  const rows: SummaryRow[] = [];

  for (const section of sections) {
    const fallbackSeverity = Math.max(0, ...section.ruleRows.map((row) => row.severity));
    const candidates = section.kpis.slice(0, section.title.includes("VISAO CEO") ? 2 : 1);

    for (const candidate of candidates) {
      if (rows.length >= 8) break;

      const matchingRule = section.ruleRows.find((row) =>
        normalizeKey(row.kpi).includes(normalizeKey(candidate.label)) ||
        normalizeKey(candidate.label).includes(normalizeKey(row.kpi)),
      );
      const severity = matchingRule?.severity ?? fallbackSeverity;
      rows.push({
        kpi: candidate.label,
        value: candidate.value,
        trend: getTrendLabel(severity),
        statusLabel: getSeverityLabel(severity),
        severity,
      });
    }

    if (rows.length >= 8) break;
  }

  return rows;
}

function pickPrimaryCharts(section: SectionCapture) {
  const preferred = section.charts.filter((chart) => {
    const title = normalizeKey(chart.title);
    return !title.includes("TABELA") && !title.includes("REGRA") && !title.includes("ALERTA");
  });

  return (preferred.length > 0 ? preferred : section.charts).slice(0, 1);
}

async function captureSections(page: Page): Promise<SectionCapture[]> {
  const sections = await page.$$(".pdf-export-section");
  const results: SectionCapture[] = [];

  for (const section of sections) {
    const sectionTitle = normalizePdfText(
      (await section.evaluate((node) => node.getAttribute("data-title")?.trim() ?? "")) || "Dashboard",
    ) || "Dashboard";

    const kpis = await section.$$eval(".overview-card", (cards) =>
      cards.slice(0, 6).map((card) => {
        const label = (card.querySelector(".overview-card-label")?.textContent ?? "").replace(/\s+/g, " ").trim();
        const value = (card.querySelector(".overview-card-value")?.textContent ?? "").replace(/\s+/g, " ").trim();
        return { label, value };
      }).filter((card) => card.label && card.value),
    );

    const chartHandles = await section.$$(".chart-card");
    const chartTitles = await section.$$eval(".chart-card", (cards) =>
      cards.map((card) => ({
        title: (card.querySelector(".chart-card-title, .detail-section-header")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      })),
    );

    const charts: ChartCapture[] = [];
    for (let index = 0; index < chartHandles.length; index += 1) {
      const image = await chartHandles[index].screenshot({ type: "png" });
      charts.push({
        title: normalizePdfText(chartTitles[index]?.title || `Chart ${index + 1}`),
        image: Buffer.from(image),
      });
      await chartHandles[index].dispose();
    }

    const rawRows = await section.$$eval("table.data-table tbody tr", (rows) =>
      rows.map((row) =>
        Array.from(row.querySelectorAll("td"))
          .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean),
      ).filter((cells) => cells.length > 0),
    );

    const ruleRows = rawRows.map((cells) => {
      if (cells.length >= 7) {
        const status = cells[5];
        return {
          kpi: cells[1],
          value: cells[2],
          target: cells[3],
          status,
          action: cells[6] ?? "",
          severity: getStatusSeverity(status),
        } satisfies RuleRow;
      }

      if (cells.length >= 4) {
        const status = cells[cells.length - 1];
        return {
          kpi: cells[0],
          value: cells[1] ?? "",
          target: cells[2] ?? "",
          status,
          action: "",
          severity: getStatusSeverity(status),
        } satisfies RuleRow;
      }

      return {
        kpi: cells[0] ?? "",
        value: cells[1] ?? "",
        target: "",
        status: "",
        action: "",
        severity: 0,
      } satisfies RuleRow;
    }).filter((row) => row.kpi);

    results.push({
      title: sectionTitle,
      kpis: kpis.map((card) => ({
        label: normalizePdfText(card.label),
        value: normalizePdfText(card.value),
      })),
      charts,
      ruleRows,
    });

    await section.dispose();
  }

  return results;
}

export class PdfAssembler {
  async generate(payload: ExportPayload): Promise<Buffer> {
    const browser = await browserPool.acquire();
    let page: Page | null = null;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1480, height: 2200, deviceScaleFactor: 2 });

      await page.evaluateOnNewDocument((input) => {
        localStorage.setItem("glx-language", input.language.toLowerCase());
        localStorage.setItem("glx-dashboard-currency", input.currency);
        (window as unknown as { __GLX_PDF_RENDER_PAYLOAD__?: unknown }).__GLX_PDF_RENDER_PAYLOAD__ = input;
      }, payload);

      await page.goto(`${resolveRenderBaseUrl()}/internal/pdf-render`, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      await page.waitForSelector('[data-pdf-render-ready="true"]', { timeout: 15000 });

      const sections = await captureSections(page);
      return this.buildPdf(payload, sections);
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
      browserPool.release(browser);
    }
  }

  private async buildPdf(payload: ExportPayload, sections: SectionCapture[]) {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const copy = COPY_BY_LANGUAGE[payload.language];
    const blueprint = PLAN_BLUEPRINTS[payload.plan];
    const generatedAt = formatGeneratedAt(payload);

    this.addSummaryPage(pdf, payload, sections, copy, blueprint, generatedAt, regular, bold);

    for (const section of sections) {
      await this.addSectionPage(pdf, payload.plan, section, copy, regular, bold);
    }

    this.addSourcesPage(pdf, payload.plan, sections, copy, generatedAt, regular, bold);
    this.addFooters(pdf, copy, generatedAt, regular);

    return Buffer.from(await pdf.save());
  }

  private addSummaryPage(
    pdf: PDFDocument,
    payload: ExportPayload,
    sections: SectionCapture[],
    copy: ExportCopy,
    blueprint: PlanBlueprint,
    generatedAt: string,
    regular: PDFFont,
    bold: PDFFont,
  ) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawPageChrome(page, copy.reportTitle, `${copy.generatedAt} ${generatedAt}`, regular, bold);

    let cursorY = PAGE_HEIGHT - MARGIN_TOP - 34;
    page.drawText(copy.reportTitle, {
      x: MARGIN_X,
      y: cursorY,
      font: bold,
      size: 24,
      color: BRAND_DARK,
    });
    cursorY -= 22;

    drawWrappedText(page, `${blueprint.title} | ${buildSubtitle(payload, copy)}`, {
      x: MARGIN_X,
      y: cursorY,
      maxWidth: CONTENT_WIDTH,
      font: regular,
      size: 10,
      lineHeight: 13,
      color: GRAY,
    });
    cursorY -= 30;

    page.drawText(normalizePdfText(copy.summaryIntro).toUpperCase(), {
      x: MARGIN_X,
      y: cursorY,
      font: bold,
      size: 9,
      color: ACCENT_ORANGE,
    });
    cursorY -= 18;

    page.drawText(copy.executiveSummary, {
      x: MARGIN_X,
      y: cursorY,
      font: bold,
      size: 16,
      color: BRAND_DARK,
    });
    cursorY -= 20;

    drawWrappedText(page, blueprint.subtitle, {
      x: MARGIN_X,
      y: cursorY,
      maxWidth: CONTENT_WIDTH,
      font: regular,
      size: 10,
      lineHeight: 13,
      color: GRAY,
    });
    cursorY -= 28;

    const rows = buildSummaryRows(sections);
    const headers = [copy.kpi, copy.value, copy.trend, copy.status];
    const columnWidths = [220, 105, 110, 96];
    const rowHeight = 26;

    this.drawTableHeader(page, headers, columnWidths, cursorY, bold);
    cursorY -= rowHeight;

    rows.forEach((row, index) => {
      const rowTop = cursorY;
      if (index % 2 === 1) {
        page.drawRectangle({
          x: MARGIN_X,
          y: rowTop - rowHeight + 4,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: LIGHT_ROW,
        });
      }

      let columnX = MARGIN_X + 10;
      const values = [row.kpi, row.value, row.trend];
      values.forEach((value, valueIndex) => {
        page.drawText(normalizePdfText(value), {
          x: columnX,
          y: rowTop - 16,
          font: valueIndex === 1 ? bold : regular,
          size: 9,
          color: BRAND_DARK,
        });
        columnX += columnWidths[valueIndex];
      });

      const badgeX = MARGIN_X + columnWidths[0] + columnWidths[1] + columnWidths[2] + 18;
      page.drawCircle({
        x: badgeX,
        y: rowTop - 12,
        size: 4,
        color: getSeverityColor(row.severity),
      });
      page.drawText(row.statusLabel, {
        x: badgeX + 10,
        y: rowTop - 16,
        font: regular,
        size: 9,
        color: BRAND_DARK,
      });

      page.drawLine({
        start: { x: MARGIN_X, y: rowTop - rowHeight + 4 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: rowTop - rowHeight + 4 },
        thickness: 0.6,
        color: GRID,
      });

      cursorY -= rowHeight;
    });
  }

  private async addSectionPage(
    pdf: PDFDocument,
    plan: ExportPlan,
    section: SectionCapture,
    copy: ExportCopy,
    regular: PDFFont,
    bold: PDFFont,
  ) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawPageChrome(page, section.title, copy.executiveSummary, regular, bold);

    let cursorY = PAGE_HEIGHT - MARGIN_TOP - 28;
    page.drawText(section.title, {
      x: MARGIN_X,
      y: cursorY,
      font: bold,
      size: 18,
      color: BRAND_DARK,
    });
    cursorY -= 26;

    const cards = section.kpis.slice(0, 4);
    if (cards.length > 0) {
      const cardWidth = (CONTENT_WIDTH - 14) / 2;
      const cardHeight = 54;
      cards.forEach((card, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = MARGIN_X + col * (cardWidth + 14);
        const y = cursorY - row * (cardHeight + 10);
        page.drawRectangle({
          x,
          y: y - cardHeight,
          width: cardWidth,
          height: cardHeight,
          color: LIGHT_ROW,
          borderColor: GRID,
          borderWidth: 1,
        });
        drawWrappedText(page, card.label, {
          x: x + 12,
          y: y - 16,
          maxWidth: cardWidth - 24,
          font: regular,
          size: 8,
          lineHeight: 10,
          color: GRAY,
        });
        page.drawText(card.value, {
          x: x + 12,
          y: y - 37,
          font: bold,
          size: 16,
          color: BRAND_DARK,
        });
      });
      cursorY -= Math.ceil(cards.length / 2) * 64 + 8;
    }

    const primaryCharts = pickPrimaryCharts(section);
    if (primaryCharts.length > 0) {
      const chart = primaryCharts[0];
      const image = await pdf.embedPng(chart.image);
      const scaled = image.scaleToFit(CONTENT_WIDTH, 290);

      page.drawText(chart.title, {
        x: MARGIN_X,
        y: cursorY - 4,
        font: bold,
        size: 11,
        color: GRAY,
      });

      const chartTop = cursorY - 18;
      page.drawRectangle({
        x: MARGIN_X - 4,
        y: chartTop - scaled.height - 6,
        width: CONTENT_WIDTH + 8,
        height: scaled.height + 12,
        color: WHITE,
        borderColor: GRID,
        borderWidth: 1,
      });
      page.drawImage(image, {
        x: MARGIN_X + (CONTENT_WIDTH - scaled.width) / 2,
        y: chartTop - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      cursorY = chartTop - scaled.height - 18;
    } else {
      page.drawText(copy.noData, {
        x: MARGIN_X,
        y: cursorY - 10,
        font: regular,
        size: 10,
        color: GRAY,
      });
      cursorY -= 28;
    }

    const analysisText = buildAnalysis(section, resolveSource(plan, section.title), copy);
    const analysisHeight = 92;
    page.drawRectangle({
      x: MARGIN_X,
      y: Math.max(MARGIN_BOTTOM + 10, cursorY - analysisHeight),
      width: CONTENT_WIDTH,
      height: analysisHeight,
      color: BRAND_LIGHT,
    });
    page.drawRectangle({
      x: MARGIN_X,
      y: Math.max(MARGIN_BOTTOM + 10, cursorY - analysisHeight),
      width: 4,
      height: analysisHeight,
      color: BRAND_BLUE,
    });
    page.drawText(copy.analysisTitle, {
      x: MARGIN_X + 14,
      y: cursorY - 16,
      font: bold,
      size: 10,
      color: BRAND_BLUE,
    });
    drawWrappedText(page, analysisText, {
      x: MARGIN_X + 14,
      y: cursorY - 34,
      maxWidth: CONTENT_WIDTH - 24,
      font: regular,
      size: 9,
      lineHeight: 12,
      color: BRAND_DARK,
    });
  }

  private addSourcesPage(
    pdf: PDFDocument,
    plan: ExportPlan,
    sections: SectionCapture[],
    copy: ExportCopy,
    generatedAt: string,
    regular: PDFFont,
    bold: PDFFont,
  ) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawPageChrome(page, copy.sourceTableTitle, `${copy.generatedAt} ${generatedAt}`, regular, bold);

    let cursorY = PAGE_HEIGHT - MARGIN_TOP - 28;
    page.drawText(copy.sourceTableTitle, {
      x: MARGIN_X,
      y: cursorY,
      font: bold,
      size: 18,
      color: BRAND_DARK,
    });
    cursorY -= 24;

    const headers = [copy.sourceModule, copy.sourceKpis, copy.sourceSystem];
    const columnWidths = [130, 220, 169];
    const rowHeight = 40;
    this.drawTableHeader(page, headers, columnWidths, cursorY, bold);
    cursorY -= 26;

    sections.forEach((section, index) => {
      const rowTop = cursorY;
      if (index % 2 === 1) {
        page.drawRectangle({
          x: MARGIN_X,
          y: rowTop - rowHeight + 2,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: LIGHT_ROW,
        });
      }

      const values = [
        section.title,
        section.kpis.slice(0, 4).map((kpi) => kpi.label).join(", ") || "-",
        resolveSource(plan, section.title),
      ];

      let columnX = MARGIN_X + 10;
      values.forEach((value, valueIndex) => {
        drawWrappedText(page, value, {
          x: columnX,
          y: rowTop - 14,
          maxWidth: columnWidths[valueIndex] - 14,
          font: regular,
          size: 8.5,
          lineHeight: 10,
          color: BRAND_DARK,
        });
        columnX += columnWidths[valueIndex];
      });

      page.drawLine({
        start: { x: MARGIN_X, y: rowTop - rowHeight + 2 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: rowTop - rowHeight + 2 },
        thickness: 0.6,
        color: GRID,
      });

      cursorY -= rowHeight;
    });
  }

  private drawPageChrome(page: PDFPage, title: string, subtitle: string, regular: PDFFont, bold: PDFFont) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 16, width: PAGE_WIDTH, height: 16, color: ACCENT_ORANGE });
    page.drawText("GLX", {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 34,
      font: bold,
      size: 16,
      color: ACCENT_ORANGE,
    });
    page.drawText(normalizePdfText(title), {
      x: MARGIN_X + 42,
      y: PAGE_HEIGHT - 32,
      font: bold,
      size: 11,
      color: BRAND_DARK,
    });
    page.drawText(normalizePdfText(subtitle), {
      x: MARGIN_X + 42,
      y: PAGE_HEIGHT - 46,
      font: regular,
      size: 8,
      color: GRAY,
    });
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_HEIGHT - 54 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: PAGE_HEIGHT - 54 },
      thickness: 0.8,
      color: GRID,
    });
  }

  private drawTableHeader(page: PDFPage, headers: string[], widths: number[], y: number, bold: PDFFont) {
    let cursorX = MARGIN_X;
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 22,
      width: CONTENT_WIDTH,
      height: 24,
      color: BRAND_DARK,
    });

    headers.forEach((header, index) => {
      page.drawText(normalizePdfText(header), {
        x: cursorX + 10,
        y: y - 14,
        font: bold,
        size: 9,
        color: WHITE,
      });
      cursorX += widths[index];
    });
  }

  private addFooters(pdf: PDFDocument, copy: ExportCopy, generatedAt: string, regular: PDFFont) {
    const pages = pdf.getPages();

    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN_X, y: MARGIN_BOTTOM - 6 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: MARGIN_BOTTOM - 6 },
        thickness: 0.6,
        color: GRID,
      });
      page.drawText(copy.confidential, {
        x: MARGIN_X,
        y: MARGIN_BOTTOM - 20,
        font: regular,
        size: 7.5,
        color: GRAY,
      });
      page.drawText(`${copy.generatedAt} ${generatedAt} | ${copy.version}`, {
        x: MARGIN_X,
        y: MARGIN_BOTTOM - 31,
        font: regular,
        size: 7,
        color: GRAY,
      });
      page.drawText(`${copy.page} ${index + 1} ${copy.of} ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN_X - 62,
        y: MARGIN_BOTTOM - 20,
        font: regular,
        size: 7.5,
        color: GRAY,
      });
    });
  }
}

export const pdfAssembler = new PdfAssembler();
