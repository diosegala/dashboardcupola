-- Tabela nova no painel já nasce com o gatilho de auditoria (modo linha até ser classificada).
CREATE OR REPLACE FUNCTION public.auditoria_tabela_nova()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_nome text;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public' LOOP
    SELECT relname INTO v_nome FROM pg_class WHERE oid = r.objid;
    IF v_nome IS NOT NULL THEN
      BEGIN
        PERFORM public.auditoria_ligar(v_nome);
      EXCEPTION WHEN others THEN
        PERFORM public._log_erro(v_nome, 'CREATE TABLE', 'Não foi possível ligar a auditoria: ' || SQLERRM);
      END;
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.auditoria_tabela_nova() FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS auditoria_tabela_nova;
CREATE EVENT TRIGGER auditoria_tabela_nova ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auditoria_tabela_nova();