# Deploy multi-cloud / hospedagem

Compatibilidade adicionada para:

- Vercel (`vercel.json` + `api/index.ts`)
- AWS (Docker para ECS/Fargate, App Runner, Elastic Beanstalk)
- GCP (Cloud Run ou App Engine Flex)
- Azure (App Service Linux / Container Apps)
- Hostinger / WordPress (via VPS/reverse proxy; compartilhado tem limitacoes)

## Teste local (producao)

```bash
pnpm build
pnpm start
```

## Vercel

- Configure as variaveis de ambiente no painel.
- O arquivo `api/index.ts` inicializa o Express em modo serverless.
- O rewrite da Vercel deve apontar para a rota da Function (`/api`) e nao para o arquivo fonte (`/api/index.ts`).

### Sintoma de configuracao incorreta

Se a home publicada mostrar texto JavaScript bruto, linhas como `var __defProp = Object.defineProperty;` ou codigo do bundle do backend, o rewrite esta apontando para o destino errado e a Vercel esta servindo o artefato/transpilado em vez de executar a Function.

### Configuracao recomendada na Vercel

- Framework Preset: `Other`
- Root Directory: raiz do repositorio
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run build`
- Output Directory: deixe vazio
- Node.js: `20.x`

### Variaveis de ambiente minimas

- `NODE_ENV=production`
- `JWT_SECRET=<segredo-forte>`
- `DATABASE_URL=<url-do-mysql>` para persistencia real
- `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` para criar o admin inicial em producao

### Preflight antes do deploy

Rode localmente:

```bash
pnpm run vercel:preflight
```

Esse script replica a validacao que mais importa para a Vercel: conseguir gerar o bundle de producao.

Para validar o comportamento de producao antes de publicar:

```bash
pnpm run build
pnpm run start
```

Depois confirme:

- `http://localhost:3000/` retorna HTML do app
- `http://localhost:3000/api/health` retorna JSON com `ok: true`

### Checklist rapido apos publicar

- Abra a raiz do dominio e confirme que a resposta eh HTML
- Abra `/api/health` e confirme retorno `200`
- Se o dominio da Vercel mostrar `DEPLOYMENT_NOT_FOUND`, reatribua o alias/dominio no painel da Vercel e faca um novo redeploy

Exemplo:

```bash
pnpm add -D @vercel/node
vercel
```

## AWS / GCP / Azure (recomendado: Docker)

Use o `Dockerfile` incluido.

```bash
docker build -t glx-partners-landing .
docker run --rm -p 3000:3000 --env-file .env glx-partners-landing
```

## GCP App Engine Flex

- `app.yaml` incluido (usa runtime custom com Docker).

## Azure

- `azure.yaml` incluido como base para `azd` (ajuste subscription/resource group conforme seu ambiente).

## Hostinger

- VPS: suportado (Node/Docker + Nginx reverse proxy).
- Hospedagem compartilhada: normalmente nao suporta backend Node persistente.
- Se usar hospedagem compartilhada, publique apenas frontend estatico e mantenha a API em outro provedor.

## WordPress

WordPress nao executa este backend Node/Express diretamente.

Opcoes viaveis:

- Subdominio separado para este app (recomendado)
- Reverse proxy para um servidor Node externo
- Iframe (menos recomendado)

## Observacoes

- Este projeto nao e apenas estatico (usa Express + tRPC + rotas API).
- Em producao, o backend serve `dist/public` apos `pnpm build`.
