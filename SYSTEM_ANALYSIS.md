# Xase OS - System Analysis & User Stories

## Executive Summary

Xase OS é uma plataforma de avaliação LLM (Large Language Model) que permite:
- Criar tarefas de teste para múltiplos modelos de IA
- Executar runs comparativos entre diferentes providers
- Coletar reviews especializadas (humanas e automatizadas via LLM-as-a-Judge)
- Gerar datasets de treinamento para fine-tuning
- Exportar resultados para HuggingFace

**Status Geral: 8.5/10** - Sistema funcional e pronto para produção com pequenos gaps.

---

## 1. Arquitetura Técnica

### Stack Tecnológico
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Autenticação:** JWT com cookies httpOnly
- **Segurança:** AES-GCM para criptografia de API keys
- **Infra:** Docker + Docker Compose, CI/CD GitHub Actions

### Modelos Suportados
| Provider | Modelos |
|----------|---------|
| OpenAI | GPT-4o, GPT-4o-mini |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| Google | Gemini 1.5 Pro, Gemini 1.5 Flash |
| xAI | Grok Beta |
| Groq | Llama 3.3 70B, Mixtral 8x7b |
| Ollama | Modelos locais |

---

## 2. Funcionalidades - O QUE FUNCIONA ✅

### 2.1 Autenticação & Usuários
| Feature | Status | Detalhes |
|---------|--------|----------|
| Login/Logout | ✅ Funcionando | JWT + cookies httpOnly |
| Registro | ✅ Funcionando | Com bcrypt para senhas |
| Session persistence | ✅ Funcionando | Cookie de 7 dias |
| Perfil de usuário | ✅ Funcionando | Avatar, nome, email, role |

### 2.2 Gestão de Tasks
| Feature | Status | Detalhes |
|---------|--------|----------|
| CRUD de tasks | ✅ Funcionando | Create, Read, Update, Delete |
| Templates pré-definidos | ✅ Funcionando | 5 templates (healthcare, legal, code, creative, redteam) |
| Versionamento de tasks | ✅ Funcionando | Histórico de versões com restore |
| Busca de tasks | ✅ Funcionando | Filtro por nome/descrição |
| Seleção de modelos | ✅ Funcionando | Toggle de modelos por provider |

### 2.3 Execução de Runs (LLM)
| Feature | Status | Detalhes |
|---------|--------|----------|
| Executar task | ✅ Funcionando | Paralelo entre modelos selecionados |
| Rate limiting | ✅ Funcionando | 10 req/min para LLM APIs |
| Caching de respostas | ✅ Funcionando | Evita custos duplicados |
| Cálculo de custo | ✅ Funcionando | Estimativa por token |
| Tracking de status | ✅ Funcionando | pending → running → completed/failed |
| Latency tracking | ✅ Funcionando | MS por resposta |

### 2.4 Review & Avaliação
| Feature | Status | Detalhes |
|---------|--------|----------|
| Review Queue | ✅ Funcionando | Lista de respostas não avaliadas |
| Review manual | ✅ Funcionando | Score 0-10, labels, rationale |
| LLM-as-a-Judge | ✅ Funcionando | Avaliação automatizada concorrente |
| Corrções de output | ✅ Funcionando | Campo correctedOutput |
| Upsert de reviews | ✅ Funcionando | Atualiza se já existir |

### 2.5 Datasets
| Feature | Status | Detalhes |
|---------|--------|----------|
| Criar datasets | ✅ Funcionando | Com runs selecionadas |
| Export JSONL | ✅ Funcionando | Formato padrão ML |
| Export JSON | ✅ Funcionando | Formatado |
| Import datasets | ✅ Funcionando | Upload JSON/JSONL |
| Push to HuggingFace | ✅ Funcionando | Export com todas as reviews |

### 2.6 Analytics
| Feature | Status | Detalhes |
|---------|--------|----------|
| Dashboard resumo | ✅ Funcionando | Tasks, runs, reviews, custo |
| Latency por modelo | ✅ Funcionando | Média e contagem |
| Score por modelo | ✅ Funcionando | Média de reviews |
| Distribuição de labels | ✅ Funcionando | excellent, good, etc. |
| Inter-rater agreement | ✅ Funcionando | % de concordância |
| Cost over time | ✅ Funcionando | Gráfico de gastos |

### 2.7 Playground
| Feature | Status | Detalhes |
|---------|--------|----------|
| Teste individual | ✅ Funcionando | Um modelo, um prompt |
| Histórico local | ✅ Funcionando | Últimas 10 execuções |
| Métricas em tempo real | ✅ Funcionando | Latência, tokens, custo |

### 2.8 Settings & Configuração
| Feature | Status | Detalhes |
|---------|--------|----------|
| Adicionar API keys | ✅ Funcionando | Criptografadas (AES-GCM) |
| Remover API keys | ✅ Funcionando | Delete seguro |
| Toggle modelos | ✅ Funcionando | Enable/disable por usuário |
| Múltiplos providers | ✅ Funcionando | 6 providers suportados |

### 2.9 Infraestrutura
| Feature | Status | Detalhes |
|---------|--------|----------|
| Docker | ✅ Funcionando | Multi-stage build |
| Docker Compose | ✅ Funcionando | PostgreSQL + App |
| Health check | ✅ Funcionando | Endpoint /api/health |
| CI/CD | ✅ Funcionando | Lint, typecheck, tests, build |
| Rate limiting | ✅ Funcionando | Por IP + user ID |

---

## 3. Funcionalidades - PROBLEMAS CONHECIDOS ⚠️

