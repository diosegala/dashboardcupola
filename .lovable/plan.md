

# Ajustar cards do RD Station no dashboard

## O que sera feito

1. **Card "Campanhas Enviadas"** — adicionar o total de leads (soma de `total_sent`) como informacao secundaria abaixo do numero de campanhas. Exemplo: "42 campanhas" com descricao "1.250 leads alcancados".

2. **Novo card "Leads Engajados"** — exibir dois numeros no mesmo card: total de leads que abriram (`total_opened`) e total que clicaram (`total_clicked`). Substituir o card atual "Leads (Cliques)".

## Alteracoes

### `src/components/dashboard/MarketingSection.tsx`

- Adicionar `totalSent`, `totalOpened` e `totalClicked` ao objeto `emailTotals` (somas de `total_sent`, `total_opened`, `total_clicked` das campanhas filtradas).
- No card "Campanhas Enviadas": mudar `description` para mostrar o total de leads que receberam (ex: `${emailTotals.totalSent.toLocaleString("pt-BR")} leads alcançados`).
- Substituir o card "Leads (Cliques)" por um card customizado (inline, sem criar componente novo) que mostra dois valores: "Abriram: X" e "Clicaram: Y" dentro do mesmo `<Card>`, mantendo o mesmo estilo visual.
- Remover o card "Taxa de Abertura" e "Taxa de Clique" separados? **Nao** — manter as taxas como estao e adicionar o card de leads engajados como quinto card, ou substituir "Leads (Cliques)" pelo novo card duplo.

### Layout final dos cards RD Station (4 cards):
1. **Campanhas Enviadas** — valor: numero de campanhas, descricao: "X leads alcançados"
2. **Taxa de Abertura** — sem mudanca
3. **Taxa de Clique** — sem mudanca
4. **Leads Engajados** — card customizado com dois valores: aberturas e cliques

Nenhuma alteracao de banco ou edge function necessaria.

