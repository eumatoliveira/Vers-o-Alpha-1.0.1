import { useEffect, useMemo, useState } from "react";
import type { Filters } from "@/features/plan-dashboard-replacement/data/mockData";
import EssentialDashboard from "@/features/plan-dashboard-replacement/components/EssentialDashboard";
import ProDashboard from "@/features/plan-dashboard-replacement/components/ProDashboard";
import EnterpriseDashboard from "@/features/plan-dashboard-replacement/components/EnterpriseDashboard";
import "@/features/plan-dashboard-replacement/scoped.css";

type Lang = "PT" | "EN" | "ES";
type Plan = "ESSENTIAL" | "PRO" | "ENTERPRISE";

type Payload = {
  clinicName: string;
  plan: "essential" | "pro" | "enterprise";
  language: Lang;
  currency: string;
  filters: Filters;
  appointments?: any[];
};

const planTabs: Record<Plan, string[]> = {
  ESSENTIAL: ["Visão CEO", "Agenda & No-Show", "Financeiro Executivo", "Marketing & Captação", "Operação & Experiência"],
  PRO: ["Visão CEO", "Financeiro Avançado", "Agenda/No-Show", "Marketing", "Integrações", "Operação & Experiência", "Equipe"],
  ENTERPRISE: ["Visão CEO", "Financeiro — Investidor", "Agenda/No-Show", "Marketing", "Multi-Unidade", "Integrações", "Operação & Experiência", "Equipe", "Governança"],
};

function toPlan(plan: Payload["plan"]): Plan {
  if (plan === "enterprise") return "ENTERPRISE";
  if (plan === "pro") return "PRO";
  return "ESSENTIAL";
}

export default function InternalPdfRender() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const data = (window as unknown as { __GLX_PDF_RENDER_PAYLOAD__?: Payload }).__GLX_PDF_RENDER_PAYLOAD__;
      if (!data) return;
      setPayload(data);
      window.clearInterval(timer);
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const plan = useMemo(() => (payload ? toPlan(payload.plan) : "ESSENTIAL"), [payload]);

  if (!payload) {
    return <div style={{ background: "#ffffff", minHeight: "100vh" }} />;
  }

  return (
    <div
      data-pdf-render-ready="true"
      className="glx-plan-dashboard-root"
      data-theme="light"
      style={{ background: "#ffffff", minHeight: "100vh", padding: 24 }}
    >
      {planTabs[plan].map((title, idx) => (
        <div key={`${title}-${idx}`} className="pdf-export-section" data-title={title} style={{ marginBottom: 28 }}>
          {plan === "ESSENTIAL" && (
            <EssentialDashboard
              lang={payload.language}
              activeTab={idx}
              theme="light"
              visualScale="normal"
              filters={payload.filters}
              onFiltersChange={() => undefined}
              appointments={payload.appointments}
            />
          )}
          {plan === "PRO" && (
            <ProDashboard
              lang={payload.language}
              activeTab={idx}
              theme="light"
              visualScale="normal"
              filters={payload.filters}
              onFiltersChange={() => undefined}
              appointments={payload.appointments}
            />
          )}
          {plan === "ENTERPRISE" && (
            <EnterpriseDashboard
              lang={payload.language}
              activeTab={idx}
              theme="light"
              visualScale="normal"
              filters={payload.filters}
              onFiltersChange={() => undefined}
              appointments={payload.appointments}
            />
          )}
        </div>
      ))}
    </div>
  );
}
