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
