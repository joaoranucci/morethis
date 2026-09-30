# Morethis — gestão para restaurantes

Next.js 16.3.7, React 19.3.0, TypeScript 6 e PostgreSQL 17, em português brasileiro e BRL. A primeira entrega implementa acesso, empresas, unidades e equipe. **O sistema de operação do restaurante ainda não está completo:** não há cardápio, pedidos, KDS, caixa, estoque ou cobrança.

## Executar no Windows / PowerShell

Requisitos: Node.js 24, npm e Docker Desktop em execução, com containers Linux.

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run db:up
npm.cmd run db:migrate
npm.cmd run dev
```

Abra **http://127.0.0.1:3000/entrar**. Use sempre essa origem, configurada em BETTER_AUTH_URL; localhost e 127.0.0.1 têm cookies diferentes. Crie sua conta, depois sua empresa e primeira unidade. Não há usuário/senha padrão nem demonstração no ambiente de desenvolvimento.

setup:env cria .env quando necessário e gera BETTER_AUTH_SECRET aleatório sem exibi-lo. Preserva URL do banco e segredo já configurados. .env e .env.test não são versionados. Não use o placeholder do exemplo como segredo. Em produção, use HTTPS, origem canônica, segredo próprio e banco com TLS/privilégios mínimos.

## Funcionalidades entregues

- Cadastro, login e logout por Better Auth 1.7.6, sessões PostgreSQL, senha mínima de 12 caracteres, expiração e rate limiting persistente.
- Criação transacional de empresa, primeira unidade e proprietário. Retentativas com a mesma chave não duplicam a empresa.
- Unidades com nome e fuso IANA configuráveis; BRL e pt-BR fixos nesta fase.
- Proprietário, gerente, caixa, atendente, cozinha e entregador; autorização no servidor e unidades explícitas para não proprietários.
- Convites manuais por link aleatório, 48 horas de validade, destinatário e unidades definidos. Só o hash é armazenado. Nenhum e-mail é enviado. Novo convite revoga os anteriores pendentes para destinatário/empresa.
- Gestão de equipe, proteção do último proprietário, revogação efetiva na próxima requisição e auditoria transacional.
- Versões para impedir sobrescrita silenciosa de empresa, unidade ou vínculo por duas sessões.
- Interface responsiva com estados de erro/carregamento/sucesso. Cozinha e entregadores não recebem equipe, convites ou auditoria.
- Liveness /api/health separado de readiness /api/ready (conexão e existência da tabela de sessões).

Recuperação de senha, verificação de e-mail e envio automático de convites **não configurados/não implementados**: exigem adaptador e processamento confiável com testes antes de habilitar. A UI informa esse limite. Cadastro não comprova posse da caixa postal; o convite exige simultaneamente login com o e-mail designado e posse do link.

## Verificação

```powershell
npm.cmd run check
npm.cmd run test:setup
npm.cmd run test:integration
npm.cmd run test:e2e
```

check executa lint, tipos, testes unitários e build. test:setup cria o banco local **morethis_test** sem apagar um banco existente, aplica migrações e grava .env.test. Recusa bancos remotos. test:integration usa PostgreSQL real. test:e2e usa o build existente na porta 3100; no Windows usa Edge headless instalado. Em Linux/CI: instale Chromium com `npx playwright install --with-deps chromium`.

Resultados: 4 testes unitários, 16 de integração e um cenário completo de navegador passaram. O cenário verifica cadastro, empresa, convite, isolamento de cozinha, CSRF, senha errada, login/logout, cookie HttpOnly, expiração e rate limiting. Aguarde um minuto antes de reexecutar imediatamente a suíte que testou bloqueio de autenticação. Capturas fictícias ficam em test-results/, ignorado pelo Git. CI configurada; execução remota depende de conectar o repositório.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| src/app | Páginas, interface e adaptadores HTTP |
| src/lib/permissions.ts | Matriz de permissões |
| src/lib/workspace-schema.ts | Validação de comandos |
| src/server/auth.ts e session.ts | Better Auth e identidade verificada |
| src/server/access.ts | Autorização por empresa/unidade |
| src/server/workspace.ts | Regras, transações, persistência e auditoria |
| db/migrations | SQL com checksum e lock |
| tests e e2e | Testes unitários, integração e navegador |

## Persistência e limites

PostgreSQL local na porta **15432**; volume morethis_postgres_data. `npm run db:down` preserva o volume. Não altere migrações aplicadas. A 001 foi preservada; a 002 adiciona autenticação/unidades/acessos. Organizações legadas recebem uma unidade principal e membros existentes recebem acesso a ela. Papéis admin/member permanecem reconhecidos, sem promoção automática a proprietário.

Identidades Better Auth vinculam-se por `better-auth:<id>`, jamais por mera coincidência de e-mail com usuários legados. Migração de identidade antiga exige procedimento administrativo verificado; conflitos não concedem acesso automaticamente.

Não há operação offline. Se a conexão cair durante uma mutação, consulte o estado salvo antes de repetir. Empresa/unidade usam identificadores de criação; edições usam versões e retornam 409 quando desatualizadas. Para convite cujo link se perdeu, gere outro: o anterior é revogado.

Veja [plano e checklist](docs/implementation-plan.md), [arquitetura](docs/architecture.md), [backup e restauração](docs/operations.md) e [retomada](docs/roadmap.md). requirements.txt original preservado; não participa da aplicação TypeScript.

Referências consultadas: [Better Auth + Next.js](https://better-auth.com/docs/integrations/next), [schema](https://better-auth.com/docs/concepts/database), [rate limiting](https://better-auth.com/docs/concepts/rate-limit). Guias da versão instalada também consultados em node_modules/next/dist/docs.
