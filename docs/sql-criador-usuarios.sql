-- Quem criou cada usuário, para quem já existe no app.
-- Daqui para frente o convite grava isso sozinho (invite-user). Este SQL preenche os antigos
-- a partir do histórico de convites do próprio Supabase (auth.audit_log_entries).
-- Pedir no chat do Lovable para rodar os dois passos, nesta ordem.

-- Passo 1 (só leitura): quantos convites antigos o histórico ainda tem.
SELECT count(*) AS convites_no_historico
FROM auth.audit_log_entries
WHERE payload->>'action' = 'user_invited';

-- Passo 2: grava o admin que convidou em cada conta que ainda não tem esse registro.
UPDATE auth.users u
SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('invited_by', c.actor_id)
FROM (
  SELECT DISTINCT ON (lower(payload->'traits'->>'user_email'))
         lower(payload->'traits'->>'user_email') AS email,
         payload->>'actor_id' AS actor_id
  FROM auth.audit_log_entries
  WHERE payload->>'action' = 'user_invited'
    AND payload->>'actor_id' IS NOT NULL
  ORDER BY lower(payload->'traits'->>'user_email'), created_at
) c
WHERE lower(u.email) = c.email
  AND NOT (coalesce(u.raw_app_meta_data, '{}'::jsonb) ? 'invited_by')
  AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = c.actor_id);
