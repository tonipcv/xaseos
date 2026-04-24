# Análise: Experiência Langfuse vs Xase OS

> Documento técnico para o time comparar arquiteturas e definir roadmap de UX para self-hosted OSS.

---

## 1. Resumo Executivo

| Aspecto | Langfuse | Xase OS Hoje | Gap |
|---------|----------|--------------|-----|
| **Primeiro acesso** | Auto-setup com wizard web | 3 comandos CLI + .env manual | Falta wizard |
| **Geração de secrets** | Automático no primeiro boot | Manual (JWT_SECRET, ENCRYPTION_KEY) | Auto-generate |
| **Criação de admin** | Flow na UI, primeiro user = owner | seed.js no terminal | First-run API |
| **API Keys de integração** | Geradas na UI (pk_*/sk_*) | Não existe | Novo modelo |
| **Armazenamento de segredos** | Backend criptografado (chave de deploy) | Backend + localStorage (misturado) | Unificar |
| **Workspace/Org** | Multi-tenant por default | Single-user flat | Adicionar |

---

## 2. Diagnóstico Detalhado do Estado Atual

### 2.1 Problema 1: Duas Fontes de Verdade para API Keys

```typescript
// src/lib/store.ts (localStorage - client-side)
apiKeys: Record<string, string>;
setApiKey: (provider: string, key: string) => void;

// prisma/schema.prisma (banco - backend)
model UserApiKey {
  userId   String
  provider String
  keyValue String  // "criptografado" com trim()
}
```

**Problema:** A UI mostra inputs que salvam em localStorage, mas o backend lê do banco. Isso cria confusão sobre onde a chave "real" fica.

**Como Langfuse resolve:**
- Segredos de provider (OpenAI, etc) ficam no banco criptografado com chave de deployment
- Não há cache no client para segredos
- API keys de integração (pk_*/sk_*) são separadas — usadas para tracing/SDK, não para LLM providers

### 2.2 Problema 2: Criptografia Fake

```typescript
// src/lib/secrets.ts
export function encryptSecret(value: string): string {
  return value.trim();  // ← não criptografa
}

export function decryptSecret(value: string): string {
  return value.trim();  // ← não decriptografa
}
```

**Problema:** O código sugere criptografia mas não implementa. Isso é pior que plaintext óbvio — dá falsa sensação de segurança.

**Como Langfuse resolve:**
```
ENCRYPTION_KEY (env var 32+ chars) → AES-256-GCM → ciphertext armazenado
```

### 2.3 Problema 3: Sem Conceito de Workspace/Org

```prisma
// Schema atual: flat, single-user mental model
model User {
  role String @default("reviewer")  // admin|reviewer, sem org
}
```

**Problema:** Não há como:
- Convidar membros para um projeto
- Isolar dados por equipe
- Ter billing separado por workspace

**Como Langfuse resolve:**
```
Organization → Projects → Members (com roles)
Cada trace pertence a um Project
API keys são por Project
```

### 2.4 Problema 4: Setup Manual Multi-step

