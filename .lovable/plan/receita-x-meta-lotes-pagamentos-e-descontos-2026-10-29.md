# Receita x meta, lotes, pagamentos e descontos

## 1. Aba Metas — Meta de receita (R$)

- A meta "Receita" (R$, por evento) já existe no catálogo de Metas. Ajustar o texto para "Meta de receita (R$)" e indicar que ela alimenta o card e o novo gráfico.
- Ela passa a ser a única fonte: card e gráfico leem só essa meta.

## 2. Novo gráfico "Receita acumulada x meta"

- Fica logo abaixo de "Pagantes acumulados x meta", com o mesmo visual, legenda e botão "i".
- Eixo X: semanas desde a primeira venda. Eixo Y: R$.
- Linha contínua azul: receita acumulada. Linha âmbar tracejada: trajetória até a meta (mesma lógica de dias úteis do gráfico de pagantes). Linha cinza pontilhada: 2026, só com "Comparar com 2026" ligado.
- Sem meta: só a linha de receita e o aviso "Defina a meta de receita na aba Metas".

## 3. Card "Receita acumulada"

- Mostra a receita realizada, % da meta e "Faltam R$ X" (ou "Meta atingida").
- Mantém ticket médio e a comparação com 2026.

## 4. "Por lote" do card Ingressos emitidos

- Na tabela que já existe, adicionar colunas: Preço, Vendidos, Saldo, % vendido, Receita.
- Preço: o valor de ingresso mais comum vendido naquele lote.
- Saldo e % vendido: calculados sobre a meta "Ingressos do lote" da aba Metas (a Sympla não envia hoje o total de vagas do lote). Sem meta do lote, mostram "—".
- O lote vigente (o que teve a venda mais recente) ganha destaque com fundo suave e um selo "Vigente".

## 5. Pagantes por forma de pagamento

- Cada forma mostra também o valor em R$ ao lado da quantidade e do %.

## 6. Card "Descontos concedidos" (novo cálculo)

- Valor total em cupons + % sobre a receita bruta. s
- Cortesias (cupom 100%) entram pelo preço cheio do lote; cupons parciais entram pela diferença.
- Receita bruta = receita paga + total de descontos.
- Respeita o filtro de datas. O espelho da página Cupons usa o mesmo cálculo, então os dois mudam juntos. Texto do "i" atualizado.  
esse card atualmente é um reflexo do card que ha em cupom. aplique esse novo calculo apenas no comercia, em cupom deve ser a versão simples. 

## Detalhes técnicos

- `useCommercialMetrics.ts`: série semanal de receita (atual, meta, ano anterior), mesmo padrão da série de pagantes; receita por forma de pagamento.
- `CommercialOverview.tsx`: novo gráfico + faltante/% no card.
- `SalesSection.tsx` (aba Por lote): preço modal por lote, saldo via meta `tickets_sold` do lote, destaque do `loteAtual`.
- `CouponKpis.tsx` / `src/lib/coupons.ts`: cortesia valorizada pelo preço modal do lote; % sobre receita bruta; teste atualizado em `couponDiscount.test.ts`.
- `metricInfo.ts` e `goalMetrics.ts`: textos.
- Sem mudanças no banco.