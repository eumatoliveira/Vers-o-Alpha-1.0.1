# Relatorio Completo - KPIs, Planos e Integracoes Backend

Data de consolidacao: 2026-03-12

## 1. Escopo deste relatorio

Este relatorio consolida tudo o que foi analisado sobre:

- a mudanca comercial do plano `Essencial` para `Start`
- o que os planos `Start` e `Pro` devem ter segundo a matriz visual enviada
- se os KPIs do PDF/PNG existem no sistema
- se os calculos desses KPIs existem no sistema
- quais integracoes de dados o backend deveria conectar
- como isso se relaciona com os endpoints e contratos atuais do backend

Conclusao executiva:

- o sistema ja exibe a maior parte dos KPIs esperados
- porem a maior parte deles ainda esta em estado `parcial`
- isso significa: existe card e grafico, mas a fonte de dados e/ou a formula real ainda nao esta implementada ponta a ponta
- o dashboard de planos ainda depende majoritariamente de mock no frontend
- o backend possui contratos parciais para dados reais, mas eles ainda nao alimentam toda a experiencia de planos

## 2. Mudanca de nome do plano

Decisao aplicada:

- nome comercial exibido ao usuario: `Start`
- identificador interno preservado: `essencial`

Motivo:

- evita regressao em permissao, regra de negocio, login, plano e consultas no backend
- permite trocar o nome comercial sem refatoracao estrutural de schemas, enums e testes

Impacto pratico:

- o usuario passa a ver `Start`
- o sistema continua tratando o tier internamente como `essencial`

Base tecnica:

- [shared/controlTowerRules.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/shared/controlTowerRules.ts)
- [client/src/features/plan-dashboard-replacement/PlanDashboardApp.tsx](/c:/Users/mathe/Review%20Glx/Guillermo02-03/client/src/features/plan-dashboard-replacement/PlanDashboardApp.tsx)

## 3. O que o plano Start deve ter

Pela imagem enviada, o plano `Start` deve conter os KPIs executivos base.

### 3.1 Agenda & No-Show

- Taxa de No-show (%)
- Taxa de Ocupacao (%)
- Taxa de Confirmacoes Realizadas (%)
- Consultas Realizadas (semana)
- Agendamentos por Canal de Aquisição
- Lead time de Agendamento

### 3.2 Financeiro

- Faturamento Bruto Mensal
- Receita Liquida
- Margem Liquida Total (%)
- Ticket Medio
- Inadimplencia (%)
- Despesas Fixas / Receita (%)
- Posicao de Caixa

### 3.3 Marketing & Captacao

- Leads Gerados total e por Canal
- Custo por Lead (CPL)
- Taxa de Conversao de Lead -> Agendamento (%)
- No-show por Canal de Origem (%)
- ROI por Canal (%)

### 3.4 Operacao & Experiencia do Paciente

- NPS Geral (0-10)
- Tempo Medio de Espera (min)
- Taxa de Retorno / Fidelizacao (%)
- SLA de Resposta ao Lead (horas)

## 4. O que o plano Pro deve ter

O plano `Pro` deve conter tudo do `Start` e, alem disso, KPIs mais granulares e analiticos.

### 4.1 Agenda & No-Show

- Taxa de Perda de Capacidade nao Recuperavel (%)
- Custo Encaixado (R$)

### 4.2 Financeiro

- DRE Gerencial / EBITDA %
- Forecast de Receita
- Break-even

### 4.3 Marketing & Captacao

- CAC por Canal
- LTV / CAC ratio

### 4.4 Operacao & Experiencia do Paciente

- NPS por Medico/Profissional
- Margem por Servico/Procedimento
- Margem por Medico (%)

## 5. Regra de negocio atual de Start e Pro no codigo

O repositorio ja contem uma regra de negocio formal para os planos.

### 5.1 Start / essencial

No rulebook atual:

- modo: `start_executive`
- modulos: agenda, financeiro, marketing, operacao
- foco: visao executiva
- alertas: `P1/P2/P3`
- governanca: `DSH`, score de completude de fonte, webhook near real-time

### 5.2 Pro

No rulebook atual:

- modo: `pro_optimization`
- modulos: agenda, financeiro, marketing, operacao
- foco: granularidade por profissional, servico, canal e simuladores
- inclui forecast P10/P50/P90, anomaly detection e CRM bidirecional

Base tecnica:

- [shared/controlTowerRules.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/shared/controlTowerRules.ts)

## 6. Estado real dos KPIs no sistema

Resumo objetivo:

