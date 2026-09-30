# Próxima entrega utilizável

Retomada: **etapa 2 — cardápio e pedido manual → cozinha → pagamento → fechamento**. Começar pela migração 003, usando identidade e autorização existentes. Nenhuma tabela desse domínio existe ainda.

1. Modelar categorias, produtos/variações, opções/combos e preços por canal. Valores em centavos, quantidades com precisão definida e FKs por empresa/unidade.
2. Validar no servidor opções, disponibilidade, descontos e preço. Não aceitar totais do navegador.
3. Pedido e itens com snapshots, chave de idempotência, versão e estados independentes de pedido/produção/pagamento/entrega.
4. PDV com busca e carrinho persistido; KDS com atualização automática, indicador de conexão e recuperação de snapshot.
5. Caixa: abertura, movimentos, pagamentos manuais divididos e fechamento, com auditoria e transações.
6. Teste completo caixa/cozinha, repetição, cancelamento e fechamento. Só depois marcar etapa 2 concluída e iniciar estoque.

E-mail: implementar adaptador oficial + outbox e recuperação/verificação quando houver provedor escolhido. Testar localmente antes de qualquer envio autorizado.

Etapas 3–8 no [plano](implementation-plan.md). Suitable permanece referência de abrangência solicitada; não houve comparação funcional ou alegação de exclusividade.
