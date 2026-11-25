# Ritmo de vendas: caixa de seleção de lote e aviso de período

## Respostas às dúvidas

**Como fica a lógica por data?** Cada venda entra no lote pela data em que foi feita (horário de Brasília), comparada com as datas de início e fim cadastradas em Configurações › Lotes. Um lote só aparece na lista a partir do dia de início. Ele fica no topo enquanto estiver vigente. Depois que termina, passa para baixo do lote seguinte.

**O filtro de período do topo da página muda este card?** Hoje não muda. O card sempre usa todas as vendas do evento, como os cards "Ingressos pagantes" e "Lote vigente". Isso acontece porque um lote já tem as próprias datas, e cruzar as duas coisas daria números confusos (por exemplo, meio lote). Você tem razão: falta avisar. O card vai mostrar o selo **"Evento inteiro"**, igual aos outros cards que não seguem o período, sempre que um período estiver escolhido.

**"Até hoje" não deveria ser o consolidado?** Já é: soma todas as vendas do lote, do primeiro dia dele até hoje, e divide pelos dias úteis já passados nesse intervalo. O **"Total"** é que divide pelos dias úteis do lote inteiro, contando os que ainda não chegaram. Por isso ele sai mais baixo enquanto o lote está aberto. Num lote encerrado, os dois dão o mesmo número. Para deixar isso claro, a chave passa a se chamar **"Consolidado até hoje | Lote inteiro"** ("Período inteiro" no Evento todo).

## O que muda

1. As abas de lote viram uma **caixa suspensa** (o mesmo modelo usado no card "Ingressos emitidos").
2. Ordem da lista: **lote vigente primeiro**, depois os encerrados do mais recente para o mais antigo, e **Evento todo** por último.
3. O card abre sempre no lote vigente.
4. Lotes que ainda não começaram continuam fora da lista e entram sozinhos no dia de início.
5. Selo "Evento inteiro" no card quando houver período escolhido no topo da página.
6. Novos nomes da chave, como descrito acima. A linha "Medindo: …" e a explicação da conta continuam.

Fica igual: cálculo, metas, regra de dias úteis e contagem de pagantes. Nenhum outro card muda e o banco não é alterado.

## Detalhes técnicos

- `lotesDoRitmo()` em `src/lib/batchPace.ts` passa a devolver a ordem: vigente, encerrados por `start_date` decrescente. Teste em `batchPace.test.ts` cobre essa ordem.
- `PaceGauge.tsx`: troca a lista de lote por `Select` (Evento todo como último item) e ganha a prop `filtrado` para o selo. `CommercialOverview.tsx` passa `filtrado`.
