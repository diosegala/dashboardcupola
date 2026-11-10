# Compradores (visão da equipe): só quem comprou 2027

## O que muda na tela
- A lista passa a mostrar **somente compras de 2027**: Sympla + vendas faturadas internamente (Pipedrive). Nada de 2026 aparece — sai a comparação "Comprou 2027 / Ainda não" e a coluna de cupom de 2026.
- Colunas: **Nome**, **Empresa**, **Ingressos**, **Origem** (Sympla ou Faturado), **Cupom 2027**.
- **Participantes já nominais**: uma linha por pessoa, como hoje (ex.: empresa com vários participantes continua com várias linhas). Coluna Ingressos = 1.
- **Ainda sem nomes**: uma linha só por compra, com o nome de quem comprou, a empresa e a quantidade (ex.: "Viviane Mondardo Pinheiro · Duda Imóveis · 8 ingressos · aguardando nomes"). Quando os nomes forem preenchidos na Sympla, a linha se abre sozinha em uma por pessoa.
- Faturados aparecem pela empresa/contato do negócio ganho, com a quantidade de ingressos do negócio e "aguardando nomes".
- Busca por nome ou empresa e filtros "Todos / Com nomes / Aguardando nomes", com totais de pessoas e ingressos no topo.

## Conferência feita
- Duda Imóveis **já comprou 2027**: 8 ingressos na Sympla em 03/11, pedido no nome de Viviane Mondardo Pinheiro, sem participantes nomeados (a Sympla repete o nome da compradora nos 8). A tela atual tenta achar cada participante de 2026 pelo nome entre as compras de 2027 e, como os nomes não batem, mostrava "Ainda não". Com a nova regra isso deixa de acontecer.
- Hoje há 88 ingressos aprovados de 2027 em 44 pedidos na Sympla; a nova lista deve somar exatamente esse total + os faturados de 2027, o que será conferido no fim.

## Atualização automática
- Sympla e Pipedrive já atualizam sozinhos a cada 15 minutos (o Pipedrive também recebe mudanças na hora). A tela passa a reler os dados a cada poucos minutos, sem precisar recarregar a página.

## Detalhes técnicos
- Nova regra pura `src/lib/currentBuyers.ts` (com testes): recebe as linhas de `get_buyer_rows` do evento atual + ingressos faturados (mesma conversão `invoicedToTickets` usada no Comercial, para os totais baterem) e devolve linhas agrupadas. Pedido "não nominal" = todos os participantes do pedido com o mesmo nome do comprador (ou sem nome) → uma linha com a quantidade; nomes distintos → uma linha por participante.
- `SellerBuyerList.tsx` deixa de ler o evento anterior e o `matchNextEvent`; `staleTime` reduzido e `refetchInterval` de 5 min.
- Testes: Duda (8 ingressos mesmo nome → 1 linha, 8 ingressos), pedido com nomes distintos → N linhas, faturado → 1 linha com a quantidade, total de ingressos = soma das vendas.
- A visão de admin (Compradores completo) não muda.
