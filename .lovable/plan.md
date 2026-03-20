

# Corrigir data de venda dos ingressos Sympla

## Problema

O campo `sold_at` é preenchido com `order_approved_date || order_date`. A data de aprovação do pagamento pode ser dias após a compra (ex: boleto, PIX pendente). O dashboard do Sympla usa a data do pedido (`order_date`), não da aprovação.

Resultado: ingressos comprados em dias anteriores mas aprovados depois inflam os números do dia da aprovação.

Evidência: no dia 19/03, 9 ingressos (IDs 306291310–306291318) foram comprados antes mas aprovados às 05:38 do dia 19, junto com um outro (306537453). Removendo esses ~17 ingressos "deslocados", o número se aproxima dos 12 que o Sympla mostra.

## Correção

### `supabase/functions/sync-sympla/index.ts`

Inverter a prioridade: usar `order_date` como primário e `order_approved_date` como fallback:

```typescript
// De:
sold_at: p.order_approved_date || p.order_date || null,

// Para:
sold_at: p.order_date || p.order_approved_date || null,
```

### Re-sincronização

Após o deploy, acionar a sincronização manualmente para atualizar todos os registros existentes com a data correta (o upsert por `sympla_order_id` vai sobrescrever os valores antigos).