- a maior parte dos KPIs do PDF existe visualmente no site
- mas nao com a logica real completa da tabela
- hoje o status correto da maioria e `parcial`

Significado de `parcial`:

- existe card e/ou grafico
- existe algum calculo
- mas a formula esta simplificada, mockada ou desconectada da fonte operacional esperada

## 7. Onde os calculos atuais estao

### 7.1 Base de calculo real usada pelos dashboards de plano

Os dashboards de planos usam principalmente:

- [client/src/features/plan-dashboard-replacement/data/mockData.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/client/src/features/plan-dashboard-replacement/data/mockData.ts)

Ali ficam os calculos base hoje usados no frontend:

- receita liquida simplificada
- margem simplificada
- ticket medio
- no-show
- ocupacao
- NPS medio
- espera media
- retorno
- CAC medio
- leads
- CPL

### 7.2 Catalogo textual de formula esperada

As formulas conceituais estao mapeadas em:

- [client/src/features/plan-dashboard-replacement/utils/kpiMeta.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/client/src/features/plan-dashboard-replacement/utils/kpiMeta.ts)

Esse arquivo descreve como o KPI deveria ser calculado, mas isso nao significa que a tela esteja usando a mesma regra real.

### 7.3 Contratos backend existentes

O backend ja possui grupos de dados:

- `ceo`
- `financial`
- `operations`
- `waste`
- `marketing`
- `quality`
- `people`
- `dataGovernance`

Base tecnica:

- [server/dashboardDataRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/dashboardDataRouter.ts)

## 8. Principais divergencias entre PDF e sistema

### 8.1 NPS

No dashboard atual, a base do frontend usa media das notas.

No conceito correto, NPS deveria ser:

- `% promotores - % detratores`

Observacao:

- existe formula correta catalogada
- mas a tela nao esta inteiramente ligada a essa regra real ponta a ponta

### 8.2 Ocupacao

No calculo atual do mock:

- ocupacao = realizadas / total de registros

Na logica correta do PDF:

- ocupacao deveria depender de capacidade real de agenda, slots e disponibilidade

### 8.3 Receita liquida

No mock atual:

- receita liquida e derivada por regra simplificada

No PDF:

- receita liquida e composta por bruto menos perdas especificas
- glosas
- descontos
- estornos
- inadimplencia
- cancelamentos

### 8.4 CAC, CPL, Leads, ROI, LTV

Esses indicadores existem em boa parte das telas, mas:

- nem sempre derivam de fontes reais
- muitas vezes sao estimativas locais no frontend
- LTV e LTV:CAC ainda nao estao implementados como contrato robusto no backend

### 8.5 SLA, retorno 90d, cancelamentos por motivo, perda de capacidade

Esses itens aparecem visualmente ou parcialmente, mas:

- nao encontrei implementacao operacional completa e fiel ao PDF

## 9. Matriz consolidada de aderencia dos KPIs

Legenda:

- `Sim`: existe de forma clara
- `Parcial`: existe em tela, mas sem formula real completa
- `Nao`: nao existe de forma fiel

| KPI | Existe na tela | Calculo fiel existe | Fonte atual |
|---|---|---|---|
| Taxa de No-show | Sim | Parcial | Mock |
| Taxa de Ocupacao | Sim | Parcial | Mock |
| Taxa de Confirmacoes Realizadas | Sim | Parcial | Mock |
| Taxa de Perda de Capacidade nao Recuperavel | Parcial | Nao | Mock |
| Consultas Realizadas | Sim | Parcial | Mock |
| Custo Encaixado | Parcial | Nao | Mock |
| Agendamentos por Canal de Aquisicao | Sim | Parcial | Mock |
| Lead time de Agendamento | Sim | Parcial | Mock |
| Faturamento Bruto Mensal | Sim | Parcial | Mock |
| Receita Liquida | Sim | Parcial | Mock |
| Margem Liquida | Sim | Parcial | Mock |
| Ticket Medio | Sim | Parcial | Mock |
| Inadimplencia | Sim | Parcial | Mock |
| Despesas Fixas / Receita | Sim | Parcial | Mock |
| DRE Gerencial / EBITDA % | Sim | Parcial | Mock |
| Forecast de Receita | Sim | Parcial | Mock |
| Posicao de Caixa | Sim | Parcial | Mock |
| Break-even | Sim | Parcial | Mock |
| Leads Gerados total e por canal | Sim | Parcial | Mock |
| CPL | Sim | Parcial | Mock |
| Conversao Lead -> Agendamento | Sim | Parcial | Mock |
| CAC por Canal | Sim | Parcial | Mock |
| No-show por Canal de Origem | Sim | Parcial | Mock |
| ROI por Canal | Sim | Parcial | Mock |
| LTV / CAC ratio | Sim | Nao fiel | Mock |
| NPS Geral | Sim | Parcial | Mock |
| NPS por Medico/Profissional | Sim | Parcial | Mock |
| Tempo Medio de Espera | Sim | Parcial | Mock |
| Taxa de Retorno / Fidelizacao | Sim | Parcial | Mock |
| SLA de Resposta ao Lead | Sim | Parcial | Mock |
| Margem por Servico/Procedimento | Sim | Parcial | Mock |
| Margem por Medico | Sim | Parcial | Mock |

