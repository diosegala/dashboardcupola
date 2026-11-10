# Mover "Vendas" de Compradores para Comercial

## O que muda
- **Compradores:** a aba "Vendas" sai. Ficam só "Perfil" e "Pessoas".
- **Comercial:** a lista de vendas entra no fim da página, num card discreto **fechado por padrão** ("Extrato de vendas · N vendas · R$ X"). Clicando, ele abre. Só administradores veem, como hoje.

## Filtros (dentro do card)
- **Origem:** Todas / Sympla / Faturados (já existe)
- **Tipo de ingresso:** lista com os tipos que aparecem nas vendas
- **Lote:** lotes de Configurações › Lotes (só atual e passados)
- **Vendedor / cupom:** lista com os nomes já padronizados (ex.: Kariny, com código no hover)
- **Canal:** os mesmos canais de "Vendas por canal"
- **Busca livre:** nome da empresa, comprador, pedido ou link
- Botão "Limpar filtros" e contagem atualizada: "12 vendas · 30 ingressos · R$ 25.000"

A lista respeita o período e o evento escolhidos no topo do painel. O lote de cada venda passa a seguir as datas de Lotes (hoje usa o nome do ingresso), igual ao card "Lote vigente".

## Detalhes técnicos
- Remover a aba em `Buyers.tsx`; montar `SalesStatement` em `Dashboard.tsx` (aba Comercial) dentro de `Collapsible`.
- Filtros com `Select` compactos; derivar opções das próprias linhas; lote via `batchCalendar`, canal via `salesChannel.ts`, nome via `coupons.ts`.
- Responsivo: filtros quebram em linhas; tabela com rolagem horizontal interna.
