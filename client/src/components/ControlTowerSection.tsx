import { m } from "framer-motion";
import { ArrowRight, BarChart3, Building2, Radar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import SplitText from "@/animation/components/SplitText";
import BlurText from "@/animation/components/BlurText";
import { useMotionCapabilities } from "@/animation/hooks/useMotionCapabilities";

type PlanCard = {
  name: string;
  audience: string;
  features: string[];
  recommended?: boolean;
};

export default function ControlTowerSection() {
  const { language } = useLanguage();
  const caps = useMotionCapabilities();
  const reducedMotion = caps.prefersReducedMotion || caps.motionLevel === "off";

  const content = {
    pt: {
      badge: "GLX CONTROL TOWER",
      title1: "O painel executivo que todo CEO",
      title2: "de clinica privada deveria ter.",
      subtitle:
        "Sabe aquela reuniao em que voce pergunta como esta a clinica e a resposta e uma impressao de planilha? O Control Tower acabou com isso.",
      description:
        "Dashboard executivo com alertas automaticos, forecast de receita, mapa de margem por procedimento e visao em tempo real de agenda, caixa, captacao e operacao.",
      plans: [
        {
          name: "Start",
          audience: "Para clinicas em estruturacao",
          features: [
            "Dashboard executivo",
            "Alertas automaticos",
            "Benchmark setorial",
          ],
        },
        {
          name: "Pro",
          audience: "Para clinicas em escala",
          features: [
            "Granularidade por profissional e servico",
            "Simuladores de cenarios",
            "Forecast com IA",
          ],
          recommended: true,
        },
        {
          name: "Enterprise",
          audience: "Para redes e grupos",
          features: [
            "Multi-unidade",
            "Valuation automatico",
            "Dashboard para investidores",
          ],
        },
      ] satisfies PlanCard[],
      footnote: "Setup em 15 dias. Suporte por 12 meses. Dados, nao desculpas.",
      cta: "VER PLANOS DO CONTROL TOWER",
      secondary: "Falar com especialista",
      layersTitle: "Camadas que o sistema integra",
      layers: [
        "Demand Control",
        "Operational Core",
        "KPI Cadence",
        "AI Optimization",
      ],
    },
    en: {
      badge: "GLX CONTROL TOWER",
      title1: "Executive visibility",
      title2: "for healthcare operators.",
      subtitle: "The operating dashboard built for predictable decisions.",
      description:
        "Executive dashboard with alerts, revenue forecast and real-time operational control.",
      plans: [
        {
          name: "Essential",
          audience: "For structured clinics",
          features: ["Executive dashboard", "Automated alerts", "Benchmarks"],
        },
        {
          name: "Pro",
          audience: "For scaling clinics",
          features: ["Granular views", "Simulators", "AI forecast"],
          recommended: true,
        },
        {
          name: "Enterprise",
          audience: "For groups and networks",
          features: ["Multi-unit", "Auto valuation", "Investor dashboard"],
        },
      ] satisfies PlanCard[],
      footnote: "Setup in 15 days. 12-month support.",
      cta: "SEE CONTROL TOWER PLANS",
      secondary: "Talk to specialist",
      layersTitle: "Integrated layers",
      layers: ["Demand Control", "Operational Core", "KPI Cadence", "AI Optimization"],
    },
    es: {
      badge: "GLX CONTROL TOWER",
      title1: "Panel ejecutivo",
      title2: "para clinicas privadas.",
      subtitle: "Visibilidad real para decidir con datos.",
      description:
        "Dashboard ejecutivo con alertas, forecast e indicadores operativos en tiempo real.",
      plans: [
        {
          name: "Esencial",
          audience: "Para clinicas en estructuracion",
          features: ["Dashboard ejecutivo", "Alertas automaticas", "Benchmark"],
        },
        {
          name: "Pro",
          audience: "Para clinicas en escala",
          features: ["Granularidad", "Simuladores", "Forecast con IA"],
          recommended: true,
        },
        {
          name: "Enterprise",
          audience: "Para redes y grupos",
          features: ["Multi-unidad", "Valuation automatico", "Panel inversores"],
        },
      ] satisfies PlanCard[],
      footnote: "Setup en 15 dias. Soporte por 12 meses.",
      cta: "VER PLANES CONTROL TOWER",
      secondary: "Hablar con especialista",
      layersTitle: "Capas integradas",
      layers: ["Demand Control", "Operational Core", "KPI Cadence", "AI Optimization"],
    },
  } as const;

  const t = content[language];

  return (
    <section id="control-tower" className="relative overflow-hidden border-t border-white/5 bg-[#07080a] py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(249,115,22,0.09),transparent_42%),radial-gradient(circle_at_84%_24%,rgba(34,211,238,0.07),transparent_44%)]" />
        <div className="absolute left-[8%] top-[22%] h-64 w-64 rounded-full bg-orange-500/8 blur-[120px]" />
        <div className="absolute right-[6%] bottom-[14%] h-64 w-64 rounded-full bg-cyan-400/8 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay" />
      </div>

      <div className="container relative z-10">
        <div className="mb-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <m.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2"
            >
              <Sparkles className="h-3.5 w-3.5 text-orange-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300">{t.badge}</span>
            </m.div>

            <m.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.46, ease: "easeOut" }}
              className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl"
            >
              <SplitText
                text={t.title1}
                tag="span"
                splitType="chars"
                className="block"
                delay={10}
                duration={0.34}
                threshold={0.16}
                rootMargin="-80px"
                from={{ opacity: 0, transform: "translateY(10px)" }}
                to={{ opacity: 1, transform: "translateY(0px)" }}
              />
              <span className="block text-white/75">{t.title2}</span>
            </m.h2>

            <BlurText
              as="p"
              text={t.subtitle}
              className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-300"
              animateBy="words"
              direction="bottom"
              delay={12}
              threshold={0.16}
              rootMargin="-50px"
              stepDuration={0.16}
            />
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70">{t.description}</p>
          </div>

          <m.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.08, duration: 0.42, ease: "easeOut" }}
            className="rounded-2xl border border-white/10 bg-[#0f1115]/80 p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">{t.layersTitle}</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-orange-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Live
              </span>
            </div>

            <div className="space-y-3">
              {t.layers.map((layer, index) => (
                <m.div
                  key={layer}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: 0.06 * index, duration: 0.3 }}
                  className="relative overflow-hidden rounded-xl border border-white/8 bg-black/35 px-4 py-3"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-cyan-300" />
                  <div className="ml-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{layer}</span>
                    <div className="flex items-center gap-2 text-xs text-white/55">
                      {index === 0 && <Radar className="h-3.5 w-3.5 text-orange-300" />}
                      {index === 1 && <Building2 className="h-3.5 w-3.5 text-cyan-300" />}
                      {index === 2 && <BarChart3 className="h-3.5 w-3.5 text-orange-300" />}
                      {index === 3 && <Sparkles className="h-3.5 w-3.5 text-cyan-300" />}
                      <span>Layer {index + 1}</span>
                    </div>
                  </div>
                  <m.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/10 to-transparent"
                    animate={reducedMotion ? undefined : { x: ["-120%", "420%"] }}
                    transition={reducedMotion ? undefined : { duration: 2.6 + index * 0.2, repeat: Infinity, repeatDelay: 2.4, ease: "linear" }}
                  />
                </m.div>
              ))}
            </div>
          </m.div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {t.plans.map((plan, index) => (
            <m.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ delay: index * 0.07, duration: 0.36, ease: "easeOut" }}
              whileHover={reducedMotion ? undefined : { y: -4 }}
              className={[
                "relative overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-colors duration-200",
                plan.recommended
                  ? "border-orange-400/30 bg-orange-500/[0.06] shadow-[0_0_0_1px_rgba(249,115,22,0.12)_inset,0_18px_40px_rgba(249,115,22,0.08)]"
                  : "border-white/10 bg-[#0f1115]/70",
              ].join(" ")}
            >
              {plan.recommended ? (
                <div className="absolute right-5 top-5 rounded-full border border-orange-300/25 bg-orange-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                  Recomendado
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.12),transparent_45%)]" />

              <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">{plan.name}</p>
              <p className="relative z-10 mt-3 text-base font-medium leading-snug text-white/85">{plan.audience}</p>

              <ul className="relative z-10 mt-5 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/80">
                    <span className="mt-[0.42rem] h-1.5 w-1.5 flex-none rounded-full bg-gradient-to-r from-orange-400 to-cyan-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </m.div>
          ))}
        </div>

        <m.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ delay: 0.1, duration: 0.36, ease: "easeOut" }}
          className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl border border-white/10 bg-black/30 p-5 md:flex-row md:items-center"
        >
          <p className="text-sm leading-relaxed text-white/75">{t.footnote}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="border-white/15 bg-white/[0.02] text-white hover:border-orange-400/30 hover:bg-white/[0.04]"
              onClick={() => window.open("/planos", "_self")}
            >
              {t.cta}
            </Button>
            <Button
              className="group bg-orange-500 text-white hover:bg-orange-500/90"
              onClick={() => window.open("https://wa.me/5511970837585", "_blank")}
            >
              {t.secondary}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </m.div>
      </div>
    </section>
  );
}
