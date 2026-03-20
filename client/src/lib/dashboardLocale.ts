import type { Language } from "@/i18n/index";

type LegendCopy = {
  title: string;
  description: string;
  bullets: [string, string, string];
};

type ClientLayoutCopy = {
  brand: string;
  sidebarSettings: string;
  backToSite: string;
  periodLabel: string;
  periods: {
    last7: string;
    last30: string;
    last90: string;
    last12m: string;
    custom: string;
  };
  liveData: string;
  notificationsTitle: string;
  notificationHeadline: string;
  notificationBody: string;
  notificationNow: string;
  profile: string;
  settings: string;
  logout: string;
  userFallback: string;
  menu: {
    ceo: string;
    financials: string;
    operations: string;
    waste: string;
    growth: string;
    quality: string;
    people: string;
    data: string;
  };
  legends: Record<string, LegendCopy>;
};

type AdminLayoutCopy = {
  panelSubtitle: string;
  navigation: {
    dashboard: string;
    pipeline: string;
    operations: string;
    aiAssistant: string;
    integrations: string;
    finance: string;
    users: string;
    system: string;
    kommo: string;
    asaas: string;
    googleCalendar: string;
    googleForms: string;
    contractsSheet: string;
    dreSheet: string;
    clientConfig: string;
    errors: string;
    flags: string;
    settings: string;
  };
  environment: {
    production: string;
    staging: string;
  };
  glxDashboard: string;
  backToSite: string;
  settings: string;
  searchPlaceholder: string;
  notificationsTitle: string;
  noNotifications: string;
  agoSuffix: string;
  logout: string;
  userFallback: string;
  legends: Record<string, LegendCopy>;
};

