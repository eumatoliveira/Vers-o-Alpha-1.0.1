# GLX Partners Landing + Control Tower

Aplicacao web completa da GLX com:
- landing page comercial,
- autenticacao por email/senha,
- dashboard de cliente (operacao/gestao),
- dashboard administrativo (centro de comando),
- regras de negocio de plano, alertas e cadencia de exportacao PDF.

Este repositorio combina frontend (React + Vite) e backend (Node + Express + tRPC) no mesmo projeto.

## Visao Geral

### Modulos principais
- **Landing page** (`/`): site institucional com secoes de oferta, prova social, FAQ e CTA.
- **Login** (`/login`): autenticacao com sessao por cookie HTTP-only.
- **Dashboard cliente legado** (`/dashboard`): modulo completo com menu por plano, integracoes, entrada de dados, funil, canais, sprints/OKRs, exportacoes e configuracoes.
- **Dashboard cliente moderno** (`/performance` e subrotas): scorecard executivo com layout por dominio (Financeiro, Operacoes, Growth, Qualidade, Equipe, Governanca de Dados).
- **Painel admin** (`/admin` e subrotas): usuarios, financeiro, sistema, erros e feature flags.

### Funcionalidades de negocio
- Controle de acesso por plano (`essencial`, `pro`, `enterprise`) por secao de dashboard.
- Motor de alertas por prioridade (`P1`, `P2`, `P3`).
- Cadencia de exportacao PDF por plano.
- Suporte multi-idioma (PT/EN/ES) com legendas explicativas nas telas criticas.

---

## Stack Tecnica

### Frontend
- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Chart.js + react-chartjs-2
- Framer Motion
- Wouter (roteamento)
- Sonner (toasts)

### Backend
- Node.js (ESM)
- Express
- tRPC 11
- Drizzle ORM
- MySQL (`mysql2`)
- JOSE (JWT)
- bcryptjs

### Qualidade
- Vitest (testes)
- TypeScript (`tsc --noEmit`)
- Prettier
- Trunk config (`.trunk/`) para lint/security checks (opcional)

---

## Estrutura de Pastas

```text
client/
  public/
    images/
    videos/
  src/
    components/
    contexts/
    i18n/
    lib/
    pages/
    _core/
server/
  _core/
  authRouter.ts
  adminRouter.ts
  dashboardDataRouter.ts
  db.ts
  routers.ts
shared/
  controlTowerRules.ts
drizzle/
  schema.ts
control-tower/
  apps/
  packages/
  prisma/
```

### Responsabilidades
- `client/`: UI, layouts, paginas e experiencia do usuario.
- `server/`: APIs tRPC, auth, regras de acesso e integracoes de dados.
- `shared/`: regras de negocio compartilhadas entre client/server/testes.
- `drizzle/`: schema de banco para entidades de auth/admin/dashboard.
- `control-tower/`: estrutura paralela para evolucao da plataforma (base futura).

---

## Rotas da Aplicacao

### Publicas
- `/` - Home
- `/planos` - Planos
- `/login` - Login
- `/obrigado` - Pagina de conversao

### Protegidas (cliente)
- `/dashboard` - Dashboard cliente legado (Control Tower)
- `/performance`
- `/performance/financials`
- `/performance/operations`
- `/performance/waste`
- `/performance/growth`
- `/performance/quality`
- `/performance/people`
- `/performance/data`

### Protegidas (admin)
- `/admin`
- `/admin/financeiro`
- `/admin/usuarios`
- `/admin/sistema`
- `/admin/erros`
- `/admin/flags`

---

## Regras de Negocio (Fonte Unica)

Arquivo central: `shared/controlTowerRules.ts`

### Planos
- `essencial`
- `pro`
- `enterprise`

### Acesso por secao (resumo)
- `essencial`: `dashboard`, `dados`, `configuracoes`
- `pro`: essentials + `realtime`, `agenda`, `equipe`, `sprints`, `funil`, `canais`, `relatorios`
- `enterprise`: pro + `integracoes`

### Regras publicas exportadas
- `PLAN_ACCESS`
- `MIN_PLAN_BY_SECTION`
- `ALERT_THRESHOLDS`
- `PDF_CADENCE_POLICY`
- `canAccessSection(...)`
- `classifyAlertPriority(...)`
- `getPdfCadenceWindow(...)`
- `normalizePlanTier(...)`

---

## Internacionalizacao (PT/EN/ES)

