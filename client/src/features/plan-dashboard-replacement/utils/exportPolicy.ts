import { getPlanBusinessRulebook, normalizePlanTier, type PlanTier } from "@shared/controlTowerRules";

type DashboardPlan = "ESSENTIAL" | "PRO" | "ENTERPRISE";

export interface ExportActionPolicy {
  visible: boolean;
  enabled: boolean;
  label: string;
  title: string;
}

export interface DashboardExportPolicy {
  csv: ExportActionPolicy;
  pdf: ExportActionPolicy;
  investorPdf: ExportActionPolicy;
}

const FINANCIAL_EXPORT_ROLES = new Set([
  "ADMIN",
  "CEO",
  "MANAGER",
  "NETWORK_OWNER",
  "NETWORK_EXEC",
  "FINANCE_LEAD",
]);

function toPlanTier(plan: DashboardPlan): PlanTier {
  return normalizePlanTier(
    plan === "ENTERPRISE" ? "enterprise" : plan === "PRO" ? "pro" : "essencial",
  );
}

function isRestrictedFinancialTab(plan: DashboardPlan, activeTab: number) {
  return (plan === "PRO" && activeTab === 2) || (plan === "ENTERPRISE" && activeTab === 2);
}

export function getDashboardExportPolicy(plan: DashboardPlan, role: string, activeTab: number): DashboardExportPolicy {
  const planTier = toPlanTier(plan);
  const rulebook = getPlanBusinessRulebook(planTier);
  const canExportFinancial = !isRestrictedFinancialTab(plan, activeTab) || FINANCIAL_EXPORT_ROLES.has(role);
  const executiveLabel = rulebook.exports.executivePdf.automatic ? "PDF Executivo" : "Exportar PDF";
  const executivePdfTitle = "Exportar em PDF o Relatório Executivo dos dados e gráficos da aba atual.";

  const basePolicy: DashboardExportPolicy = {
    csv: {
      visible: true,
      enabled: canExportFinancial,
      label: "Exportar CSV",
      title:
        canExportFinancial
          ? "Exportar planilha simples com os campos e dados da aba atual."
          : "Seu perfil nao possui permissao para exportacao financeira nesta aba.",
    },
    pdf: {
      visible: true,
      enabled: plan === "ESSENTIAL" ? true : canExportFinancial,
      label: executiveLabel,
      title:
        plan === "ESSENTIAL" || canExportFinancial
          ? executivePdfTitle
          : "Seu perfil nao possui permissao para exportacao financeira nesta aba.",
    },
    investorPdf: {
      visible: false,
      enabled: false,
      label: "PDF Investidor",
      title: "Disponivel apenas no plano Enterprise com investor view.",
    },
  };

  if (plan !== "ENTERPRISE" || !rulebook.exports.investorPdfOneClick) {
    return basePolicy;
  }

  const investorTabActive = activeTab === 2;

  return {
    ...basePolicy,
    investorPdf: {
      visible: investorTabActive,
      enabled: investorTabActive && canExportFinancial,
      label: "PDF Investidor",
      title: investorTabActive
        ? canExportFinancial
          ? "Exportar investor view LGPD-safe da aba atual."
          : "Seu perfil nao possui permissao para exportacao do investor PDF."
        : "Disponivel na visao investidor/valuation do plano Enterprise.",
    },
  };
}
