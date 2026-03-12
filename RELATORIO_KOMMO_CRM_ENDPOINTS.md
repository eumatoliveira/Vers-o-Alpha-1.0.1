# Relatorio Tecnico - Endpoints Kommo CRM para integrar com esta aplicacao

Data de consolidacao: 2026-03-12

## 1. Objetivo

Este relatorio lista os endpoints necessarios para conectar a aplicacao ao Kommo CRM e extrair dados para alimentar:

- dashboards de plano (`Start`, `Pro`, `Enterprise`)
- modulo Control Tower
- funil comercial
- KPIs de agenda, marketing e experiencia

Tambem inclui:

- endpoints internos ja existentes neste backend
- mapeamento `endpoint Kommo -> dado obtido -> KPI impactado`
- ordem recomendada de implementacao

## 2. Resumo executivo

Para esta aplicacao, os endpoints Kommo realmente importantes sao estes grupos:

- `OAuth`
- `Account`
- `Leads`
- `Contacts`
- `Companies`
- `Users`
- `Pipelines / Stages`
- `Custom Fields`
- `Linked Entities`
- `Notes`
- `Tasks`
- `Events`
- `Webhooks`

No estado atual do projeto:

- o backend ja possui base para `save config`, `sync manual`, `refresh token`, `webhook` e `full sync`
- mas a implementacao real de coleta ainda esta muito centrada em `leads`
- ainda faltam adaptadores mais completos para contatos, companies, notas, tarefas, eventos e joins mais ricos

## 3. Endpoints oficiais do Kommo que devem ser usados

Base URL:

- `https://{subdomain}.kommo.com/api/v4`

Autenticacao OAuth:

- `POST https://{subdomain}.kommo.com/oauth2/access_token`

Fonte oficial:

- OAuth 2.0: https://developers.kommo.com/docs/oauth-20
- Token endpoint: https://developers.kommo.com/reference/get-token

### 3.1 OAuth e autorizacao

#### 1. Gerar autorizacao do usuario

- fluxo Kommo OAuth via tela de permissao
- usado para obter `authorization_code`

Observacao:

- isso nao e um endpoint REST da sua aplicacao; e parte do fluxo de autorizacao do Kommo

#### 2. Trocar authorization code por tokens

- `POST https://{subdomain}.kommo.com/oauth2/access_token`

Uso:

- obter `access_token`
- obter `refresh_token`
- obter `expires_in`

#### 3. Renovar token expirado

- `POST https://{subdomain}.kommo.com/oauth2/access_token`

Uso:

- enviar `grant_type=refresh_token`
- renovar `access_token`
- renovar `refresh_token`

## 4. Endpoints Kommo para leitura de dados

### 4.1 Conta

#### Endpoint

- `GET /api/v4/account`

#### Para que serve

- validar account/subdomain
- capturar metadata da conta
- capturar contexto de usuario, configuracoes e referencias basicas

#### KPI impactado

- nao alimenta KPI diretamente
- serve de bootstrap para integracao e validacao

Fonte oficial:

- https://developers.kommo.com/reference/account
- https://developers.kommo.com/reference/account-parameters

### 4.2 Leads

#### Endpoint principal

- `GET /api/v4/leads`

#### Uso nesta aplicacao

- base do funil comercial
- origem para leads por canal
- conversao lead -> agendamento
- lead time
- no-show por origem
- receita por lead quando houver relacionamento posterior

#### Campos importantes

- `id`
- `name`
- `pipeline_id`
- `status_id`
- `responsible_user_id`
- `price`
- `created_at`
- `updated_at`
- `custom_fields_values`

#### KPIs impactados

- Leads gerados total e por canal
- Conversao Lead -> Agendamento
- CAC por canal
- No-show por canal de origem
- Lead time
- ROI por canal

Fonte oficial:

- https://developers.kommo.com/reference/leads
- https://developers.kommo.com/reference/leads-list

### 4.3 Leads complex / captacao estruturada

#### Endpoint

- `POST /api/v4/leads/complex`