### Camadas de traducao
- `client/src/i18n/` - dicionarios gerais de UI.
- `client/src/lib/i18n.ts` - chaves de dashboard legado e legendas detalhadas.
- `client/src/lib/dashboardLocale.ts` - copy estruturado de layouts cliente/admin e legendas por rota.

### Idiomas suportados
- Portugues (`pt`)
- Ingles (`en`)
- Espanhol (`es`)

### Comportamento
- Idioma persistido em `localStorage` (`glx-language`).
- Menus, labels, cards, botoes e legendas dos dashboards traduzidos.

---

## Autenticacao e Usuarios de Teste

Implementacao principal em `server/authRouter.ts`.

### Bootstrap de contas (via ambiente)
Em `development`, o projeto cria automaticamente estas contas locais:
- `admin@glx.local` / `Admin123!`
- `cliente@glx.local` / `Cliente123!`
- `pro@glx.local` / `Pro123!`
- `enterprise@glx.local` / `Enterprise123!`

Em `production`, as contas iniciais sao criadas somente com variaveis de ambiente:
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_DEMO_USERS`
- `BOOTSTRAP_TEST_CLIENT_EMAILS` (lista separada por virgula)
- `BOOTSTRAP_TEST_CLIENT_PASSWORD`
- `BOOTSTRAP_TEST_CLIENT_NAME`

Se essas variaveis nao estiverem definidas em `production`, o bootstrap de usuarios e ignorado com log de aviso.

### Sessao
- Cookie HTTP-only (`GLX`), com `sameSite` dinamico (`lax` em HTTP, `none` em HTTPS).
- JWT assinado com `ENV.cookieSecret`.

---

## Banco de Dados

### Engine
- Drizzle ORM com MySQL.

### Modo sem banco
- Se `DATABASE_URL` nao estiver definido, parte do sistema opera com fallback em memoria (especialmente usuarios/auth locais para desenvolvimento).

### Schema
Arquivo: `drizzle/schema.ts`

Entidades principais:
- `users`, `audit_logs`, `feature_flags`, `system_metrics`, `subscriptions`, `payments`, `error_logs`, `service_status`
- tabelas de dados de dashboard por dominio (`ceo_metrics`, `financial_data`, `operations_data`, etc.)
- `manual_entries` para input manual de dados

---

## Variaveis de Ambiente

Arquivo base: `.env` (nao versionado)

Copie o template e preencha com seus valores:

```bash
cp .env.example .env
```

| Variavel | Obrigatoria | Uso |
|---|---:|---|
| `NODE_ENV` | Sim | `development` ou `production` |
| `PORT` | Nao | Porta preferencial (padrao 3000; fallback automatico para porta livre) |
| `JWT_SECRET` | **Sim em producao** | Assinatura JWT / segredo de cookie |
| `DATABASE_URL` | Recomendado | Conexao MySQL para persistencia real |
| `BOOTSTRAP_ADMIN_EMAIL` | Nao | Email do admin inicial |
| `BOOTSTRAP_ADMIN_PASSWORD` | Nao | Senha do admin inicial |
| `BOOTSTRAP_DEMO_USERS` | Nao | Usuarios demo no formato `email|senha|plano|nome` separados por `;` |
| `BOOTSTRAP_TEST_CLIENT_EMAILS` | Nao | Emails de contas de teste (csv) |
| `BOOTSTRAP_TEST_CLIENT_PASSWORD` | Nao | Senha unica para contas de teste |
| `BOOTSTRAP_TEST_CLIENT_NAME` | Nao | Nome exibido para contas de teste |
| `VITE_TEST_NOTIFICATION_EMAILS` | Nao | Emails habilitados para notificacao de demonstração no dashboard cliente |
| `VITE_APP_ID` | Nao | ID de aplicacao (frontend/backend) |
| `OAUTH_SERVER_URL` | Nao | URL do servidor OAuth (quando usado) |
| `OWNER_OPEN_ID` | Nao | Define owner/admin por openId |
| `BUILT_IN_FORGE_API_URL` | Nao | Integracao Forge |
| `BUILT_IN_FORGE_API_KEY` | Nao | Chave da API Forge |

### Exemplo minimo para dev

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=substitua_por_um_segredo_forte
DATABASE_URL=mysql://db_user:db_password@localhost:3306/glx
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change_this_admin_password
BOOTSTRAP_DEMO_USERS=cliente@glx.local|Cliente123!|essencial|Cliente Local GLX;pro@glx.local|Pro123!|pro|Pro Local GLX;enterprise@glx.local|Enterprise123!|enterprise|Enterprise Local GLX
BOOTSTRAP_TEST_CLIENT_EMAILS=client1@example.com,client2@example.com
BOOTSTRAP_TEST_CLIENT_PASSWORD=change_this_client_password
BOOTSTRAP_TEST_CLIENT_NAME=Conta de Teste GLX
VITE_TEST_NOTIFICATION_EMAILS=client1@example.com,client2@example.com
```

