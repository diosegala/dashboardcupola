
# Adicionar filtro de campanhas de e-mail (RD Station)

## O que sera feito

Reutilizar o componente `CampaignFilter` ja existente para permitir filtrar campanhas de e-mail do RD Station, exatamente como ja funciona para o Meta Ads. O filtro ficara ao lado do titulo "RD Station".

## Alteracoes

### 1. `src/components/dashboard/MarketingSection.tsx`

- Adicionar um novo estado `selectedEmailCampaigns` (array de `rd_campaign_id`).
- Extrair a lista de campanhas de e-mail unicas a partir de `emailCampaigns` (mapeando `rd_campaign_id` como `campaign_id` e `name` como `campaign_name`).
- Criar um `filteredEmailCampaigns` com `useMemo`: se nenhuma campanha estiver selecionada, mostrar todas; caso contrario, filtrar por `rd_campaign_id`.
- Recalcular `emailTotals` usando `filteredEmailCampaigns` em vez de `emailCampaigns`.
- Adicionar um segundo `CampaignFilter` ao lado do titulo "RD Station", passando as campanhas de e-mail e o estado de selecao.
- Mover o layout da secao RD Station para ter um header com `<h3>` + `<CampaignFilter>` lado a lado (mesmo padrao flexbox usado no Meta Ads no topo).

### Nenhuma alteracao de banco ou edge function necessaria

O componente `CampaignFilter` ja e generico o suficiente -- aceita `campaign_id` e `campaign_name`, entao basta mapear os campos do RD Station para essa interface.
