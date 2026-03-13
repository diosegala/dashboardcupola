

# Meta Ads — Novas métricas e correção de compras (Plano Revisado)

## Análise

Confirmado que o `actions` retorna `{"action_type": "purchase", "value": "12"}` — o código atual já extrai corretamente pelo `action_type === "purchase"`. O problema é que o campo `actions` causa erro 500 na API do Meta (code 1, subcode 99), e o fallback descarta todas as actions, zerando compras e impedindo as novas métricas.

Da documentação do Meta Pixel, os standard events relevantes são:
- **Purchase** → `action_type: "purchase"`
- **AddToCart** → `action_type: "add_to_cart"`
- **Mensagens** → `action_type: "onsite_conversion.messaging_conversation_started_7d"`
- **Remarketing Qualificado** → Conversão customizada, aparece como `offsite_conversion.custom.<ID>`. Precisamos descobrir o ID.

## Etapas

### 1. Migração — adicionar colunas em `ad_metrics`

```sql
ALTER TABLE public.ad_metrics
  ADD COLUMN IF NOT EXISTS messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_to_cart integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remarketing_qualified integer DEFAULT 0;
```

### 2. Corrigir o fetch de `actions` no `sync-meta/index.ts`

O problema: quando `actions` é incluído junto com os outros campos, a API retorna 500. A solução é fazer **duas requests separadas**:
1. Request principal: campos inline (impressions, clicks, spend, etc.) — já funciona
2. Request secundária: apenas `actions` — com retry e tratamento de erro independente

Isso garante que as métricas base sempre são salvas, e as actions são adicionadas quando disponíveis.

Além disso, **logar todos os `action_type` únicos** encontrados para que possamos identificar o action_type exato do "Remarketing Qualificado" (conversão customizada).

### 3. Extrair novas métricas das actions

```typescript
const actions: any[] = r.actions || [];
const findAction = (type: string) => 
  parseInt(actions.find(a => a.action_type === type)?.value || "0") || 0;

const purchases = findAction("purchase");
const messages = findAction("onsite_conversion.messaging_conversation_started_7d");
const addToCart = findAction("add_to_cart");
// Remarketing: logar todos os types para descobrir o ID correto
// Inicialmente tentar buscar por substring "remarketing" nos action_types
```

### 4. Atualizar `MarketingSection.tsx`

Adicionar 3 novos MetricCards na seção Meta Ads:
- **Mensagens** — total do campo `messages`
- **Adição de Carrinho** — total do campo `add_to_cart`
- **Remarketing Qualificado** — total do campo `remarketing_qualified`

### Observação sobre Remarketing Qualificado

Conversões customizadas no Meta aparecem como `offsite_conversion.custom.<ID_NUMÉRICO>`. Sem saber o ID exato, vou implementar um **log de todos os action_types** encontrados durante o sync. Após a próxima sincronização, poderemos ver nos logs qual é o action_type correto e mapear para a coluna `remarketing_qualified`.

