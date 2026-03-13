

# Solução Definitiva: Sync Meta com Actions dia a dia

## Problema atual

A Meta API falha consistentemente (error 1504044 "Service temporarily unavailable") quando pedimos o campo `actions` com `time_increment=1` + `level=adset` + `date_preset=last_30d` numa única requisição. É muita carga de processamento no lado da Meta. O fallback atual remove `actions` da requisição e grava tudo com zeros.

## Solução

Dividir a requisição em **chamadas individuais por dia** (30 chamadas separadas). Cada chamada cobre 1 dia apenas, com `actions` incluso. Isso reduz drasticamente a carga no servidor da Meta e é o padrão recomendado para contas com muitos adsets.

```text
Antes (1 requisição pesada):
  GET insights?date_preset=last_30d&time_increment=1&fields=...actions...
  → Meta retorna erro 1504044

Depois (30 requisições leves):
  Dia 1: GET insights?time_range={"since":"2026-02-11","until":"2026-02-11"}&fields=...actions...  ✓
  Dia 2: GET insights?time_range={"since":"2026-02-12","until":"2026-02-12"}&fields=...actions...  ✓
  ...
  Dia 30: GET insights?time_range={"since":"2026-03-12","until":"2026-03-12"}&fields=...actions... ✓
```

Se um dia específico falhar, salvamos as métricas básicas daquele dia (sem actions) e tentamos novamente os dias que falharam no final. Os dias que conseguiram actions são salvos completos.

## Alterações

### `supabase/functions/sync-meta/index.ts` (reescrita da lógica de fetch)

1. **Gerar array de 30 datas** (últimos 30 dias)
2. **Para cada dia**: fazer requisição individual com `time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` e campos simplificados conforme pedido:
   - `fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,action_values,inline_link_clicks`
   - `level=adset`
   - Sem `action_types` (filtrar server-side)
3. **Extrair actions server-side**: do array `actions`, pegar `link_click`, `purchase`, `onsite_conversion.messaging_conversation_started_7d`, `add_to_cart`, `offsite_conversion.fb_pixel_custom`, `lead`
4. **Se um dia falhar**: buscar sem `actions` para esse dia (métricas básicas), marcar como parcial
5. **Retry dos dias parciais**: ao final, tentar novamente os dias que falharam (1 tentativa extra)
6. **Persistência**: deletar `source='meta'` e inserir tudo de uma vez (mesmo padrão atual)
7. **Registrar status**: se houve dias parciais, salvar `error_message` com aviso ("X dias sem dados de conversão") sem marcar como erro

### `src/components/dashboard/MarketingSection.tsx` (sem mudança funcional)

O aviso de "Sem dados de Meta" já existe. Nenhuma alteração necessária no frontend pois os dados chegarão nos mesmos campos.

### Sem alteração de banco de dados.

## Resultado esperado

- Purchases, messages, add_to_cart, remarketing populados corretamente nos cards
- Se a Meta falhar em dias específicos, os outros dias ainda terão dados completos
- Logs claros mostrando quais dias tiveram actions e quais não