## 10. Integracoes de dados exigidas pela pagina do PNG

Pela pagina do PNG com a coluna de origem, a arquitetura esperada de integracoes de dados e:

- `CRM`
- `API ASAAS`
- `LEADS`
- `ADS`
- `API AGENDA`
- `META ADS`
- `GOOGLE ADS`
- `WHATSAPP`
- `PESQUISA`
- `FINANCEIRO`
- `CAMADA CALCULADA`

Agrupando isso em integracoes backend concretas:

- CRM / Agenda clinica
- Asaas
- Meta Ads
- Google Ads
- WhatsApp
- Sistema/Pesquisa de NPS
- Financeiro complementar / ERP / conciliacao
- Camada analitica interna para KPIs derivados

Observacao importante:

- essa imagem define principalmente `fontes de dados para dashboards`
- ela nao define sozinha todas as integracoes de `login`
- login e autenticacao sao outra camada

## 11. Lista tecnica de integracoes backend obrigatorias, por dominio

### 11.1 CRM / Agenda

Deve alimentar:

- no-show
- ocupacao
- confirmacoes
- consultas realizadas
- agendamentos por canal
- lead time de agendamento
- conversao lead -> agendamento
- taxa de retorno / fidelizacao
- espera media
- SLA de resposta ao lead
- cancelamentos por motivo
- agenda por profissional/slot

Campos minimos esperados:

- `leadId`
- `patientId`
- `professional`
- `procedure`
- `channel`
- `unit`
- `status`
- `firstContactAt`
- `firstResponseAt`
- `confirmedAt`
- `arrivalAt`
- `consultationStartedAt`
- `cancellationReason`
- `confirmedAttendance`
- `recurringPatient`
- `isNewPatient`
- `slotsAvailable`
- `slotsEmpty`
- `waitMinutes`

Contrato proximo do que ja existe:

- `localAiRecordSchema` em [server/dashboardDataRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/dashboardDataRouter.ts)

### 11.2 Asaas / Financeiro

Deve alimentar:

- faturamento bruto
- receita liquida
- ticket medio
- inadimplencia
- despesas fixas / receita
- DRE / EBITDA
- forecast de receita
- posicao de caixa
- break-even

Campos minimos esperados:

- `revenueGross`
- `revenueNet`
- `discounts`
- `glosas`
- `taxes`
- `directCost`
- `variableCost`
- `fixedCost`
- `paidAt`
- `dueAt`
- `ticketMedio`

Contratos backend correlatos:

- `getFinancialData`
- `upsertFinancialData`

Em:

- [server/dashboardDataRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/dashboardDataRouter.ts)

### 11.3 Marketing / Ads

Deve alimentar:

- leads por canal
- CPL
- CAC
- ROI por canal
- no-show por canal de origem
- LTV / CAC
- funil completo

Integracoes obrigatorias:

- Meta Ads
- Google Ads
- CRM/Leads
- eventualmente Analytics/UTM

Campos minimos esperados:

- `marketingSpend`
- `channel`
- `leadId`
- `patientId`
- `isNewPatient`
- `revenueNet`
- `sourceType`

Contratos backend correlatos:

- `getMarketingData`
- `upsertMarketingData`

### 11.4 Pesquisa / WhatsApp / NPS

Deve alimentar:

- NPS geral
- NPS por profissional
- feedback do paciente
- SLA de resposta

Campos minimos esperados:

- `npsScore`
- `professional`
- `responseAt`
- `firstResponseAt`
- `channel`

Contratos backend correlatos:

- `getQualityData`
- `upsertQualityData`

### 11.5 Camada calculada interna

Necessaria para:

- LTV / CAC
- break-even
- margem por minuto
- payback CAC
- NRR
- impacto financeiro
- RevPAS
- alertas enterprise

Funcoes ja existentes no codigo:

- `calcFaturamentoLiquido`
- `calcEbitdaNormalizada`
- `calcRevPas`
- `calcBreakEven`
- `calcCustoOportunidade`
- `calcMargemPorMinuto`
- `calcPaybackCac`
- `calcLtvLiquido`
- `calcNrr`
- `calcNps`

