# Rever o card "Ingressos emitidos" e trazer "Vendas por lote" para dentro dele

## O que muda para quem usa

Um único card, **Ingressos emitidos**, com três abas:

```text
[ Por categoria ]  [ Por tipo de ingresso ]  [ Por lote ]
```

- **Por categoria** e **Por tipo de ingresso**: rosca + legenda (como hoje, só que corrigida).
- **Por lote**: as barras que hoje ficam no card "Vendas por lote" no fim da página (pagantes, meta do lote, comparação com 2026). O card separado sai do fim da página.

## Nova lógica das categorias

Hoje a regra olha primeiro o preço: qualquer ingresso com valor acima de zero vira "Pagos na Sympla". Assim, um ingresso de expositor/credencial ou com valor simbólico (abaixo do "Valor mínimo" configurado no painel) entra como pago. A nova ordem de decisão:

```text
1. Não aprovado                                   -> Pendentes
2. Cupom de faturamento                           -> Faturados internamente  (conta na meta)
3. Cupom 100% ou valor abaixo do "Valor mínimo"   -> Cortesias
4. Tipo "Credenciais" (equipe, expositor, imprensa) -> Credenciais / bonificados
5. Valor pago, sem cupom                          -> Pagos na Sympla        (conta na meta)
6. Valor pago, com cupom de desconto              -> Pagos com desconto     (conta na meta)
7. Valor zero, sem cupom                          -> Gratuitos sem cupom
```

- A legenda separa em dois grupos com subtotal: **Contam na meta** (pagos, pagos com desconto, faturados) e **Não contam** (cortesias, credenciais, gratuitos, pendentes).
- O número do centro passa a ser o total emitido, e o subtotal "contam na meta" fica na legenda, batendo com o card "Meta de ingressos pagantes".
- Os dados de hoje (14 pagos, 4 cortesias de resgate GANHADOR) seguem iguais; a mudança protege contra os casos futuros.

## Correções visuais

- Texto do centro ("ingressos emitidos") menor (10–11px), quebrando em duas linhas dentro do furo, sem vazar.
- Rosca com tamanho fixo menor no celular, e legenda embaixo da rosca em telas estreitas (hoje os números "77,8%" são cortados na borda).
- Sem caixinha flutuante e sem animação repetida (já feito).
- Abas com rolagem horizontal se não couberem.

## Botão "i"

Texto revisado para explicar as três abas e a regra das categorias acima, incluindo que valores abaixo do "Valor mínimo" contam como cortesia.

## Detalhes técnicos

- `IssuedTicketsCard.tsx`: nova função `porCategoria` com a ordem acima; usa `parseCoupon().kind`, `ticketKind() === "Credenciais"` e o valor mínimo já usado no painel; legenda agrupada; terceira aba renderiza o conteúdo de lote.
- Extrair o corpo de `SalesSection` para `LotBreakdown` (sem Card) e usá-lo na aba; remover o card avulso de onde é montado. `CommercialOverview` passa `goals`, `allTimeTickets` e `previousYearTickets` ao card.
- `metricInfo.ts`: atualizar "Ingressos emitidos" e "Composição".
- Teste pequeno para a classificação (cupom 100%, faturado, credencial, valor abaixo do mínimo, desconto).
