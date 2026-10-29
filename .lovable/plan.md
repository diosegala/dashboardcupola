# Página "Cupons" (visão gerencial e de admin)

## O que muda para quem usa

Um novo item **Cupons** no menu lateral, visível para admins e viewers, mas não para a equipe de vendas. O box "Cupons" do fim do Dashboard sai e vai para essa página, que fica organizada de cima para baixo:

```text
[ Cupons gratuitos ]  [ Descontos concedidos (R$) ]  [ Cupons usados ]  [ Ingressos com cupom ]
-------------------------------------------------------------------------------------------
Ranking da equipe por lote      |  Histórico de ganhadores (ranqueado)
-------------------------------------------------------------------------------------------
Ranking de todos os cupons (tabela com filtro por grupo e busca)
```

1. **Indicadores no topo**
   - **Cupons gratuitos**: quantidade de ingressos emitidos com cupom de 100% (resgate, palestrantes, parceiros etc.).
   - **Descontos concedidos**: soma em reais do desconto dado pelos cupons **menores que 100%**. Os de 100% ficam de fora dessa conta.
   - **Cupons usados**: quantos códigos diferentes foram usados.
   - **Ingressos com cupom**: quantos ingressos usaram algum cupom.
2. **Ranking da equipe**: a mesma lógica da visão da equipe (vendas pagantes por cupom da equipe, que recomeça a cada lote, com navegação entre lotes), mas mostrando **quantidade e receita** de cada pessoa, sem o destaque "Você".
3. **Histórico de ganhadores**: o 1º lugar de cada lote encerrado, mais um ranking geral de quem venceu mais lotes, com 1º, 2º e 3º colocados de cada lote.
4. **Ranking de todos os cupons**: tabela ordenada por usos com as colunas cupom, grupo, desconto, tipo, usos, receita gerada e desconto em R$. Tem filtro por grupo (Todos, Equipe, Resgate, Palestrantes, Parceiros, Faturados) e busca por código.

Cada bloco tem o botão "i" explicando a lógica (veja abaixo). Assim como o resto do painel, tudo respeita o evento selecionado e o filtro de "Valor mínimo".

## Textos dos "i"

- **Cupons gratuitos**: ingressos aprovados com cupom de 100% de desconto. Não contam na meta de pagantes.
- **Descontos concedidos**: diferença entre o preço cheio e o valor pago, somada só nos cupons com desconto parcial (menor que 100%). Em cupom percentual, o preço cheio é calculado a partir do valor pago (valor pago ÷ (1 − desconto)). Em cupom de valor fixo, soma-se o valor do cupom por ingresso.
- **Ranking da equipe**: vendas pagantes feitas com o cupom de cada pessoa da equipe (nome + 5). Recomeça a cada lote, e o lote atual é o da venda mais recente. Empates ficam na mesma posição.
- **Histórico de ganhadores**: quem liderou cada lote já encerrado. Em caso de empate, todos os empatados contam como vencedores.
- **Ranking de cupons**: todos os cupons usados no evento, do mais usado para o menos usado, com o grupo identificado pelo código.

## Detalhes técnicos

- Nova rota `/cupons` com a página `src/pages/Coupons.tsx` e o item no `AppSidebar` (publicItems, ícone `Ticket`). Na página, a equipe de vendas é redirecionada para `/`.
- Dados: `useAllTimeTicketSales(event.sympla_event_id)` + `splitTickets`, como no SellerHome.
- `buildTeamRanking` passa a guardar também a `receita` por pessoa e o top 3 de cada lote. `TeamRanking` ganha a prop `gerencial`, que mostra a receita e esconde o "Você".
- A tabela de cupons sai de `CommercialSegments` e vai para `CouponsTable` (adicionando receita, desconto em R$ e busca). O TeamRanking também sai do Dashboard e fica só na página Cupons.
- Nova função `couponDiscountValue(ticket)` em `src/lib/coupons.ts`, com teste: 10% sobre R$ 900 pagos dá R$ 100; cupom "R$ 944.55" por 2 ingressos dá R$ 1.889,10; cupom de 100% dá 0.
- Textos novos em `metricInfo.ts`.
