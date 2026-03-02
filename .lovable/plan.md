

# Reduzir frequencia do cron do RD Station e adicionar cooldown

## Problema

O cron do RD Station executa a cada 15 minutos, mas o rate limit da API do RD Station tem uma janela mais longa. Os logs mostram que a maioria das execucoes recebe 429 na primeira pagina e retorna 0 campanhas. Isso gera ruido nos logs e chamadas desnecessarias.

## Solucao

### 1. Alterar frequencia do cron de 15 para 60 minutos
Executar uma migration SQL para atualizar o cron job existente:
```text
cron.unschedule('sync-rd-station-every-15min')
cron.schedule('sync-rd-station-every-60min', '0 * * * *', ...)
```

### 2. Adicionar cooldown na edge function
No inicio da funcao, antes de fazer qualquer chamada a API, verificar `last_synced_at`. Se a ultima sincronizacao bem-sucedida foi ha menos de 30 minutos, pular a execucao (retornar `skipped: true`). Isso evita chamadas desnecessarias quando o cron dispara logo apos uma sync parcial ou completa.

### 3. Resetar status atual se necessario
Verificar e resetar o status da integracao se estiver em estado de erro por rate limit.

## Detalhes tecnicos

### Migration SQL
- Remover cron `sync-rd-station-every-15min`
- Criar cron `sync-rd-station-every-60min` com schedule `0 * * * *`

### Edge function (sync-rd-station/index.ts)
- Adicionar check de cooldown apos carregar a integracao:
  - Se `last_synced_at` existe e tem menos de 30 minutos, retornar `{ skipped: true, reason: "Recently synced" }`
- Manter toda a logica existente de staleness check, retry e dedup

