CREATE OR REPLACE FUNCTION public.logs_resumo(f jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores veem os logs' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'total', count(*),
    'exclusoes', count(*) FILTER (WHERE l.acao LIKE '%.excluido'),
    'permissoes', count(*) FILTER (WHERE l.categoria = 'permissao'),
    'falhas', count(*) FILTER (WHERE l.resultado = 'erro'))
  INTO r FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'));
  RETURN r;
END $$;