

# Seção de Funil KPIs no Dashboard

## Contexto

O diretor de marketing quer uma visão de funil (TOFU → MOFU → BOFU) com metas e realizados, como na planilha da imagem. A visualização ficará no topo do dashboard, antes da seção de Vendas.

## Mapeamento de métricas

| Etapa | Objetivo | Fonte do dado | Status |
|-------|----------|---------------|--------|
| TOFU | Engajamento | Meta Ads `post_engagement` action | **Novo** — precisa capturar |
| MOFU | Carrinho Mídia | Meta Ads `add_to_cart` | Já existe |
| MOFU | G.D Email | RD Station `total_clicked` | Já existe |
| MOFU | G.D Mídia | Meta Ads `link_clicks` | Já existe |
| BOFU | Leadster/Mensagens | Meta `messages` + Leadster API | Leadster = **futuro** |
| BOFU | Todas Vendas | Sympla `ticket_sales` | Já existe |
| BOFU | Receita | Sympla `total_price` | Já existe |

## Implementação

### 1. Migration: adicionar coluna `post_engagement` em `ad_metrics`

```sql
ALTER TABLE ad_metrics ADD COLUMN IF NOT EXISTS post_engagement integer DEFAULT 0;
```

### 2. Edge Function `sync-meta/index.ts`

Capturar `post_engagement` do array `actions`:

```typescript
const postEngagement = findAction(actions, "post_engagement");
// adicionar ao objeto mapeado:
post_engagement: postEngagement,
```

### 3. Novas metric_keys em `goalMetrics.ts`

Adicionar keys para o funil para que possam ser usadas na página de Metas:

```
funnel_tofu_engagement, funnel_mofu_cart, funnel_mofu_gd_email,
funnel_mofu_gd_midia, funnel_bofu_messages, funnel_bofu_sales, funnel_bofu_revenue
```

### 4. Componente `FunnelKPISection.tsx`

Tabela estilizada com colunas: **Etapa | Objetivo | Meta | Realizado | %**

- Cada linha busca a meta via `findGoal(goals, metricKey, range)` e calcula o realizado a partir dos dados já disponíveis no dashboard
- Barra de progresso visual na coluna %
- Badges coloridas para TOFU (azul), MOFU (amarelo), BOFU (verde)
- Linha de Leadster mostrará apenas `messages` do Meta por enquanto, com nota "(sem Leadster)"

### 5. `Index.tsx` — adicionar a seção

Inserir `<FunnelKPISection>` entre o título/seletor de período e a seção de Vendas, passando `adMetrics`, `emailCampaigns`, `tickets`, `goals` e `range`.

## Sobre o Leadster

Para integrar o Leadster via API, precisarei do token de API e da documentação/endpoint que vocês usam. Posso fazer isso como um próximo passo após essa primeira entrega.

## Sobre "G.D email" e "G.D mídia"

Preciso confirmar: **G.D email** seria o total de **cliques únicos** nas campanhas do RD Station, e **G.D mídia** seria o total de **cliques no link** do Meta Ads? Se forem outras métricas, me avise antes da implementação.