Base tecnica:

- [shared/controlTowerRules.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/shared/controlTowerRules.ts)

## 12. Lista tecnica de integracoes backend obrigatorias, por KPI

### 12.1 Agenda & No-Show

| KPI | Integracao obrigatoria | Endpoint/backend atual relacionado | Estado |
|---|---|---|---|
| Taxa de No-show | CRM / Agenda | `getWasteData`, `upsertWasteData` | Parcial |
| Taxa de Ocupacao | CRM / Agenda / Capacidade | `getOperationsData`, `upsertOperationsData` | Parcial |
| Taxa de Confirmacoes | CRM / Agenda / WhatsApp | sem contrato fechado especifico | Parcial |
| Perda de Capacidade nao Recuperavel | CRM / Agenda / Slots | `waste`, `operations`, camada calculada | Parcial |
| Consultas Realizadas | CRM / Agenda | derivado local/frontend hoje | Parcial |
| Custo Encaixado | Agenda + Ticket medio | camada calculada | Parcial |
| Agendamentos por Canal | CRM / Leads | `marketing.channelPerformanceData` parcial | Parcial |
| Lead time de Agendamento | CRM / Leads / Agenda | sem contrato fechado especifico | Parcial |

### 12.2 Financeiro

| KPI | Integracao obrigatoria | Endpoint/backend atual relacionado | Estado |
|---|---|---|---|
| Faturamento Bruto Mensal | Asaas / ERP | `getFinancialData`, `upsertFinancialData` | Parcial |
| Receita Liquida | Asaas / ERP | `getFinancialData`, `upsertFinancialData` | Parcial |
| Margem Liquida | Asaas / ERP + custos | `getFinancialData`, `upsertFinancialData` | Parcial |
| Ticket Medio | Financeiro + Agenda | sem campo final fechado | Parcial |
| Inadimplencia | Asaas / recebiveis | sem contrato final dedicado | Parcial |
| Despesas Fixas / Receita | Asaas / custos | `financial` parcial | Parcial |
| DRE / EBITDA | ERP / centro de custos | parcial no backend | Parcial |
| Forecast Receita | financeiro + camada analitica | parcial no frontend | Parcial |
| Posicao de Caixa | financeiro | `saldoCaixa`, `fluxoCaixaOperacional` | Parcial |
| Break-even | financeiro + camada calculada | funcao calculada existe | Parcial |

### 12.3 Marketing & Captacao

| KPI | Integracao obrigatoria | Endpoint/backend atual relacionado | Estado |
|---|---|---|---|
| Leads por canal | CRM / Leads / Ads | `channelPerformanceData` | Parcial |
| CPL | Ads | `costPerLead` | Parcial |
| Conversao Lead -> Agendamento | CRM + Agenda | `funnelData` parcial | Parcial |
| CAC por canal | Ads + CRM | `acquisitionCost` | Parcial |
| No-show por canal de origem | CRM + Agenda | sem join real completo | Parcial |
| ROI por canal | Ads + Financeiro + CRM | `marketingRoi` generico | Parcial |
| LTV / CAC | CRM + Financeiro + Ads + camada calculada | sem contrato final | Parcial |

### 12.4 Operacao & Experiencia

| KPI | Integracao obrigatoria | Endpoint/backend atual relacionado | Estado |
|---|---|---|---|
| NPS Geral | Pesquisa / WhatsApp | `getQualityData`, `upsertQualityData` | Parcial |
| NPS por Profissional | Pesquisa / WhatsApp / CRM | sem contrato por profissional fechado | Parcial |
| Tempo Medio de Espera | CRM / Recepcao | `getOperationsData`, `upsertOperationsData` | Parcial |
| Taxa de Retorno / Fidelizacao | CRM / Agenda | sem cohort final fechado | Parcial |
| SLA de Resposta ao Lead | WhatsApp / CRM | sem contrato fechado | Parcial |
| Margem por Servico | Financeiro + CRM | camada calculada parcial | Parcial |
| Margem por Medico | Financeiro + CRM | camada calculada parcial | Parcial |

## 13. Endpoints backend atuais que ja podem ser aproveitados

O backend atual ja possui estrutura reutilizavel.

### 13.1 Roteador raiz

- [server/routers.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/routers.ts)

Namespaces principais:

- `emailAuth`
- `dashboardData`
- `controlTower`
- `manualEntries`
- `clientDashboard`

### 13.2 Dashboard data