const CLIENT_COPY: Record<Language, ClientLayoutCopy> = {
  pt: {
    brand: "PERFORMANCE",
    sidebarSettings: "Configuracoes",
    backToSite: "Voltar ao Site",
    periodLabel: "Periodo",
    periods: {
      last7: "Ultimos 7 dias",
      last30: "Ultimos 30 dias",
      last90: "Ultimos 90 dias",
      last12m: "Ultimos 12 meses",
      custom: "Periodo personalizado",
    },
    liveData: "Dados ao vivo",
    notificationsTitle: "Notificacoes GLX",
    notificationHeadline: "Novos alertas na operacao",
    notificationBody:
      "NPS e Churn atingiram zona de atencao no ultimo fechamento (P1 critico).",
    notificationNow: "Agora",
    profile: "Perfil",
    settings: "Configuracoes",
    logout: "Sair",
    userFallback: "Usuario",
    menu: {
      ceo: "CEO Scorecard",
      financials: "Financeiro",
      operations: "Operacao Clinica",
      waste: "Desperdicios Operacionais",
      growth: "Growth Engine",
      quality: "Qualidade e NPS",
      people: "Equipe",
      data: "Governanca de Dados",
    },
    legends: {
      "/performance": {
        title: "Legenda do Scorecard",
        description:
          "Painel executivo com metas, desvios e alertas para decisao rapida.",
        bullets: [
          "Card KPI: mostra valor atual, meta e variacao percentual.",
          "Alertas P1/P2/P3: priorizam risco de receita e operacao.",
          "Forecast: compara realizado, meta e previsao mensal.",
        ],
      },
      "/performance/financials": {
        title: "Legenda de Financeiro",
        description:
          "Analise de receita, margem e caixa com foco em previsibilidade.",
        bullets: [
          "Receita: total bruto por periodo selecionado.",
          "Margem: receita menos custos fixos e variaveis.",
          "Fluxo de caixa: entradas e saidas para decisao de curto prazo.",
        ],
      },
      "/performance/operations": {
        title: "Legenda de Operacoes",
        description:
          "Capacidade, fila e agenda para reduzir espera e no-show.",
        bullets: [
          "Capacidade diaria: limite de atendimentos por time.",
          "No-show: monitoramento por turno e profissional.",
          "Tempo de ciclo: mede gargalos da recepcao ao atendimento.",
        ],
      },
      "/performance/waste": {
        title: "Legenda de Desperdicio",
        description:
          "Mapa de perdas por processo para atacar custo invisivel.",
        bullets: [
          "Perda estimada: valor financeiro do retrabalho e ociosidade.",
          "No-show e glosa: principais fontes de erosao de margem.",
          "Prioridade: ataque primeiro itens com alto impacto e alta frequencia.",
        ],
      },
      "/performance/growth": {
        title: "Legenda de Growth",
        description:
          "Funil comercial e aquisicao com foco em conversao e CAC.",
        bullets: [
          "CAC: custo medio para gerar 1 paciente novo.",
          "LTV: valor projetado durante o relacionamento.",
          "ROAS/ROI: retorno por canal de aquisicao.",
        ],
      },
      "/performance/quality": {
        title: "Legenda de Qualidade",
        description:
          "Satisfacao do paciente e padrao de atendimento da operacao.",
        bullets: [
          "NPS: promotores menos detratores.",
          "Tempo de espera: impacto direto na experiencia.",
          "Reclamacoes recorrentes: base para plano de melhoria.",
        ],
      },
      "/performance/people": {
        title: "Legenda de Equipe",
        description:
          "Produtividade por profissional e distribuicao de carga.",
        bullets: [
          "Atendimentos: volume realizado por colaborador.",
          "Conversao: eficiencia comercial por pessoa.",
          "Kanban de equipe: status operacional com alocacao dinamica.",
        ],
      },
      "/performance/data": {
        title: "Legenda de Governanca",
        description:
          "Integridade, origem e atualizacao das fontes de dados.",
        bullets: [
          "Fonte de verdade: define sistema principal por indicador.",
          "Latencia: tempo entre evento e atualizacao no painel.",
          "Qualidade: cobertura, consistencia e rastreabilidade.",
        ],
      },
      default: {
        title: "Legenda do Painel",
        description:
          "Interpretacao rapida dos indicadores para orientar decisao.",
        bullets: [
          "KPIs mostram desempenho atual vs metas.",
          "Alertas destacam prioridade operacional e financeira.",
          "Use tendencias para agir antes do desvio escalar.",
        ],
      },
    },
  },
  en: {
    brand: "PERFORMANCE",
    sidebarSettings: "Settings",
    backToSite: "Back to Site",
    periodLabel: "Period",
    periods: {
      last7: "Last 7 days",
      last30: "Last 30 days",
      last90: "Last 90 days",
      last12m: "Last 12 months",
      custom: "Custom range",
    },
    liveData: "Live data",
    notificationsTitle: "GLX Notifications",
    notificationHeadline: "New operational alerts",
    notificationBody:
      "NPS and Churn reached attention zone in the latest close (critical P1).",
    notificationNow: "Now",
    profile: "Profile",
    settings: "Settings",
    logout: "Logout",
    userFallback: "User",
    menu: {
      ceo: "CEO Scorecard",
      financials: "Financials",
      operations: "Clinical Operations",
      waste: "Operational Waste",
      growth: "Growth Engine",
      quality: "Quality and NPS",
      people: "People",
      data: "Data Governance",
    },
    legends: {
      "/performance": {
        title: "Scorecard Legend",
        description:
          "Executive panel with goals, deviations and alerts for fast decisions.",
        bullets: [
          "KPI card: current value, target and percentage variance.",
          "P1/P2/P3 alerts: prioritize revenue and operations risks.",
          "Forecast: compares actual, target and monthly projection.",
        ],
      },
      "/performance/financials": {
        title: "Financial Legend",
        description:
          "Revenue, margin and cash analysis focused on predictability.",
        bullets: [
          "Revenue: gross total for selected period.",
          "Margin: revenue minus fixed and variable costs.",
          "Cash flow: inflow and outflow for short-term decisions.",
        ],
      },
      "/performance/operations": {
        title: "Operations Legend",
        description:
          "Capacity, queue and schedule to reduce waiting and no-show.",
        bullets: [
          "Daily capacity: service limit per team.",
          "No-show: tracking by shift and professional.",
          "Cycle time: bottlenecks from reception to consultation.",
        ],
      },
      "/performance/waste": {
        title: "Waste Legend",
        description:
          "Loss map by process to attack hidden cost.",
        bullets: [
          "Estimated loss: financial impact of rework and idle time.",
          "No-show and denials: main margin erosion sources.",
          "Priority: solve high-impact and high-frequency items first.",
        ],
      },
      "/performance/growth": {
        title: "Growth Legend",
        description:
          "Commercial funnel and acquisition focused on conversion and CAC.",
        bullets: [
          "CAC: average cost to bring one new patient.",
          "LTV: projected relationship value.",
          "ROAS/ROI: return by acquisition channel.",
        ],
      },
      "/performance/quality": {
        title: "Quality Legend",
        description:
          "Patient satisfaction and service quality pattern.",
        bullets: [
          "NPS: promoters minus detractors.",
          "Wait time: direct impact on experience.",
          "Recurring complaints: basis for improvement plan.",
        ],
      },
      "/performance/people": {
        title: "People Legend",
        description:
          "Productivity per professional and workload distribution.",
        bullets: [
          "Appointments: delivered volume per collaborator.",
          "Conversion: commercial efficiency by person.",
          "People Kanban: operational status with dynamic allocation.",
        ],
      },
      "/performance/data": {
        title: "Data Governance Legend",
        description:
          "Integrity, origin and freshness of data sources.",
        bullets: [
          "Source of truth: primary system per KPI.",
          "Latency: time from event to dashboard update.",
          "Quality: coverage, consistency and traceability.",
        ],
      },
      default: {
        title: "Panel Legend",
        description:
          "Quick KPI interpretation to guide decision-making.",
        bullets: [
          "KPIs show current performance versus targets.",
          "Alerts highlight operational and financial priority.",
          "Use trend to act before deviation escalates.",
        ],
      },
    },
  },
  es: {
    brand: "PERFORMANCE",
    sidebarSettings: "Configuraciones",
    backToSite: "Volver al Sitio",
    periodLabel: "Periodo",
    periods: {
      last7: "Ultimos 7 dias",
      last30: "Ultimos 30 dias",
      last90: "Ultimos 90 dias",
      last12m: "Ultimos 12 meses",
      custom: "Rango personalizado",
    },
    liveData: "Datos en vivo",
    notificationsTitle: "Notificaciones GLX",
    notificationHeadline: "Nuevas alertas de operacion",
    notificationBody:
      "NPS y Churn entraron en zona de atencion en el ultimo cierre (P1 critico).",
    notificationNow: "Ahora",
    profile: "Perfil",
    settings: "Configuraciones",
    logout: "Salir",
    userFallback: "Usuario",
    menu: {
      ceo: "CEO Scorecard",
      financials: "Finanzas",
      operations: "Operacion Clinica",
      waste: "Desperdicio Operacional",
      growth: "Growth Engine",
      quality: "Calidad y NPS",
      people: "Equipo",
      data: "Gobernanza de Datos",
    },
    legends: {
      "/performance": {
        title: "Leyenda del Scorecard",
        description:
          "Panel ejecutivo con metas, desvio y alertas para decidir rapido.",
        bullets: [
          "Tarjeta KPI: valor actual, meta y variacion porcentual.",
          "Alertas P1/P2/P3: priorizan riesgo de ingresos y operacion.",
          "Forecast: compara realizado, meta y proyeccion mensual.",
        ],
      },
      "/performance/financials": {
        title: "Leyenda de Finanzas",
        description:
          "Analisis de ingresos, margen y caja con foco en previsibilidad.",
        bullets: [
          "Ingresos: total bruto del periodo seleccionado.",
          "Margen: ingresos menos costos fijos y variables.",
          "Flujo de caja: entradas y salidas para decisiones de corto plazo.",
        ],
      },
      "/performance/operations": {
        title: "Leyenda de Operaciones",
        description:
          "Capacidad, cola y agenda para reducir espera y no-show.",
        bullets: [
          "Capacidad diaria: limite de atenciones por equipo.",
          "No-show: monitoreo por turno y profesional.",
          "Tiempo de ciclo: cuellos de botella de recepcion a consulta.",
        ],
      },
      "/performance/waste": {
        title: "Leyenda de Desperdicio",
        description:
          "Mapa de perdidas por proceso para atacar costo invisible.",
        bullets: [
          "Perdida estimada: impacto financiero de retrabajo y ociosidad.",
          "No-show y glosa: principales fuentes de erosion del margen.",
          "Prioridad: resolver primero alto impacto y alta frecuencia.",
        ],
      },
      "/performance/growth": {
        title: "Leyenda de Growth",
        description:
          "Embudo comercial y adquisicion con foco en conversion y CAC.",
        bullets: [
          "CAC: costo medio para traer 1 paciente nuevo.",
          "LTV: valor proyectado de la relacion.",
          "ROAS/ROI: retorno por canal de adquisicion.",
        ],
      },
      "/performance/quality": {
        title: "Leyenda de Calidad",
        description:
          "Satisfaccion del paciente y patron de calidad del servicio.",
        bullets: [
          "NPS: promotores menos detractores.",
          "Tiempo de espera: impacto directo en experiencia.",
          "Quejas recurrentes: base para plan de mejora.",
        ],
      },
      "/performance/people": {
        title: "Leyenda de Equipo",
        description:
          "Productividad por profesional y distribucion de carga.",
        bullets: [
          "Atenciones: volumen realizado por colaborador.",
          "Conversion: eficiencia comercial por persona.",
          "Kanban de equipo: estado operacional con asignacion dinamica.",
        ],
      },
      "/performance/data": {
        title: "Leyenda de Gobernanza",
        description:
          "Integridad, origen y actualizacion de las fuentes.",
        bullets: [
          "Fuente de verdad: sistema principal por KPI.",
          "Latencia: tiempo entre evento y actualizacion en panel.",
          "Calidad: cobertura, consistencia y trazabilidad.",
        ],
      },
      default: {
        title: "Leyenda del Panel",
        description:
          "Lectura rapida de indicadores para orientar decisiones.",
        bullets: [
          "KPIs muestran desempeno actual vs metas.",
          "Alertas destacan prioridad operacional y financiera.",
          "Use tendencia para actuar antes de escalar el desvio.",
        ],
      },
    },
  },
};