#### Uso nesta aplicacao

- opcional para criar leads enriquecidos a partir da aplicacao
- util quando a aplicacao tambem precisar empurrar conversoes para o Kommo

#### KPI impactado

- governanca do funil
- integracao bidirecional

Fonte oficial:

- https://developers.kommo.com/reference/complex-leads

### 4.4 Incoming leads / unsorted

#### Endpoints

- `GET /api/v4/leads/unsorted`
- `POST /api/v4/leads/unsorted/{uid}/link`

#### Uso nesta aplicacao

- tratar leads de captura ainda nao consolidados
- reconciliar leads vindos de formularios, chats e automacoes

#### KPI impactado

- volume de leads
- conversao de entrada
- tempo de resposta inicial

Fonte oficial:

- https://developers.kommo.com/reference/incoming-leads-list
- https://developers.kommo.com/reference/linking-incoming-leads

### 4.5 Contacts

#### Endpoints

- `GET /api/v4/contacts`
- `GET /api/v4/contacts/{id}`

#### Uso nesta aplicacao

- consolidar telefone, email, nome e relacionamentos do lead
- relacionar paciente/contato com historico

#### KPI impactado

- taxa de retorno / fidelizacao
- SLA de resposta ao lead
- LTV por paciente
- NPS por contato/paciente

Fonte oficial:

- https://developers.kommo.com/reference/contacts-list
- https://developers.kommo.com/reference/get-contact

### 4.6 Companies

#### Endpoints

- `GET /api/v4/companies`
- `GET /api/v4/companies/{id}` se necessario detalhar

#### Uso nesta aplicacao

- menos critico para clinica B2C
- util em operacoes B2B, convenios, parceiros e contas corporativas

#### KPI impactado

- mix de receita
- concentracao de receita
- contas corporativas

Fonte oficial:

- https://developers.kommo.com/reference/companies
- https://developers.kommo.com/reference/companies-list

### 4.7 Users

#### Endpoint

- `GET /api/v4/users`

#### Uso nesta aplicacao

- resolver `responsible_user_id`
- transformar IDs do Kommo em nomes de vendedor / recepcao / profissional

#### KPI impactado

- NPS por profissional
- SLA por responsavel
- lead ownership
- ranking por responsavel

Fonte oficial:

- https://developers.kommo.com/reference/users-and-roles
- https://developers.kommo.com/reference/users-list

### 4.8 Pipelines e stages

#### Endpoint base

- endpoints da secao `Leads pipelines and stages`

#### Uso nesta aplicacao

- mapear pipeline/stage para:
  - lead novo
  - contato realizado
  - agendado
  - compareceu
  - no-show
  - ganho/perdido

#### KPI impactado

- funil completo
- conversao por etapa
- velocidade do funil
- gargalo por etapa

Fonte oficial:

- https://developers.kommo.com/reference/leads-pipelines-and-stages

### 4.9 Custom fields

#### Endpoint

- `GET /api/v4/{entity_type}/custom_fields`

Exemplos:

- `GET /api/v4/leads/custom_fields`
- `GET /api/v4/contacts/custom_fields`
- `GET /api/v4/companies/custom_fields`

#### Uso nesta aplicacao

- descobrir ids reais dos campos customizados do cliente
- mapear:
  - origem do lead
  - unidade
  - procedimento
  - data de agendamento
  - data da consulta
  - status operacional
  - tags e UTMs

#### KPI impactado

- praticamente todos os KPIs dependentes de configuracao customizada do cliente

Fonte oficial:

- https://developers.kommo.com/reference/custom-fields
- https://developers.kommo.com/reference/custom-field-by-entity

### 4.10 Linked entities

#### Endpoints

- `GET /api/v4/{entity}/{entity_id}/links`
- `POST /api/v4/{entity}/{entity_id}/link`

#### Uso nesta aplicacao

- relacionar lead <-> contact
- relacionar lead <-> company
- montar joins necessarios para enriquecimento

#### KPI impactado