### 3.1 Problemas Menores
| Problema | Impacto | Solução Proposta |
|----------|---------|------------------|
| Logo invertida em tema claro | Visual | ✅ Corrigido - agora inverte apenas no tema claro |
| Runs longos podem timeout | UX | Implementar queue assíncrona (BullMQ) |
| Cache não persiste entre deploys | Performance | Usar Redis para cache distribuído |

### 3.2 Gaps Funcionais
| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Sem async queue para runs | Médio - runs >30s travam | 🔴 Alta |
| Sem logging estruturado | Difícil debug em produção | 🟡 Média |
| Sem notificações real-time | UX poderia ser melhor | 🟢 Baixa |
| Sem backup automático | Risco de dados | 🟡 Média |

---

## 4. User Stories Completas

### 4.1 Como Usuário (Evaluator)

**US-001: Configurar meu ambiente**
```
Como usuário
Quero adicionar minhas API keys de LLM
Para poder executar tarefas nos modelos desejados

Critérios:
- Posso adicionar keys para múltiplos providers
- Keys são criptografadas antes de salvar
- Posso remover keys quando quiser
- Modelos ficam disponíveis automaticamente
```

**US-002: Criar uma task de avaliação**
```
Como usuário
Quero criar uma task com prompt específico
Para testar diferentes LLMs na mesma tarefa

Critérios:
- Posso usar templates pré-definidos
- Posso escrever system e user prompts
- Posso selecionar quais modelos usar
- Task é salva com versionamento
```

**US-003: Executar uma task**
```
Como usuário
Quero executar uma task nos modelos selecionados
Para comparar as respostas

Critérios:
- Execução paralela entre modelos
- Visualização de progresso
- Custo estimado mostrado
- Respostas salvas automaticamente
```

**US-004: Revisar respostas de LLMs**
```
Como usuário
Quero avaliar a qualidade das respostas
Para criar dados de treinamento

Critérios:
- Fila de respostas não avaliadas
- Score de 0-10 por resposta
- Labels: excellent, good, acceptable, poor, failure
- Campo para explicar avaliação
- Posso corrigir a resposta se necessário
```

**US-005: Usar LLM como Judge**
```
Como usuário
Quero que um LLM avalie as respostas automaticamente
Para acelerar o processo de review

Critérios:
- Seleciono qual modelo será o judge
- Judge avalia todas as respostas de um run
- Reviews são salvas como 'automated'
- Posso reavaliar manualmente depois
```

**US-006: Exportar dataset**
```
Como usuário
Quero exportar runs revisados como dataset
Para usar em fine-tuning

Critérios:
- Seleciono quais runs incluir
- Formato JSONL compatível
- Todas as reviews incluídas
- Posso fazer push para HuggingFace
```

### 4.2 Como Administrador

**US-007: Monitorar uso da plataforma**
```
Como admin
Quero ver analytics de uso
Para entender como a ferramenta é usada

Critérios:
- Total de tasks, runs, reviews
- Custo total estimado
- Latência média por modelo
- Distribuição de qualidade
```

**US-008: Gerenciar modelos disponíveis**
```
Como admin
Quero controlar quais modelos aparecem
Para manter a lista atualizada

Critérios:
- Enable/disable modelos globalmente
- Configurar custos por modelo
- Adicionar novos modelos via código
```

---

## 5. Test Coverage

### 5.1 Testes Implementados
| Módulo | Testes | Cobertura |
|--------|--------|-----------|
| Auth (JWT) | 5 | Sign, verify, cookies |
| Utils | 8 | ID generation, dates, cn |
| Health API | 2 | DB connection check |
| Tasks API | 5 | CRUD operations |
| Rate Limit | 12 | Throttling logic |
| **Total** | **32** | **Core functionality** |

### 5.2 E2E Tests (Playwright)
| Fluxo | Status |
|-------|--------|
| Login → Dashboard | ✅ |
| Create Task | ✅ |
| Execute Run | ⚠️ (precisa de API keys mock) |
| Review Queue | ⚠️ (precisa de dados de teste) |

---

## 6. Security Assessment

### 6.1 Implementado ✅
- JWT com httpOnly cookies
- AES-GCM encryption para API keys
- Rate limiting (prevents abuse)
- Input validation em todas as rotas
- SQL injection protection (Prisma ORM)
- XSS protection (React escaping)

### 6.2 Recomendações
- Implementar CSP headers
- HSTS para HTTPS
- Rate limiting mais granular por endpoint
- Audit logging para ações sensíveis

---

## 7. Performance Metrics

### 7.1 Atuais
| Métrica | Valor |
|---------|-------|
| Cold start (Docker) | ~3s |
| API response time | <100ms (cached) |
| LLM call latency | Provider-dependent |
| Build time | ~45s |

### 7.2 Otimizações Aplicadas
- Caching de respostas LLM
- Rate limiting eficiente (LRU)
- Queries leves para listagens
- Pagination em todas as listas

---

## 8. Roadmap Sugerido

### Fase 1: Produção (Agora)
- ✅ Docker completo
- ✅ Rate limiting
- ✅ Tests básicos
- 🔄 Async queue (BullMQ) - **Em progresso**

### Fase 2: Escala (Próximo mês)
- Redis para cache distribuído
- Logging estruturado (Pino)
- Métricas Prometheus/Grafana
- Backup automático

### Fase 3: Enterprise (Futuro)
- Multi-tenant support
- SSO (SAML/OIDC)
- Audit logs completos
- SLA monitoring

---

## 9. Conclusão

**Xase OS está:**
- ✅ Funcional para uso imediato
- ✅ Seguro para deploy em produção
- ✅ Bem arquitetado e mantenível
- 🔄 Com pequenos gaps para escala

**Recomendação:** Aprovado para deploy. A única feature crítica pendente é a async queue para runs longos.

---

*Documento gerado em: 24/04/2026*
*Versão: 1.0*
