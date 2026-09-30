# Arquitetura e regras de acesso

Monólito modular. Interface em Client/Server Components, adaptadores HTTP em Route Handlers, regras e persistência server-only. PostgreSQL é fonte de verdade. Cada rota privada verifica a sessão no banco via Better Auth; presença de cookie não basta.

Better Auth mantém senhas/sessões; não criamos criptografia de senha ou protocolo de sessão. Sessões de 12 horas, renovação por atividade e cache de cookies desativado. Rate limiting persiste no banco e funciona em desenvolvimento. Em produção, proxy confiável deve sobrescrever cabeçalhos de IP encaminhado; usar TLS e origem canônica.

O adaptador /api/workspace valida origem exata nas mutações, sessão, JSON, limite real de 16 KiB e schema Zod. Não usa identidade/papel do cliente. Métodos internos recebem Actor da sessão verificada; testes injetam atores isolados. Respostas privadas usam no-store.

## Permissões

| Perfil | Acesso entregue | Capacidades previstas na matriz, ainda sem módulo |
| --- | --- | --- |
| Proprietário | Todas as unidades, empresa/equipe/convites/auditoria | Todas |
| Gerente | Edita unidades atribuídas, lê auditoria dessas unidades | Pedidos, descontos, pagamentos, caixa, cozinha, entrega |
| Caixa | Unidades atribuídas | Pedidos, pagamentos, caixa |
| Atendente | Unidades atribuídas | Criar pedidos |
| Cozinha | Unidades atribuídas, sem equipe/auditoria | Produção |
| Entregador | Unidades atribuídas, sem equipe/auditoria | Entregas; futuro filtro por entregador obrigatório |

Só proprietários gerenciam equipe. Gerentes não promovem membros nem concedem unidades. Papéis legados mantêm compatibilidade com a 001/helper original, sem ganhar administração nova. Títulos de entrada variam por perfil; PDV/KDS ainda não existem para redirecionamento operacional.

## Isolamento e concorrência

Unidades, vínculos, convites e auditoria possuem escopo explícito. unit_access/invitation_units têm FKs compostas com organização. Todas as referências são validadas no servidor. Leitura usa snapshot consistente; revogação aparece na próxima requisição.

Mutações travam a linha da organização antes de verificar acesso. Isso serializa alterações de papéis/unidades/convites e protege o último proprietário. Versão desatualizada de empresa/unidade/vínculo resulta em 409. Onboarding trava o ator e usa chave única + hash de parâmetros; empresa, unidade e proprietário nascem na mesma transação. Unidade tem ID de criação para retentativas. Não há remoção de empresa/unidade exposta.

SQL parametrizado, sem RLS nesta fase. Novas tabelas exigem organization_id, unit_id quando aplicável, FKs compostas, índices e testes de escopo. Não expor helpers de baixo nível a clientes.

## Convites e e-mail

Token de 32 bytes aleatórios, hash SHA-256, expiração 48h. Token bruto retornado uma vez, fora de logs/auditoria. Link usa fragmento; cliente guarda temporariamente em sessionStorage e remove da barra até o aceite. Não há mensagens externas.

Aceite exige sessão com e-mail correspondente, token, prazo e não revogação. Não altera membro preexistente. Repetição não duplica vínculo/auditoria; convite consumido não recria membro removido. Novo convite revoga pendentes anteriores para destinatário/empresa.

Recuperação/verificação e envio automático dependem de adaptador, outbox, retentativas e testes com servidor local de e-mail. Ainda não implementados. Não há provedor, fila ou entrega simulada.

## Auditoria e limites

Eventos de criação/edição de empresa/unidade, convite e alterações de vínculo são gravados com ator, ação, escopo, data e detalhes na mesma transação, sem senha/token/e-mail de convite. Não há API para editá-los. O banco local tem privilégios amplos; produção exige separar papéis e retenção para proteger alterações diretas. Auditoria de login, MFA e gestão visual de dispositivos ainda não implementados.

Identidade global de negócio vincula-se pelo assunto do provedor. Nunca adotar usuário legado por e-mail sem verificação administrativa. Não há pedidos, estoque ou indicadores fictícios.
