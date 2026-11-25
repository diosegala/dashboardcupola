# Ritmo de vendas por lote

## O que muda no card "Ritmo de vendas"

1. **Seletor de lote** no topo do card, igual ao do card "Ingressos emitidos": Pré-venda, Lote 0, Lote 1, Lote 2... (os lotes cadastrados em Configurações › Lotes) e **Evento todo**.
2. **Abre no lote vigente** (mesma regra do card "Lote vigente", pelas datas em horário de Brasília). A escolha vale só enquanto a tela está aberta; ao voltar, abre de novo no lote vigente. Se faltar data em algum lote, abre em "Evento todo" e mostra o aviso que já existe.
3. **Chave "Até hoje | Total"** ao lado do seletor, começando em **Até hoje**:
  - **Até hoje**: pagantes vendidos na seleção ÷ dias úteis já passados da seleção (do início até hoje).
  - **Total**: pagantes vendidos na seleção ÷ todos os dias úteis da seleção (do início ao fim do lote; no Evento todo, do início das vendas até a véspera do evento).
  - Lote já encerrado: as duas visões dão o mesmo número (todo o período já passou). Lote que ainda não começou: mostra "Lote ainda não começou", sem número.
4. **Cálculo respeita a seleção**:
  - Lote escolhido: usa só as vendas cuja data caiu dentro das datas daquele lote e só os dias desse lote.
  - Evento todo: usa o período completo.
  - **Ritmo necessário**: no lote, (meta do lote − pagantes do lote) ÷ dias úteis que faltam no lote; no Evento todo, continua como hoje (meta do evento). Sem meta, mostra só o ritmo.
  - O velocímetro, a cor (verde/amarelo) e o selo "Acima/Abaixo do ritmo" passam a comparar o ritmo da seleção com o necessário da seleção.
  - A comparação com o evento anterior aparece só no "Evento todo" (os lotes do ano passado não têm as mesmas datas).
5. O texto pequeno embaixo dos números diz de onde vem a conta, por exemplo "38 pagantes ÷ 12 dias úteis do Lote 1 até hoje". A dica "i" é atualizada explicando lote, "Até hoje" e "Total".

O que **não** muda: pagantes contam só pagos (Sympla aprovados + faturados), dias úteis seguem a mesma regra de hoje, nenhum outro card é alterado, sem mudança no banco.

## Detalhes técnicos

- Nova função pura `ritmoDaSelecao()` em `src/lib/batchPace.ts` (entrada: vendas pagas, lotes de `batchCalendar()`, metas, seleção, visão, hoje) devolvendo ritmo, dias usados, pagantes, necessário, faltam e situação. Lote de cada venda via `loteNaData(sold_at)`; dias úteis via `businessDaysBetween`.
- Testes em `src/lib/batchPace.test.ts`: só vendas do lote entram; "Até hoje" divide por dias decorridos e "Total" por todos os dias do lote; lote encerrado dá o mesmo valor nas duas; lote futuro sem número; necessário do lote = faltam ÷ dias restantes.
- `PaceGauge.tsx` ganha o `Select` (reaproveitando `LOTE_EVENTO`) e um seletor de dois botões; `CommercialOverview.tsx` passa vendas, metas e lote vigente e deixa de montar `loteRitmo` à parte.
- Textos da dica em `src/lib/metricInfo.ts`.  
  
Plano aprovado com os ajustes abaixo. Não implemente nada além do que está aqui.
  1. Formato do seletor
  Use o mesmo componente visual do card de lote que já existe no dashboard.
  Se esse card usa abas horizontais, use abas horizontais no Ritmo de vendas
  também. Não troque por dropdown. O pedido original foi replicar a mesma
  navegação por lote que já existe.
  2. Pré-venda e Lote 0
  Antes de criar as duas opções, verifique no cadastro de lotes se Pré-venda
  e Lote 0 são registros distintos. Se forem o mesmo período com nomes
  diferentes, exiba apenas uma opção. Não duplique a mesma faixa de datas em
  duas abas.
  3. Visão padrão
  Mantenha "Até hoje" como padrão, conforme você propôs. Confirmado.
  4. Comparação com o evento anterior
  Mantenha a comparação visível apenas no Evento todo por enquanto, como você
  propôs, mas deixe a função preparada para receber um recorte por datas de
  calendário no futuro. O critério de comparação do dashboard é mesmo período
  do ano anterior e não lote contra lote, então essa comparação será revista
  em um ajuste seguinte. Não implemente essa revisão agora.
  5. Ritmo necessário e velocímetro
  Mantenha o cálculo de ritmo necessário por seleção e o velocímetro
  respondendo à seleção, como você propôs. Isso não constava no pedido
  original, então ao finalizar deixe explícito na interface qual seleção está
  sendo medida, para evitar leitura errada do selo de acima ou abaixo do
  ritmo.
  6. Texto de apoio
  Mantenha a linha explicando a conta, no formato que você propôs. Ela resolve
  o risco de leitura ambígua entre as duas visões.
  7. Escopo fechado
  Não altere outros cards, não altere o banco e não mude a regra de dias úteis
  nem a regra de contagem de pagantes.