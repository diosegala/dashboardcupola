-- Patrocínios: mantém a sincronização do Pipedrive funcionando sem mexer no código da função (05/11/2026).
-- Rodar inteiro no editor SQL do Lovable, ANTES das partes da carga inicial. Não apaga dados.
--
-- Problema: a função sync-pipedrive monta a data "atualizados desde" com milissegundos (…:00.000Z) e o Pipedrive
-- recusa (erro 400). Ela monta essa data na memória, no começo de cada rodada nova.
-- Solução no banco: sempre que a função grava o estado da sincronização, esta regra
--   1) tira os milissegundos das datas guardadas;
--   2) quando uma rodada termina (a função apaga a "rodada em andamento"), já deixa a próxima rodada preparada,
--      com a data no formato certo. A função usa a rodada preparada em vez de montar uma nova com milissegundos.
-- Quando o item 8 do pedido ao Lovable for feito, esta regra pode ficar: ela continua correta.

CREATE OR REPLACE FUNCTION public.crm_sync_state_normaliza()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  desde text;
  funis jsonb;
  estrutura boolean;
BEGIN
  IF NEW.cursors IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Datas sem milissegundos.
  IF NEW.cursors ? 'deals' AND NEW.cursors ->> 'deals' ~ '\.\d+(Z|\+00:00)$' THEN
    NEW.cursors := jsonb_set(NEW.cursors, '{deals}', to_jsonb(regexp_replace(NEW.cursors ->> 'deals', '\.\d+(Z|\+00:00)$', 'Z')));
  END IF;
  IF jsonb_typeof(NEW.cursors -> 'work') = 'object' AND (NEW.cursors #>> '{work,since}') ~ '\.\d+(Z|\+00:00)$' THEN
    NEW.cursors := jsonb_set(NEW.cursors, '{work,since}', to_jsonb(regexp_replace(NEW.cursors #>> '{work,since}', '\.\d+(Z|\+00:00)$', 'Z')));
  END IF;

  -- 2) Rodada terminou: prepara a próxima com a data certa (2 minutos antes do fim da última, para não perder nada).
  IF (NEW.cursors -> 'work' IS NULL OR jsonb_typeof(NEW.cursors -> 'work') = 'null') AND NEW.cursors ? 'deals' THEN
    desde := to_char(((NEW.cursors ->> 'deals')::timestamptz - interval '2 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    SELECT coalesce(jsonb_agg(DISTINCT (p ->> 'pipeline_pd_id')::bigint), '[]'::jsonb)
      INTO funis
      FROM public.sponsorship_config c, jsonb_array_elements(c.pipelines) p
     WHERE c.crm_account = NEW.crm_account;
    -- Etapas, produtos e usuários são relidos uma vez por dia.
    estrutura := NOT (NEW.cursors ? 'structure_at') OR (NEW.cursors ->> 'structure_at')::timestamptz < now() - interval '24 hours';
    NEW.cursors := jsonb_set(NEW.cursors, '{work}', jsonb_build_object(
      'started', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'structure', estrutura,
      'phase', 'structure',
      'step', 0,
      'seen', '[]'::jsonb,
      'pipeline', 0,
      'mode', 0,
      'since', desde,
      'initial', false,
      'pipelines', funis,
      'pending', '[]'::jsonb,
      'leadMode', 0
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_sync_state_normaliza ON public.crm_sync_state;
CREATE TRIGGER crm_sync_state_normaliza
BEFORE INSERT OR UPDATE ON public.crm_sync_state
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_state_normaliza();

-- Conferência: deve listar a regra crm_sync_state_normaliza.
SELECT tgname AS regra FROM pg_trigger WHERE tgrelid = 'public.crm_sync_state'::regclass AND NOT tgisinternal;
