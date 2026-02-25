

# Adicionar sync automatico do Sympla via cron job

## Situacao atual

A funcao `sync-sympla` ja existe e funciona, mas so e executada manualmente pelo botao "Sincronizar" na pagina de integracoes. Nao ha nenhum cron job configurado.

## O que sera feito

Configurar um cron job no banco de dados que chama a funcao `sync-sympla` automaticamente a cada 15 minutos, conforme definido na estrategia do projeto.

## Passos

### 1. Habilitar extensoes `pg_cron` e `pg_net`

Criar uma migracao SQL para habilitar as duas extensoes necessarias:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### 2. Criar o cron job

Usar um INSERT direto (nao migracao, pois contem dados especificos do projeto como URL e anon key) para agendar a chamada HTTP POST a cada 15 minutos:

```sql
SELECT cron.schedule(
  'sync-sympla-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nrgptrxuvxuqdmehpili.supabase.co/functions/v1/sync-sympla',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Isso fara com que a funcao `sync-sympla` seja invocada automaticamente a cada 15 minutos, mantendo os dados de ingressos do Sympla sempre atualizados no dashboard.

### Observacao sobre autenticacao

A funcao `sync-sympla` ja tem `verify_jwt = false` no `config.toml`, e o codigo interno so valida auth quando recebe um header `Authorization` com token de usuario. Chamadas do cron com o anon key passarao pela verificacao sem problemas, pois o auth check e feito com `userClient.auth.getUser()` que retornara erro, mas como o fluxo continua normalmente apos o bloco de auth (nao ha `return` obrigatorio em caso de ausencia de header), a sincronizacao executara com sucesso.

## Arquivos alterados

Nenhum arquivo de codigo sera alterado. Apenas comandos SQL serao executados no banco de dados.