**Hoje:**
1. `cp .env.example .env`
2. Editar 3-4 variáveis (DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
3. `docker-compose up -d`
4. `node scripts/migrate.js`
5. `node scripts/seed.js` (cria user fixo: test@xase.ai / test123456)
6. Abrir browser, fazer login

**Langfuse:**
1. `docker-compose up`
2. Abrir browser
3. Wizard cria admin + mostra API keys
4. Pronto

---

## 3. Solução Proposta: Arquitetura Alvo

### 3.1 Modelo de Dados Novo

```prisma
// Novo: Deployment config (singleton, env-based ou UI-configured)
model DeploymentConfig {
  id              String   @id @default(cuid())
  // Secrets de deployment (para criptografar user secrets)
  masterKeyHash   String   // bcrypt do ENCRYPTION_KEY
  // Bootstrap state
  isSetupComplete Boolean  @default(false)
  createdAt       DateTime @default(now())
}

// Novo: Organization/Workspace
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  // Segredos de provider no nível de org (self-hosted = 1 org geralmente)
  createdAt   DateTime @default(now())
  members     OrganizationMember[]
  projects    Project[]
  apiKeys     OrganizationApiKey[]  // pk_*, sk_* para integração
}

model OrganizationMember {
  id             String       @id @default(cuid())
  orgId          String
  userId         String
  role           String       // owner, admin, member
  org            Organization @relation(fields: [orgId], references: [id])
  user           User         @relation(fields: [userId], references: [id])
  
  @@unique([orgId, userId])
}

// Novo: Project (escopo de dados)
model Project {
  id          String       @id @default(cuid())
  orgId       String
  name        String
  slug        String
  // Provider secrets podem ser por projeto ou herdar da org
  createdAt   DateTime     @default(now())
  org         Organization @relation(fields: [orgId], references: [id])
  tasks       Task[]       // ← move de User para Project
  runs        Run[]
}

// Refatorado: Provider secrets com criptografia real
model ProviderSecret {
  id            String   @id @default(cuid())
  scope         String   // 'org' | 'project'
  scopeId       String   // orgId ou projectId
  provider      String   // 'openai', 'anthropic', etc
  // Criptografia: AES-256-GCM com ENCRYPTION_KEY
  encryptedKey  String
  iv            String   // initialization vector
  tag           String   // auth tag
  version       Int      @default(1)  // para rotação
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([scope, scopeId, provider])
}

// Refatorado: API keys para integração (tipo Langfuse)
model OrganizationApiKey {
  id          String       @id @default(cuid())
  orgId       String
  name        String       // ex: "Produção", "Staging"
  publicKey   String       @unique // pk_lf_xxxx (prefixo para identificar)
  // hash do secret, não o secret em si
  secretHash  String       // bcrypt do sk_lf_xxxx
  lastUsedAt  DateTime?
  createdAt   DateTime     @default(now())
  revokedAt   DateTime?
  org         Organization @relation(fields: [orgId], references: [id])
}

// Simplificado: User (sem mais apiKeys diretos)
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  password    String   // bcrypt
  createdAt   DateTime @default(now())
  memberships OrganizationMember[]
}
```

### 3.2 Flow de Setup (Experiência Alvo)

```
docker-compose up
    ↓
Container entrypoint verifica DeploymentConfig
    ↓
Se !isSetupComplete:
    - Gera JWT_SECRET e ENCRYPTION_KEY aleatórios (256-bit)
    - Salva hash do ENCRYPTION_KEY em DeploymentConfig
    - Expõe na UI: /setup (wizard)
    ↓
Usuário abre browser → /setup
    ↓
Wizard coleta:
    - Email, nome, senha (primeiro admin/owner)
    - (Opcional) Nome da Organization
    - (Opcional) Provider secrets iniciais
    ↓
POST /api/setup completa:
    - Cria User (admin)
    - Cria Organization (owner)
    - Cria DeploymentConfig.isSetupComplete = true
    - Gera e mostra: PUBLIC_KEY / SECRET_KEY para SDK
    ↓
Redirect para /login
    ↓
User loga → Dashboard
```

### 3.3 Novas Rotas Necessárias

| Rota | Propósito |
|------|-----------|
| `GET /api/setup/status` | Verifica se setup foi completado (público) |
| `POST /api/setup` | Cria admin, org, finaliza setup (só quando !isSetupComplete) |
| `GET /api/org/:slug/keys` | Lista API keys de integração (pk_*/sk_*) |
| `POST /api/org/:slug/keys` | Gera nova API key pair |
| `DELETE /api/org/:slug/keys/:id` | Revoga API key |
| `GET /api/projects` | Lista projetos do usuário |
| `POST /api/projects` | Cria novo projeto |
| `GET /api/projects/:id/secrets` | Provider secrets do projeto |
| `POST /api/projects/:id/secrets` | Adiciona/atualiza provider secret |

### 3.4 Componentes UI Novos

| Componente | Onde | Função |
|--------------|------|--------|
| `SetupWizard` | `/setup` | First-run: cria admin, org, keys |
| `ApiKeyDisplay` | Settings > API Keys | Mostra pk_*/sk_*, com "copy to clipboard" |
| `ProjectSelector` | Header | Switch entre projetos |
| `InviteMemberDialog` | Settings > Members | Convidar por email |
| `ProviderSecretsManager` | Settings > Providers | CRUD de secrets com máscara (***) |

---

## 4. Checklist Técnico de Implementação

### Fase 1: Foundation (P0 — Critical)

- [ ] **1.1** Implementar criptografia real em `src/lib/secrets.ts` (AES-256-GCM)
- [ ] **1.2** Criar `DeploymentConfig` e rotas `/api/setup/*`
- [ ] **1.3** Criar entrypoint Docker que auto-gera secrets se não existirem
- [ ] **1.4** Criar página `/setup` com wizard de first-run
- [ ] **1.5** Remover `scripts/seed.js` — não mais necessário

### Fase 2: Workspace/Org (P1 — High)

- [ ] **2.1** Migration SQL: criar `Organization`, `OrganizationMember`, `Project`
- [ ] **2.2** Migration de dados: migrar tasks/runs existentes para um "Default Project"
- [ ] **2.3** Refatorar auth: adicionar `org` ao JWT claims
- [ ] **2.4** Middleware de contexto: `getCurrentOrg()` a partir do slug ou cookie
- [ ] **2.5** UI: Project selector no header

### Fase 3: API Keys de Integração (P1 — High)

- [ ] **3.1** Criar `OrganizationApiKey` model
- [ ] **3.2** Implementar geração de pk_*/sk_* (prefixos para identificar tipo)
- [ ] **3.3** Criar middleware de autenticação por API key (além de session)
- [ ] **3.4** UI: página de API keys com "Generate new key"

### Fase 4: Provider Secrets (P1 — High)

- [ ] **4.1** Criar `ProviderSecret` model (com criptografia real)
- [ ] **4.2** Refatorar `src/lib/llm.ts` para buscar de `ProviderSecret` ao invés de `UserApiKey`
- [ ] **4.3** Remover `apiKeys` do `store.ts` (localStorage)
- [ ] **4.4** UI: Provider secrets manager com máscara visual

### Fase 5: RBAC e Convites (P2 — Medium)

- [ ] **5.1** Implementar roles: owner, admin, member
- [ ] **5.2** Middleware de autorização por recurso (canAccessProject, etc)
- [ ] **5.3** Sistema de convites por email (tokens temporários)
- [ ] **5.4** UI: Member management com alteração de role

### Fase 6: Audit e Compliance (P2 — Medium)

- [ ] **6.1** Criar `AuditLog` model (quem, o quê, quando, onde)
- [ ] **6.2** Logar: criação/deleção de secrets, mudanças de role, API key events
- [ ] **6.3** UI: Audit log viewer (admin only)

### Fase 7: Migração e Documentação (P2 — Medium)

- [ ] **7.1** Script de migração para usuários existentes
- [ ] **7.2** Atualizar README com novo flow de setup
- [ ] **7.3** Atualizar OpenAPI spec com novas rotas
- [ ] **7.4** CONTRIBUTING: documentar novo modelo de tenancy

---

## 5. Decisões Arquiteturais para Discutir

### 5.1 Escopo de Secrets: Deployment vs Org vs Project

| Opção | Prós | Contras |
|-------|------|---------|
| **A: Deployment-level** (atual implícito) | Simples, funciona para single-user | Não escala para multi-org |
| **B: Org-level** (recomendado) | Natural para SaaS multi-tenant | Mais complexo para self-hosted simples |
| **C: Project-level** | Máxima granularidade | Overkill, muito complexo |

**Recomendação:** Começar com B (org-level), mas código preparado para herança (org → project).

### 5.2 Formato de API Keys

```
Langfuse: pk-lf-{uuid} / sk-lf-{uuid}
Stripe: pk_live_{hash} / sk_live_{hash}
OpenAI: sk-{prefixo}{hash}

Proposta Xase OS:
- pk-xo-{uuid}  (public key — para identificar org/project)
- sk-xo-{uuid}  (secret key — só mostrado uma vez)
```

### 5.3 Estratégia de Criptografia

```
Chave mestra: ENCRYPTION_KEY (32 bytes, env var)
Algoritmo: AES-256-GCM
- IV: 16 bytes aleatórios por secret
- Tag: 16 bytes auth tag
- Ciphertext: armazenado em DB

Implementação: Web Crypto API (Node.js crypto.subtle)
```

---

## 6. Comparação Visual: Antes vs Depois

### Setup Experience

| Passo | Antes (Hoje) | Depois (Alvo) |
|-------|--------------|---------------|
| 1 | Copiar .env.example | `docker-compose up` |
| 2 | Editar env vars | Esperar containers |
| 3 | `docker-compose up` | Abrir browser |
| 4 | `node scripts/migrate.js` | Wizard: criar conta |
| 5 | `node scripts/seed.js` | Wizard: ver API keys |
| 6 | Login com cred fixas | Dashboard pronto |

### Armazenamento de Segredos

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Provider keys | UserApiKey (trim()) | ProviderSecret (AES-256-GCM) |
| LocalStorage | Sim (confundindo) | Não |
| API keys (SDK) | Não existe | OrganizationApiKey (hashed) |

---

## 7. Referências para o Time

### Código Langfuse Open Source

Repositórios relevantes para estudar:
- `langfuse/langfuse` — Core (Next.js, Prisma, similar stack)
- Estrutura de `Organization`, `Project`, `ApiKey` models
- Setup wizard: `web/src/pages/setup.tsx`
- Criptografia: `packages/shared/src/encryption.ts`

### Arquivos Xase OS para Modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar Organization, Project, ProviderSecret, OrganizationApiKey |
| `src/lib/secrets.ts` | Implementar AES-256-GCM real |
| `src/lib/store.ts` | Remover apiKeys de localStorage |
| `src/app/api/settings/keys/route.ts` | Refatorar para novo modelo |
| `src/app/api/llm/*/route.ts` | Buscar de ProviderSecret |
| `scripts/seed.js` | Deletar |
| `docker-compose.yml` | Adicionar entrypoint de auto-setup |
| `README.md` | Documentar novo flow |

---

## 8. Métricas de Sucesso

| Métrica | Baseline (Hoje) | Alvo |
|---------|-----------------|------|
| Tempo de setup (novo usuário) | 10-15 min | < 2 min |
| Comandos CLI necessários | 4-5 | 1 (`docker-compose up`) |
| Arquivos de config manual | .env | 0 (auto) |
| Fontes de verdade para secrets | 2 (DB + localStorage) | 1 (DB criptografado) |
| Modelos de tenancy | 1 (flat) | 3 (Org → Project → User) |

---

## 9. Próximos Passos Recomendados

1. **Time Langfuse:** Revisar esta análise e validar estratégia de tenancy
2. **Priorização:** Definir se Fase 1 (wizard) é P0 ou se criptografia real é mais urgente
3. **Spike:** Implementar protótipo de `/api/setup` e criptografia AES-256-GCM
4. **RFC:** Criar issue/discussion no GitHub com checklist para contribuidores

---

*Documento criado para análise do time. Não implementar antes de validação arquitetural.*
