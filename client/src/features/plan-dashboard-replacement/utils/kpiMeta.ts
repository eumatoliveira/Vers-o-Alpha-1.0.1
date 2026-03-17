export type KpiSourceMode = "integrated" | "fallback";

export type KpiMeta = {
  label: string;
  formula: string;
  howToCalculate: string;
  sources: string[];
  fields: string[];
  note?: string;
};

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceSet(mode: KpiSourceMode, preferred: string[]): string[] {
  if (mode === "integrated") return preferred;
  return ["Fallback interno do dashboard (dados simulados de desenvolvimento)", ...preferred];
}

function makeMeta(label: string, mode: KpiSourceMode): KpiMeta {
  const key = normalizeLabel(label);

  if (key.includes("nps por")) {
    return {
      label,
      formula: "NPS por profissional = media das notas do formulario pos-consulta segmentadas por profissional",
      howToCalculate: "Filtre as respostas do profissional no periodo, some as notas validas e divida pela quantidade de respostas validas.",
      sources: sourceSet(mode, ["Pesquisa NPS / WhatsApp / formulario de satisfacao", "Tabela consolidada com professionalId"]),
      fields: ["score", "professionalId", "responseAt", "unit"],
    };
  }

  if (key.includes("nps")) {
    return {
      label,
      formula: "NPS Geral = media das notas coletadas via formulario pos-consulta no periodo",
      howToCalculate: "Some as notas validas do periodo e divida pelo total de respostas validas.",
      sources: sourceSet(mode, ["Pesquisa NPS / WhatsApp / formulario de satisfacao", "Tabela de respostas NPS consolidada"]),
      fields: ["score", "responseAt", "unit"],
    };
  }

  if (key.includes("ocupacao") || key.includes("ociosidade")) {
    return {
      label,
      formula: key.includes("ociosidade") ? "Ociosidade = 100 - Ocupacao" : "Ocupacao = Consultas realizadas / Capacidade disponivel x 100",
      howToCalculate: key.includes("ociosidade")
        ? "Calcule primeiro a ocupacao do periodo e subtraia de 100%."
        : "Some consultas realizadas no periodo, some a capacidade disponivel dos slots/profissionais/unidades equivalentes e divida realizadas por capacidade.",
      sources: sourceSet(mode, ["Agenda / CRM de agenda", "Cadastro de capacidade por profissional/slot/unidade"]),
      fields: ["status", "scheduledAt", "professionalId", "unit", "slotCapacity"],
    };
  }

  if (key.includes("confirmacoes")) {
    return {
      label,
      formula: "Confirmacoes = Agendamentos confirmados / Total agendado x 100",
      howToCalculate: "Conte os agendamentos confirmados no periodo e divida pelo total agendado no mesmo recorte.",
      sources: sourceSet(mode, ["CRM / agenda / WhatsApp", "Historico de confirmacao"]),
      fields: ["status", "confirmedAt", "scheduledAt", "channel", "professionalId"],
    };
  }

  if (key.includes("perda de capacidade")) {
    return {
      label,
      formula: "Perda de capacidade = (No-shows + cancelamentos < 24h) / Total de consultas agendadas x 100",
      howToCalculate: "Some faltas e cancelamentos feitos com menos de 24h de antecedencia e divida pelo total agendado.",
      sources: sourceSet(mode, ["Agenda / CRM", "Historico de cancelamento com timestamp"]),
      fields: ["status", "scheduledAt", "canceledAt", "cancellationHoursBefore"],
    };
  }

  if (key.includes("no show por canal")) {
    return {
      label,
      formula: "No-show por canal = No-shows do canal / Agendados do canal x 100",
      howToCalculate: "Filtre o canal desejado, conte faltas e divida pelo total agendado daquele canal.",
      sources: sourceSet(mode, ["Agenda / CRM", "Origem do lead / canal"]),
      fields: ["status", "channel", "scheduledAt"],
    };
  }

  if (key.includes("no show") || key.includes("noshow")) {
    return {
      label,
      formula: "No-Show = Consultas faltadas / Consultas agendadas x 100",
      howToCalculate: "Conte agendamentos com status de falta no periodo e divida pelo total de agendamentos do mesmo recorte.",
      sources: sourceSet(mode, ["Agenda / recepcao / CRM", "Historico de status da consulta"]),
      fields: ["status", "scheduledAt", "channel", "professionalId", "unit"],
    };
  }

  if (key.includes("consultas realizadas")) {
    return {
      label,
      formula: "Consultas realizadas = total de consultas efetivamente realizadas na semana ou periodo",
      howToCalculate: "Conte somente consultas com status realizado no recorte selecionado.",
      sources: sourceSet(mode, ["Agenda / CRM", "Historico de atendimentos"]),
      fields: ["status", "performedAt", "professionalId", "unit"],
    };
  }

  if (key.includes("custo") && key.includes("no show")) {
    return {
      label,
      formula: "Custo estimado do no-show = Numero de no-shows x Ticket medio do periodo",
      howToCalculate: "Conte os no-shows do periodo e multiplique pelo ticket medio observado no mesmo recorte.",
      sources: sourceSet(mode, ["Agenda / CRM", "Financeiro / ticket medio"]),
      fields: ["status", "ticketMedio", "scheduledAt"],
    };
  }

  if (key.includes("lead time")) {
    return {
      label,
      formula: "Lead time = Dias entre primeiro contato e confirmacao",
      howToCalculate: "Subtraia a data do primeiro contato da data de confirmacao do agendamento e consolide a media no recorte.",
      sources: sourceSet(mode, ["Kommo / CRM / agenda", "Historico de interacoes"]),
      fields: ["leadId", "createdAt", "confirmedAt", "channel"],
    };
  }

  if (key.includes("faturamento bruto")) {
    return {
      label,
      formula: "Faturamento bruto = Soma de todos os recebimentos do mes antes de deducoes",
      howToCalculate: "Some os recebimentos do periodo antes de cancelar, estornar ou baixar inadimplencia.",
      sources: sourceSet(mode, ["Asaas / ERP / financeiro principal"]),
      fields: ["amount", "confirmedAt", "status", "billingPeriod"],
    };
  }

  if (key.includes("receita liquida")) {
    return {
      label,
      formula: "Receita Liquida = Faturamento Bruto - Cancelamentos - Inadimplencia - Estornos",
      howToCalculate: "Parta do bruto do periodo e desconte cancelamentos, inadimplencia e estornos do mesmo recorte.",
      sources: sourceSet(mode, ["Asaas / ERP / financeiro principal", "Recebiveis / cancelamentos / estornos"]),
      fields: ["grossAmount", "cancellationAmount", "defaultAmount", "chargebackAmount", "confirmedAt"],
    };
  }

  if (key.includes("ebitda")) {
    return {
      label,
      formula: "EBITDA = Receita Liquida - CMV - Despesas variaveis - Despesas fixas pro-rata",
      howToCalculate: "Parta da receita liquida do periodo, subtraia CMV, despesas variaveis e a parcela fixa apropriada ao periodo.",
      sources: sourceSet(mode, ["Asaas / ERP / DRE gerencial", "Centro de custos / despesas operacionais"]),
      fields: ["netRevenue", "cmv", "variableCosts", "fixedCosts", "competenceDate"],
    };
  }

  if (key.includes("margem por servico") || key.includes("margem por procedimento")) {
    return {
      label,
      formula: "Margem por servico = (Receita do servico - Custo direto com insumo e repasse) / Receita x 100",
      howToCalculate: "Agrupe por servico ou procedimento, desconte insumos e repasses diretos e divida o resultado pela receita do proprio servico.",
      sources: sourceSet(mode, ["Financeiro / ERP", "CRM / agenda / cadastro de servicos"]),
      fields: ["serviceId", "revenue", "directCost", "repasse", "performedAt"],
    };
  }

  if (key.includes("margem por medico")) {
    return {
      label,
      formula: "Margem por medico = (Receita gerada - Repasse contratual - Custo hora proporcional) / Receita x 100",
      howToCalculate: "Agrupe por profissional, desconte repasse contratual e custo hora proporcional e divida pela receita gerada.",
      sources: sourceSet(mode, ["Financeiro / ERP", "CRM / agenda / cadastro de profissionais"]),
      fields: ["professionalId", "revenue", "repasse", "hourCost", "performedAt"],
    };
  }

  if (key.includes("margem")) {
    return {
      label,
      formula: "Margem Liquida = Lucro Liquido / Receita Liquida x 100",
      howToCalculate: "Defina o lucro liquido do periodo, divida pela receita liquida do mesmo recorte e multiplique por 100.",
      sources: sourceSet(mode, ["Asaas / ERP / centro de custos", "Cadastro de repasse, custo direto e custo hora"]),
      fields: ["profit", "netRevenue", "expenseType", "competenceDate"],
    };
  }

  if (key.includes("ticket")) {
    return {
      label,
      formula: "Ticket Medio = Receita Total / Numero de consultas realizadas no periodo",
      howToCalculate: "Some a receita total do periodo e divida pelo total de consultas realizadas no mesmo recorte.",
      sources: sourceSet(mode, ["Asaas / ERP / financeiro", "Agenda / consultas realizadas"]),
      fields: ["grossRevenue", "realizedCount", "procedureId", "professionalId"],
    };
  }

  if (key.includes("inadimpl")) {
    return {
      label,
      formula: "Inadimplencia = Valores nao pagos / Faturado x 100",
      howToCalculate: "Some os valores em aberto ou vencidos e divida pelo faturado do mesmo recorte.",
      sources: sourceSet(mode, ["Asaas / recebiveis", "Financeiro / faturamento"]),
      fields: ["unpaidAmount", "grossRevenue", "dueAt", "paidAt"],
      note: "Faixas: P1 (meta) < 4% | P2: 4% a 8% | P3: > 8%.",
    };
  }

  if (key.includes("despesas fixas")) {
    return {
      label,
      formula: "Despesas Fixas / Receita = Total de despesas fixas / Receita Liquida x 100",
      howToCalculate: "Some as despesas fixas do periodo e divida pela receita liquida do mesmo recorte.",
      sources: sourceSet(mode, ["ERP / centro de custos", "Financeiro / receita liquida"]),
      fields: ["fixedCosts", "netRevenue", "competenceDate"],
      note: "Faixas: P1 (meta) < 45% | P2: 45% a 60% | P3: > 60%.",
    };
  }

  if (key.includes("forecast")) {
    return {
      label,
      formula: "Forecast de Receita = Numero de consultas confirmadas na agenda x Ticket medio historico por procedimento",
      howToCalculate: "Conte as consultas confirmadas futuras, aplique o ticket medio historico por procedimento e some o valor projetado.",
      sources: sourceSet(mode, ["Agenda / CRM", "Financeiro historico por procedimento"]),
      fields: ["confirmedAppointments", "procedureId", "historicalAvgTicket"],
    };
  }

  if (key.includes("posicao de caixa") || key.includes("caixa")) {
    return {
      label,
      formula: "Posicao de Caixa = Saldo atual + entradas previstas - saidas previstas",
      howToCalculate: "Some o saldo atual com as entradas previstas e desconte as saidas previstas do periodo.",
      sources: sourceSet(mode, ["Tesouraria / ERP / financeiro", "Fluxo de caixa previsto"]),
      fields: ["cashBalance", "projectedInflows", "projectedOutflows", "competenceDate"],
      note: "Faixas: P1 (meta) sempre positivo | P2: projecao negativa | P3: caixa negativo.",
    };
  }

  if (key.includes("break even") || key.includes("break-even")) {
    return {
      label,
      formula: "Break-even = Despesas Fixas Totais / Margem de Contribuicao Media (%)",
      howToCalculate: "Calcule a margem de contribuicao media por atendimento, divida as despesas fixas por essa margem e compare com a receita atual.",
      sources: sourceSet(mode, ["Financeiro / ERP", "Custos variaveis e ticket medio"]),
      fields: ["fixedCosts", "avgTicket", "variableCosts", "competenceDate"],
      note: "O PDF expressa a margem de contribuicao em percentual, mas a aplicacao deve converter isso para contribuicao monetaria antes de dividir as despesas fixas.",
    };
  }

  if (key.includes("cpl")) {
    return {
      label,
      formula: "CPL = Total gasto no canal / Leads gerados no periodo",
      howToCalculate: "Some o investimento do canal no periodo e divida pelo numero de leads gerados pelo mesmo canal.",
      sources: sourceSet(mode, ["Meta Ads / Google Ads", "CRM / captacao por canal"]),
      fields: ["channel", "adSpend", "leadId", "createdAt"],
    };
  }

  if (key.includes("conversao") && key.includes("consulta")) {
    return {
      label,
      formula: "Conversao Lead -> Consulta Realizada = Consultas realizadas / Total de leads x 100",
      howToCalculate: "Conte as consultas efetivamente realizadas oriundas de leads do periodo e divida pelo total de leads.",
      sources: sourceSet(mode, ["CRM / agenda", "Historico do funil"]),
      fields: ["leadId", "status", "performedAt", "channel"],
    };
  }

  if (key.includes("conversao") && key.includes("agendamento")) {
    return {
      label,
      formula: "Conversao Lead -> Agendamento = Agendamentos confirmados / Total de leads x 100",
      howToCalculate: "Conte os agendamentos confirmados do periodo e divida pelo total de leads gerados no mesmo recorte.",
      sources: sourceSet(mode, ["CRM / agenda", "Historico do funil"]),
      fields: ["leadId", "confirmedAt", "channel"],
    };
  }

  if (key.includes("cac")) {
    return {
      label,
      formula: "CAC = Gasto no canal / Novos pacientes originados do canal no periodo",
      howToCalculate: "Some o investimento do canal no periodo e divida pelo total de novos pacientes convertidos e atribuidos ao mesmo canal.",
      sources: sourceSet(mode, ["Meta Ads / Google Ads / CRM", "Kommo / funil comercial / conversoes"]),
      fields: ["adSpend", "customerId", "convertedAt", "channel"],
    };
  }

  if (key.includes("ltv") && key.includes("cac")) {
    return {
      label,
      formula: "LTV / CAC = LTV / CAC, onde LTV = Ticket Medio x Frequencia de retorno x Meses de retencao",
      howToCalculate: "Calcule o LTV do paciente pela recorrencia media e divida pelo CAC do mesmo recorte ou canal.",
      sources: sourceSet(mode, ["Financeiro / contratos / recorrencia", "CRM / ads / conversoes"]),
      fields: ["avgTicket", "returnFrequency", "retentionMonths", "cac", "channel"],
    };
  }

  if (key.includes("ltv")) {
    return {
      label,
      formula: "LTV = Ticket Medio x Frequencia de retorno x Meses de retencao",
      howToCalculate: "Calcule o ticket medio da base, estime a frequencia de retorno e multiplique pelo tempo medio de retencao.",
      sources: sourceSet(mode, ["Financeiro / contratos / historico de recorrencia", "CRM / agenda / renovacoes"]),
      fields: ["avgTicket", "returnFrequency", "retentionMonths", "customerId"],
    };
  }

  if (key.includes("roi")) {
    return {
      label,
      formula: "ROI = (Receita atribuida ao canal - Gasto no canal) / Gasto x 100",
      howToCalculate: "Atribua a receita ao canal correto, subtraia o gasto daquele canal e divida pelo investimento.",
      sources: sourceSet(mode, ["Meta Ads / Google Ads / Analytics", "CRM / financeiro com atribuicao por canal"]),
      fields: ["attributedRevenue", "investment", "utmSource", "channel"],
    };
  }

  if (key.includes("leads")) {
    return {
      label,
      formula: "Leads = Volume total de leads por canal no periodo",
      howToCalculate: "Conte os leads qualificados do periodo, agrupando por canal quando o card exigir segmentacao.",
      sources: sourceSet(mode, ["Kommo / CRM / captacao", "Historico de interacoes"]),
      fields: ["leadId", "createdAt", "qualified", "channel"],
    };
  }

  if (key.includes("retorno") || key.includes("fidelizacao") || key.includes("recorrencia")) {
    return {
      label,
      formula: "Retorno / Fidelizacao = Pacientes que retornam em ate 90 dias apos a 1a consulta / Base elegivel x 100",
      howToCalculate: "Defina a base elegivel da primeira consulta e divida os pacientes que retornaram em ate 90 dias pelo total elegivel.",
      sources: sourceSet(mode, ["CRM / agenda", "Historico do paciente"]),
      fields: ["customerId", "firstAppointmentAt", "returnAppointmentAt", "professionalId"],
    };
  }

  if (key.includes("sla de resposta ao lead")) {
    return {
      label,
      formula: "SLA de Resposta ao Lead = Tempo medio entre 1o contato do lead e resposta da recepcao",
      howToCalculate: "Subtraia o timestamp do primeiro contato do timestamp da primeira resposta valida e consolide a media do periodo.",
      sources: sourceSet(mode, ["Kommo / CRM / WhatsApp / recepcao", "Historico de interacoes"]),
      fields: ["leadId", "createdAt", "firstResponseAt", "channel"],
    };
  }

  if (key.includes("espera")) {
    return {
      label,
      formula: "Tempo Medio de Espera = Hora de atendimento real - Hora agendada (media do periodo)",
      howToCalculate: "Subtraia a hora agendada da hora real de atendimento em cada consulta e calcule a media do periodo.",
      sources: sourceSet(mode, ["Agenda / recepcao", "Logs operacionais com timestamp"]),
      fields: ["scheduledAt", "startedAt", "professionalId", "unit"],
    };
  }

  if (key.includes("valuation") || key.includes("multiplo") || key.includes("payback") || key.includes("m a")) {
    return {
      label,
      formula: key.includes("valuation")
        ? "Valuation = EBITDA normalizado x multiplo ajustado"
        : key.includes("payback")
          ? "Payback = Investimento / EBITDA alvo"
          : "Multiplo estimado = multiplo base + ajustes dinamicos",
      howToCalculate: "Normalize o EBITDA LTM, aplique ajustes de risco e crescimento e calcule os cenarios de valuation e payback.",
      sources: sourceSet(mode, ["Financeiro consolidado / DRE / rede multi-unidade", "Camada analitica de valuation do Control Tower"]),
      fields: ["ebitdaLtm", "normalizedEbitda", "adjustedMultiple", "targetInvestment", "synergy"],
    };
  }

  return {
    label,
    formula: "Indicador calculado a partir do recorte atual do dashboard",
    howToCalculate: "Aplique os filtros ativos do dashboard, identifique a base do indicador e consolide o valor segundo a regra de negocio definida para o modulo.",
    sources: sourceSet(mode, ["Control Tower / integracoes conectadas ao cliente"]),
    fields: ["period", "unit", "channel", "professionalId"],
    note: "Esse KPI ainda nao possui regra especifica mapeada no catalogo visual. O card continua exibindo a origem operacional ativa do dashboard.",
  };
}

export function resolveKpiMeta(label: string, mode: KpiSourceMode): KpiMeta {
  return makeMeta(label, mode);
}