- LTV
- recorrencia
- receita por contato
- identificacao de contas e relacionamentos

Fonte oficial:

- https://developers.kommo.com/reference/linked-entities
- https://developers.kommo.com/reference/linking-entities

### 4.11 Notes

#### Endpoint

- `GET /api/v4/{entity_type}/{entity_id}/notes`

#### Uso nesta aplicacao

- extrair historico textual
- identificar tentativas de contato
- identificar motivo de perda/cancelamento se isso estiver anotado em nota

#### KPI impactado

- SLA de resposta ao lead
- cancelamentos por motivo
- RCA operacional

Fonte oficial:

- https://developers.kommo.com/reference/notes
- https://developers.kommo.com/reference/notes-by-entity-id

### 4.12 Tasks

#### Endpoints

- `GET /api/v4/tasks`
- `GET /api/v4/tasks/{id}`

#### Uso nesta aplicacao

- medir follow-up comercial
- medir atraso de tarefa
- medir disciplina operacional e cadencia de resposta

#### KPI impactado

- SLA de resposta ao lead
- eficiencia comercial
- tempo de atendimento/follow-up

Fonte oficial:

- https://developers.kommo.com/reference/tasks
- https://developers.kommo.com/reference/tasks-list
- https://developers.kommo.com/reference/task-id

### 4.13 Events

#### Endpoint

- `GET /api/v4/events`

#### Uso nesta aplicacao

- auditar mudancas de stage
- identificar quando o lead mudou de etapa
- detectar eventos que nao aparecem em snapshot final

#### KPI impactado

- tempo entre etapas
- conversao por etapa
- lead time do agendamento
- taxa de retorno quando houver reentrada

Fonte oficial:

- https://developers.kommo.com/reference/events-list

### 4.14 Webhooks do Kommo

#### Endpoints Kommo relacionados

- `GET /api/v4/webhooks`
- criacao/gestao de webhooks via secao de Webhooks

#### Uso nesta aplicacao

- receber eventos near real-time
- reduzir dependencia de full sync frequente
- reagir a lead criado, editado, stage alterado, task alterada etc.

Fonte oficial:

- https://developers.kommo.com/reference/webhooks
- https://developers.kommo.com/reference/list-webhooks
- https://developers.kommo.com/docs/webhooks-general

## 5. Endpoints internos desta aplicacao ja existentes para Kommo

O projeto ja possui endpoints e rotas internas relevantes.

### 5.1 Webhook HTTP do Kommo

#### Endpoint interno

- `POST /crm/kommo/webhook`

Arquivo:

- [kommoRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/infrastructure/webhooks/kommoRouter.ts)

Uso:

- receber notificacoes do Kommo
- validar assinatura/header
- normalizar payload
- enfileirar evento para processamento

#### Endpoint interno adicional

- `GET /crm/kommo/webhook/revoked`

Uso:

- receber evento de revogacao / uninstall de integracao

### 5.2 Salvar configuracao da integracao Kommo

#### tRPC endpoint

- `admin.saveIntegrationConfig`

Arquivo:

- [adminRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/adminRouter.ts)

Payload aceito para Kommo:

- `provider`
- `enabled`
- `accountDomain`
- `apiBaseUrl`
- `accessToken`
- `refreshToken`
- `webhookSecret`
- `webhookToken`
- `userAgent`
- `environment`

### 5.3 Ler configuracao atual da integracao Kommo

#### tRPC endpoints

- `admin.getMyIntegrationConfig`
- `admin.getIntegrationConfigs`

Uso:

- diagnostico
- painel admin
- verificacao de tokens e configuracao

### 5.4 Disparar sincronizacao manual

#### tRPC endpoints

- `admin.syncIntegrationNow`
- `controlTower.syncKommoNow`

Arquivos:

- [adminRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/adminRouter.ts)
- [controlTowerRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/controlTowerRouter.ts)

Uso:

- executar full sync do Kommo para o usuario atual

### 5.5 Ver status do pipeline de integracao

#### tRPC endpoint

- `admin.getIntegrationPipelineStatus`

