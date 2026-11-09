# Tabela "Meta e falta" sem cortar colunas

## Problema

No card Cotas vendidas, a aba "Meta e falta" corta as colunas "% da meta" e "Falta". A tabela tem largura mínima maior que o card ao lado do resumo por responsável, então a parte da direita some.

## O que muda (só visual, sem mudar números nem regras)

- A tabela passa a caber na largura do card, sem largura mínima fixa.
- O cabeçalho fica mais curto: Cota · Meta · Vendidas · % · Falta.
- A nota "+N em negociação" desce para uma linha própria, menor, abaixo do nome da cota. Assim a coluna Vendidas fica estreita.
- O espaçamento entre colunas diminui. O nome da cota pode quebrar linha em vez de empurrar as outras colunas.
- No topo do card, "em negociação" e "2026 na mesma data" deixam de quebrar no meio ("em / negociação"). O texto não se espreme mais.

## Detalhes técnicos

- `SponsorQuotasCard.tsx`, aba "meta": remover `min-w-[380px]`, usar `table-fixed` com larguras por coluna, `px-1.5`, `whitespace-nowrap` nos números, e mover "+N em negociação" para a célula da cota.
- Cabeçalho do card: `whitespace-nowrap` no rótulo "em negociação" e `flex-wrap` no bloco de números.
- Nada muda nas abas "Por cota" e "Receita por cota" nem nas barras.

Obs.: a imagem enviada ainda mostra a versão antiga do resumo por responsável. A versão nova (Ranking/Lista) aparece depois de recarregar a página.