### Regra critica de seguranca
- Em `production`, o servidor **falha no bootstrap** se `JWT_SECRET` estiver ausente.

---

## Como Rodar Localmente

### 1) Pre-requisitos
- Node.js 20+
- Corepack habilitado
- pnpm
- (Opcional) MySQL para persistencia real

### 2) Instalar dependencias

```bash
corepack pnpm install
```

### 3) Rodar em desenvolvimento

```bash
corepack pnpm run dev
```

Servidor:
- `http://localhost:3000`
- Se a porta 3000 estiver ocupada, o backend escolhe automaticamente a proxima porta disponivel.

### 4) Build de producao

```bash
corepack pnpm run build
corepack pnpm run start
```

---

## Scripts Disponiveis

| Script | Comando | Descricao |
|---|---|---|
| `dev` | `cross-env NODE_ENV=development tsx watch server/_core/index.ts` | Sobe app em modo desenvolvimento |
| `build` | `vite build && esbuild ...` | Gera build frontend + bundle backend |
| `start` | `cross-env NODE_ENV=production node dist/index.js` | Executa build em modo producao |
| `check` | `tsc --noEmit` | Validacao de tipos TypeScript |
| `test` | `vitest run` | Testes automatizados |
| `format` | `prettier --write .` | Formata codigo |
| `db:push` | `drizzle-kit generate && drizzle-kit migrate` | Gera e aplica migracoes |

---

## Qualidade e Validacao

Fluxo recomendado antes de subir alteracoes:

```bash
corepack pnpm run check
corepack pnpm run test
corepack pnpm run build
```

---

## API (tRPC) - Resumo

Roteador raiz: `server/routers.ts`

Namespaces principais:
- `auth`: sessao atual e logout
- `emailAuth`: login, registro, gestao de usuarios e senha
- `admin`: dados de centro de comando (usuarios, financeiro, sistema, erros, flags)
- `dashboardData`: CRUD de dados de dashboards por cliente
- `manualEntries`: CRUD de entradas manuais
- `clientDashboard`: leitura de dashboard por `clientSlug`

Endpoint base:
- `/api/trpc`

---

## Midia e Assets

- Videos do login em loop (MP4/WebM): `client/public/videos/`
- GIFs/imagens da landing e login: `client/public/images/`

---

## .trunk (Tooling)

Diretorio versionado: `.trunk/`

Conteudo principal:
- `.trunk/trunk.yaml` - configuracao de linters/security checks
- `.trunk/configs/.markdownlint.yaml` - regra markdownlint
- `.trunk/.gitignore` - arquivos locais do Trunk que nao devem ir para o git

Uso opcional para pipelines de qualidade.

---

## Troubleshooting

### 1) "Missing JWT_SECRET in production"
Defina `JWT_SECRET` no ambiente antes de rodar `start`.

### 2) Porta 3000 ocupada
Comportamento esperado: o servidor troca automaticamente para outra porta livre.

### 3) Login falhando em ambiente local
Confirme que as variaveis `BOOTSTRAP_*` foram definidas no `.env` e que o backend esta rodando.

### 4) Sem dados no dashboard
- Verifique se ha entradas manuais/integracoes salvas.
- Em ambiente sem `DATABASE_URL`, parte dos dados pode ficar apenas em memoria.

---

## Observacoes de Deploy

- Configure variaveis de ambiente no provedor (especialmente `JWT_SECRET` e `DATABASE_URL`).
- Use HTTPS para cookies `SameSite=None` com `secure=true`.
- Execute `build` no CI e publique o conteudo de `dist/`.
- Na Vercel, o rewrite deve apontar para `/api` e nao para `/api/index.ts`, senao a home pode exibir JavaScript bruto em vez do app.
- Antes de publicar na Vercel, rode `pnpm run vercel:preflight` para validar o bundle de producao.
- Se um dominio da Vercel responder `DEPLOYMENT_NOT_FOUND`, reatribua o alias/dominio ao deploy ativo no painel.

---

## Licenca

MIT (`package.json`).

---

## Contato

Projeto GLX Partners.
Para evolucoes de negocio e regras de dashboard, priorizar alteracoes em `shared/controlTowerRules.ts` e refletir nos layouts/clientes/admin.
