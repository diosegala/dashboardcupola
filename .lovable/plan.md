

# Reverter RD Station para OAuth

## Mudanca

No `src/components/integrations/CredentialsForm.tsx`, substituir o campo unico `api_token` do RD Station pelos 3 campos OAuth originais:

| Campo | Label |
|---|---|
| `client_id` | Client ID |
| `client_secret` | Client Secret |
| `refresh_token` | Refresh Token |

## Detalhes tecnicos

Alterar a chave `rd_station` no objeto `FIELDS` de:

```text
api_token -> "API Token (Token Privado)"
```

Para:

```text
client_id    -> "Client ID"
client_secret -> "Client Secret"
refresh_token -> "Refresh Token"
```

Apenas uma alteracao no arquivo `src/components/integrations/CredentialsForm.tsx`. Nenhum outro arquivo precisa ser modificado.

