import { useMemo } from "react";
import { Link } from "wouter";
import { m } from "framer-motion";
import { ArrowLeft, BarChart3, Building2, Check, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getDefaultDashboardPathByRole, resolveClientDashboardRole } from "@/lib/clientDashboardRole";

type ConsultoriaPlan = {
  badge: string;
  title: string;
  summary: string;
  bullets: string[];
  indication: string;
  timeline: string;
  featured?: boolean;
};

type ControlTowerPlan = {
  title: string;
  summary: string;
  bullets: string[];
  timeline: string;
  featured?: boolean;
  icon: typeof BarChart3;
  tone: "essencial" | "pro" | "enterprise";
};

const CONSULTORIA_PLANS: ConsultoriaPlan[] = [
  {
    badge: "ENTRADA",
    title: "Start Lite",
    summary:
      "Para clinicas que precisam arrumar o basico antes de acelerar. Operacao ainda no improviso.",
    bullets: [
      "Controle de agenda e no-show",
      "Processos essenciais padronizados",
      "Dashboard minimo com KPIs criticos",
      "Gestao semanal leve (war room)",
      "Quick wins com retorno em semanas",
    ],
    indication:
      "Indicado quando a principal dor e desorganizacao operacional - buracos na agenda, no-show alto e follow-up inexistente.",
    timeline: "Setup 30-45 dias · Gestao 12 meses",
  },
  {
    badge: "MAIS CONTRATADO",
    title: "Start",
    summary:
      "Para clinicas que querem estrutura completa de base - previsibilidade e eficiencia antes de escalar.",
    bullets: [
      "Sistema operacional completo",
      "Dashboard executivo + rotina semanal",
      "Funil interno sem vazamento",
      "SOPs essenciais (agenda, vendas, follow-up)",
      "Capacidade e ocupacao otimizadas",
      "Governanca executiva mensal",
    ],
    indication:
      "Indicado quando a dor e imprevisibilidade - a clinica tem demanda, mas nao tem sistema para capturar o resultado.",
    timeline: "Setup 60 dias · Gestao 12 meses",
    featured: true,
  },
  {
    badge: "AVANCADO",
    title: "Pro",
    summary: "Para clinicas que faturam bem mas o lucro some. Agenda cheia, EBITDA baixo.",
    bullets: [
      "Tudo do Start +",
      "Mapa de margem por servico e medico",
      "Politica comercial e de desconto",
      "Precificacao e mix de servicos",
      "Estrategia de recorrencia de pacientes",
      "Automacoes avancadas e treinamento",
      "Governanca intensa (war room + board)",
    ],
    indication:
      "Indicado quando a dor e margem invisivel - existe volume, mas o lucro nao aparece no extrato.",
    timeline: "Setup 60-90 dias · Gestao 12 meses",
  },
];

const CONTROL_TOWER_PLANS: ControlTowerPlan[] = [
  {
    title: "Start",
    summary:
      "Para clinicas em estruturacao que precisam de visibilidade clara para tomar as primeiras decisoes por dados.",
    bullets: [
      "Dashboard executivo com 4 modulos",
      "Alertas automaticos P1/P2/P3",
      "Agenda, financeiro, marketing e operacao",
      "Benchmark setorial por especialidade",
      "Exportacao PDF executivo mensal",
      "Onboarding em 15 dias",
    ],
    timeline: "Setup 15 dias · Suporte 12 meses",
    icon: BarChart3,
    tone: "essencial",
  },
  {
    title: "Pro",
    summary: "Para clinicas que querem granularidade por profissional, servico e canal.",
    bullets: [
      "Tudo do Start +",
      "Drill-down por medico e procedimento",
      "Simuladores: break-even, overbooking, mix",
      "Forecast de receita com IA (P10/P50/P90)",
      "Waterfall de variacao de receita",
      "Deteccao de anomalias por ML",
      "Integracao bidirecional com CRM",
    ],
    timeline: "Setup 15 dias · Suporte 12 meses",
    featured: true,
    icon: Shield,
    tone: "pro",
  },
  {
    title: "Enterprise",
    summary:
      "Para grupos, redes e empresas se preparando para captacao, fusao ou M&A.",
    bullets: [
      "Pro em cada unidade +",
      "Consolidacao multi-unidade",
      "Valuation automatico mensal",
      "Simulador de aquisicao (M&A Engine)",
      "RBAC com 8 perfis de acesso",
      "API para Power BI / Tableau",
      "Dashboard para Investidores incluso",
    ],
    timeline: "Setup 15 dias · Suporte 12 meses",
    icon: Building2,
    tone: "enterprise",
  },
];

