-- Patrocínios: destrava a sincronização do Pipedrive que parou com "Pipedrive respondeu 400" (05/11/2026).
-- Rodar inteiro no editor SQL do Lovable. Não apaga dados.
--
-- A sincronização busca os negócios ganhos e perdidos "atualizados desde" uma data. A data foi gravada com
-- milissegundos (2025-05-05T00:00:00.000Z) e o Pipedrive só aceita sem eles (2025-05-05T00:00:00Z).
-- Isto corrige a data guardada no ponto em que a sincronização parou; na próxima rodada ela continua dali.
UPDATE public.crm_sync_state
SET cursors = jsonb_set(cursors, '{work,since}', to_jsonb(regexp_replace(cursors #>> '{work,since}', '\.\d+Z$', 'Z'))),
    last_error = NULL,
    last_started_at = NULL
WHERE crm_account = 'cupola'
  AND cursors #>> '{work,since}' IS NOT NULL;

-- Conferência: a data deve aparecer sem os milissegundos.
SELECT crm_account, cursors #>> '{work,since}' AS desde, cursors #>> '{work,phase}' AS fase
FROM public.crm_sync_state;
