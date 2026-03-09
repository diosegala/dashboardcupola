

# Duas melhorias no Dashboard

## 1. Remover Google Ads do dashboard

O bloco "Google Ads" na `MarketingSection` e a linha "Google Ads" no gráfico `ClicksByDayChart` serão removidos.

**Arquivos:**
- `src/components/dashboard/MarketingSection.tsx` — remover bloco Google Ads (linhas 164-173) e variável `google` (linha 70)
- `src/components/dashboard/charts/ClicksByDayChart.tsx` — remover a linha Google Ads do gráfico, renomear título para "Cliques por Dia (Meta Ads)", remover a separação meta/google no `useMemo`

## 2. Corrigir métricas do Meta Ads (link_clicks, CPC, CTR, purchases)

**Diagnóstico:** Os dados no banco mostram `link_clicks=0`, `ctr=0`, `cpc=0`, `purchases=0` para todos os registros Meta. O log da edge function mostra que o campo `actions` da API Meta está retornando erro transiente ("Service temporarily unavailable"), então o fallback executa sem `actions` e esses campos ficam zerados.

**Solução:** A Meta API oferece campos dedicados que **não dependem** do array `actions`:
- `inline_link_clicks` → cliques no link
- `inline_link_click_ctr` → CTR de link clicks
- `cost_per_inline_link_click` → CPC de link clicks

Esses campos são mais confiáveis que extrair de `actions`. Para `purchases`, manteremos a tentativa via `actions` como bonus, mas os campos inline garantem que link_clicks/CPC/CTR sempre funcionem.

**Arquivo:** `supabase/functions/sync-meta/index.ts`
- Adicionar `inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click` aos campos requisitados (tanto na versão com actions quanto sem)
- No mapeamento (linha 134-159): usar `r.inline_link_clicks` para link_clicks, `r.inline_link_click_ctr` para CTR, `r.cost_per_inline_link_click` para CPC
- Manter `actions` para extrair purchases quando disponível

Após o deploy, será necessário re-sincronizar a integração Meta para popular os dados corretos.

