

# Métricas do Meta em Branco — Dados Antigos Sem Actions

## Diagnóstico

Os dados na tabela `ad_metrics` foram sincronizados **antes** da correção que extrai actions (purchases, messages, add_to_cart, remarketing_qualified). Todos os registros atuais mostram esses campos como 0.

Além disso, os registros antigos têm `ad_set_id: ""` (sincronizados no nível campaign), enquanto uma nova sincronização criará registros com `ad_set_id` preenchido (nível adset). Isso resultaria em **duplicação** — registros antigos com 0s + registros novos com dados reais — distorcendo os totais.

## Solução

Duas mudanças no `sync-meta/index.ts`:

1. **Limpar dados antigos antes do upsert** — adicionar um `DELETE` dos registros `source = 'meta'` antes de inserir os novos dados. Isso garante que não haja duplicação entre os formatos antigo (campaign-level, ad_set_id vazio) e novo (adset-level, ad_set_id preenchido).

2. **Trocar upsert por insert** — como os dados antigos são deletados primeiro, não há necessidade de `onConflict`. Usar `insert` simples em chunks.

### Código

No trecho após o fetch e antes do batch insert:
```typescript
// Delete old meta data before inserting fresh data
const { error: delError } = await supabase
  .from("ad_metrics")
  .delete()
  .eq("source", "meta");
if (delError) throw delError;
```

Depois, trocar `.upsert(chunk, { onConflict: ... })` por `.insert(chunk)`.

Isso resolve tanto o problema dos dados zerados quanto elimina definitivamente o erro de `ON CONFLICT`.

### Após a mudança

O usuário precisa rodar uma nova sincronização do Meta para popular os dados corretos.