function openCalendly() {
  window.open("https://wa.me/5511970837585", "_blank", "noopener,noreferrer");
}

function toneClasses(tone: ControlTowerPlan["tone"], featured?: boolean) {
  if (tone === "pro") {
    return {
      card: "border-orange-500/45 bg-[linear-gradient(180deg,rgba(255,115,0,0.14),rgba(10,10,10,0.92)_28%,rgba(10,10,10,0.98)_100%)] shadow-[0_0_0_1px_rgba(255,115,0,0.08),0_18px_50px_rgba(0,0,0,0.45)]",
      icon: "bg-orange-500/10 text-orange-300 border-orange-500/30",
      accent: "text-orange-300",
      button: "bg-[#ff6a00] hover:bg-[#ff7d26] text-white",
      ring: featured ? "ring-1 ring-orange-500/30" : "",
    };
  }

  if (tone === "enterprise") {
    return {
      card: "border-white/10 bg-[linear-gradient(180deg,rgba(255,115,0,0.04),rgba(10,10,10,0.94)_24%,rgba(10,10,10,0.98)_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.35)]",
      icon: "bg-white/[0.03] text-white/75 border-white/10",
      accent: "text-white/55",
      button: "bg-white/[0.06] hover:bg-white/[0.1] text-white",
      ring: "",
    };
  }

  return {
    card: "border-white/10 bg-[linear-gradient(180deg,rgba(255,115,0,0.03),rgba(10,10,10,0.94)_22%,rgba(10,10,10,0.98)_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.32)]",
    icon: "bg-white/[0.03] text-white/75 border-white/10",
    accent: "text-white/60",
    button: "bg-white/[0.06] hover:bg-white/[0.1] text-white",
    ring: "",
  };
}