Uso:

- monitorar saude de ingestao Kommo

### 5.6 Salvar credenciais CRM no Control Tower

#### tRPC endpoint

- `controlTower.saveCrmCredentials`

Uso:

- salvar `accountDomain`, `accessToken`, `refreshToken`, `expiresAt`, `scope`

Arquivo:

- [controlTowerRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/controlTowerRouter.ts)

## 6. Implementacao Kommo ja existente no backend

### 6.1 Full sync atual

Arquivo:

- [kommoFullSyncUseCase.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/application/useCases/kommoFullSyncUseCase.ts)

Estado atual:

- busca somente leads
- usa `fetchKommoLeads`
- normaliza payload
- enfileira eventos

### 6.2 Refresh token atual

Arquivo:

- [refreshKommoTokenUseCase.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/application/useCases/refreshKommoTokenUseCase.ts)

Estado atual:

- ja usa o endpoint oficial:
  - `POST https://{accountDomain}/oauth2/access_token`

### 6.3 Cliente HTTP atual do Kommo

Arquivo:

- [kommoApiService.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/infrastructure/crm/kommoApiService.ts)

Estado atual:

- implementa `GET /api/v4/leads`
- suporta filtro `filter[created_at][from]`

## 7. Mapeamento endpoint Kommo -> dado -> KPI

| Endpoint Kommo | Dado principal | KPI/uso na aplicacao |
|---|---|---|
| `POST /oauth2/access_token` | token | autenticacao da integracao |
| `GET /api/v4/account` | metadata da conta | bootstrap da integracao |
| `GET /api/v4/leads` | funil, valor, stage, responsavel | leads, conversao, CAC, ROI, lead time |
| `GET /api/v4/contacts` | contato/paciente | retorno, LTV, SLA, NPS |
| `GET /api/v4/companies` | empresa/conta | concentracao de receita, contas B2B |
| `GET /api/v4/users` | responsaveis | NPS por profissional, SLA por responsavel |
| `GET /api/v4/{entity_type}/custom_fields` | schema de campos customizados | todos os joins e mapeamentos |
| `GET /api/v4/{entity}/{entity_id}/links` | relacionamentos | link lead-contato-company |
| `GET /api/v4/{entity_type}/{entity_id}/notes` | historico textual | motivo, follow-up, RCA |
| `GET /api/v4/tasks` | tarefas e deadlines | SLA, disciplina comercial |
| `GET /api/v4/events` | mudancas historicas | tempo entre etapas, stage changes |
| `GET /api/v4/webhooks` | webhooks cadastrados | governanca e diagnostico |

## 8. Endpoints minimos para um MVP funcional de Kommo nesta aplicacao

Se o objetivo for colocar Kommo para funcionar o quanto antes, o conjunto minimo e:

### Obrigatorios

- `POST /oauth2/access_token`
- `GET /api/v4/account`
- `GET /api/v4/leads`
- `GET /api/v4/contacts`
- `GET /api/v4/users`
- `GET /api/v4/{entity_type}/custom_fields`
- `POST /crm/kommo/webhook`

### Muito recomendados

- `GET /api/v4/events`
- `GET /api/v4/{entity}/{entity_id}/links`
- `GET /api/v4/{entity_type}/{entity_id}/notes`
- `GET /api/v4/tasks`

## 9. Sequencia recomendada de sincronizacao

### Etapa 1 - bootstrap

1. trocar/renovar token
2. ler account
3. ler users
4. ler pipelines/stages
5. ler custom fields de leads/contacts/companies

### Etapa 2 - carga inicial

1. ler leads
2. ler contacts relacionados
3. ler links lead-contact-company
4. ler notes das entidades principais
5. ler tasks abertas e concluidas
6. ler events recentes

### Etapa 3 - near real-time

1. configurar webhook Kommo
2. receber em `/crm/kommo/webhook`
3. normalizar payload
4. enriquecer com chamadas REST de detalhe quando necessario
5. persistir para `dashboardData` e `controlTower`

