# Metas por lote: escolher o lote deste evento

## Causa
Em "Ingressos do lote" e "Receita do lote", a lista de opções mostra **nomes de ingressos** lidos de todas as vendas já sincronizadas, dos dois eventos misturados. Essa leitura para nas primeiras 1.000 vendas, e o evento anterior tem milhares. Por isso os ingressos deste evento ("Pré-Venda 2027…", "Lote 0 | …") quase nunca aparecem.

## Correção
- A lista passa a mostrar **lotes**, e não nomes de ingressos: Pré-venda, Lote 0, Lote 1… Lote 8, mais algum lote extra que exista nas vendas deste evento.
- É a mesma lista que "Vendas do canal no lote" já usa.
- Assim a meta encaixa direto no card "Lote vigente" e na aba "Por lote", que já agrupam por lote.
- Metas antigas gravadas com nome de ingresso continuam valendo: o painel já converte o nome para o lote.

## Detalhes técnicos
- `src/components/goals/GoalEditor.tsx`: `opcoesLote` passa a usar `lotesDoCalendario` também no escopo "lote", e não só no "canal".
- `src/hooks/useTicketTypes.ts`: filtrar pelo evento atual (`event_id = sympla_event_id`) para que lotes extras venham só deste evento.
- Conferir no navegador: abrir "Definir" em "Ingressos do lote", escolher "Lote 0", salvar e ver a meta no card "Lote vigente".
