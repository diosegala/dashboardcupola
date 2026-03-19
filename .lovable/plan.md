

# Adicionar métrica de Investimento (Spend) do Meta Ads

## O que muda

Adicionar um novo `MetricCard` de "Investimento" na seção Meta Ads do dashboard, formatado em R$, com suporte a meta (goal). Como os dados já são filtrados por campanha via `CampaignFilter`, o valor já refletirá a seleção de campanhas automaticamente.

## Implementação — `src/components/dashboard/MarketingSection.tsx`

1. Na grid de MetricCards do Meta Ads (linha ~162), adicionar um novo card entre "Campanhas" e "Impressões":

```tsx
<MetricCard
  title="Investimento"
  value={`R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
  icon={Wallet}
  goal={findGoal(goals, "meta_spend", range)?.target_value}
  description="Total investido no período"
/>
```

`totalSpend` já é calculado na linha 151 (`sum(meta, "spend")`), e já respeita o filtro de campanhas. Nenhuma lógica nova é necessária — apenas o card.

## Resultado

- O card aparece na seção Meta Ads com valor em R$ (ex: `R$ 1.234,56`)
- Filtrando por campanha, o valor muda automaticamente
- Se uma meta `meta_spend` for configurada na página de Metas, a barra de progresso aparece