Rota central de dados administrativos / ingestao:

- [server/dashboardDataRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/dashboardDataRouter.ts)

Endpoints principais:

- `getCeoMetrics`
- `upsertCeoMetrics`
- `getFinancialData`
- `upsertFinancialData`
- `getOperationsData`
- `upsertOperationsData`
- `getWasteData`
- `upsertWasteData`
- `getMarketingData`
- `upsertMarketingData`
- `getQualityData`
- `upsertQualityData`
- `getPeopleData`
- `upsertPeopleData`
- `getDataGovernanceData`
- `upsertDataGovernanceData`
- `createDataImport`
- `updateDataImportStatus`
- `ingestWithLocalAi`

### 13.3 Autenticacao e provisionamento de integracoes

Base tecnica:

- [server/authRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/authRouter.ts)

O que ja existe:

- login email/senha
- criacao de usuarios
- definicao de plano
- provisionamento administrativo de integracoes por usuario

Tipos de integracao suportados hoje no provisionamento admin:

- `kommo`
- `asaas`
- `crm_hubspot`
- `crm_rd_station`
- `meta_pixel`
- `meta_capi`
- `google_ads`
- `google_ads_enhanced`
- `gtm`
- `server_side_gtm`
- `google_sheets`
- `power_bi`

Conclusao tecnica:

- o backend ja tem uma base de provisionamento de integracoes
- mas isso ainda nao significa ingestao automatica completa dos KPIs do PDF

## 14. Todos os dashboards e todos os logins no backend

Interpretacao correta da exigencia:

### 14.1 Dashboards

Sim:

- o PNG deve ser lido como matriz de integracoes obrigatorias para alimentar `todos os dashboards` relevantes

### 14.2 Logins

Nao necessariamente:

- a imagem fala principalmente de integracao de `dados`
- nao define sozinha integracao de `autenticacao`

O que o backend de login ja tem hoje:

- login local por email/senha
- sessao por cookie/JWT
- cadastro administrativo de usuarios
- plano por usuario

Se a estrategia futura exigir SSO, entao isso seria um projeto adicional.

## 15. Gap principal de arquitetura hoje

O maior gap nao e falta total de backend.

O maior gap e:

- os dashboards de planos ainda usam muito `mockData.ts`
- os contratos backend existem, mas nao estao plenamente conectados ao frontend dos planos
- faltam joins reais entre CRM, agenda, financeiro, ads e satisfacao
- faltam granularidades por canal, profissional, slot, servico e cohort

## 16. Prioridade recomendada de implementacao

### Fase 1 - Conectar o frontend de planos ao backend real

- remover dependencia primaria de `mockData.ts`
- consumir `dashboardData` e/ou `controlTower`
- definir fallback apenas para ambiente demo

### Fase 2 - Fechar contratos de dados por modulo

- agenda
- financeiro
- marketing
- operacao/experiencia

### Fase 3 - Fechar integracoes reais

- CRM/Agenda
- Asaas
- Meta Ads
- Google Ads
- WhatsApp / Pesquisa NPS

### Fase 4 - Implementar camada analitica derivada

- LTV/CAC
- break-even
- margem por servico
- margem por medico
- forecast real
- cohort 90d
- score de completude de fonte

### Fase 5 - So depois refinamento enterprise

- consolidacao multi-unidade
- benchmark interno
- score da rede
- valuation
- investor layer

## 17. Entrega final desta analise

Este relatorio responde aos pedidos feitos:

- confirmou a mudanca comercial para `Start`
- separou o que `Start` e `Pro` devem ter
- verificou se os KPIs do PDF existem
- verificou se os calculos do PDF existem
- confirmou o que o PNG pede de integracoes
- transformou essa pagina do PNG em lista tecnica de integracoes backend obrigatorias
- organizou isso por dominio, por KPI e por endpoint atual

## 18. Arquivos-chave para continuar a implementacao

- [shared/controlTowerRules.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/shared/controlTowerRules.ts)
- [server/dashboardDataRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/dashboardDataRouter.ts)
- [server/authRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/authRouter.ts)
- [server/routers.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/routers.ts)
- [client/src/features/plan-dashboard-replacement/data/mockData.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/client/src/features/plan-dashboard-replacement/data/mockData.ts)
- [client/src/features/plan-dashboard-replacement/utils/kpiMeta.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/client/src/features/plan-dashboard-replacement/utils/kpiMeta.ts)
- [TDD_KPI_MATRIZ_AUDITORIA.md](/c:/Users/mathe/Review%20Glx/Guillermo02-03/TDD_KPI_MATRIZ_AUDITORIA.md)