const ADMIN_COPY: Record<Language, AdminLayoutCopy> = {
  pt: {
    panelSubtitle: "Painel Admin",
    navigation: {
      dashboard: "Dashboard",
      pipeline: "Pipeline & Funil",
      operations: "Operacao Interna",
      aiAssistant: "Assistente IA",
      integrations: "Integracoes",
      finance: "Financeiro",
      users: "Usuarios",
      system: "Sistema",
      kommo: "Kommo",
      asaas: "Asaas",
      googleCalendar: "Google Calendar",
      googleForms: "Google Forms",
      contractsSheet: "Planilha de Contratos",
      dreSheet: "Planilha DRE",
      clientConfig: "Config. do Cliente",
      errors: "Erros e Logs",
      flags: "Feature Flags",
      settings: "Configurações",
    },
    environment: {
      production: "Producao",
      staging: "Homologacao",
    },
    glxDashboard: "Dashboard GLX",
    backToSite: "Voltar ao Site",
    settings: "Configuracoes",
    searchPlaceholder: "Buscar usuarios por email ou ID...",
    notificationsTitle: "Notificacoes",
    noNotifications: "Nenhuma notificacao",
    agoSuffix: "atras",
    logout: "Sair",
    userFallback: "Admin",
    legends: {
      "/admin": {
        title: "Legenda - Centro de Comando",
        description:
          "Visao executiva da operacao interna da plataforma GLX.",
        bullets: [
          "KPIs: receita recorrente, churn e base ativa.",
          "Alertas: eventos de risco e acao imediata.",
          "Acoes pendentes: fila operacional para o time admin.",
        ],
      },
      "/admin?view=pipeline": {
        title: "Pipeline & Funil",
        description:
          "Leitura do para-brisa comercial para garantir crescimento futuro.",
        bullets: [
          "Topo do funil: entrada de leads e qualidade do targeting.",
          "Fechamento: conversao entre calls, propostas e contratos.",
          "Visao consolidada: pipeline ponderado, ACV e setups em andamento.",
        ],
      },
      "/admin?view=operacao": {
        title: "Operação Interna",
        description:
          "Leitura do retrovisor operacional para proteger receita, margem e capacidade.",
        bullets: [
          "Receita e MRR: crescimento, churn e previsibilidade.",
          "Clientes e retencao: NPS, health score e entregas no prazo.",
          "Financeiro e capacidade: caixa, inadimplencia e utilizacao do time.",
        ],
      },
      "/admin/financeiro": {
        title: "Legenda - Financeiro Admin",
        description:
          "Saude financeira da operacao SaaS e previsao de custo.",
        bullets: [
          "MRR/ARR: base de receita recorrente.",
          "Custos cloud: consumo de infraestrutura.",
          "Inadimplencia: impacto direto em churn e caixa.",
        ],
      },
      "/admin/usuarios": {
        title: "Legenda - Usuarios",
        description:
          "Gestao de acesso, plano e permissao por conta.",
        bullets: [
          "Plano define modulo liberado por cliente.",
          "Permissoes controlam funcoes sensiveis.",
          "Status de conta orienta suporte e sucesso.",
        ],
      },
      "/admin/sistema": {
        title: "Legenda - Sistema",
        description:
          "Monitoramento tecnico de disponibilidade e performance.",
        bullets: [
          "Latencia por servico e camada.",
          "Uso de recurso com limite de alerta.",
          "Saude de jobs e filas assincronas.",
        ],
      },
      "/admin/kommo": {
        title: "",
        description:
          "Parametros de OAuth, tokens e webhook para sincronizacao em tempo real.",
        bullets: [
          "Client ID, secret e redirect devem bater com o app cadastrado na Kommo.",
          "Refresh token sustenta a sincronizacao sem login manual recorrente.",
          "Webhook autenticado evita ingestao de eventos falsos.",
        ],
      },
      "/admin/asaas": {
        title: "",
        description:
          "Parametros de token, webhook e fila para cobrancas em tempo real.",
        bullets: [
          "Access token autentica chamadas REST no Asaas.",
          "Webhook token valida eventos financeiros recebidos.",
          "Fila com retry evita perda de cobrancas e pagamentos.",
        ],
      },
      "/admin/google-calendar": {
        title: "",
        description:
          "Leitura gratuita de eventos do Google Calendar para contar calls e diagnosticos por tag.",
        bullets: [
          "Use tags como CALL-QUAL, CALL-FECH e DIAG-OS no titulo ou descricao.",
          "Apps Script pode rodar a leitura periodica sem custo adicional.",
          "Payload normalizado deve entrar no backend por webhook interno.",
        ],
      },
      "/admin/google-forms": {
        title: "",
        description:
          "Google Forms com respostas em Sheets e disparo automatico por gatilho.",
        bullets: [
          "Conecte o formulario a uma planilha de respostas oficial do Google.",
          "Use onFormSubmit para enviar NPS e engajamento em tempo real.",
          "A agregacao final deve seguir a regra de negocio ja definida no dashboard.",
        ],
      },
      "/admin/planilha-contratos": {
        title: "",
        description:
          "Leitura automatica da planilha de contratos para clientes ativos, MRR e churn.",
        bullets: [
          "A atualizacao da planilha continua manual, como no briefing.",
          "Apps Script ou Sheets API podem ler a aba e publicar o snapshot.",
          "O backend deve recalcular MRR, setups e status 12m sem alterar formulas.",
        ],
      },
      "/admin/planilha-dre": {
        title: "",
        description:
          "Snapshot mensal da planilha DRE para margem liquida, CAC e receita por hora.",
        bullets: [
          "O fechamento segue mensal, sem mudar a frequencia de negocio.",
          "Sheets API ou Apps Script podem publicar os valores ja consolidados.",
          "A regra de calculo final continua no backend do dashboard.",
        ],
      },
      "/admin/erros": {
        title: "Legenda - Erros e Logs",
        description:
          "Triagem de incidentes e rastreabilidade de falhas.",
        bullets: [
          "Severidade define SLA de resposta.",
          "Modulo e timestamp facilitam RCA.",
          "Status ativo/inativo controla notificacao.",
        ],
      },
      "/admin/flags": {
        title: "Legenda - Feature Flags",
        description:
          "Controle de rollout de funcionalidades por ambiente.",
        bullets: [
          "Flag por escopo: global, plano ou cliente.",
          "Rollout gradual reduz risco de regressao.",
          "Auditoria registra alteracao e responsavel.",
        ],
      },
      default: {
        title: "Legenda do Admin",
        description:
          "Contexto de leitura para decisao tecnica e operacional.",
        bullets: [
          "Monitore saude, risco e custo em conjunto.",
          "Priorize incidentes por impacto de negocio.",
          "Use historico para prevenir recorrencia.",
        ],
      },
    },
  },
  en: {
    panelSubtitle: "Admin Panel",
    navigation: {
      dashboard: "Dashboard",
      pipeline: "Pipeline & Funnel",
      operations: "Internal Operations",
      aiAssistant: "AI Assistant",
      integrations: "Integrations",
      finance: "Financial",
      users: "Users",
      system: "System",
      kommo: "Kommo",
      asaas: "Asaas",
      googleCalendar: "Google Calendar",
      googleForms: "Google Forms",
      contractsSheet: "Contracts Sheet",
      dreSheet: "DRE Sheet",
      clientConfig: "Client Config",
      errors: "Errors and Logs",
      flags: "Feature Flags",
      settings: "Settings",
    },
    environment: {
      production: "Production",
      staging: "Staging",
    },
    glxDashboard: "GLX Dashboard",
    backToSite: "Back to Site",
    settings: "Settings",
    searchPlaceholder: "Search users by email or ID...",
    notificationsTitle: "Notifications",
    noNotifications: "No notifications",
    agoSuffix: "ago",
    logout: "Logout",
    userFallback: "Admin",
    legends: {
      "/admin": {
        title: "Legend - Command Center",
        description:
          "Executive view of GLX platform internal operations.",
        bullets: [
          "KPIs: recurring revenue, churn and active base.",
          "Alerts: risk events and immediate action.",
          "Pending actions: operational queue for admin team.",
        ],
      },
      "/admin?view=pipeline": {
        title: "Legend - View 2 Pipeline & Funnel",
        description:
          "Commercial windshield view to secure future growth.",
        bullets: [
          "Top of funnel: lead inflow and targeting quality.",
          "Closing: conversion across calls, proposals and contracts.",
          "Consolidated view: weighted pipeline, ACV and active setups.",
        ],
      },
      "/admin?view=operacao": {
        title: "Legend - View 1 Internal Operations",
        description:
          "Operational rear-view to protect revenue, margin and delivery capacity.",
        bullets: [
          "Revenue and MRR: growth, churn and predictability.",
          "Clients and retention: NPS, health score and on-time delivery.",
          "Finance and capacity: cash, delinquency and team utilization.",
        ],
      },
      "/admin/financeiro": {
        title: "Legend - Admin Financial",
        description:
          "SaaS operation financial health and cost forecast.",
        bullets: [
          "MRR/ARR: recurring revenue baseline.",
          "Cloud cost: infrastructure consumption.",
          "Delinquency: direct impact on churn and cash.",
        ],
      },
      "/admin/usuarios": {
        title: "Legend - Users",
        description:
          "Access, plan and permission management by account.",
        bullets: [
          "Plan defines modules available to each client.",
          "Permissions control sensitive actions.",
          "Account status guides support and success.",
        ],
      },
      "/admin/sistema": {
        title: "Legend - System",
        description:
          "Technical monitoring of uptime and performance.",
        bullets: [
          "Latency by service and layer.",
          "Resource usage with alert thresholds.",
          "Health of jobs and async queues.",
        ],
      },
      "/admin/kommo": {
        title: "Legend - Kommo",
        description:
          "OAuth, token and webhook parameters for real-time synchronization.",
        bullets: [
          "Client ID, secret and redirect URL must match the Kommo app settings.",
          "Refresh token keeps sync alive without repeated manual login.",
          "Authenticated webhook prevents forged event ingestion.",
        ],
      },
      "/admin/asaas": {
        title: "Legend - Asaas",
        description:
          "Token, webhook and queue parameters for real-time billing ingestion.",
        bullets: [
          "Access token authenticates REST requests against Asaas.",
          "Webhook token validates incoming financial events.",
          "Retry queue prevents payment event loss.",
        ],
      },
      "/admin/google-calendar": {
        title: "",
        description:
          "Free Google Calendar ingestion for calls and diagnostics by tag.",
        bullets: [
          "Use CALL-QUAL, CALL-FECH and DIAG-OS in title or description.",
          "Apps Script can schedule reads without extra cost.",
          "Normalized events should be posted to an internal GLX webhook.",
        ],
      },
      "/admin/google-forms": {
        title: "",
        description:
          "Google Forms connected to Sheets with automatic trigger delivery.",
        bullets: [
          "Link the form to a native Google response sheet.",
          "Use onFormSubmit to send NPS and engagement in real time.",
          "Keep final KPI aggregation under existing backend rules.",
        ],
      },
      "/admin/planilha-contratos": {
        title: "",
        description:
          "Automated contracts sheet read for active clients, MRR and churn.",
        bullets: [
          "Manual sheet updates remain unchanged.",
          "Apps Script or Sheets API can publish the current snapshot.",
          "Backend recalculation should preserve the current formulas.",
        ],
      },
      "/admin/planilha-dre": {
        title: "",
        description:
          "Monthly DRE sheet snapshot for net margin, CAC and revenue per hour.",
        bullets: [
          "Monthly cadence remains the same.",
          "Sheets API or Apps Script can publish the closed month values.",
          "Final KPI formulas should remain in the backend layer.",
        ],
      },
      "/admin/erros": {
        title: "Legend - Errors and Logs",
        description:
          "Incident triage and failure traceability.",
        bullets: [
          "Severity defines response SLA.",
          "Module and timestamp speed RCA.",
          "Active/inactive status controls notification flow.",
        ],
      },
      "/admin/flags": {
        title: "Legend - Feature Flags",
        description:
          "Feature rollout control by environment.",
        bullets: [
          "Flag scope: global, plan or tenant.",
          "Gradual rollout reduces regression risk.",
          "Audit trail tracks owner and change.",
        ],
      },
      default: {
        title: "Admin Legend",
        description:
          "Reading context for technical and operational decisions.",
        bullets: [
          "Monitor health, risk and cost together.",
          "Prioritize incidents by business impact.",
          "Use history to prevent recurrence.",
        ],
      },
    },
  },
  es: {
    panelSubtitle: "Panel Admin",
    navigation: {
      dashboard: "Dashboard",
      pipeline: "Pipeline y Funnel",
      operations: "Operacion Interna",
      aiAssistant: "Asistente IA",
      integrations: "Integraciones",
      finance: "Finanzas",
      users: "Usuarios",
      system: "Sistema",
      kommo: "Kommo",
      asaas: "Asaas",
      googleCalendar: "Google Calendar",
      googleForms: "Google Forms",
      contractsSheet: "Planilla de Contratos",
      dreSheet: "Planilla DRE",
      clientConfig: "Config. del Cliente",
      errors: "Errores y Logs",
      flags: "Feature Flags",
      settings: "Configuraciones",
    },
    environment: {
      production: "Produccion",
      staging: "Staging",
    },
    glxDashboard: "Dashboard GLX",
    backToSite: "Volver al Sitio",
    settings: "Configuraciones",
    searchPlaceholder: "Buscar usuarios por email o ID...",
    notificationsTitle: "Notificaciones",
    noNotifications: "Sin notificaciones",
    agoSuffix: "hace",
    logout: "Salir",
    userFallback: "Admin",
    legends: {
      "/admin": {
        title: "Leyenda - Centro de Comando",
        description:
          "Vista ejecutiva de la operacion interna de GLX.",
        bullets: [
          "KPIs: ingreso recurrente, churn y base activa.",
          "Alertas: eventos de riesgo y accion inmediata.",
          "Acciones pendientes: cola operativa del equipo admin.",
        ],
      },
      "/admin?view=pipeline": {
        title: "Leyenda - Visión 2 Pipeline y Funnel",
        description:
          "Lectura del parabrisas comercial para garantizar crecimiento futuro.",
        bullets: [
          "Top of funnel: entrada de leads y calidad del targeting.",
          "Cierre: conversion entre calls, propuestas y contratos.",
          "Vista consolidada: pipeline ponderado, ACV y setups en marcha.",
        ],
      },
      "/admin?view=operacao": {
        title: "Leyenda - Visión 1 Operación Interna",
        description:
          "Lectura operativa para proteger ingresos, margen y capacidad de entrega.",
        bullets: [
          "Ingresos y MRR: crecimiento, churn y previsibilidad.",
          "Clientes y retencion: NPS, health score y entregas a tiempo.",
          "Finanzas y capacidad: caja, mora y uso del equipo.",
        ],
      },
      "/admin/financeiro": {
        title: "Leyenda - Finanzas Admin",
        description:
          "Salud financiera de la operacion SaaS y costo proyectado.",
        bullets: [
          "MRR/ARR: base de ingreso recurrente.",
          "Costo cloud: consumo de infraestructura.",
          "Mora: impacto directo en churn y caja.",
        ],
      },
      "/admin/usuarios": {
        title: "Leyenda - Usuarios",
        description:
          "Gestion de acceso, plan y permisos por cuenta.",
        bullets: [
          "El plan define modulos por cliente.",
          "Permisos controlan funciones sensibles.",
          "Estado de cuenta orienta soporte y exito.",
        ],
      },
      "/admin/sistema": {
        title: "Leyenda - Sistema",
        description:
          "Monitoreo tecnico de disponibilidad y performance.",
        bullets: [
          "Latencia por servicio y capa.",
          "Uso de recursos con umbral de alerta.",
          "Salud de jobs y colas asincronas.",
        ],
      },
      "/admin/kommo": {
        title: "Leyenda - Kommo",
        description:
          "Parametros de OAuth, tokens y webhook para sincronizacion en tiempo real.",
        bullets: [
          "Client ID, secret y redirect URL deben coincidir con la app registrada en Kommo.",
          "Refresh token mantiene la sincronizacion sin relogin manual.",
          "Webhook autenticado evita ingestar eventos falsos.",
        ],
      },
      "/admin/asaas": {
        title: "Leyenda - Asaas",
        description:
          "Parametros de token, webhook y cola para cobros en tiempo real.",
        bullets: [
          "Access token autentica llamadas REST contra Asaas.",
          "Webhook token valida eventos financieros entrantes.",
          "La cola con retry evita perdida de eventos de pago.",
        ],
      },
      "/admin/google-calendar": {
        title: "",
        description:
          "Ingestion gratuita de Google Calendar para calls y diagnosticos por etiqueta.",
        bullets: [
          "Usa CALL-QUAL, CALL-FECH y DIAG-OS en titulo o descripcion.",
          "Apps Script puede ejecutar lecturas programadas sin costo extra.",
          "Los eventos normalizados deben entrar por webhook interno de GLX.",
        ],
      },
      "/admin/google-forms": {
        title: "",
        description:
          "Google Forms conectado a Sheets con disparo automatico por trigger.",
        bullets: [
          "Conecta el formulario a una hoja de respuestas nativa de Google.",
          "Usa onFormSubmit para enviar NPS y engagement en tiempo real.",
          "La agregacion final debe mantener la regla actual del dashboard.",
        ],
      },
      "/admin/planilha-contratos": {
        title: "",
        description:
          "Lectura automatica de la planilla de contratos para clientes activos, MRR y churn.",
        bullets: [
          "La actualizacion manual de la planilla se mantiene.",
          "Apps Script o Sheets API pueden publicar el snapshot vigente.",
          "El backend debe preservar las formulas actuales.",
        ],
      },
      "/admin/planilha-dre": {
        title: "",
        description:
          "Snapshot mensual de la planilla DRE para margen neto, CAC e ingreso por hora.",
        bullets: [
          "La frecuencia mensual se mantiene igual.",
          "Sheets API o Apps Script pueden publicar el cierre del mes.",
          "La formula final de KPI sigue en la capa backend.",
        ],
      },
      "/admin/erros": {
        title: "Leyenda - Errores y Logs",
        description:
          "Triage de incidentes y trazabilidad de fallas.",
        bullets: [
          "Severidad define SLA de respuesta.",
          "Modulo y timestamp aceleran RCA.",
          "Estado activo/inactivo controla notificaciones.",
        ],
      },
      "/admin/flags": {
        title: "Leyenda - Feature Flags",
        description:
          "Control de rollout por entorno y alcance.",
        bullets: [
          "Scope de flag: global, plan o cliente.",
          "Rollout gradual reduce riesgo de regresion.",
          "Auditoria registra responsable y cambio.",
        ],
      },
      default: {
        title: "Leyenda Admin",
        description:
          "Contexto para decisiones tecnicas y operativas.",
        bullets: [
          "Monitoree salud, riesgo y costo en conjunto.",
          "Priorice incidentes por impacto de negocio.",
          "Use historico para evitar recurrencia.",
        ],
      },
    },
  },
};

export function getClientLayoutCopy(language: Language): ClientLayoutCopy {
  return CLIENT_COPY[language];
}

export function getAdminLayoutCopy(language: Language): AdminLayoutCopy {
  return ADMIN_COPY[language];
}

export function resolveClientLegend(language: Language, path: string): LegendCopy {
  const copy = CLIENT_COPY[language];
  return copy.legends[path] ?? copy.legends.default;
}

export function resolveAdminLegend(language: Language, path: string): LegendCopy {
  const copy = ADMIN_COPY[language];
  return copy.legends[path] ?? copy.legends.default;
}
