# Ritmo de vendas: caixa de seleção de lote e aviso de período

## Respostas aos pontos em aberto

1. **Pré-venda e Lote 0:** não existe duplicidade. Consultei o cadastro de lotes do CUPOLA Summit 2027:
  - não há nenhum registro chamado Pré-venda;
  - o Lote 0 vai de 03/11/2026 a 08/11/2026;
  - o Lote 1 vai de 09/11/2026 a 25/11/2026;
  - do Lote 2 ao Lote 8, os períodos vêm em sequência.
   Nenhuma faixa de datas se sobrepõe a outra. Se um dia houver dois lotes com a mesma faixa de datas, ou com datas sobrepostas, a lista mostra só o primeiro.
2. **Ritmo necessário e velocímetro:** continuam no escopo, exatamente como no plano anterior, que já está na prévia. O ritmo necessário é calculado por seleção: no lote, o que falta da meta do lote ÷ dias úteis que restam no lote; no Evento todo, a meta do evento. O velocímetro e o selo "Acima/Abaixo do ritmo" também respondem à seleção. Quando escrevi que "o cálculo fica igual", quis dizer igual ao plano anterior. Nada disso muda agora.
3. **Comparação com o evento anterior:** continua visível só no Evento todo. A conta já recebe qualquer recorte por datas de calendário (início e fim), então dá para usar o mesmo período do ano anterior num ajuste futuro, que não entra agora.

## O que muda

1. As abas de lote viram uma **caixa suspensa**, no mesmo modelo do card "Ingressos emitidos".
2. A lista segue a **ordem cronológica**, da Pré-venda (quando estiver cadastrada) até o lote mais recente, com **Evento todo** por último.
3. O card abre sempre no lote vigente.
4. Lotes que ainda não começaram ficam fora da lista e entram sozinhos no dia de início.
5. O card mostra o selo **"Evento inteiro"** quando houver um período escolhido no topo da página. O card não segue esse filtro, igual aos cards "Ingressos pagantes" e "Lote vigente".
6. A chave passa a se chamar **"Consolidado até hoje | Lote inteiro"**; no Evento todo, **"Consolidado até hoje | Período inteiro"**. A linha "Medindo: …" e a explicação da conta continuam.

Escopo fechado: nenhum outro card muda, e o banco, a regra de dias úteis e a contagem de pagantes ficam como estão.

## Detalhes técnicos

- `lotesDoRitmo()` em `src/lib/batchPace.ts`: ordem cronológica (ordem do cadastro e depois data de início). Descarta lotes futuros e também lotes cujas datas se sobrepõem às de um lote já listado. Os testes cobrem a ordem e a sobreposição.
- `PaceGauge.tsx`: a lista de lotes vira `Select` (Evento todo por último), entram os novos rótulos da chave e a prop `filtrado` para o selo. `CommercialOverview.tsx` passa a enviar `filtrado`.  
Respostas aceitas nos três pontos. Pode implementar o que está no plano,
  com uma verificação adicional antes de concluir.
  Verificação de vendas fora de qualquer lote
  O cadastro começa em Lote 0 no dia 03/11/2026. Verifique se existem vendas
  pagas com data anterior a 03/11/2026, somando Sympla aprovados e faturados.
  A pré-venda do evento de 2027 aconteceu em maio de 2026, em uma ação com
  cupom, e é tratada internamente como lote zero, mas o cadastro atual não
  cobre esse período.
  Me responda:
  1. Quantas vendas pagas existem com data anterior a 03/11/2026 e qual a data
     mais antiga.
  2. Como a função trata hoje uma venda cuja data não cai em nenhuma faixa de
     lote cadastrada, tanto na seleção por lote quanto no Evento todo.
  Regra a aplicar
  Nenhuma venda paga pode ser descartada do Evento todo por não pertencer a um
  lote cadastrado. Se a lógica atual descarta, corrija para que o Evento todo
  sempre use todas as vendas pagas do evento.
  Não crie nenhum lote novo e não altere o cadastro. Se existirem vendas
  anteriores ao Lote 0, apenas reporte para mim e siga com o restante da
  implementação. O cadastro da pré-venda será decidido fora desta tarefa.
  Demais itens do plano estão aprovados. Implemente.