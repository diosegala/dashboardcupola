

# Corrigir sincronização do RD Station travada

## Problema identificado

A integração do RD Station está com status "syncing" preso desde 27/02 por dois motivos:

1. **Timeout do edge function**: Os retries do rate limit esperam 30-90 segundos, mas edge functions possuem timeout de ~60 segundos. A função "morre" antes de conseguir atualizar o status de volta.
2. **Sem cron job configurado**: Diferente das outras integrações, o RD Station não tem agendamento automático. Quando o status ficou travado em "syncing", nenhuma nova tentativa foi disparada.

## Plano de correção

### 1. Resetar o status travado no banco
Executar uma migration para atualizar o status de "syncing" para "idle", liberando a integração.

### 2. Reescrever a lógica de retry da edge function
- Remover delays longos (30-90s) que excedem o timeout
- Usar retry rápido: no máximo 2 tentativas com delay de 2-3 segundos
- Se receber 429, parar imediatamente e salvar o que já foi coletado (sincronização parcial)
- Reduzir pageSize para 10 para diminuir chance de rate limit

### 3. Adicionar verificacao de status travado
No inicio da funcao, se o status for "syncing" e o `updated_at` for mais antigo que 5 minutos, resetar automaticamente para "idle" antes de iniciar.

### 4. Criar cron job para o RD Station
Adicionar agendamento a cada 15 minutos, igual as demais integrações.

## Detalhes tecnicos

### Migration SQL
- UPDATE integrations SET sync_status = 'idle', error_message = 'Reset: status travado' WHERE name = 'rd_station' AND sync_status = 'syncing'
- Criar cron job: `SELECT cron.schedule('sync-rd-station-every-15min', '*/15 * * * *', ...)`

### Edge function (sync-rd-station/index.ts)
- Adicionar check de staleness no inicio (se syncing por mais de 5min, resetar)
- Retry: max 2 tentativas, delay de 2s entre elas
- Se 429: parar paginacao, salvar dados parciais, retornar status "idle" com mensagem informativa
- Garantir que o bloco catch sempre atualiza o status para "error"

