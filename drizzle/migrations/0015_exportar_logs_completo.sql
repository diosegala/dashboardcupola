DROP FUNCTION IF EXISTS public.exportar_logs(jsonb);

-- Exportação: o próprio servidor grava "log.exportado" antes de devolver as linhas (numa só resposta, sem corte de 1000).
CREATE FUNCTION public.exportar_logs(f jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores exportam os logs' USING ERRCODE = '42501'; END IF;
  SELECT least(count(*), 20000) INTO n FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'));
  PERFORM public._log_inserir('log.exportado', 'operacao', 'logs_atividade', NULL, 'Exportação do log (' || n || ' linhas)', 'Logs', NULL,
    NULL, jsonb_build_object('filtros', coalesce(f, '{}'), 'linhas', n), '{}', 'sucesso', NULL, n);
  SELECT coalesce(jsonb_agg(to_jsonb(s) - 'dados_antes' - 'dados_depois' ORDER BY s.ocorrido_em DESC, s.id DESC), '[]'::jsonb) INTO r
  FROM (SELECT * FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'))
        ORDER BY l.ocorrido_em DESC, l.id DESC LIMIT 20000) s;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.exportar_logs(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportar_logs(jsonb) TO authenticated;