## 10. Campos do Kommo que valem padronizacao imediata

Para a aplicacao funcionar bem, recomendo padronizar estes campos no mapeamento:

- `lead_id`
- `contact_id`
- `company_id`
- `responsible_user_id`
- `pipeline_id`
- `status_id`
- `created_at`
- `updated_at`
- `price`
- `source / utm / canal`
- `unidade`
- `procedimento`
- `data_agendamento`
- `data_confirmacao`
- `data_comparecimento`
- `motivo_cancelamento`
- `primeira_resposta`

## 11. Gaps atuais do projeto para Kommo

Hoje o projeto ja tem base boa, mas ainda faltam:

- cliente HTTP Kommo para `contacts`, `users`, `events`, `tasks`, `notes`, `links`
- mapeamento robusto de `custom_fields_values`
- reconciliacao de `lead -> contato -> evento -> tarefa`
- persistencia estruturada para historico por etapa
- sincronizacao incremental por `updated_at`
- enriquecimento dos dashboards de plano com esses dados reais

## 12. Implementacao recomendada por arquivo

### Ja existentes e devem evoluir

- [kommoApiService.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/infrastructure/crm/kommoApiService.ts)
- [kommoFullSyncUseCase.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/application/useCases/kommoFullSyncUseCase.ts)
- [refreshKommoTokenUseCase.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/application/useCases/refreshKommoTokenUseCase.ts)
- [kommoRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/infrastructure/webhooks/kommoRouter.ts)
- [controlTowerRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/controlTowerRouter.ts)
- [adminRouter.ts](/c:/Users/mathe/Review%20Glx/Guillermo02-03/server/adminRouter.ts)

### Novos adaptadores sugeridos

- `server/infrastructure/crm/kommoContactsService.ts`
- `server/infrastructure/crm/kommoUsersService.ts`
- `server/infrastructure/crm/kommoEventsService.ts`
- `server/infrastructure/crm/kommoTasksService.ts`
- `server/infrastructure/crm/kommoNotesService.ts`
- `server/infrastructure/crm/kommoLinksService.ts`
- `server/infrastructure/crm/kommoCustomFieldsService.ts`

## 13. Conclusao pratica

Se a pergunta for "quais endpoints eu preciso para trazer os dados do Kommo para esta aplicacao?", a resposta curta e:

- autenticacao:
  - `POST https://{subdomain}.kommo.com/oauth2/access_token`
- leitura minima:
  - `GET /api/v4/account`
  - `GET /api/v4/leads`
  - `GET /api/v4/contacts`
  - `GET /api/v4/users`
  - `GET /api/v4/{entity_type}/custom_fields`
- enriquecimento recomendado:
  - `GET /api/v4/events`
  - `GET /api/v4/tasks`
  - `GET /api/v4/{entity_type}/{entity_id}/notes`
  - `GET /api/v4/{entity}/{entity_id}/links`
- webhook:
  - Kommo -> `POST /crm/kommo/webhook`

## 14. Fontes oficiais usadas

- OAuth 2.0: https://developers.kommo.com/docs/oauth-20
- Token endpoint: https://developers.kommo.com/reference/get-token
- Account: https://developers.kommo.com/reference/account
- Leads: https://developers.kommo.com/reference/leads-list
- Contacts: https://developers.kommo.com/reference/contacts-list
- Companies: https://developers.kommo.com/reference/companies-list
- Users: https://developers.kommo.com/reference/users-list
- Pipelines and stages: https://developers.kommo.com/reference/leads-pipelines-and-stages
- Custom fields: https://developers.kommo.com/reference/custom-field-by-entity
- Linked entities: https://developers.kommo.com/reference/linked-entities
- Notes by entity: https://developers.kommo.com/reference/notes-by-entity-id
- Tasks: https://developers.kommo.com/reference/tasks-list
- Events: https://developers.kommo.com/reference/events-list
- Webhooks: https://developers.kommo.com/docs/webhooks-general
- Webhooks API: https://developers.kommo.com/reference/webhooks

