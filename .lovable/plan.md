

# Simplificar integração RD Station para API Token

## Mudança

No arquivo `src/components/integrations/CredentialsForm.tsx`, substituir os 3 campos OAuth do RD Station (`client_id`, `client_secret`, `refresh_token`) por um único campo:

| Campo | Label |
|---|---|
| `api_token` | API Token (Token Privado) |

## Detalhes técnicos

Alterar o objeto `FIELDS` na chave `rd_station` de:
```text
client_id, client_secret, refresh_token
```
Para:
```text
api_token -> "API Token (Token Privado)"
```

Apenas uma linha precisa mudar no `CredentialsForm.tsx`. Nenhuma outra alteração é necessária, pois o campo é salvo como JSON genérico na coluna `credentials` da tabela `integrations`.

Quando a edge function de sync do RD Station for implementada no futuro, ela usará `credentials.api_token` para autenticar via header `Authorization: Bearer {token}` na API v2 do RD Station.