export default function Plans() {
  const { user } = useAuth();
  const dashboardHref = user ? getDefaultDashboardPathByRole(resolveClientDashboardRole(user as any)) : "/";
  const backButtonLabel = user ? "Voltar ao Dashboard do Cliente" : "Voltar ao Site";

  const phaseSteps = useMemo(
    () => ["1 SPRINT DIAGNOSTICA", "2 SETUP", "3 GESTAO CONTINUA"],
    [],
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,115,0,0.1),transparent_22%),linear-gradient(180deg,#050505_0%,#050505_58%,#070707_100%)]" />
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#050505]/84 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:h-20">
          <a href="/#home" className="flex items-center gap-2">
            <img src="/images/logo-transparent.png" alt="GLX Partners" className="h-12 w-auto md:h-20" />
          </a>

          <Link href={dashboardHref}>
            <m.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}>
              <Button
                variant="ghost"
                className="group relative rounded-full border border-orange-500/25 bg-[#120c08] px-4 text-white hover:bg-[#1b120b] hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  {backButtonLabel}
                </span>
              </Button>
            </m.div>
          </Link>
        </div>
      </header>

      <main className="relative px-4 pb-20 pt-28 md:pt-36">
        <section className="container">
          <m.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-10"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,115,0,0.14),transparent_34%,transparent_62%,rgba(255,115,0,0.08)),radial-gradient(circle_at_8%_18%,rgba(255,115,0,0.14),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(255,115,0,0.05),transparent_30%)]" />
            <div className="relative z-10 max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/90">
                GLX Partners - Portfolio & Planos
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                O sistema certo para onde sua
                <br />
                clinica esta agora.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/70 md:text-lg">
                Cada clinica chega com um estagio diferente de maturidade. A GLX nao forca um modelo unico - escolhemos
                juntos o caminho com maior ROI para o seu momento.
              </p>
              <p className="mt-5 text-lg font-medium tracking-tight text-white/85 md:text-xl">
                Growth. Lean. Execution.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                Versao 2026 | Uso interno e comercial
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {phaseSteps.map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </m.div>
        </section>

        <section className="container mt-14 border-t border-white/8 pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/90">
              GLX Partners - Consultoria
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
              Tres profundidades. Um unico objetivo: lucro previsivel.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 md:text-lg">
              A Sprint Diagnostica define qual plano faz mais sentido. Voce nunca compra no escuro - compra com business
              case na mao.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {CONSULTORIA_PLANS.map((plan, index) => (
              <m.div
                key={plan.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
                className={cn(
                  "relative flex h-full flex-col rounded-[1.6rem] border p-5 md:p-6",
                  plan.featured
                    ? "border-orange-500/40 bg-[linear-gradient(180deg,rgba(255,115,0,0.13),rgba(8,8,8,0.94)_26%,rgba(8,8,8,0.99)_100%)] shadow-[0_0_0_1px_rgba(255,115,0,0.08),0_22px_52px_rgba(0,0,0,0.46)]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(255,115,0,0.03),rgba(8,8,8,0.94)_24%,rgba(8,8,8,0.99)_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.3)]",
                )}
              >
                {plan.featured ? (
                  <div className="absolute -top-3 left-6 rounded-full border border-orange-400/30 bg-[#1c1209] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200 shadow-[0_10px_30px_rgba(255,115,0,0.15)]">
                    ★ MAIS CONTRATADO
                  </div>
                ) : null}

                <div className="mb-3">
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", plan.featured ? "text-orange-200" : "text-white/55")}>
                    {plan.badge}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">{plan.title}</h3>
                </div>

                <ul className="space-y-2.5">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.featured ? "text-orange-300" : "text-white/50")} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                  {plan.timeline}
                </div>
              </m.div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,115,0,0.04),rgba(9,9,9,0.96)_34%,rgba(9,9,9,0.99)_100%)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <p className="text-sm leading-relaxed text-white/70">
              * A Sprint Diagnostica e a porta de entrada de todos os planos. Em 10-15 dias entregamos o baseline,
              o mapa de vazamentos e o business case com ROI projetado. O valor da Sprint e 100% creditado no Setup
              se voce decidir seguir em ate 10 dias apos a devolutiva.
            </p>
          </div>
        </section>

        <section id="control-tower-product" className="container mt-16 scroll-mt-28 border-t border-white/8 pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/90">
              GLX Control Tower - Produto
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
              O painel que todo CEO de clinica privada deveria ter na segunda-feira de manha.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 md:text-lg">
              Nao e um relatorio. E um sistema de decisao com dados atualizados - com alertas automaticos, forecast de
              receita e mapa de margem. Disponivel separado da consultoria ou integrado ao seu plano.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {CONTROL_TOWER_PLANS.map((plan, index) => {
              const tone = toneClasses(plan.tone, plan.featured);
              return (
                <m.div
                  key={plan.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
                  className={cn(
                    "relative flex h-full flex-col rounded-[1.6rem] border p-5 md:p-6",
                    tone.card,
                    tone.ring,
                  )}
                >
                  {plan.featured ? (
                    <div className="absolute -top-3 left-6 rounded-full border border-orange-400/30 bg-[#1c1209] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200 shadow-[0_10px_30px_rgba(255,115,0,0.15)]">
                      RECOMENDADO
                    </div>
                  ) : null}

                  <h3 className="text-2xl font-bold tracking-tight">{plan.title}</h3>
                  <p className={cn("mt-2 text-sm font-semibold uppercase tracking-[0.14em]", tone.accent)}>
                    {plan.timeline}
                  </p>

                  <ul className="mt-4 space-y-2.5">
                    {plan.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm text-white/80">
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.featured ? "text-orange-300" : "text-white/50")} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <Button
                      onClick={openCalendly}
                      className={cn("w-full rounded-full font-semibold uppercase tracking-[0.14em]", tone.button)}
                    >
                      Falar com especialista
                    </Button>
                  </div>
                </m.div>
              );
            })}
          </div>
        </section>

        <section className="container mt-16">
          <m.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] md:p-10"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,115,0,0.14),transparent_42%),linear-gradient(90deg,rgba(255,115,0,0.05),transparent_38%,transparent_70%,rgba(255,115,0,0.03))]" />
            <div className="relative z-10 mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/25 bg-[#17100b] text-orange-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-lg leading-relaxed text-white/85">
                Nao sabe qual plano faz mais sentido para o momento da sua clinica?
              </p>
              <p className="mt-2 text-base leading-relaxed text-white/65 md:text-lg">
                A Sprint Diagnostica responde essa pergunta com dados - nao com suposicao.
              </p>

              <div className="mt-7">
                <Button
                  onClick={openCalendly}
                  className="h-auto rounded-full bg-[#ff6a00] px-8 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white hover:bg-[#ff7d26] md:px-10"
                >
                  Agendar Sprint Diagnostica
                </Button>
                <p className="mt-3 text-xs uppercase tracking-[0.15em] text-white/50 md:text-sm">
                  30 minutos. Com dados do seu mercado e do seu perfil de clinica.
                </p>
              </div>
            </div>
          </m.div>
        </section>
      </main>

      <footer className="border-t border-white/8 px-4 py-8">
        <div className="container text-center text-sm text-white/45">
          GLX Partners | glxpartners.io | Growth. Lean. Execution.
        </div>
      </footer>
    </div>
  );
}
