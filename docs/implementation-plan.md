# Plano de implementação — Morethis restaurantes

## Diagnóstico verificado em 29/09/2026

Inspecionados AGENTS.md, CLAUDE.md, README, docs, src, db/migrations, tests e package.json. Existem Next.js 16.3.7, React 19.3.0, TypeScript 6.0.3, PostgreSQL 17 no Compose, pg, ESLint e Vitest. A migração 001 contém users, organizations e memberships. Há página institucional, liveness e testes de autorização por empresa. Não havia login, unidades, auditoria, cardápio, pedidos, caixa ou estoque. Nenhuma pasta estrutural essencial estava ausente; os módulos de negócio ainda não foram implementados. O repositório foi inicializado, mas não possui commit ou remoto.

Os guias locais de Route Handlers, autenticação e Server Actions da versão instalada foram consultados. Preservar a migração 001 e o vínculo dos registros existentes; evoluir por novas migrações. O requirements.txt preexistente não participa da aplicação.

## Etapas e critérios

| Etapa | Estado inicial | Critério de conclusão |
| --- | --- | --- |
| 1. Acesso, empresas, unidades e equipe | Parcial: núcleo concluído; e-mail pendente | Sessões reais, unidades, autorização, auditoria e testes entregues; recuperação/verificação e envio de e-mail ausentes |
| 2. Cardápio, PDV, cozinha, pagamento e caixa | Pendente | Pedido manual até fechamento, snapshots, estados separados, divisão de pagamento, idempotência e concorrência |
| 3. Estoque, fichas e porções | Pendente | Ledger, lotes, produção intermediária, consumo e cancelamento rastreáveis |
| 4. Margens e simulação | Pendente | Custos versionados, pendências explícitas e fórmula de contribuição |
| 5. Mesas, delivery e cardápio público | Pendente | Fluxos completos, acompanhamento privado, preços recalculados e limites de requisição |
| 6. Compras, financeiro e relatórios | Pendente | Movimentos conciliáveis, taxas e exportações |
| 7. Planejamento e desperdício | Pendente | Histórico por período, dias atípicos e comparação com produção real |
| 8. Relacionamento, integrações e assinatura | Pendente | Adaptadores verificados, filas, limites e webhooks idempotentes |

Cada etapa exige persistência e testes antes da próxima. Não apresentar áreas futuras como funcionais. Não realizar deploy, cobranças ou envios reais. E-mail e outras integrações devem permanecer explicitamente não configurados sem credenciais e autorização operacional.

## Decisões da etapa 1

- Monólito modular; PostgreSQL como fonte de verdade. Better Auth mantém contas, senhas e sessões; autorização de negócio continua no Morethis.
- Identidades autenticadas não são vinculadas automaticamente a usuários legados por e-mail. O vínculo usa o identificador do provedor para impedir tomada de conta.
- Proprietário tem todas as unidades; demais perfis recebem acesso explícito por unidade. Gerente não pode gerir proprietários nem conceder acessos fora de seu escopo.
- Cadastro de conta não dá acesso a empresas existentes. Onboarding cria empresa, primeira unidade e proprietário em uma transação.
- BRL e pt-BR inicialmente; fuso IANA validado e configurável por unidade.
- Sem autorização de envio externo nesta execução. Recuperação/convites por e-mail ficam identificados e não podem aparecer como enviados.

## Registro de validação e retomada

### Concluído

- [x] Better Auth com sessões PostgreSQL, cadastro/login/logout, cookie HttpOnly e rate limiting persistente.
- [x] Empresas/unidades, fuso IANA, criação transacional, chaves de criação e versões.
- [x] Seis perfis, acesso por unidade, equipe, último proprietário protegido e auditoria.
- [x] Convites manuais com token aleatório, hash, expiração, destinatário e revogação.
- [x] Formulários persistentes, estados de erro/carregamento/sucesso e confirmações.
- [x] Banco de testes separado, verificações e teste de navegador.

### Parcial, pendente e dependências externas

- **Parcial:** entrada por perfil tem título e dados mínimos; PDV/KDS/entregas ainda não existem para destino operacional.
- **Pendente:** adaptador de e-mail, outbox, verificação e recuperação. **Bloqueado por acesso externo:** envio real depende de provedor/credenciais e autorização. Nada foi enviado.
- **Pendente:** etapas 2–8 integralmente; nenhum módulo ou indicador simulado.
- **Pendente:** primeiro commit/remoto, CI remota e validação de produção.

### Evidências locais

`npm run check`: lint sem avisos, tipos, 4 testes unitários e build passaram. `npm run test:integration`: 16 testes passaram, incluindo escopo de empresa/unidade, FKs contra referências cruzadas, convites inválidos/revogados/expirados, prevenção de escalada, retentativa de criação, corrida de versões e corrida de rebaixamento de proprietários. `npm run test:e2e`: um cenário no Edge headless passou com cadastro, empresa, convite, autorização de cozinha, CSRF, cookies, login/logout, expiração e rate limiting. Capturas desktop/celular usam dados fictícios no banco separado.

Falhas encontradas e corrigidas: API removida do Vitest (`describe.sequential`), cast UUID no fixture, ordem de limpeza de FKs nos fixtures e seletor de alerta conflitante com o anunciador do Next.js. Backup/restore e CI remota **não executados**.

**Retomada exata:** migração 003 e serviços de cardápio/pedido da etapa 2, conforme `docs/roadmap.md`. Não foram expostos segredos ou substituídos dados reais. O Morethis ainda não é um SaaS completo de operação de restaurantes.
