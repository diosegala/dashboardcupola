

# Corrigir métricas do RD Station e adicionar Bounce

## Problema

A API do RD Station Analytics (`/platform/analytics/emails`) retorna campos que não estamos capturando:
- `email_delivered_count` — emails efetivamente entregues (o que o relatório da UI do RD chama de "entregues")
- `email_bounced_count` — emails rejeitados
- `email_dropped_count` — emails descartados
- `email_spam_reported_count` — marcados como spam

Atualmente usamos `contacts_count` como `total_sent`, que representa o total de contatos **selecionados** para envio (inclui bounces/drops). Isso explica a diferença nos números.

## Plano

### 1. Migration: adicionar colunas na tabela `email_campaigns`

```sql
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS total_delivered integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bounced integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dropped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_reported integer DEFAULT 0;
```

### 2. Edge Function `sync-rd-station/index.ts`

Atualizar o mapeamento para capturar os novos campos da API:

```typescript
return {
  rd_campaign_id: String(item.campaign_id),
  name: item.campaign_name ?? null,
  sent_at: item.send_at ?? null,
  total_sent: item.contacts_count ?? 0,        // mantém: total selecionados
  total_delivered: item.email_delivered_count ?? 0,  // NOVO
  total_bounced: item.email_bounced_count ?? 0,      // NOVO
  total_dropped: item.email_dropped_count ?? 0,      // NOVO
  total_opened: item.email_opened_count ?? 0,
  total_clicked: item.email_clicked_count ?? 0,
  unsubscribes: item.email_unsubscribed_count ?? 0,
  spam_reported: item.email_spam_reported_count ?? 0,  // NOVO
  open_rate: ...,  // recalcular usando delivered como base
  click_rate: ..., // recalcular usando delivered como base
  synced_at: new Date().toISOString(),
};
```

As taxas (`open_rate`, `click_rate`) passam a usar `total_delivered` como denominador — alinhando com a lógica do relatório do RD Station.

### 3. Dashboard `MarketingSection.tsx`

**Card "Campanhas Enviadas"**: mudar a descrição de "leads alcançados" para mostrar entregues vs enviados:
```
"16.756 entregues de 16.800 enviados"
```

**Novo dado no card "Leads Engajados"**: adicionar linha de Bounced abaixo de Clicaram:
```
Abriram    6.846
Clicaram      18
Bounced       44
```

**Comparador de Campanhas**: adicionar linha de Bounced e usar `total_delivered` nas taxas.

### 4. `emailTotals` — adicionar agregações

```typescript
totalDelivered: sum(filteredEmailCampaigns, "total_delivered"),
totalBounced: sum(filteredEmailCampaigns, "total_bounced"),
```

## Resultado

- Métricas alinhadas com os relatórios do RD Station (usa "entregues" como base)
- Bounce visível no dashboard (card Leads Engajados + comparador)
- `total_sent` preservado para referência (contatos selecionados)

