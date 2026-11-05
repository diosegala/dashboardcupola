-- Patrocínios: carga inicial só da edição atual (05/11/2026). Rodar inteiro no editor SQL do Lovable. Não apaga dados.
--
-- A sincronização grava os negócios um por um e o servidor corta a chamada em 150 segundos (cerca de 230 negócios).
-- O Pipedrive entrega 500 por página e a sincronização só guarda o ponto ao fim da página, então ela recomeçava
-- sempre na mesma página. Isto faz a busca começar no primeiro dia da edição atual (dia seguinte ao fim do Summit 2026),
-- com bem menos negócios, e libera uma nova rodada na hora (sem esperar os 10 minutos da trava).
-- A edição anterior inteira (Renovação e Comparar) entra depois do ajuste de código (item 9 do pedido ao Lovable).
UPDATE public.crm_sync_state
SET cursors = jsonb_set(
      jsonb_set(cursors #- '{work,cursor}' #- '{work,nextCursor}' #- '{work,pageDone}', '{work,since}', to_jsonb('2026-05-22T00:00:00Z'::text)),
      '{work,pending}', '[]'::jsonb),
    last_error = NULL,
    last_started_at = NULL
WHERE crm_account = 'cupola'
  AND cursors #>> '{work,phase}' = 'deals';

UPDATE public.integrations SET sync_status = 'idle', error_message = NULL WHERE name = 'pipedrive';

-- Conferência: desde = 2026-05-22T00:00:00Z, fase = deals, sem trava (inicio vazio).
SELECT crm_account, cursors #>> '{work,since}' AS desde, cursors #>> '{work,phase}' AS fase, last_started_at AS inicio
FROM public.crm_sync_state;
