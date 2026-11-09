# Vendas por canal com metas (aba Comercial)

## O que muda para quem usa
O card "Vendas por canal" da aba Comercial passa a comparar as vendas de cada canal com a meta do planejamento.

- **Seletor de lote** no topo do card: Lote 0, Lote 1 e Evento todo. Abre no lote vigente. As datas de cada lote vêm da configuração de lotes, não do código.
- **Leitura rápida:** um resumo no topo, por exemplo "3 de 8 canais bateram a meta". Cada canal recebe um selo verde (bateu a meta) ou âmbar (ainda não).
- **Cada canal mostra:** vendidos, meta, % da meta e quanto falta, com uma barra de progresso até a meta. O lápis abre a meta daquele canal e lote já preenchida.
- **Canal sem meta no lote:** mostra só os vendidos, sem percentual.
- **"Sem canal identificado":** fica no fim, mostra só a quantidade e não entra nas metas.
- **Aba "Tabela"** com os mesmos números (Canal · Vendidos · Meta · % · Falta), para consulta precisa.
- **Texto explicativo sempre visível** abaixo do card, com as regras de atribuição.

**Canais fixos, nesta ordem:** BDR, Anúncios (Meta e Google), Equipe CUPOLA, Imobi Report, E-mail marketing, Patrocinadores, Instagram Rodrigo e Redes sociais (Instagram, WhatsApp, LinkedIn). As linhas "Cancelados", "Leticia10" e "Sem link" deixam de existir. Vendas canceladas não contam em nenhum canal. O canal mobile não será criado.

## Regras de atribuição (na ordem de prioridade)
1. **Faturado interno:** conta para BDR quando o vendedor é a Letícia Bello e para Equipe CUPOLA nos demais casos.
2. **Sympla com link parametrizado:** o canal sai dos UTMs da integração, mesmo quando a compra usou cupom.
   - Link com "bdr" → BDR
   - Meta, Facebook, Google ou Ads → Anúncios
   - Imobi Report → Imobi Report
   - RD Station ou e-mail → E-mail marketing
   - Patrocinador → Patrocinadores
   - Instagram do Rodrigo → Instagram Rodrigo
   - Instagram, WhatsApp ou LinkedIn → Redes sociais
   - "timecupola" → Equipe CUPOLA
3. **Sem link, ou link que não identifica canal:** o cupom decide.
   - Qualquer cupom da Letícia Bello (LETICIAC5, LETICIA10, LETICIA15 e variações) → BDR. O LETICIAA5 é de outra Letícia e não entra aqui.
   - Cupom nominal da equipe, cadastrado em Configurações › Cupons e vendedores → Equipe CUPOLA.
4. **Nenhum dos casos acima** → Sem canal identificado.

## Consistência e desempenho
- O card respeita o período escolhido no topo e o lote selecionado.
- A soma dos canais, incluindo "Sem canal identificado", bate com o total de pagantes dos outros cards no mesmo período e lote.
- O card usa os dados de vendas que o painel já carrega, sem nenhuma consulta nova. Se ainda estiver lento, ele passa a carregar sozinho, com um esqueleto de carregamento, sem segurar o restante da tela.

## Metas
- O card usa as metas por canal e lote que já existem no painel de metas. Nenhum valor existente será alterado.
- A lista de canais sugeridos no formulário de metas passa a usar os mesmos nomes de canal do card.
- Antes de implementar, vou conferir se os nomes de canal nas metas já salvas batem com os novos nomes. Se não baterem, o card reconhece o nome antigo (por exemplo, "Meta Ads" conta como Anúncios), sem mudar o que está salvo.

## Detalhes técnicos
- `src/lib/salesChannel.ts`: reescrever `canalDe` com a ordem de prioridade acima. A lista fixa `CANAIS` e um mapa de nomes antigos para os novos ficam no mesmo arquivo. Vendas canceladas são removidas antes de agrupar. O cupom da Bello é reconhecido por `personOfCode` (pessoa fora do ranking cadastrada com LETICIA*), excluindo LETICIAA5. O vendedor do faturado é reconhecido por `personBySeller`.
- Lote: usar `batchStarts` e `batchOnDate` de `batches.ts`. O lote padrão vem de `batchSummary`.
- Metas: as metas com `metric_key='channel_sales'` são filtradas por `ticket_type` (lote) e `quota_key` (canal). Em Evento todo, as metas de todos os lotes somam.
- Novo componente `ChannelGoalsCard.tsx`, com as abas "Por canal" e "Tabela", usado no lugar do bloco atual em `CommercialOverview.tsx`. Ele tem seu próprio `Suspense` ou skeleton.
- Atualizar `metricInfo.ts` e a lista de canais sugeridos em `goalMetrics.ts`.
- Testes em `src/lib/salesChannel.test.ts`, um por regra:
  - link bdr com cupom → BDR
  - UTM tem prioridade sobre o cupom
  - LETICIA10 sem link → BDR
  - LETICIAA5 sem link → Equipe CUPOLA
  - faturado da Bello → BDR
  - faturado de outro vendedor → Equipe CUPOLA
  - venda cancelada fica fora de todos os canais
  - a soma dos canais é igual ao total de pagantes
