

# Correção da Integração Meta Ads — Request Unificado

## Problema

A requisição separada para `actions` retorna consistentemente erro 500 (code 1, subcode 99). A abordagem de duas requests não está funcionando.

## Solução

Seguir exatamente o formato especificado pelo usuário: **uma única request** com `actions` e `action_values` incluídos nos fields, nível `adset`, e `date_preset=last_30d`.

## Mudanças no `sync-meta/index.ts`

### Reestruturar a request

Substituir as duas requests (base + actions) por uma única:

```
GET /act_{id}/insights
  ?fields=campaign_name,adset_name,impressions,clicks,spend,actions,action_values
  &level=adset
  &date_preset=last_30d
  &access_token={token}
```

Mudanças específicas:
- **Remover** a request B separada de actions e todo o actionsMap
- **Unificar** em uma única request com todos os campos
- **Mudar nível** de `campaign` para `adset`
- **Usar `date_preset=last_30d`** em vez de `time_range` manual
- **Remover `time_increment=1`** (não necessário com date_preset)
- **Adicionar `action_values`** nos fields
- **Remover campos inline** (`inline_link_clicks`, etc.) — dados virão do array `actions`
- **Log completo** da URL antes de enviar (mascarando o token)

### Extrair actions no servidor

Após receber a resposta, filtrar do array `actions` apenas:
- `link_click` → link_clicks
- `purchase` → purchases
- `lead` → (logar para referência)
- `onsite_conversion.messaging_conversation_started_7d` → messages
- `add_to_cart` → add_to_cart

Também logar todos os `action_type` únicos para identificar o remarketing qualificado.

### Ajustar upsert

Como agora os dados vêm por `adset`, o `onConflict` precisa ser ajustado. Os dados serão agrupados por adset em vez de campaign. Mapear:
- `campaign_name` → campaign_name
- `adset_name` → ad_set_name (campo já existe na tabela)
- Derivar `campaign_id` e `ad_set_id` dos dados retornados (adicionar esses fields)

Fields finais: `campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,action_values`

### Verificações

- Ad Account ID com prefixo `act_` (já implementado)
- API versão v22.0 (já superior a v19.0) ✓
- Token permissions: não verificável em código, mas o log facilitará debug

## Não é necessário

- Mudanças no banco (colunas já existem)
- Mudanças no frontend

